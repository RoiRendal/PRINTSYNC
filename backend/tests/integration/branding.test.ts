import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * `GET /api/v1/branding` is the only unauthenticated read of `business_settings`,
 * and the login screen depends on it. These checks therefore run without any
 * credentials at all — unlike `api.test.ts`, nothing here is skipped when
 * `PRINTSYNC_TEST_EMAIL`/`PASSWORD` are absent, because requiring a session would
 * defeat the point of the endpoint.
 */

const baseUrl = process.env.PRINTSYNC_TEST_BASE_URL ?? 'http://127.0.0.1:4000/api/v1';

interface BrandingResponse {
  businessName: string;
  logoUrl: string | null;
}

async function get(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json', ...headers },
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

function dataOf<T>(body: unknown): T {
  return (body as { data: T }).data;
}

describe('public branding API', () => {
  it('serves brand identity to a signed-out caller', async () => {
    const response = await get('/branding');

    assert.equal(response.status, 200, JSON.stringify(response.body));
    const branding = dataOf<BrandingResponse>(response.body);
    assert.equal(typeof branding.businessName, 'string');
    assert.ok(branding.businessName.length > 0);
  });

  it('returns a logo that is either hosted or the same-origin fallback', async () => {
    const branding = dataOf<BrandingResponse>((await get('/branding')).body);

    if (branding.logoUrl === null) return;
    // Never an inline data URL: the base64 fallback was removed when logos moved
    // to Storage, and a data URL here would mean the migration regressed.
    assert.equal(branding.logoUrl.startsWith('data:'), false);
    assert.match(branding.logoUrl, /^(https?:\/\/|\/)/);
  });

  it('exposes only the brand fields', async () => {
    const branding = dataOf<Record<string, unknown>>((await get('/branding')).body);

    // `vat_rate` and `currency_symbol` are operational settings and must not be
    // readable by anyone who can reach the login page.
    assert.deepEqual(Object.keys(branding).sort(), ['businessName', 'logoUrl']);
  });

  it('tolerates a stale session cookie instead of rejecting the request', async () => {
    // A user whose session expired lands on the login screen with an old cookie
    // still attached, so the endpoint must ignore it rather than answer 401.
    const response = await get('/branding', { Cookie: 'printsync_access_token=expired.token.value' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(typeof dataOf<BrandingResponse>(response.body).businessName, 'string');
  });

  it('stays reachable when the request advertises a redirect origin', async () => {
    // Proves the route is mounted at the public layer rather than behind a router
    // whose middleware only applies to the API surface.
    const response = await get('/branding', { Origin: 'http://localhost:3000' });

    assert.equal(response.status, 200, JSON.stringify(response.body));
  });
});
