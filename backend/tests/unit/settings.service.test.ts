import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getBusinessSettings,
  setBusinessLogo,
  updateBusinessSettings,
} from '../../src/modules/settings/settings.service.js';
import { createFakeSupabase, FakeSupabase } from './helpers/fakeSupabase.js';
import { assertAppError } from './helpers/assertAppError.js';

const SETTINGS_ROW = {
  business_name: 'IC Printing Services',
  logo_url: '/brand-logo.png',
  vat_rate: 12,
  currency_symbol: '₱',
  updated_at: '2026-09-15T00:00:00.000Z',
};

describe('settings.service', () => {
  describe('getBusinessSettings', () => {
    it('maps the single settings row into the domain shape', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      const settings = await getBusinessSettings(db.client);

      assert.equal(settings.businessName, 'IC Printing Services');
      assert.equal(settings.logoUrl, '/brand-logo.png');
      assert.equal(settings.vatRate, 12);
      assert.equal(settings.currencySymbol, '₱');
      assert.equal(settings.updatedAt, '2026-09-15T00:00:00.000Z');
    });

    it('always reads the singleton row (id = 1)', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await getBusinessSettings(db.client);

      assert.deepEqual(FakeSupabase.filterOf(db.callsFor('business_settings')[0], 'eq'), ['id', 1]);
    });

    it('applies the documented defaults when columns are missing', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', {
        data: { ...SETTINGS_ROW, logo_url: null, vat_rate: null, currency_symbol: null },
        error: null,
      });

      const settings = await getBusinessSettings(db.client);

      // VAT and currency fall back to the Philippine defaults the UI assumes.
      assert.equal(settings.logoUrl, null);
      assert.equal(settings.vatRate, 12);
      assert.equal(settings.currencySymbol, '₱');
    });

    it('maps a missing row to a 503 SETTINGS_LOOKUP_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: null, error: { message: 'no rows returned' } });

      await assertAppError(() => getBusinessSettings(db.client), 503, 'SETTINGS_LOOKUP_FAILED');
    });
  });

  describe('updateBusinessSettings', () => {
    it('writes snake_case columns and stamps the actor', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      const settings = await updateBusinessSettings(
        db.client,
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

      await updateBusinessSettings(db.client, { businessName: 'Renamed Shop' }, 'actor-1');

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
        { businessName: 'IC Printing Services', vatRate: 0, currencySymbol: '$' },
        'actor-1',
      );

      const payload = db.lastCall('business_settings', 'update')?.payload as Record<string, unknown>;
      assert.equal(payload.business_name, 'IC Printing Services');
      // 0 and '' are legitimate values and must not be dropped as falsy.
      assert.equal(payload.vat_rate, 0);
      assert.equal(payload.currency_symbol, '$');
    });

    it('always targets the singleton row', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await updateBusinessSettings(db.client, { businessName: 'Renamed Shop' }, 'actor-1');

      assert.deepEqual(FakeSupabase.filterOf(db.lastCall('business_settings', 'update'), 'eq'), ['id', 1]);
    });

    it('maps a write failure to a 400 SETTINGS_UPDATE_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: null, error: { message: 'permission denied' } });

      await assertAppError(
        () => updateBusinessSettings(db.client, { businessName: 'Renamed Shop' }, 'actor-1'),
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

      const settings = await setBusinessLogo(db.client, logoUrl, 'actor-1');

      const payload = db.lastCall('business_settings', 'update')?.payload as Record<string, unknown>;
      assert.deepEqual(Object.keys(payload).sort(), ['logo_url', 'updated_by']);
      assert.equal(payload.logo_url, logoUrl);
      assert.equal(payload.updated_by, 'actor-1');
      assert.equal(settings.logoUrl, logoUrl);
    });

    it('clears the logo so the bundled asset takes over', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: { ...SETTINGS_ROW, logo_url: null }, error: null });

      const settings = await setBusinessLogo(db.client, null, 'actor-1');

      const payload = db.lastCall('business_settings', 'update')?.payload as Record<string, unknown>;
      assert.equal(payload.logo_url, null);
      assert.equal(settings.logoUrl, null);
    });

    it('always targets the singleton row', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await setBusinessLogo(db.client, 'https://example.com/logo.png', 'actor-1');

      assert.deepEqual(FakeSupabase.filterOf(db.lastCall('business_settings', 'update'), 'eq'), ['id', 1]);
    });

    it('maps a write failure to a 400 SETTINGS_UPDATE_FAILED', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: null, error: { message: 'permission denied' } });

      await assertAppError(
        () => setBusinessLogo(db.client, 'https://example.com/logo.png', 'actor-1'),
        400,
        'SETTINGS_UPDATE_FAILED',
      );
    });
  });
});
