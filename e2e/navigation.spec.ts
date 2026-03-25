import { test, expect } from '@playwright/test';

const uniqueEmail = () => `e2e-nav-${Date.now()}@test.com`;
const TEST_PASSWORD = 'Test1234';
const API_BASE = 'http://localhost:3001';

test.describe('Navigation — Unauthenticated', () => {
  test('landing page is accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('EV Bike')).toBeVisible();
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('register page is accessible', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('/home redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('/rides redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/rides');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('/admin redirects when unauthenticated', async ({ page }) => {
    await page.goto('/admin');
    // Should redirect to login or landing
    await expect(page).not.toHaveURL(/\/admin/);
  });
});

test.describe('Navigation — Authenticated User', () => {
  const email = uniqueEmail();

  test.beforeAll(async ({ request }) => {
    // Register user via API
    await request.post(`${API_BASE}/api/auth/register`, {
      data: { name: 'E2E Nav User', email, password: TEST_PASSWORD },
    });
  });

  test('/home shows map for authenticated user', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Map or list view should be visible
    await expect(
      page.getByText(/map view/i).or(page.getByText(/list view/i))
    ).toBeVisible();
  });

  test('main nav links are present', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Check nav links
    await expect(page.getByRole('link', { name: /map/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /my rides/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /payment/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /plan/i })).toBeVisible();
  });

  test('navigate to My Rides page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    await page.getByRole('link', { name: /my rides/i }).click();
    await expect(page).toHaveURL(/\/rides/);
  });

  test('navigate to Payment Methods page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    await page.getByRole('link', { name: /payment/i }).click();
    await expect(page).toHaveURL(/\/settings\/payments/);
  });

  test('navigate to Subscription page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    await page.getByRole('link', { name: /plan/i }).click();
    await expect(page).toHaveURL(/\/settings\/subscription/);
  });

  test('admin link is not visible for regular users', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Admin link should not be visible for non-admin user
    await expect(page.getByRole('link', { name: /admin/i })).not.toBeVisible();
  });
});

test.describe('Navigation — Admin User', () => {
  const adminEmail = `e2e-nav-admin-${Date.now()}@test.com`;

  test.beforeAll(async ({ request }) => {
    // Register and promote to admin via API
    const regRes = await request.post(`${API_BASE}/api/auth/register`, {
      data: { name: 'E2E Admin Nav', email: adminEmail, password: TEST_PASSWORD },
    });
    const cookies = regRes.headers()['set-cookie'] ?? '';

    const meRes = await request.get(`${API_BASE}/api/auth/me`, {
      headers: { cookie: cookies },
    });
    const me = await meRes.json();
    const userId = me.user?.id ?? me.id;

    await request.put(`${API_BASE}/api/admin/users/${userId}/role`, {
      headers: { cookie: cookies, 'content-type': 'application/json' },
      data: { role: 'admin' },
    });
  });

  test('admin link is visible for admin users', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    await expect(page.getByRole('link', { name: /admin/i })).toBeVisible();
  });

  test('admin can navigate to admin dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    await page.getByRole('link', { name: /admin/i }).click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(
      page.getByText(/fleet overview/i).or(page.getByText(/total bikes/i))
    ).toBeVisible({ timeout: 10000 });
  });
});
