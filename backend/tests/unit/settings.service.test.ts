import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getBusinessSettings,
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

    it('clears the logo when the caller omits it', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: { ...SETTINGS_ROW, logo_url: null }, error: null });

      await updateBusinessSettings(db.client, { businessName: 'Renamed Shop' }, 'actor-1');

      const payload = db.lastCall('business_settings', 'update')?.payload as Record<string, unknown>;
      assert.equal(payload.logo_url, null);
    });

    it('persists an explicit logo URL', async () => {
      const db = createFakeSupabase();
      db.queueTable('business_settings', { data: SETTINGS_ROW, error: null });

      await updateBusinessSettings(
        db.client,
        { businessName: 'IC Printing Services', logoUrl: '/uploads/logo.png' },
        'actor-1',
      );

      const payload = db.lastCall('business_settings', 'update')?.payload as Record<string, unknown>;
      assert.equal(payload.logo_url, '/uploads/logo.png');
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
});
