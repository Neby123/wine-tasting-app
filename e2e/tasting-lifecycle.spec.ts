import { expect, test, type Page, type Route } from '@playwright/test';

interface MockState {
  sessions: Array<Record<string, unknown>>;
  wines: Array<Record<string, unknown>>;
  votes: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  wishlist: Array<Record<string, unknown>>;
}

function sqlLikeToRegex(pattern: string): RegExp {
  let out = '^';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) {
      const next = pattern[++i];
      out += next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (ch === '%' || ch === '*') {
      out += '.*';
    } else if (ch === '_') {
      out += '.';
    } else {
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  out += '$';
  return new RegExp(out, 'i');
}

function applyPostgrestFilters(
  rows: Array<Record<string, unknown>>,
  searchParams: URLSearchParams
): Array<Record<string, unknown>> {
  let result = [...rows];
  const reserved = new Set(['select', 'order', 'limit', 'offset', 'on_conflict']);

  for (const [col, expr] of searchParams.entries()) {
    if (reserved.has(col)) continue;

    if (expr.startsWith('eq.')) {
      const target = expr.slice(3);
      result = result.filter((r) => String(r[col] ?? '') === target);
    } else if (expr.startsWith('neq.')) {
      const target = expr.slice(4);
      result = result.filter((r) => String(r[col] ?? '') !== target);
    } else if (expr.startsWith('gte.')) {
      const target = expr.slice(4);
      const targetTime = Date.parse(target);
      result = result.filter((r) => {
        const val = String(r[col] ?? '');
        const valTime = Date.parse(val);
        if (!Number.isNaN(targetTime) && !Number.isNaN(valTime)) {
          return valTime >= targetTime;
        }
        return val >= target;
      });
    } else if (expr.startsWith('ilike.')) {
      const rx = sqlLikeToRegex(expr.slice(6));
      result = result.filter((r) => rx.test(String(r[col] ?? '')));
    } else if (expr.startsWith('in.(') && expr.endsWith(')')) {
      const inner = expr.slice(4, -1);
      const vals = inner
        .split(',')
        .map((v) => v.trim().replace(/^"(.*)"$/, '$1'));
      const valSet = new Set(vals);
      result = result.filter((r) => valSet.has(String(r[col] ?? '')));
    }
  }

  const order = searchParams.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    const desc = dir === 'desc';
    result.sort((a, b) => {
      const av = String(a[col] ?? '');
      const bv = String(b[col] ?? '');
      return desc ? bv.localeCompare(av) : av.localeCompare(bv);
    });
  }

  const limitParam = searchParams.get('limit');
  if (limitParam) {
    const limit = parseInt(limitParam, 10);
    if (!Number.isNaN(limit) && limit >= 0) {
      result = result.slice(0, limit);
    }
  }

  return result;
}

async function installMockSupabase(page: Page, state: MockState) {
  let seq = 1;
  const nextId = (prefix: string) => `${prefix}-0000-0000-0000-${String(seq++).padStart(12, '0')}`;

  // Silence Supabase Realtime WebSocket frames cleanly with zero console errors
  await page.routeWebSocket(/mock-wine-db\.supabase\.co\/realtime\/v1\/websocket/, (ws) => {
    ws.onMessage((message) => {
      if (typeof message !== 'string') return;
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed)) {
          ws.send(JSON.stringify([parsed[0], parsed[1], parsed[2], 'phx_reply', { status: 'ok', response: {} }]));
        } else if (parsed && typeof parsed === 'object') {
          ws.send(
            JSON.stringify({
              topic: parsed.topic,
              event: 'phx_reply',
              payload: { status: 'ok', response: {} },
              ref: parsed.ref ?? null,
              join_ref: parsed.join_ref ?? null,
            })
          );
        }
      } catch {
        // ignore non-JSON frames
      }
    });
  });

  await page.route('https://mock-wine-db.supabase.co/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method().toUpperCase();
    const headers = req.headers();
    const wantsSingle = (headers['accept'] || '').includes('application/vnd.pgrst.object+json');
    const path = url.pathname;

    const sendRows = async (rows: Array<Record<string, unknown>>, status = 200) => {
      if (wantsSingle) {
        if (rows.length === 0) {
          await route.fulfill({
            status: 406,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 'PGRST116',
              details: 'The result contains 0 rows',
              hint: null,
              message: 'JSON object requested, multiple (or no) rows returned',
            }),
          });
          return;
        }
        await route.fulfill({
          status,
          contentType: 'application/vnd.pgrst.object+json',
          body: JSON.stringify(rows[0]),
        });
        return;
      }
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
    };

    if (path.endsWith('/rest/v1/rpc/check_is_host')) {
      const valid = (headers['x-host-passcode'] || '') === '1234';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(valid),
      });
      return;
    }

    if (path.endsWith('/functions/v1/enrich-wine')) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not Found' }),
      });
      return;
    }

    const tableMatch = path.match(/\/rest\/v1\/(sessions|wines|votes|history|wishlist)$/);
    if (!tableMatch) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Unknown endpoint"}' });
      return;
    }

    const tableName = tableMatch[1] as keyof MockState;
    const table = state[tableName];

    if (method === 'GET') {
      const filtered = applyPostgrestFilters(table, url.searchParams);
      await sendRows(filtered, 200);
      return;
    }

    if (method === 'POST') {
      const rawBody = req.postDataJSON();
      const incoming = (Array.isArray(rawBody) ? rawBody : [rawBody]) as Array<Record<string, unknown>>;
      const prefer = headers['prefer'] || '';
      const isUpsert = prefer.includes('resolution=merge-duplicates') || url.searchParams.has('on_conflict');
      const created: Array<Record<string, unknown>> = [];

      for (const item of incoming) {
        if (isUpsert && item.id) {
          const idx = table.findIndex((r) => r.id === item.id);
          const merged = {
            ...item,
            created_at: (idx >= 0 ? table[idx].created_at : undefined) || new Date().toISOString(),
          };
          if (idx >= 0) {
            table[idx] = merged;
          } else {
            table.push(merged);
          }
          created.push(merged);
        } else {
          const row: Record<string, unknown> = {
            id: item.id || nextId(tableName),
            created_at: new Date().toISOString(),
            match_winners: tableName === 'sessions' ? {} : undefined,
            revealed: tableName === 'wines' ? false : undefined,
            ...item,
          };
          table.push(row);
          created.push(row);
        }
      }
      await sendRows(created, 201);
      return;
    }

    if (method === 'PATCH') {
      const updates = req.postDataJSON() as Record<string, unknown>;
      const matched = applyPostgrestFilters(table, url.searchParams);
      const matchedSet = new Set(matched);
      const updatedRows: Array<Record<string, unknown>> = [];

      for (let i = 0; i < table.length; i++) {
        if (matchedSet.has(table[i])) {
          table[i] = { ...table[i], ...updates };
          updatedRows.push(table[i]);
        }
      }
      await sendRows(updatedRows, 200);
      return;
    }

    if (method === 'DELETE') {
      const matched = applyPostgrestFilters(table, url.searchParams);
      const matchedSet = new Set(matched);
      state[tableName] = table.filter((r) => !matchedSet.has(r));
      await sendRows(matched, 200);
      return;
    }

    await route.fulfill({ status: 405, contentType: 'application/json', body: '{}' });
  });
}

test.describe('Grand Taste Tourney full blind tasting lifecycle', () => {
  test('completes setup, registration, local draft reload recovery, batch save, reveal, chart inspection, history sync, cellar, and zero-overflow responsiveness', async ({ page }) => {
    const state: MockState = {
      sessions: [],
      wines: [],
      votes: [],
      history: [],
      wishlist: [],
    };

    const unexpectedConsoleErrors: string[] = [];
    const failedHttpResponses: string[] = [];
    const pageErrors: string[] = [];
    const nativeDialogs: string[] = [];
    let beforeUnloadTriggered = 0;

    page.on('response', (res) => {
      if (res.status() >= 400) {
        failedHttpResponses.push(`${res.status()} ${res.url()}`);
      }
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const locUrl = msg.location()?.url || '';
        const isExpectedEnrich404 =
          locUrl.endsWith('/functions/v1/enrich-wine') &&
          msg.text().includes('404');
        if (!isExpectedEnrich404) {
          unexpectedConsoleErrors.push(`${msg.text()} (${locUrl || 'unknown'})`);
        }
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'beforeunload') {
        beforeUnloadTriggered += 1;
        await dialog.accept();
        return;
      }
      nativeDialogs.push(`${dialog.type()}: ${dialog.message()}`);
      await dialog.dismiss();
    });

    await installMockSupabase(page, state);

    const nav = page.getByRole('navigation', { name: 'Primary sections' });
    const main = page.locator('#main-content');

    // 1. Bootstrap Supabase via invite query params and verify credentials are scrubbed from URL
    await page.goto('/?sb_url=https://mock-wine-db.supabase.co&sb_key=mock-anon-key-123');
    await expect.poll(() => new URL(page.url()).search).toBe('');
    await expect(page.getByText(/Multiplayer Connected/i)).toBeVisible();

    // 2. Configure Host Controls & Verify Passcode via Settings
    await nav.getByRole('button', { name: /^Settings$/i }).click();
    await main.getByLabel(/Your Name \/ Participant Name/i).fill('David');
    const hostSwitch = main.getByRole('switch', { name: /Host Controls/i });
    await expect(hostSwitch).toHaveAttribute('aria-checked', 'false');
    await hostSwitch.click();
    await expect(hostSwitch).toHaveAttribute('aria-checked', 'true');

    const passcodeInput = main.getByLabel(/^Host Passcode$/i);
    await passcodeInput.fill('9999');
    await main.getByRole('button', { name: /Verify Passcode/i }).click();
    await expect(main.getByText(/Incorrect host passcode/i)).toBeVisible();

    await passcodeInput.fill('1234');
    await main.getByRole('button', { name: /Verify Passcode/i }).click();
    await expect(main.getByText(/Verified by database host policy/i)).toBeVisible();

    await main.getByRole('button', { name: /Save Profile/i }).click();
    await expect(main.getByText(/Profile updated successfully/i)).toBeVisible();

    // 3. Initialize Session
    await nav.getByRole('button', { name: /New Session/i }).click();
    await expect(main.getByRole('heading', { name: /Initialize Tasting Session/i })).toBeVisible();
    await main.getByLabel(/Session Title/i).fill('Saturday Night Blind Pinot');
    await main.getByRole('button', { name: /Initialize Session/i }).click();

    await expect(main.getByRole('heading', { name: /Wine Registry/i })).toBeVisible();

    // 4. Register bottles + verify missing enrich-wine shows graceful amber notice + test ConfirmDialog delete
    await main.getByLabel(/Brought By \/ Contributor/i).fill('David & Abby');
    await main.getByLabel(/Wine Name/i).fill('Santa Margherita Pinot Grigio');
    await main.getByRole('button', { name: /Auto-fill details/i }).click();
    await expect(main.getByText(/Wine auto-fill is unavailable/i)).toBeVisible();
    await main.getByLabel(/Price \(\$ USD\)/i).fill('24.99');
    await main.getByLabel(/Tasting Notes \/ Description/i).fill('Crisp pear and lemon zest');
    await main.getByRole('button', { name: /Register Wine/i }).click();
    await expect(main.getByText('Santa Margherita Pinot Grigio', { exact: true })).toBeVisible();

    await main.getByLabel(/Brought By \/ Contributor/i).fill('Ben & Monica');
    await main.getByLabel(/Wine Name/i).fill('Jermann Pinot Grigio');
    await main.getByLabel(/Price \(\$ USD\)/i).fill('36');
    await main.getByRole('button', { name: /Register Wine/i }).click();
    await expect(main.getByText('Jermann Pinot Grigio', { exact: true })).toBeVisible();

    await main.getByLabel(/Brought By \/ Contributor/i).fill('Jack');
    await main.getByLabel(/Wine Name/i).fill('Temp Mistake Bottle');
    await main.getByLabel(/Price \(\$ USD\)/i).fill('15');
    await main.getByRole('button', { name: /Register Wine/i }).click();
    await expect(main.getByText('Temp Mistake Bottle', { exact: true })).toBeVisible();

    // Delete 3rd bottle via permanently visible touch button & native <dialog> ConfirmDialog
    await main.getByRole('button', { name: 'Remove Temp Mistake Bottle' }).click();
    await expect(main.getByRole('heading', { name: /Remove Bottle from Registry\?/i })).toBeVisible();
    await main.getByRole('button', { name: /Remove Bottle/i }).click();
    await expect(main.getByText('Temp Mistake Bottle', { exact: true })).toHaveCount(0);

    await main.getByRole('button', { name: /Start Tasting Session/i }).click();
    await expect(main.getByRole('heading', { name: 'Saturday Night Blind Pinot' })).toBeVisible();

    // 5. Switch to Alexcia, enter draft for Wine A, reload page, verify recovery, then batch save A & B
    await main.getByRole('button', { name: /Switch Taster/i }).click();
    await main.getByRole('button', { name: 'Alexcia', exact: true }).click();
    await expect(main.getByText(/Taster:/)).toContainText('Alexcia');

    await main.getByRole('button', { name: /Wine A/i }).click();
    await main.getByLabel(/Wine A Score/i).fill('88');
    await main.getByRole('button', { name: /Mid \(\$\$\)/i }).click();
    await main.getByRole('button', { name: /Yes!/i }).click();
    await main.getByRole('button', { name: 'Acidity 4 out of 5' }).click();
    await main.getByRole('button', { name: 'Sweetness 2 out of 5' }).click();
    await main.getByPlaceholder(/Aroma, flavor notes, finish/i).fill('Love crisp pear');

    await expect(main.getByText(/Unsaved drafts for Wine A\./i)).toBeVisible();

    // Hard reload simulates backgrounded/discarded mobile tab before hitting Save
    await page.reload();
    expect(beforeUnloadTriggered).toBeGreaterThanOrEqual(1);
    await expect(main.getByText(/Unsaved drafts for Wine A\./i)).toBeVisible();
    await expect(main.getByText(/Unsaved draft \(88\/100\)/i)).toBeVisible();

    await main.getByRole('button', { name: /Wine B/i }).click();
    await main.getByLabel(/Wine B Score/i).fill('72');
    await main.getByRole('button', { name: /Save All Unsaved Ratings \(2\)/i }).click();

    await expect(main.getByText('Saved: 2 of 2')).toBeVisible();
    await expect(main.getByText(/Unsaved drafts/i)).toHaveCount(0);

    // 6. Unbag & reveal on Standings & Stats, then inspect scatter plot dot via click/tap
    await nav.getByRole('button', { name: /Standings & Stats/i }).click();
    await main.getByLabel('Mapped wine for Bag A').selectOption({ label: 'Santa Margherita Pinot Grigio ($25) - David & Abby' });
    await main.getByLabel('Mapped wine for Bag B').selectOption({ label: 'Jermann Pinot Grigio ($36) - Ben & Monica' });
    await main.getByRole('button', { name: /Save Reveal & Map Results/i }).click();

    await expect(main.getByText(/Saturday Night Blind Pinot Champion \(Best in Show\)/i)).toBeVisible();
    await expect(main.getByRole('tab', { name: /Value Analysis & Awards/i })).toHaveAttribute('aria-selected', 'true');

    await main.getByRole('tab', { name: /Live Tasting Status/i }).click();
    await expect(main.getByText(/Tasting Completed & Revealed/i)).toBeVisible();

    await main.getByRole('tab', { name: /Value Analysis & Awards/i }).click();
    await main.getByRole('button', { name: /Wine A: Santa Margherita Pinot Grigio/i }).click();
    await expect(
      main.locator('[role="status"]').filter({ hasText: 'Wine A: Santa Margherita Pinot Grigio' })
    ).toBeVisible();
    await expect(main.getByRole('heading', { name: /Wine Specifications Breakdown/i })).toBeVisible();

    // 7. Submit late rating as Jack after reveal & verify History Sensory Journal reflects it
    await nav.getByRole('button', { name: /Tasting Sheet/i }).click();
    await main.getByRole('button', { name: /Switch Taster/i }).click();
    await main.getByRole('button', { name: 'Jack', exact: true }).click();

    await main.getByRole('button', { name: /Wine B/i }).click();
    await main.getByLabel(/Wine B Score/i).fill('94');
    await main.getByRole('button', { name: /Save Rating for Wine B/i }).click();
    await expect(main.getByText('Saved: 94/100', { exact: true })).toBeVisible();

    await nav.getByRole('button', { name: /^History$/i }).click();
    await main.getByRole('button', { name: /Saturday Night Blind Pinot/i }).click();
    await main.getByLabel(/Taster Journal for:/i).selectOption('Alexcia');
    await expect(main.getByText('Acid 4/5')).toBeVisible();
    await expect(main.getByText('Sweet 2/5')).toBeVisible();

    // Verify Jack's late rating also synced into History
    await main.getByLabel(/Taster Journal for:/i).selectOption('Jack');
    await expect(main.getByText('94/100', { exact: true })).toBeVisible();

    // 8. Cellar search, bookmark, and native <dialog> removal
    await nav.getByRole('button', { name: /^Cellar$/i }).click();
    await main.getByPlaceholder(/Search by name, grape, region, style, or event/i).fill('Santa Margherita');
    await main.getByRole('button', { name: 'Add Santa Margherita Pinot Grigio to buy-again list' }).click();
    await expect(main.getByRole('button', { name: 'Remove Santa Margherita Pinot Grigio from cellar' })).toBeVisible();
    await main.getByRole('button', { name: 'Remove Santa Margherita Pinot Grigio from cellar' }).click();
    await main.getByRole('button', { name: /^Remove$/i }).click();
    await expect(main.getByRole('button', { name: 'Remove Santa Margherita Pinot Grigio from cellar' })).toHaveCount(0);

    // 9. Extreme narrow viewport (320px) zero horizontal overflow verification
    await page.setViewportSize({ width: 320, height: 568 });
    await nav.getByRole('button', { name: /Tasting Sheet/i }).click();
    const overflowTasting = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowTasting).toBeLessThanOrEqual(1);

    await nav.getByRole('button', { name: /Standings & Stats/i }).click();
    const overflowDashboard = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowDashboard).toBeLessThanOrEqual(1);

    expect(failedHttpResponses).toEqual([
      '404 https://mock-wine-db.supabase.co/functions/v1/enrich-wine',
    ]);
    expect(unexpectedConsoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(nativeDialogs).toEqual([]);
  });
});
