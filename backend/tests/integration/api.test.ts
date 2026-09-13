import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const baseUrl = process.env.PRINTSYNC_TEST_BASE_URL ?? 'http://127.0.0.1:4000/api/v1';
const email = process.env.PRINTSYNC_TEST_EMAIL;
const password = process.env.PRINTSYNC_TEST_PASSWORD;
const requireAuthenticatedTests = process.env.PRINTSYNC_REQUIRE_AUTH_TESTS === 'true';

let cookieHeader = '';
let temporaryOrderId: string | null = null;
let temporaryTransactionId: string | null = null;

type ApiResponse<T> = {
  status: number;
  body: T | { error?: { code?: string; message?: string } } | null;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  if (cookieHeader) headers.set('Cookie', cookieHeader);

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body: body as ApiResponse<T>['body'] };
}

function dataOf<T>(response: ApiResponse<T>): T {
  assert.equal(response.status >= 200 && response.status < 300, true, JSON.stringify(response.body));
  const body = response.body as { data: T };
  return body.data;
}

function errorCode(response: ApiResponse<unknown>): string | undefined {
  return (response.body as { error?: { code?: string } })?.error?.code;
}

async function login(): Promise<boolean> {
  if (!email || !password) return false;
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = response.headers.get('set-cookie');
  if (!response.ok || !setCookie) return false;
  cookieHeader = setCookie
    .split(/, (?=[^;]+=)/)
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');
  return true;
}

describe('PRINTSYNC API integration', () => {
  before(async () => {
    if (requireAuthenticatedTests && (!email || !password)) {
      throw new Error('PRINTSYNC_TEST_EMAIL and PRINTSYNC_TEST_PASSWORD are required when PRINTSYNC_REQUIRE_AUTH_TESTS=true.');
    }
    const authenticated = await login();
    if (!authenticated && email && password) {
      throw new Error('Configured PRINTSYNC_TEST_EMAIL/PASSWORD could not authenticate.');
    }
  });

  after(async () => {
    if (temporaryOrderId && cookieHeader) {
      await request(`/orders/${temporaryOrderId}`, { method: 'DELETE' });
    }
    if (temporaryTransactionId && cookieHeader) {
      await request(`/payments/transactions/${temporaryTransactionId}/void`, { method: 'POST', body: JSON.stringify({}) });
    }
  });

  it('serves the public health endpoint', async () => {
    const response = await request<{ status: string }>('/health');
    assert.equal(response.status, 200);
    assert.equal(dataOf(response).status, 'ok');
  });

  it('rejects protected requests without authentication', async () => {
    const savedCookie = cookieHeader;
    cookieHeader = '';
    const response = await request('/orders');
    cookieHeader = savedCookie;
    assert.equal(response.status, 401);
    assert.equal(errorCode(response), 'AUTHENTICATION_REQUIRED');
  });

  it('returns authenticated operational read contracts', async (context) => {
    if (!cookieHeader) {
      context.skip('Set PRINTSYNC_TEST_EMAIL and PRINTSYNC_TEST_PASSWORD for authenticated integration checks.');
      return;
    }

    const [inventory, designs, orders, settings, analytics] = await Promise.all([
      request<unknown[]>('/inventory'),
      request<unknown[]>('/designs'),
      request<unknown[]>('/orders'),
      request<{ businessName: string }>('/settings'),
      request<{ revenue: number }>('/analytics/summary?from=2020-01-01&to=2099-12-31'),
    ]);

    assert.equal(inventory.status, 200);
    assert.equal(designs.status, 200);
    assert.equal(orders.status, 200);
    assert.equal(settings.status, 200);
    assert.equal(analytics.status, 200);
    assert.equal(typeof dataOf(settings).businessName, 'string');
    assert.equal(typeof dataOf(analytics).revenue, 'number');
  });

  it('refreshes an authenticated session', async (context) => {
    if (!cookieHeader) {
      context.skip('Set PRINTSYNC_TEST_EMAIL and PRINTSYNC_TEST_PASSWORD for authenticated integration checks.');
      return;
    }

    const response = await request<{ user: { id: string } }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);
    assert.equal(typeof dataOf(response).user.id, 'string');
  });

  it('rejects inconsistent transaction totals before writing', async (context) => {
    if (!cookieHeader) {
      context.skip('Set PRINTSYNC_TEST_EMAIL and PRINTSYNC_TEST_PASSWORD for authenticated integration checks.');
      return;
    }

    const response = await request('/payments/transactions', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ name: 'Invalid totals test item', quantity: 1, unitPrice: 10 }],
        subtotal: 999,
        discount: 0,
        tax: 0,
        total: 999,
        paymentMethod: 'Cash',
        paymentAmount: 999,
      }),
    });

    assert.equal(response.status, 400);
  });

  it('creates and voids a payment transaction through the API', async (context) => {
    if (!cookieHeader) {
      context.skip('Set PRINTSYNC_TEST_EMAIL and PRINTSYNC_TEST_PASSWORD for authenticated integration checks.');
      return;
    }

    const created = await request<{ id: string; status: string; paymentMethod: string }>('/payments/transactions', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ name: 'Non-stock test item', quantity: 1, unitPrice: 10 }],
        subtotal: 10,
        discount: 0,
        tax: 0,
        total: 10,
        paymentMethod: 'Card',
        paymentAmount: 10,
      }),
    });
    const createdTransaction = dataOf(created);
    temporaryTransactionId = createdTransaction.id;
    assert.equal(created.status, 201);
    assert.equal(createdTransaction.status, 'completed');
    assert.equal(createdTransaction.paymentMethod, 'Card');

    const voided = await request<{ id: string; status: string }>(`/payments/transactions/${temporaryTransactionId}/void`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(voided.status, 200);
    assert.equal(dataOf(voided).status, 'voided');
    temporaryTransactionId = null;
  });

  it('creates, updates, and deletes an order through the API', async (context) => {
    if (!cookieHeader) {
      context.skip('Set PRINTSYNC_TEST_EMAIL and PRINTSYNC_TEST_PASSWORD for authenticated integration checks.');
      return;
    }

    const created = await request<{ id: string; status: string }>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer: 'Automated Integration Test',
        lineItems: [{ name: 'Non-stock test line', quantity: 1, unitPrice: 0 }],
        amount: 0,
        status: 'Pending',
        notes: 'Automatically cleaned up by integration tests',
        isCustom: true,
      }),
    });
    const createdOrder = dataOf(created);
    temporaryOrderId = createdOrder.id;
    assert.equal(created.status, 201);
    assert.equal(createdOrder.status, 'Pending');

    const updated = await request<{ status: string }>(`/orders/${temporaryOrderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'In Production' }),
    });
    assert.equal(updated.status, 200);
    assert.equal(dataOf(updated).status, 'In Production');

    const deleted = await request(`/orders/${temporaryOrderId}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    temporaryOrderId = null;
  });
});