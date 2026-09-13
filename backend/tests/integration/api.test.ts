import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

const baseUrl = process.env.PRINTSYNC_TEST_BASE_URL ?? 'http://127.0.0.1:4000/api/v1';
const email = process.env.PRINTSYNC_TEST_EMAIL;
const password = process.env.PRINTSYNC_TEST_PASSWORD;
const requireAuthenticatedTests = process.env.PRINTSYNC_REQUIRE_AUTH_TESTS === 'true';

let cookieHeader = '';
let temporaryOrderId: string | null = null;
let temporaryTransactionId: string | null = null;
let temporaryInventoryId: string | null = null;
let temporaryDesignId: string | null = null;
let temporaryUserId: string | null = null;

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

function skipIfUnauthenticated(context: { skip: (reason: string) => void }, label: string): boolean {
  if (!cookieHeader) {
    context.skip(`Set PRINTSYNC_TEST_EMAIL and PRINTSYNC_TEST_PASSWORD for authenticated integration checks (${label}).`);
    return true;
  }
  return false;
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
    if (temporaryDesignId && cookieHeader) {
      await request(`/designs/${temporaryDesignId}`, { method: 'DELETE' });
    }
    if (temporaryOrderId && cookieHeader) {
      await request(`/orders/${temporaryOrderId}`, { method: 'DELETE' });
    }
    if (temporaryTransactionId && cookieHeader) {
      await request(`/payments/transactions/${temporaryTransactionId}/void`, { method: 'POST', body: JSON.stringify({}) });
    }
    if (temporaryInventoryId && cookieHeader) {
      await request(`/inventory/${temporaryInventoryId}`, { method: 'DELETE' });
    }
    if (temporaryUserId && cookieHeader) {
      await request(`/users/${temporaryUserId}`, { method: 'DELETE' });
    }
  });

  // ─── Health & Ready ──────────────────────────────────────────────

  it('serves the public health endpoint', async () => {
    const response = await request<{ status: string }>('/health');
    assert.equal(response.status, 200);
    assert.equal(dataOf(response).status, 'ok');
  });

  it('serves the ready endpoint with dependency checks', async () => {
    const response = await request<{ status: string; dependencies: Record<string, string> }>('/ready');
    assert.equal(response.status, 200);
    assert.equal(dataOf(response).status, 'ready');
  });

  // ─── Authentication & Authorization Guards ────────────────────────

  it('rejects protected requests without authentication', async () => {
    const savedCookie = cookieHeader;
    cookieHeader = '';
    const response = await request('/orders');
    cookieHeader = savedCookie;
    assert.equal(response.status, 401);
    assert.equal(errorCode(response), 'AUTHENTICATION_REQUIRED');
  });

  it('returns 404 for unknown routes', async () => {
    const response = await request('/nonexistent-endpoint');
    assert.equal(response.status, 404);
    assert.equal(errorCode(response), 'NOT_FOUND');
  });

  it('rejects invalid credentials on login', async () => {
    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nobody@printsync.invalid', password: 'wrongpassword' }),
    });
    assert.equal(response.status, 401);
    assert.equal(errorCode(response), 'INVALID_CREDENTIALS');
  });

  it('rejects login with malformed email', async () => {
    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: 'password' }),
    });
    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'INVALID_LOGIN_REQUEST');
  });

  it('returns the current session for an authenticated user', async (context) => {
    if (skipIfUnauthenticated(context, 'session')) return;

    const response = await request<{ user: { id: string; email: string } }>('/auth/session');
    assert.equal(response.status, 200);
    assert.equal(typeof dataOf(response).user.id, 'string');
    assert.equal(typeof dataOf(response).user.email, 'string');
  });

  it('refreshes an authenticated session', async (context) => {
    if (skipIfUnauthenticated(context, 'refresh')) return;

    const response = await request<{ user: { id: string } }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);
    assert.equal(typeof dataOf(response).user.id, 'string');
  });

  // ─── Operational Read Contracts ─────────────────────────────────

  it('returns authenticated operational read contracts', async (context) => {
    if (skipIfUnauthenticated(context, 'read contracts')) return;

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

  // ─── Analytics ───────────────────────────────────────────────────

  it('returns analytics summary with valid date range', async (context) => {
    if (skipIfUnauthenticated(context, 'analytics summary')) return;

    const response = await request<{ revenue: number; transactionCount: number }>('/analytics/summary?from=2020-01-01&to=2099-12-31');
    assert.equal(response.status, 200);
    assert.equal(typeof dataOf(response).revenue, 'number');
  });

  it('rejects analytics summary without date range', async (context) => {
    if (skipIfUnauthenticated(context, 'analytics validation')) return;

    const response = await request('/analytics/summary');
    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'INVALID_ANALYTICS_QUERY');
  });

  it('returns sales timeline with bucket parameter', async (context) => {
    if (skipIfUnauthenticated(context, 'sales timeline')) return;

    const response = await request<unknown[]>('/analytics/sales-timeline?from=2020-01-01&to=2099-12-31&bucket=day');
    assert.equal(response.status, 200);
  });

  it('returns product trends with bucket parameter', async (context) => {
    if (skipIfUnauthenticated(context, 'product trends')) return;

    const response = await request<unknown[]>('/analytics/product-trends?from=2020-01-01&to=2099-12-31&bucket=week');
    assert.equal(response.status, 200);
  });

  it('returns inventory forecast with horizon', async (context) => {
    if (skipIfUnauthenticated(context, 'inventory forecast')) return;

    const response = await request<unknown[]>('/analytics/inventory-forecast?from=2020-01-01&to=2099-12-31&horizonDays=30');
    assert.equal(response.status, 200);
  });

  // ─── Audit Logs ──────────────────────────────────────────────────

  it('returns paginated audit logs', async (context) => {
    if (skipIfUnauthenticated(context, 'audit logs')) return;

    const response = await request<{ items: unknown[]; total: number; page: number; pageSize: number }>(
      '/audit-logs?page=1&pageSize=10',
    );
    assert.equal(response.status, 200);
    const data = dataOf(response);
    assert.equal(typeof data.total, 'number');
    assert.equal(typeof data.page, 'number');
    assert.equal(typeof data.pageSize, 'number');
  });

  it('filters audit logs by action', async (context) => {
    if (skipIfUnauthenticated(context, 'audit filter')) return;

    const response = await request<{ items: unknown[]; total: number }>(
      '/audit-logs?page=1&pageSize=5&action=auth.login_succeeded',
    );
    assert.equal(response.status, 200);
  });

  // ─── Payments / Transactions ────────────────────────────────────

  it('lists transactions', async (context) => {
    if (skipIfUnauthenticated(context, 'list transactions')) return;

    const response = await request<unknown[]>('/payments/transactions');
    assert.equal(response.status, 200);
  });

  it('rejects inconsistent transaction totals before writing', async (context) => {
    if (skipIfUnauthenticated(context, 'transaction validation')) return;

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

  it('rejects transaction with invalid payment method', async (context) => {
    if (skipIfUnauthenticated(context, 'payment method validation')) return;

    const response = await request('/payments/transactions', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ name: 'Test item', quantity: 1, unitPrice: 10 }],
        subtotal: 10,
        discount: 0,
        tax: 0,
        total: 10,
        paymentMethod: 'Crypto',
        paymentAmount: 10,
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'INVALID_TRANSACTION_REQUEST');
  });

  it('returns 404 for a non-existent transaction', async (context) => {
    if (skipIfUnauthenticated(context, 'transaction not found')) return;

    const response = await request('/payments/transactions/00000000-0000-0000-0000-000000000000');
    assert.equal(response.status, 404);
    assert.equal(errorCode(response), 'TRANSACTION_NOT_FOUND');
  });

  it('creates and voids a payment transaction through the API', async (context) => {
    if (skipIfUnauthenticated(context, 'transaction lifecycle')) return;

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

    // Verify we can fetch the created transaction
    const fetched = await request<{ id: string; status: string }>(`/payments/transactions/${temporaryTransactionId}`);
    assert.equal(fetched.status, 200);
    assert.equal(dataOf(fetched).id, temporaryTransactionId);

    const voided = await request<{ id: string; status: string }>(`/payments/transactions/${temporaryTransactionId}/void`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(voided.status, 200);
    assert.equal(dataOf(voided).status, 'voided');
    temporaryTransactionId = null;
  });

  it('rejects voiding a non-existent transaction', async (context) => {
    if (skipIfUnauthenticated(context, 'void non-existent')) return;

    const response = await request('/payments/transactions/00000000-0000-0000-0000-000000000000/void', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
  });

  // ─── Orders ──────────────────────────────────────────────────────

  it('creates, updates, and deletes an order through the API', async (context) => {
    if (skipIfUnauthenticated(context, 'order lifecycle')) return;

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

  it('fetches a single order by id', async (context) => {
    if (skipIfUnauthenticated(context, 'get order')) return;

    const created = await request<{ id: string }>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer: 'Get Order Test',
        lineItems: [{ name: 'Test line', quantity: 1, unitPrice: 5 }],
        amount: 5,
        status: 'Pending',
        isCustom: true,
      }),
    });
    temporaryOrderId = dataOf(created).id;

    const fetched = await request<{ id: string; customer: string }>(`/orders/${temporaryOrderId}`);
    assert.equal(fetched.status, 200);
    assert.equal(dataOf(fetched).id, temporaryOrderId);
    assert.equal(dataOf(fetched).customer, 'Get Order Test');

    await request(`/orders/${temporaryOrderId}`, { method: 'DELETE' });
    temporaryOrderId = null;
  });

  it('returns 404 for a non-existent order', async (context) => {
    if (skipIfUnauthenticated(context, 'order not found')) return;

    const response = await request('/orders/00000000-0000-0000-0000-000000000000');
    assert.equal(response.status, 404);
    assert.equal(errorCode(response), 'ORDER_NOT_FOUND');
  });

  it('rejects an order with missing required fields', async (context) => {
    if (skipIfUnauthenticated(context, 'order validation')) return;

    const response = await request('/orders', {
      method: 'POST',
      body: JSON.stringify({ customer: 'Missing fields test' }),
    });
    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'INVALID_ORDER_REQUEST');
  });

  // ─── Inventory ──────────────────────────────────────────────────

  it('creates, adjusts, updates, and deletes an inventory item through the API', async (context) => {
    if (skipIfUnauthenticated(context, 'inventory lifecycle')) return;

    const created = await request<{ id: string; sku: string; name: string; stock: number; price: number }>('/inventory', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Integration Test Item',
        category: 'Supplies',
        stock: 10,
        reorderLevel: 5,
        price: 2.50,
      }),
    });
    const createdItem = dataOf(created);
    temporaryInventoryId = createdItem.id;
    assert.equal(created.status, 201);
    assert.equal(createdItem.name, 'Integration Test Item');
    assert.equal(createdItem.stock, 10);
    assert.equal(typeof createdItem.sku, 'string');

    const adjusted = await request<{ id: string; stock: number }>(`/inventory/${temporaryInventoryId}/movements`, {
      method: 'POST',
      body: JSON.stringify({ quantity: -3, reason: 'Integration test adjustment' }),
    });
    assert.equal(adjusted.status, 200);
    assert.equal(dataOf(adjusted).stock, 7);

    const updated = await request<{ id: string; name: string; price: number }>(`/inventory/${temporaryInventoryId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Integration Test Item (Updated)',
        category: 'Supplies',
        reorderLevel: 5,
        price: 3.00,
      }),
    });
    assert.equal(updated.status, 200);
    assert.equal(dataOf(updated).name, 'Integration Test Item (Updated)');
    assert.equal(dataOf(updated).price, 3.00);

    const deletedItem = await request(`/inventory/${temporaryInventoryId}`, { method: 'DELETE' });
    assert.equal(deletedItem.status, 204);
    temporaryInventoryId = null;
  });

  it('rejects inventory movement with zero quantity', async (context) => {
    if (skipIfUnauthenticated(context, 'inventory movement validation')) return;

    // Create an item to test against
    const created = await request<{ id: string }>('/inventory', {
      method: 'POST',
      body: JSON.stringify({ name: 'Zero Movement Test', category: 'Supplies', reorderLevel: 1, price: 1.00 }),
    });
    temporaryInventoryId = dataOf(created).id;

    const response = await request(`/inventory/${temporaryInventoryId}/movements`, {
      method: 'POST',
      body: JSON.stringify({ quantity: 0, reason: 'Zero test' }),
    });
    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'INVALID_INVENTORY_MOVEMENT');

    await request(`/inventory/${temporaryInventoryId}`, { method: 'DELETE' });
    temporaryInventoryId = null;
  });

  // ─── Designs ─────────────────────────────────────────────────────

  it('creates, updates, and deletes a design through the API', async (context) => {
    if (skipIfUnauthenticated(context, 'design lifecycle')) return;

    const created = await request<{ id: string; name: string; category: string }>('/designs', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Integration Test Design',
        category: 'Banners',
        imageUrl: '/uploads/test-design.png',
        tags: ['test', 'integration'],
      }),
    });
    const createdDesign = dataOf(created);
    temporaryDesignId = createdDesign.id;
    assert.equal(created.status, 201);
    assert.equal(createdDesign.name, 'Integration Test Design');
    assert.equal(createdDesign.category, 'Banners');

    const updated = await request<{ id: string; name: string }>(`/designs/${temporaryDesignId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Integration Test Design (Updated)',
        category: 'Logos',
        imageUrl: '/uploads/test-design-v2.png',
        tags: ['test', 'updated'],
      }),
    });
    assert.equal(updated.status, 200);
    assert.equal(dataOf(updated).name, 'Integration Test Design (Updated)');

    const deleted = await request(`/designs/${temporaryDesignId}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    temporaryDesignId = null;
  });

  it('rejects a design with missing required fields', async (context) => {
    if (skipIfUnauthenticated(context, 'design validation')) return;

    const response = await request('/designs', {
      method: 'POST',
      body: JSON.stringify({ category: 'Missing name' }),
    });
    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'INVALID_DESIGN_REQUEST');
  });

  it('rejects a design with an invalid image URL', async (context) => {
    if (skipIfUnauthenticated(context, 'design url validation')) return;

    const response = await request('/designs', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad URL Design', imageUrl: 'not-a-url', tags: [] }),
    });
    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'INVALID_DESIGN_REQUEST');
  });

  it('uploads a design asset and returns a public image URL', async (context) => {
    if (skipIfUnauthenticated(context, 'design asset upload')) return;

    // Minimal 1x1 PNG as base64 data URL
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const response = await request<{ imageUrl: string; assetType: string; assetSizeBytes: number }>(
      '/designs/assets',
      {
        method: 'POST',
        body: JSON.stringify({
          dataUrl,
          fileName: 'test-asset.png',
          contentType: 'image/png',
          sizeBytes: 70,
        }),
      },
    );
    assert.equal(response.status, 201);
    assert.equal(typeof dataOf(response).imageUrl, 'string');
    assert.equal(dataOf(response).assetType, 'image/png');
    assert.equal(typeof dataOf(response).assetSizeBytes, 'number');
  });

  // ─── Settings ───────────────────────────────────────────────────

  it('updates business settings', async (context) => {
    if (skipIfUnauthenticated(context, 'settings update')) return;

    // Read current settings first
    const before = await request<{ businessName: string }>('/settings');
    assert.equal(before.status, 200);

    // Update business name
    const updated = await request<{ businessName: string }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ businessName: 'Integration Test Business' }),
    });
    assert.equal(updated.status, 200);
    assert.equal(dataOf(updated).businessName, 'Integration Test Business');

    // Restore the original name
    await request('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ businessName: dataOf(before).businessName }),
    });
  });

  it('rejects settings update with empty business name', async (context) => {
    if (skipIfUnauthenticated(context, 'settings validation')) return;

    const response = await request('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ businessName: '' }),
    });
    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'INVALID_SETTINGS_REQUEST');
  });

  // ─── Users ───────────────────────────────────────────────────────

  it('lists users', async (context) => {
    if (skipIfUnauthenticated(context, 'list users')) return;

    const response = await request<unknown[]>('/users');
    assert.equal(response.status, 200);
  });

  it('creates, updates, and deletes a user through the API', async (context) => {
    if (skipIfUnauthenticated(context, 'user lifecycle')) return;

    const uniqueEmail = `itest-${Date.now()}@printsync.test`;
    const created = await request<{ id: string; name: string; email: string; role: string }>('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Integration Test User',
        email: uniqueEmail,
        role: 'staff',
        position: 'Test Position',
        password: 'TestPassword123',
      }),
    });
    const createdUser = dataOf(created);
    temporaryUserId = createdUser.id;
    assert.equal(created.status, 201);
    assert.equal(createdUser.name, 'Integration Test User');
    assert.equal(createdUser.email, uniqueEmail);
    assert.equal(createdUser.role, 'staff');

    const updated = await request<{ id: string; name: string; position: string }>(`/users/${temporaryUserId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Integration Test User (Updated)',
        email: uniqueEmail,
        role: 'staff',
        position: 'Updated Position',
      }),
    });
    assert.equal(updated.status, 200);
    assert.equal(dataOf(updated).name, 'Integration Test User (Updated)');
    assert.equal(dataOf(updated).position, 'Updated Position');

    const deleted = await request(`/users/${temporaryUserId}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    temporaryUserId = null;
  });

  it('rejects creating a user with an invalid email', async (context) => {
    if (skipIfUnauthenticated(context, 'user validation')) return;

    const response = await request('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bad Email User',
        email: 'not-an-email',
        role: 'staff',
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'INVALID_USER_REQUEST');
  });

  it('rejects creating a user with an invalid role', async (context) => {
    if (skipIfUnauthenticated(context, 'user role validation')) return;

    const response = await request('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bad Role User',
        email: `bad-role-${Date.now()}@printsync.test`,
        role: 'superadmin',
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'INVALID_USER_REQUEST');
  });

  it('prevents a user from deleting their own account', async (context) => {
    if (skipIfUnauthenticated(context, 'self-delete guard')) return;

    // Get the current user's ID from the session
    const session = await request<{ user: { id: string } }>('/auth/session');
    const currentUserId = dataOf(session).user.id;

    const response = await request(`/users/${currentUserId}`, { method: 'DELETE' });
    assert.equal(response.status, 400);
    assert.equal(errorCode(response), 'SELF_DELETE_NOT_ALLOWED');
  });
});
