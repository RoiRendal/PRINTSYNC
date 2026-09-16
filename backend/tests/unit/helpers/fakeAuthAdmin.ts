import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Test double for `supabase.auth.admin.*`.
 *
 * The auth module is a separate surface from the PostgREST query builder that
 * `FakeSupabase` models, so it gets its own double rather than being folded into
 * that one. Responses are configured per method and every call is recorded, so a
 * test can assert the outcome *and* what the service asked for.
 *
 * Like `FakeSupabase`, an unconfigured method throws rather than resolving with a
 * plausible-looking default: a forgotten mock should fail loudly.
 */
export interface FakeAuthCall {
  method: string;
  args: readonly unknown[];
}

export interface FakeAuthResult {
  data?: unknown;
  error?: unknown;
}

export class FakeAuthAdmin {
  private readonly queued = new Map<string, FakeAuthResult[]>();
  private readonly defaults = new Map<string, FakeAuthResult>();
  private readonly recorded: FakeAuthCall[] = [];

  /** One-shot response for the next N calls to `method`. */
  queueResult(method: string, ...results: FakeAuthResult[]): this {
    this.queued.set(method, [...(this.queued.get(method) ?? []), ...results]);
    return this;
  }

  /** Persistent response for every call to `method` once the queue is empty. */
  on(method: string, result: FakeAuthResult): this {
    this.defaults.set(method, result);
    return this;
  }

  /** Every call recorded so far, oldest first. */
  get calls(): FakeAuthCall[] {
    return this.recorded.map((call) => ({ method: call.method, args: [...call.args] }));
  }

  callsFor(method: string): FakeAuthCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  reset(): this {
    this.queued.clear();
    this.defaults.clear();
    this.recorded.length = 0;
    return this;
  }

  /** The surface `supabase.auth.admin` exposes to the services under test. */
  readonly admin = {
    createUser: (attributes: unknown) => this.resolve('createUser', [attributes]),
    updateUserById: (id: string, attributes: unknown) => this.resolve('updateUserById', [id, attributes]),
    deleteUser: (id: string) => this.resolve('deleteUser', [id]),
    listUsers: (options?: unknown) => this.resolve('listUsers', [options]),
  };

  private resolve(method: string, args: readonly unknown[]): Promise<FakeAuthResult> {
    this.recorded.push({ method, args });
    const queued = this.queued.get(method);
    if (queued && queued.length > 0) return Promise.resolve(queued.shift() as FakeAuthResult);
    const fallback = this.defaults.get(method);
    if (fallback) return Promise.resolve(fallback);
    throw new Error(
      `FakeAuthAdmin: no response configured for auth.admin.${method}. ` +
        'Use queueResult() for a one-shot response or on() for a default.',
    );
  }
}

/**
 * Attaches an auth double to a `FakeSupabase` and returns it.
 *
 * `FakeSupabase.client` *is* the fake instance, so assigning the double onto it
 * is what makes `supabase.auth.admin.*` resolve inside a service under test —
 * without touching the shared query-builder helper.
 */
export function withAuthAdmin(db: { client: SupabaseClient }): FakeAuthAdmin {
  const auth = new FakeAuthAdmin();
  (db.client as unknown as { auth: FakeAuthAdmin }).auth = auth;
  return auth;
}
