import { test, expect, type APIRequestContext } from '@playwright/test';

const TEST_PASSWORD = 'Test1234';
const API_BASE = 'http://localhost:3001';

async function createAdminUser(request: APIRequestContext, email: string) {
  // Register the user via API
  const regRes = await request.post(`${API_BASE}/api/auth/register`, {
    data: { name: 'E2E Admin', email, password: TEST_PASSWORD },
  });
  const cookies = regRes.headers()['set-cookie'] ?? '';

  // Get user ID
  const meRes = await request.get(`${API_BASE}/api/auth/me`, {
    headers: { cookie: cookies },
  });
  const me = await meRes.json();
  const userId = me.user?.id ?? me.id;

  // Promote to admin — this may fail if user is first admin (bootstrap problem).
  // Try the endpoint; if it 403s the user may already need to be seeded as admin.
  await request.put(`${API_BASE}/api/admin/users/${userId}/role`, {
    headers: { cookie: cookies, 'content-type': 'application/json' },
    data: { role: 'admin' },
  });

  return { email, cookies, userId };
}

async function loginViaUI(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
}

test.describe('Admin Dashboard Flows', () => {
  const adminEmail = `e2e-admin-${Date.now()}@test.com`;

  test.beforeAll(async ({ request }) => {
    await createAdminUser(request, adminEmail);
  });

  test('admin can access fleet overview', async ({ page }) => {
    await loginViaUI(page, adminEmail, TEST_PASSWORD);

    // Navigate to admin
    await page.getByRole('link', { name: /admin/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Fleet overview stats should be visible
    await expect(
      page.getByText(/total bikes/i).or(page.getByText(/fleet overview/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('admin can navigate to station management', async ({ page }) => {
    await loginViaUI(page, adminEmail, TEST_PASSWORD);
    await page.goto('/admin/stations');

    await expect(
      page.getByText(/stations/i).or(page.getByText(/station management/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('admin can create a new station', async ({ page }) => {
    await loginViaUI(page, adminEmail, TEST_PASSWORD);
    await page.goto('/admin');

    // Click add station
    await page.getByRole('button', { name: /add station/i }).click();

    // Fill station form
    const nameInput = page.getByLabel(/name/i).first();
    await nameInput.fill(`E2E Station ${Date.now()}`);

    const addressInput = page.getByLabel(/address/i);
    if (await addressInput.isVisible()) {
      await addressInput.fill('456 Test Ave, San Francisco, CA');
    }

    const latInput = page.getByLabel(/lat/i);
    if (await latInput.isVisible()) {
      await latInput.fill('37.78');
    }

    const lngInput = page.getByLabel(/lng/i);
    if (await lngInput.isVisible()) {
      await lngInput.fill('-122.42');
    }

    const capacityInput = page.getByLabel(/capacity/i).or(page.getByLabel(/docks/i));
    if (await capacityInput.isVisible()) {
      await capacityInput.fill('10');
    }

    // Submit
    await page.getByRole('button', { name: /create|save|add|submit/i }).click();

    // Verify creation feedback (toast or station appearing in list)
    await expect(
      page.getByText(/created/i).or(page.getByText(/E2E Station/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('admin can navigate to bike management', async ({ page }) => {
    await loginViaUI(page, adminEmail, TEST_PASSWORD);
    await page.goto('/admin/bikes');

    await expect(
      page.getByText(/bikes/i).or(page.getByText(/bike management/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('admin can add a bike', async ({ page }) => {
    await loginViaUI(page, adminEmail, TEST_PASSWORD);
    await page.goto('/admin');

    // Click add bike button
    await page.getByRole('button', { name: /add bike/i }).click();

    // Fill bike form
    const serialInput = page.getByLabel(/serial/i);
    if (await serialInput.isVisible()) {
      await serialInput.fill(`E2E-${Date.now()}`);
    }

    const modelInput = page.getByLabel(/model/i);
    if (await modelInput.isVisible()) {
      await modelInput.fill('E2E Test Model');
    }

    // Select a station from dropdown if available
    const stationSelect = page.getByLabel(/station/i);
    if (await stationSelect.isVisible()) {
      await stationSelect.selectOption({ index: 1 });
    }

    // Submit
    await page.getByRole('button', { name: /create|save|add|submit/i }).click();

    await expect(
      page.getByText(/created/i).or(page.getByText(/E2E/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('admin can view user management', async ({ page }) => {
    await loginViaUI(page, adminEmail, TEST_PASSWORD);
    await page.goto('/admin/users');

    await expect(
      page.getByText(/users/i).or(page.getByText(/user management/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('admin can view analytics', async ({ page }) => {
    await loginViaUI(page, adminEmail, TEST_PASSWORD);
    await page.goto('/admin/analytics');

    await expect(
      page.getByText(/analytics/i).or(page.getByText(/revenue/i).or(page.getByText(/rides/i)))
    ).toBeVisible({ timeout: 10000 });
  });

  test('admin can view alerts', async ({ page }) => {
    await loginViaUI(page, adminEmail, TEST_PASSWORD);
    await page.goto('/admin/alerts');

    await expect(
      page.getByText(/alerts/i).or(page.getByText(/no alerts/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('admin sidebar navigation works', async ({ page }) => {
    await loginViaUI(page, adminEmail, TEST_PASSWORD);
    await page.goto('/admin');

    // Check all sidebar links are visible
    const sidebarLinks = [
      /fleet overview/i,
      /stations/i,
      /bikes/i,
      /users/i,
      /disputes/i,
      /analytics/i,
      /alerts/i,
    ];

    for (const linkText of sidebarLinks) {
      await expect(page.getByRole('link', { name: linkText })).toBeVisible();
    }

    // Back to App link
    await expect(page.getByRole('link', { name: /back to app/i })).toBeVisible();
  });
});
