import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const uniqueEmail = () => `e2e-ride-${Date.now()}@test.com`;
const TEST_PASSWORD = 'Test1234';
const TEST_NAME = 'E2E Ride User';
const API_BASE = 'http://localhost:3001';

async function registerAndLogin(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Name').fill(TEST_NAME);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel('Confirm Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
}

async function ensureStationWithBike(request: APIRequestContext, cookies: string) {
  // Create a station via admin API
  const stationRes = await request.post(`${API_BASE}/api/admin/stations`, {
    headers: { cookie: cookies, 'content-type': 'application/json' },
    data: {
      name: `E2E Station ${Date.now()}`,
      address: '123 Test St, San Francisco, CA',
      lat: 37.7749,
      lng: -122.4194,
      dockCapacity: 10,
    },
  });
  const station = await stationRes.json();

  // Add a bike to the station
  const bikeRes = await request.post(`${API_BASE}/api/admin/bikes`, {
    headers: { cookie: cookies, 'content-type': 'application/json' },
    data: {
      serialNumber: `E2E-BIKE-${Date.now()}`,
      model: 'E2E Test Bike',
      stationId: station.station?.id ?? station.id,
      batteryLevel: 95,
    },
  });
  const bike = await bikeRes.json();

  return {
    stationId: station.station?.id ?? station.id,
    stationName: station.station?.name ?? station.name,
    bikeId: bike.bike?.id ?? bike.id,
  };
}

async function makeAdmin(request: APIRequestContext, email: string) {
  // Register an admin user
  const regRes = await request.post(`${API_BASE}/api/auth/register`, {
    data: { name: 'E2E Admin', email, password: TEST_PASSWORD },
  });
  const cookies = regRes.headers()['set-cookie'] ?? '';

  // Get user info
  const meRes = await request.get(`${API_BASE}/api/auth/me`, {
    headers: { cookie: cookies },
  });
  const me = await meRes.json();
  const userId = me.user?.id ?? me.id;

  // Promote to admin (need to use same cookies)
  await request.put(`${API_BASE}/api/admin/users/${userId}/role`, {
    headers: { cookie: cookies, 'content-type': 'application/json' },
    data: { role: 'admin' },
  });

  return cookies;
}

test.describe('Full Ride Lifecycle', () => {
  let email: string;
  let adminEmail: string;

  test.beforeAll(() => {
    email = uniqueEmail();
    adminEmail = `e2e-admin-ride-${Date.now()}@test.com`;
  });

  test('register and add a payment method', async ({ page }) => {
    await registerAndLogin(page, email);

    // Navigate to payment methods
    await page.getByRole('link', { name: /payment/i }).click();
    await expect(page).toHaveURL(/\/settings\/payments/, { timeout: 10000 });

    // Fill and submit the add card form
    await page.getByLabel(/last 4/i).fill('4242');
    await page.getByLabel(/brand/i).selectOption('visa');
    await page.getByLabel(/month/i).fill('12');
    await page.getByLabel(/year/i).fill('2028');
    await page.getByRole('button', { name: /add card/i }).click();

    // Verify card appears in list
    await expect(page.getByText('4242')).toBeVisible({ timeout: 5000 });
  });

  test('view station with bikes on home page', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Switch to list view to see stations
    const listViewBtn = page.getByText(/list view/i);
    if (await listViewBtn.isVisible()) {
      await listViewBtn.click();
    }

    // Wait for stations to load — at least one station row should appear
    await expect(
      page.getByRole('row').or(page.getByText(/station/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('unlock a bike and start a ride', async ({ page, request }) => {
    // Setup: create admin, station, and bike via API
    const adminCookies = await makeAdmin(request, adminEmail);
    const { bikeId } = await ensureStationWithBike(request, adminCookies);

    // Login as regular user
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Navigate to unlock page for the bike
    await page.goto(`/unlock/${bikeId}`);

    // Should see unlock page with pricing info
    await expect(page.getByText(/\$1\.00/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/\$0\.15/)).toBeVisible();

    // Click unlock
    await page.getByRole('button', { name: /unlock bike/i }).click();

    // Confirm in dialog if present
    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Should redirect to active ride page
    await expect(page).toHaveURL(/\/ride\/active/, { timeout: 10000 });
  });

  test('active ride shows timer and end ride controls', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Navigate to active ride
    await page.goto('/ride/active');

    // Verify active ride elements
    await expect(page.getByRole('button', { name: /end ride/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('end ride and view summary', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Go to active ride
    await page.goto('/ride/active');

    // Select return station if dropdown is available
    const stationDropdown = page.getByLabel(/return station/i).or(page.getByRole('combobox'));
    if (await stationDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await stationDropdown.selectOption({ index: 1 });
    }

    // End ride
    await page.getByRole('button', { name: /end ride/i }).click();

    // Confirm if needed
    const confirmBtn = page.getByRole('button', { name: /confirm/i });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Should see ride summary
    await expect(
      page.getByText(/completed/i).or(page.getByText(/ride summary/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('ride history shows the completed ride', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Navigate to ride history
    await page.getByRole('link', { name: /my rides/i }).click();
    await expect(page).toHaveURL(/\/rides/, { timeout: 10000 });

    // Should show at least one ride
    await expect(page.getByText(/completed/i).or(page.getByText(/\$/i))).toBeVisible({
      timeout: 10000,
    });
  });
});
