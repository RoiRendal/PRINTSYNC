import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getBusinessSettings,
  getPublicBranding,
  setBusinessLogo,
  updateBusinessSettings,
} from '../../src/modules/settings/settings.service.js';
import { createFakeSupabase, FakeSupabase } from './helpers/fakeSupabase.js';
import { assertAppError } from './helpers/assertAppError.js';

/**
 * A stored logo is always a Supabase Storage public URL now — there is no
 * bundled `/brand-logo.png` fallback to model. `logo_url: null` below is the
 * genuinely-no-logo state, which the UI renders as the business initials.
 */
const STORED_LOGO_URL = 'https://example.supabase.co/storage/v1/object/public/business-assets/seed/brand-logo.png';

const BALAYAN_ID = '11111111-1111-4111-8111-111111111111';
const NASUGBU_ID = '22222222-2222-4222-8222-222222222222';

const SETTINGS_ROW = {
  branch_id: BALAYAN_ID,
  business_name: 'IC Printing Services',
  logo_url: STORED_LOGO_URL,
  vat_rate: 12,
  currency_symbol: '₱',
  updated_at: '2026-09-15T00:00:00.000Z',
};

describe('settings.service', () => {
  describe('getBusinessSettings', () => {
    it('maps the settings row into the domain shape', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      const settings = await getBusinessSettings(db.client, BALAYAN_ID);

      assert.equal(settings.businessName, 'IC Printing Services');
      assert.equal(settings.logoUrl, STORED_LOGO_URL);
      assert.equal(settings.vatRate, 12);
      assert.equal(settings.currencySymbol, '₱');
      assert.equal(settings.updatedAt, '2026-09-15T00:00:00.000Z');
    });

    it('scopes the read to the given branch, never to id = 1', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await getBusinessSettings(db.client, NASUGBU_ID);

      const filter = FakeSupabase.filterOf(db.callsFor('business_settings')[0], 'eq');
      assert.deepEqual(filter, ['branch_id', NASUGBU_ID]);
      // The old singleton predicate must be gone: `id = 1` would return Balayan's
      // row for a Nasugbu caller and — worse — would still "work", so a passing
      // test that asserted `id` would hide the bug rather than catch it.
      assert.notDeepEqual(filter, ['id', 1]);
    });

    it('applies the documented defaults when columns are missing', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', {
        data: { ...SETTINGS_ROW, logo_url: null, vat_rate: null, currency_symbol: null },
        error: null,
      });

      const settings = await getBusinessSettings(db.client, BALAYAN_ID);

      // VAT and currency fall back to the Philippine defaults the UI assumes.
      assert.equal(settings.logoUrl, null);
      assert.equal(settings.vatRate, 12);
      assert.equal(settings.currencySymbol, '₱');
    });

    it('maps a missing row to a 503 SETTINGS_LOOKUP_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: null, error: { message: 'no rows returned' } });

      await assertAppError(() => getBusinessSettings(db.client, BALAYAN_ID), 503, 'SETTINGS_LOOKUP_FAILED');
    });
  });

  describe('getPublicBranding', () => {
    it('maps only the brand columns', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      const branding = await getPublicBranding(db.client, BALAYAN_ID);

      assert.deepEqual(branding, {
        businessName: 'IC Printing Services',
        logoUrl: STORED_LOGO_URL,
      });
    });

    it('never reads the operational columns on the unauthenticated path', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await getPublicBranding(db.client, BALAYAN_ID);

      // The projection is the guard: if `vat_rate` is never selected, a careless
      // edit to the mapping below cannot leak it to a signed-out caller.
      const columns = db.callsFor('business_settings')[0]?.columns ?? '';
      assert.equal(columns.includes('business_name'), true);
      assert.equal(columns.includes('logo_url'), true);
      assert.equal(columns.includes('vat_rate'), false);
      assert.equal(columns.includes('currency_symbol'), false);
    });

    it('returns a null logo when the shop has none', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: { ...SETTINGS_ROW, logo_url: null }, error: null });

      const branding = await getPublicBranding(db.client, BALAYAN_ID);

      assert.equal(branding.logoUrl, null);
      assert.equal(branding.businessName, 'IC Printing Services');
    });

    it('reads the given branch when one is known', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await getPublicBranding(db.client, NASUGBU_ID);

      assert.deepEqual(FakeSupabase.filterOf(db.callsFor('business_settings')[0], 'eq'), ['branch_id', NASUGBU_ID]);
    });

    it('falls back to the oldest row when no branch is known, and bounds the read', async () => {
      // The login screen renders before anyone has a session, so it cannot pass a
      // branch. It must still show the company identity rather than nothing.
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      const branding = await getPublicBranding(db.client);

      assert.equal(branding.businessName, 'IC Printing Services');
      const call = db.callsFor('business_settings')[0];
      // No branch filter at all in this mode...
      assert.equal(FakeSupabase.filterOf(call, 'eq'), undefined);
      // ...but the read is still pinned to one row. Without `limit`, adding a
      // second branch turns this into a whole-table read, and `.maybeSingle()`
      // then fails outright with two settings rows in the database.
      assert.deepEqual(FakeSupabase.filterOf(call, 'limit'), [1]);
      assert.deepEqual(FakeSupabase.filterOf(call, 'order'), ['created_at', { ascending: true }]);
      assert.equal(call?.modes.includes('maybeSingle'), true);
    });

    it('maps a missing row to a 503 BRANDING_LOOKUP_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: null, error: { message: 'no rows returned' } });

      // Distinct from SETTINGS_LOOKUP_FAILED so the login screen can tell a broken
      // branding read apart from a broken settings read.
      await assertAppError(() => getPublicBranding(db.client, BALAYAN_ID), 503, 'BRANDING_LOOKUP_FAILED');
    });
  });

  describe('updateBusinessSettings', () => {
    it('writes snake_case columns and stamps the actor', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      const settings = await updateBusinessSettings(
        db.client,
        BALAYAN_ID,
        { businessName: 'IC Printing Services', vatRate: 12, currencySymbol: '₱' },
        'actor-1',
      );

      const payload = db.lastCall('business_settings', 'update')?.payload as Record<string, unknown>;
      assert.equal(payload.business_name, 'IC Printing Services');
      assert.equal(payload.vat_rate, 12);
      assert.equal(payload.currency_symbol, '₱');
      assert.equal(payload.updated_by, 'actor-1');
      assert.equal(settings.businessName, 'IC Printing Services');
    });

    it('clears nothing else: the logo is not part of this write', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await updateBusinessSettings(db.client, BALAYAN_ID, { businessName: 'Renamed Shop' }, 'actor-1');

      const payload = db.lastCall('business_settings', 'update')?.payload as Record<string, unknown>;
      // The logo has its own writer, so a generic save must not touch `logo_url`
      // — otherwise editing the VAT rate would silently wipe the logo.
      assert.equal('logo_url' in payload, false);
    });

    it('persists the name and defaults together', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await updateBusinessSettings(
        db.client,
        BALAYAN_ID,
        { businessName: 'IC Printing Services', vatRate: 0, currencySymbol: '$' },
        'actor-1',
      );

      const payload = db.lastCall('business_settings', 'update')?.payload as Record<string, unknown>;
      assert.equal(payload.business_name, 'IC Printing Services');
      // 0 and '' are legitimate values and must not be dropped as falsy.
      assert.equal(payload.vat_rate, 0);
      assert.equal(payload.currency_symbol, '$');
    });

    it('targets the caller\'s branch, so one branch cannot rename another', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await updateBusinessSettings(db.client, NASUGBU_ID, { businessName: 'Renamed Shop' }, 'actor-1');

      assert.deepEqual(
        FakeSupabase.filterOf(db.lastCall('business_settings', 'update'), 'eq'),
        ['branch_id', NASUGBU_ID],
      );
    });

    it('maps a write failure to a 400 SETTINGS_UPDATE_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: null, error: { message: 'permission denied' } });

      await assertAppError(
        () => updateBusinessSettings(db.client, BALAYAN_ID, { businessName: 'Renamed Shop' }, 'actor-1'),
        400,
        'SETTINGS_UPDATE_FAILED',
      );
    });
  });

  describe('setBusinessLogo', () => {
    it('writes only the logo column and the actor', async () => {
      const db = createFakeSupabase();
      const logoUrl = 'https://example.supabase.co/storage/v1/object/public/business-assets/actor-1/logo.png';
      db.queueTable('business_settings', { data: { ...SETTINGS_ROW, logo_url: logoUrl }, error: null });

      const settings = await setBusinessLogo(db.client, BALAYAN_ID, logoUrl, 'actor-1');

      const payload = db.lastCall('business_settings', 'update')?.payload as Record<string, unknown>;
      assert.deepEqual(Object.keys(payload).sort(), ['logo_url', 'updated_by']);
      assert.equal(payload.logo_url, logoUrl);
      assert.equal(payload.updated_by, 'actor-1');
      assert.equal(settings.logoUrl, logoUrl);
    });

    it('clears the logo so the UI falls back to the business initials', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: { ...SETTINGS_ROW, logo_url: null }, error: null });

      const settings = await setBusinessLogo(db.client, BALAYAN_ID, null, 'actor-1');

      const payload = db.lastCall('business_settings', 'update')?.payload as Record<string, unknown>;
      assert.equal(payload.logo_url, null);
      assert.equal(settings.logoUrl, null);
    });

    it('targets the caller\'s branch, so a logo upload cannot overwrite another branch\'s', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await setBusinessLogo(db.client, NASUGBU_ID, 'https://example.com/logo.png', 'actor-1');

      assert.deepEqual(
        FakeSupabase.filterOf(db.lastCall('business_settings', 'update'), 'eq'),
        ['branch_id', NASUGBU_ID],
      );
    });

    it('maps a write failure to a 400 SETTINGS_UPDATE_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: null, error: { message: 'permission denied' } });

      await assertAppError(
        () => setBusinessLogo(db.client, BALAYAN_ID, 'https://example.com/logo.png', 'actor-1'),
        400,
        'SETTINGS_UPDATE_FAILED',
      );
    });
  });
});
