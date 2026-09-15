import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Minimal Supabase test double for service unit tests.
 *
 * Every service takes its `SupabaseClient` as the first argument, so business
 * logic can be driven with this fake instead of a live database. It earns its
 * place for two reasons:
 *
 *   1. Row mapping, totals and pagination are exercised without network,
 *      credentials or seed data.
 *   2. Every query is recorded, so a test can assert the *shape* of the query
 *      the service produced (table, filters, range, RPC arguments) rather than
 *      only its return value.
 *
 * Responses are explicit by design: querying a table or RPC that has no
 * configured response throws, so a forgotten mock fails loudly instead of
 * silently returning empty data.
 */

export interface FakeResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

export interface FakeFilter {
  method: string;
  args: readonly unknown[];
}

export interface FakeCall {
  kind: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
  /** Table name for `from()` queries, RPC name for `rpc()` calls. */
  target: string;
  columns?: string | undefined;
  options?: unknown;
  payload?: unknown;
  filters: FakeFilter[];
  modes: string[];
}

const cloneCall = (call: FakeCall): FakeCall => ({
  ...call,
  filters: [...call.filters],
  modes: [...call.modes],
});

/**
 * Chainable stand-in for a Supabase query builder. Awaiting it resolves to the
 * queued (or default) response for its table.
 */
class FakeQuery implements PromiseLike<FakeResult> {
  constructor(
    private readonly db: FakeSupabase,
    private readonly call: FakeCall,
  ) {}

  /**
   * Supabase allows re-selecting after a write (`.update(...).eq(...).select()`),
   * so the projection is recorded on the existing call rather than starting a
   * new one.
   */
  select(columns?: string, options?: { count?: string }): this {
    this.call.columns = columns;
    if (options !== undefined) this.call.options = options;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.call.filters.push({ method: 'eq', args: [column, value] });
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.call.filters.push({ method: 'in', args: [column, [...values]] });
    return this;
  }

  order(column: string, options?: unknown): this {
    this.call.filters.push({ method: 'order', args: options === undefined ? [column] : [column, options] });
    return this;
  }

  range(from: number, to: number): this {
    this.call.filters.push({ method: 'range', args: [from, to] });
    return this;
  }

  single(): this {
    this.call.modes.push('single');
    return this;
  }

  maybeSingle(): this {
    this.call.modes.push('maybeSingle');
    return this;
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onFulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.db.resolveTable(this.call)).then(onFulfilled, onRejected);
  }
}

class FakeTable {
  constructor(
    private readonly db: FakeSupabase,
    private readonly table: string,
  ) {}

  select(columns?: string, options?: { count?: string }): FakeQuery {
    return this.db.startQuery({
      kind: 'select',
      target: this.table,
      columns,
      ...(options === undefined ? {} : { options }),
      filters: [],
      modes: [],
    });
  }

  insert(payload: unknown): FakeQuery {
    return this.db.startQuery({ kind: 'insert', target: this.table, payload, filters: [], modes: [] });
  }

  update(payload: unknown): FakeQuery {
    return this.db.startQuery({ kind: 'update', target: this.table, payload, filters: [], modes: [] });
  }

  delete(): FakeQuery {
    return this.db.startQuery({ kind: 'delete', target: this.table, filters: [], modes: [] });
  }
}

export class FakeSupabase {
  /** The value to hand to a service. Typed as a real client, backed by fakes. */
  readonly client: SupabaseClient;

  private readonly tableQueue = new Map<string, FakeResult[]>();
  private readonly tableDefaults = new Map<string, FakeResult>();
  private readonly rpcQueue = new Map<string, FakeResult[]>();
  private readonly rpcDefaults = new Map<string, FakeResult>();
  private readonly recorded: FakeCall[] = [];

  constructor() {
    this.client = this as unknown as SupabaseClient;
  }

  // ─── Query entry points (mirrors the Supabase client surface) ─────

  from(table: string): FakeTable {
    return new FakeTable(this, table);
  }

  rpc(name: string, args: Record<string, unknown>): Promise<FakeResult> {
    this.recorded.push({ kind: 'rpc', target: name, payload: args, filters: [], modes: [] });
    return Promise.resolve(this.resolveRpc(name));
  }

  // ─── Response configuration ──────────────────────────────────────

  /** One-shot response for the next N queries against `table`. */
  queueTable(table: string, ...results: FakeResult[]): this {
    this.tableQueue.set(table, [...(this.tableQueue.get(table) ?? []), ...results]);
    return this;
  }

  /** Persistent response for every query against `table` with no queue left. */
  onTable(table: string, result: FakeResult): this {
    this.tableDefaults.set(table, result);
    return this;
  }

  /** One-shot response for the next N calls to `name`. */
  queueRpc(name: string, ...results: FakeResult[]): this {
    this.rpcQueue.set(name, [...(this.rpcQueue.get(name) ?? []), ...results]);
    return this;
  }

  /** Persistent response for every call to `name` with no queue left. */
  onRpc(name: string, result: FakeResult): this {
    this.rpcDefaults.set(name, result);
    return this;
  }

  // ─── Introspection ───────────────────────────────────────────────

  get calls(): FakeCall[] {
    return this.recorded.map(cloneCall);
  }

  callsFor(target: string, kind?: FakeCall['kind']): FakeCall[] {
    return this.recorded
      .filter((call) => call.target === target && (kind === undefined || call.kind === kind))
      .map(cloneCall);
  }

  /**
   * The most recent call against `table` / RPC `name`. Pass `kind` to skip past
   * follow-up reads — e.g. `lastCall('orders', 'update')` when the service
   * re-reads the row after writing.
   */
  lastCall(target: string, kind?: FakeCall['kind']): FakeCall | undefined {
    const match = [...this.recorded]
      .reverse()
      .find((call) => call.target === target && (kind === undefined || call.kind === kind));
    return match ? cloneCall(match) : undefined;
  }

  /** Convenience: the args of the first filter of `method` on a call. */
  static filterOf(call: FakeCall | undefined, method: string): readonly unknown[] | undefined {
    return call?.filters.find((filter) => filter.method === method)?.args;
  }

  reset(): this {
    this.tableQueue.clear();
    this.tableDefaults.clear();
    this.rpcQueue.clear();
    this.rpcDefaults.clear();
    this.recorded.length = 0;
    return this;
  }

  // ─── Internals ───────────────────────────────────────────────────

  /** Called by FakeQuery; records the call so tests can assert on it. */
  startQuery(call: FakeCall): FakeQuery {
    this.recorded.push(call);
    return new FakeQuery(this, call);
  }

  /** Called by FakeQuery when awaited. Not part of the test-facing API. */
  resolveTable(call: FakeCall): FakeResult {
    const queued = this.tableQueue.get(call.target);
    if (queued && queued.length > 0) return queued.shift() as FakeResult;
    const fallback = this.tableDefaults.get(call.target);
    if (fallback) return fallback;
    throw new Error(
      `FakeSupabase: no response configured for table "${call.target}" (${call.kind}). ` +
        'Use queueTable() for a one-shot response or onTable() for a default.',
    );
  }

  private resolveRpc(name: string): FakeResult {
    const queued = this.rpcQueue.get(name);
    if (queued && queued.length > 0) return queued.shift() as FakeResult;
    const fallback = this.rpcDefaults.get(name);
    if (fallback) return fallback;
    throw new Error(
      `FakeSupabase: no response configured for rpc "${name}". ` +
        'Use queueRpc() for a one-shot response or onRpc() for a default.',
    );
  }
}

export function createFakeSupabase(): FakeSupabase {
  return new FakeSupabase();
}
