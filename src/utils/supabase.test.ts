import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { getLocalCalendarDateString } from './date';

type QueryResult = { data: unknown; error: unknown };

interface RecordedCall {
  table: string;
  op: string;
  payload?: unknown;
  filters: Array<{ method: string; args: unknown[] }>;
}

function createMockSupabaseFactory(
  resolver: (call: RecordedCall) => QueryResult | Promise<QueryResult>,
  overrides?: {
    rpc?: (fn: string) => Promise<{ data: unknown; error: unknown }>;
    functionsInvoke?: (fn: string, opts: unknown) => Promise<{ data: unknown; error: unknown }>;
  }
) {
  const calls: RecordedCall[] = [];
  let capturedFetch: typeof fetch | undefined;

  const createClient = vi.fn((_url: string, _key: string, opts?: { global?: { fetch?: typeof fetch } }) => {
    capturedFetch = opts?.global?.fetch;
    return {
      from: (table: string) => {
        const current: RecordedCall = { table, op: 'select', filters: [] };

        const builder: Record<string, unknown> = {};
        const chainMethods = ['select', 'eq', 'neq', 'gte', 'in', 'ilike', 'order', 'limit'];
        chainMethods.forEach((method) => {
          builder[method] = (...args: unknown[]) => {
            if (method === 'select' && current.op === 'select') {
              current.filters.push({ method, args });
            } else {
              current.filters.push({ method, args });
            }
            return builder;
          };
        });

        builder.insert = (payload: unknown) => {
          current.op = 'insert';
          current.payload = payload;
          return builder;
        };
        builder.update = (payload: unknown) => {
          current.op = 'update';
          current.payload = payload;
          return builder;
        };
        builder.upsert = (payload: unknown) => {
          current.op = 'upsert';
          current.payload = payload;
          return builder;
        };
        builder.delete = () => {
          current.op = 'delete';
          return builder;
        };

        const execute = async () => {
          calls.push(current);
          return await resolver(current);
        };

        builder.single = () => execute();
        builder.maybeSingle = () => execute();
        builder.then = (
          onFulfilled?: (val: QueryResult) => unknown,
          onRejected?: (err: unknown) => unknown
        ) => execute().then(onFulfilled, onRejected);

        return builder;
      },
      rpc: overrides?.rpc ?? vi.fn(async () => ({ data: true, error: null })),
      functions: {
        invoke:
          overrides?.functionsInvoke ??
          vi.fn(async () => ({ data: { varietal: 'Pinot Grigio' }, error: null })),
      },
    };
  });

  return {
    createClient,
    calls,
    getCapturedFetch: () => capturedFetch,
  };
}

describe('supabase data layer', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('extracts sb_url and sb_key from URL params, strips credentials from address bar, and preserves explicit headers in dynamicFetch', async () => {
    window.history.replaceState(
      {},
      '',
      '/?sb_url=https://demo.supabase.co/&sb_key=anon-key-123#tasting'
    );

    const mock = createMockSupabaseFactory(() => ({ data: null, error: null }));
    vi.doMock('@supabase/supabase-js', () => ({ createClient: mock.createClient }));

    await import('./supabase');

    expect(localStorage.getItem('WINE_TASTING_SB_URL')).toBe('https://demo.supabase.co/');
    expect(localStorage.getItem('WINE_TASTING_SB_KEY')).toBe('anon-key-123');
    expect(mock.createClient).toHaveBeenCalledWith(
      'https://demo.supabase.co',
      'anon-key-123',
      expect.any(Object)
    );
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#tasting');

    // Verify dynamicFetch keeps explicit header overrides while injecting voter token & passcode
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response('{}', { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const capturedFetch = mock.getCapturedFetch();
    expect(capturedFetch).toBeTypeOf('function');
    await capturedFetch!('https://demo.supabase.co/rest/v1/votes', {
      headers: {
        'x-host-passcode': 'custom-override',
        'x-extra': 'kept',
      },
    });

    const sentHeaders = capturedInit?.headers as Headers;
    expect(sentHeaders.get('x-host-passcode')).toBe('custom-override');
    expect(sentHeaders.get('x-extra')).toBe('kept');
    expect(sentHeaders.get('x-voter-token')).toBeTruthy();
  });

  it('keeps completed sessions from today local calendar day active via getActiveSession', async () => {
    localStorage.setItem('WINE_TASTING_SB_URL', 'https://demo.supabase.co');
    localStorage.setItem('WINE_TASTING_SB_KEY', 'anon-key-123');

    const todayLocal = getLocalCalendarDateString();
    const todayCompleted = {
      id: 'sess-today',
      name: 'Tonight Flight',
      date: `${todayLocal}T00:00:00Z`,
      created_at: new Date().toISOString(),
      status: 'completed',
      match_winners: {},
    };

    const mock = createMockSupabaseFactory((call) => {
      const isActiveCheck = call.filters.some(
        (f) => f.method === 'neq' && f.args[0] === 'status' && f.args[1] === 'completed'
      );
      if (isActiveCheck) {
        return { data: null, error: null };
      }
      return {
        data: [
          {
            id: 'sess-old',
            name: 'Last Week',
            date: '2020-01-01T00:00:00Z',
            created_at: '2020-01-01T18:00:00Z',
            status: 'completed',
            match_winners: {},
          },
          todayCompleted,
        ],
        error: null,
      };
    });
    vi.doMock('@supabase/supabase-js', () => ({ createClient: mock.createClient }));

    const { db } = await import('./supabase');
    const result = await db.getActiveSession();

    expect(result?.id).toBe('sess-today');
    const completedCall = mock.calls[1];
    expect(completedCall?.filters.some((f) => f.method === 'gte' && f.args[0] === 'date')).toBe(true);
  });

  it('validates voter name, escapes LIKE wildcards, hydrates sensory envelope, and blocks silent cross-device RLS overwrites', async () => {
    localStorage.setItem('WINE_TASTING_SB_URL', 'https://demo.supabase.co');
    localStorage.setItem('WINE_TASTING_SB_KEY', 'anon-key-123');

    let scenario: 'update_ok' | 'rls_empty' | 'rls_42501' | 'race_23505' = 'update_ok';

    const mock = createMockSupabaseFactory((call) => {
      if (call.op === 'select') {
        if (scenario === 'race_23505') {
          const alreadyAttemptedInsert = mock.calls.some((c) => c.op === 'insert');
          return {
            data: alreadyAttemptedInsert ? [{ id: 'vote-raced', voter_name: 'David' }] : [],
            error: null,
          };
        }
        return { data: [{ id: 'vote-1', voter_name: 'Alexcia_100%' }], error: null };
      }

      if (call.op === 'insert') {
        return {
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        };
      }

      if (call.op === 'update') {
        if (scenario === 'rls_empty') {
          return { data: null, error: null };
        }
        if (scenario === 'rls_42501') {
          return { data: null, error: { code: '42501', message: 'new row violates row-level security' } };
        }
        return {
          data: {
            id: call.filters.find((f) => f.method === 'eq' && f.args[0] === 'id')?.args[1] || 'vote-1',
            session_id: 'sess-1',
            voter_name: (call.payload as { voter_name: string }).voter_name,
            match_id: 'STANDALONE_A',
            wine_1_label: 'A',
            wine_2_label: 'A',
            slider_value: 87,
            notes_wine_1: 'Crisp apple',
            notes_wine_2: JSON.stringify({
              __v: 1,
              perceived_price_1: 'mid',
              buy_again_1: 'yes',
              acidity_1: 4,
              body_1: 3,
              sweetness_1: 1,
            }),
          },
          error: null,
        };
      }

      return { data: null, error: null };
    });

    vi.doMock('@supabase/supabase-js', () => ({ createClient: mock.createClient }));
    const { db } = await import('./supabase');

    // 1. Blank voter name throws explicit error
    await expect(
      db.submitVote({
        session_id: 'sess-1',
        voter_name: '   ',
        match_id: 'STANDALONE_A',
        wine_1_label: 'A',
        wine_2_label: 'A',
        slider_value: 80,
      })
    ).rejects.toThrow('Voter name is required before saving a rating.');

    // 2. Escapes %, _ in case-insensitive lookup, preserves stored casing, hydrates notes_wine_2 metadata
    const updated = await db.submitVote({
      session_id: 'sess-1',
      voter_name: 'alexcia_100%',
      match_id: 'STANDALONE_A',
      wine_1_label: 'A',
      wine_2_label: 'A',
      slider_value: 87,
      notes_wine_1: 'Crisp apple',
      perceived_price_1: 'mid',
      buy_again_1: 'yes',
      acidity_1: 4,
      body_1: 3,
      sweetness_1: 1,
    });
    const ilikeFilter = mock.calls[0]?.filters.find((f) => f.method === 'ilike');
    expect(ilikeFilter?.args[1]).toBe('alexcia\\_100\\%');
    expect(updated.voter_name).toBe('Alexcia_100%');
    expect(updated.perceived_price_1).toBe('mid');
    expect(updated.buy_again_1).toBe('yes');
    expect(updated.acidity_1).toBe(4);
    expect(updated.notes_wine_2).toBeUndefined();

    // 3. Cross-device overwrite blocked quietly by RLS (maybeSingle() -> null) raises clear error
    scenario = 'rls_empty';
    await expect(
      db.submitVote({
        session_id: 'sess-1',
        voter_name: 'Alexcia_100%',
        match_id: 'STANDALONE_A',
        wine_1_label: 'A',
        wine_2_label: 'A',
        slider_value: 87,
      })
    ).rejects.toThrow(/another device/i);

    // 4. SQLSTATE 42501 RLS error translates into clear browser ownership message
    scenario = 'rls_42501';
    await expect(
      db.submitVote({
        session_id: 'sess-1',
        voter_name: 'Alexcia_100%',
        match_id: 'STANDALONE_A',
        wine_1_label: 'A',
        wine_2_label: 'A',
        slider_value: 87,
      })
    ).rejects.toThrow(/another browser\/device/i);

    // 5. Concurrent insert collision (23505) retries cleanly as an update
    scenario = 'race_23505';
    mock.calls.length = 0;
    const raced = await db.submitVote({
      session_id: 'sess-1',
      voter_name: 'david',
      match_id: 'STANDALONE_A',
      wine_1_label: 'A',
      wine_2_label: 'A',
      slider_value: 87,
    });
    expect(raced.id).toBe('vote-raced');
    expect(raced.voter_name).toBe('David');
  });

  it('verifies host passcodes against check_is_host RPC and handles missing enrich-wine gracefully', async () => {
    localStorage.setItem('WINE_TASTING_SB_URL', 'https://demo.supabase.co');
    localStorage.setItem('WINE_TASTING_SB_KEY', 'anon-key-123');

    const mock = createMockSupabaseFactory(
      () => ({ data: null, error: null }),
      {
        functionsInvoke: vi.fn(async () => ({
          data: null,
          error: { context: { status: 404 }, message: 'Edge Function not found' },
        })),
      }
    );
    vi.doMock('@supabase/supabase-js', () => ({ createClient: mock.createClient }));

    const { db } = await import('./supabase');

    expect(await db.verifyHostPasscode('  ')).toEqual({
      valid: false,
      reason: 'Please enter a host passcode.',
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response('false', { status: 200 }))
      .mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await db.verifyHostPasscode('secret-pass')).toEqual({ valid: true });
    expect(await db.verifyHostPasscode('wrong-pass')).toEqual({
      valid: false,
      reason: 'Incorrect host passcode — rejected by database RLS.',
    });
    expect(await db.verifyHostPasscode('bad-status')).toEqual({
      valid: false,
      reason: 'Passcode check returned HTTP 403.',
    });

    await expect(db.enrichWine('Santa Margherita')).rejects.toThrow(
      'Wine auto-fill is unavailable because the optional enrich-wine Edge Function is not deployed on this backend. Enter details manually.'
    );
  });

  it('caches a single stable voter_token in memory when iPhone/browser storage throws', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-123');
    vi.doMock('./storage', async () => {
      const actual = await vi.importActual<typeof import('./storage')>('./storage');
      return {
        ...actual,
        safeStorageGet: () => null,
        safeStorageSet: () => undefined,
      };
    });

    const mock = createMockSupabaseFactory((call) => {
      if (call.op === 'select') return { data: [], error: null };
      if (call.op === 'insert') {
        return {
          data: {
            id: 'vote-mem',
            session_id: 'sess-1',
            voter_name: 'David',
            match_id: 'STANDALONE_A',
            wine_1_label: 'A',
            wine_2_label: 'A',
            slider_value: 83,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    vi.doMock('@supabase/supabase-js', () => ({ createClient: mock.createClient }));
    const { db, getOrGenerateVoterToken } = await import('./supabase');

    const tokenA = getOrGenerateVoterToken();
    const tokenB = getOrGenerateVoterToken();
    expect(tokenA).toBe(tokenB);

    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedInit = init;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    await mock.getCapturedFetch()!('https://demo.supabase.co/rest/v1/votes', {});
    expect((capturedInit?.headers as Headers).get('x-voter-token')).toBe(tokenA);

    await db.submitVote({
      session_id: 'sess-1',
      voter_name: 'David',
      match_id: 'STANDALONE_A',
      wine_1_label: 'A',
      wine_2_label: 'A',
      slider_value: 83,
    });

    const insertCall = mock.calls.find((c) => c.op === 'insert');
    expect((insertCall?.payload as { voter_token?: string })?.voter_token).toBe(tokenA);
  });
});
