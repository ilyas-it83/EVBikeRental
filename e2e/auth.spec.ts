import { test, expect, type Page } from '@playwright/test';

const uniqueEmail = () => `e2e-auth-${Date.now()}@test.com`;
const TEST_PASSWORD = 'Test1234';
const TEST_NAME = 'E2E Auth User';

async function registerUser(page: Page, name: string, email: string, password: string) {
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
}

test.describe('Authentication Flow', () => {
  let email: string;

  test.beforeAll(() => {
    email = uniqueEmail();
  });

  test('landing page shows hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('EV Bike')).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });

  test('navigate to register from landing page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('register a new user', async ({ page }) => {
    await registerUser(page, TEST_NAME, email, TEST_PASSWORD);
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
  });

  test('home page shows map or station list', async ({ page }) => {
    // Login first since tests are sequential but not sharing page state
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Verify home page content
    await expect(
      page.getByText(/map view/i).or(page.getByText(/list view/i))
    ).toBeVisible();
  });

  test('logout redirects to login', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Logout
    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('WrongPassword99');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('register form validates required fields', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText(/email is required/i).or(page.getByText(/name/i))).toBeVisible();
  });

  test('register form validates password requirements', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Name').fill('Test');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm Password').fill('short');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(
      page.getByText(/at least 8 characters/i).or(page.getByText(/letter and.*number/i))
    ).toBeVisible();
  });

  test('register form validates password match', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Name').fill('Test');
    await page.getByLabel('Email').fill('mismatch@example.com');
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel('Confirm Password').fill('Different1234');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});
