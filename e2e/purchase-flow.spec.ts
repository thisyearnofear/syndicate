/**
 * E2E TEST — Purchase Flow
 *
 * Smoke test for the primary user journey:
 *   1. Load home page
 *   2. Click "Play Megapot" CTA
 *   3. See wallet connection prompt (or purchase modal if mocked connected)
 *   4. Verify modal structure renders without errors
 *
 * This test runs against a local dev server. Wallet connection and RPC
 * are not mocked in this initial setup — the test validates that the
 * UI renders correctly up to the point where a wallet signature is needed.
 */

import { test, expect } from '@playwright/test';

test.describe('Purchase Flow', () => {
  test('home page loads with Play/Grow/Coordinate CTAs', async ({ page }) => {
    await page.goto('/');

    // Verify the main heading renders
    await expect(page.locator('h1')).toContainText('Syndicate');

    // Verify the three primary CTAs exist
    await expect(page.getByRole('button', { name: /Coordinate Capital/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Grow with Yield/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Play Megapot/i })).toBeVisible();
  });

  test('clicking Play Megapot opens purchase modal', async ({ page }) => {
    await page.goto('/');

    // Click the Play Megapot button
    await page.getByRole('button', { name: /Play Megapot/i }).click();

    // Should see a dialog/modal appear (either wallet connect or purchase form)
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Modal should have recognizable purchase content
    const modalText = await dialog.textContent();
    expect(
      modalText?.includes('Connect') ||
      modalText?.includes('Participation') ||
      modalText?.includes('Ticket')
    ).toBeTruthy();
  });

  test('navigation shows all expected items', async ({ page }) => {
    await page.goto('/');

    // Desktop nav items
    await expect(page.getByTitle(/Buy Megapot/i).first()).toBeVisible();
    await expect(page.getByTitle(/Discover or create/i).first()).toBeVisible();
    await expect(page.getByTitle(/Put capital to work/i).first()).toBeVisible();
    await expect(page.getByTitle(/Move funds into/i).first()).toBeVisible();
  });

  test('bridge page loads and shows chain options', async ({ page }) => {
    await page.goto('/bridge');

    await expect(page.locator('h1')).toContainText('Bridge USDC to Base');

    // Should have chain selector buttons
    await expect(page.getByText('Solana')).toBeVisible();
    await expect(page.getByText('NEAR')).toBeVisible();
    await expect(page.getByText('Ethereum')).toBeVisible();
    await expect(page.getByText('Starknet')).toBeVisible();
  });

  test('product mode cards render with capability messaging', async ({ page }) => {
    await page.goto('/');

    // Look for the product modes section
    await expect(page.getByText('Three Ways To Use Syndicate')).toBeVisible();

    // Each mode card should have a CTA button
    const modeButtons = page.locator('button:has-text("Discover or create"), button:has-text("Explore strategies"), button:has-text("Buy tickets")');
    await expect(modeButtons).toHaveCount(3);
  });
});
