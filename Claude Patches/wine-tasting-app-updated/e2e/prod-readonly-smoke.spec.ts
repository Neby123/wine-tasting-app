import { expect, test } from '@playwright/test';

test.describe('Read-only smoke verification', () => {
  test('renders responsive application shell cleanly with zero mutating requests or console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const mutatingRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Strictly guarantee zero mutations against any live Supabase host regardless of config source
    await page.route('**/*.supabase.co/**', async (route) => {
      const method = route.request().method().toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        mutatingRequests.push(`${method} ${route.request().url()}`);
        await route.abort();
        return;
      }
      await route.continue();
    });

    const sbUrl = (process.env.PLAYWRIGHT_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const sbKey = (process.env.PLAYWRIGHT_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

    if (sbUrl && sbKey) {
      await page.addInitScript(
        ({ url, key }) => {
          localStorage.setItem('WINE_TASTING_SB_URL', url);
          localStorage.setItem('WINE_TASTING_SB_KEY', key);
        },
        { url: sbUrl, key: sbKey }
      );
    }

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Grand Taste Tourney/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Skip to main content/i })).toBeAttached();

    const nav = page.getByRole('navigation', { name: 'Primary sections' });
    const isConnected = await page.getByText(/Multiplayer Connected/i).isVisible();

    // Check navigation landmark tabs remain accessible and free of horizontal overflow
    await nav.getByRole('button', { name: /^Settings$/i }).click();
    await expect(page.getByRole('heading', { name: /App Settings/i })).toBeVisible();

    if (isConnected) {
      await nav.getByRole('button', { name: /^History$/i }).click();
      await expect(page.getByRole('heading', { name: /Historical Tasting Archives|No History Found|Failed to Load History/i })).toBeVisible();
    }

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    expect(mutatingRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
