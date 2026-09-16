import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import type { DataChangeEvent } from '@printsync/shared-types';
import {
  countDataChangeSubscribers,
  countPublishedDataChanges,
  publishDataChange,
  subscribeToDataChange,
} from '../../src/services/domainEventBus.js';

/**
 * The bus is a module-level singleton, so every subscriber registered here must
 * be released before the next test — otherwise a listener from an earlier test
 * observes a later one's events and the assertions become order-dependent.
 */
let cleanups: Array<() => void> = [];

function subscribe(listener: (event: DataChangeEvent) => void): () => void {
  const unsubscribe = subscribeToDataChange(listener);
  cleanups.push(unsubscribe);
  return unsubscribe;
}

/** Records every event it receives. */
function recorder(): { events: DataChangeEvent[]; listener: (event: DataChangeEvent) => void } {
  const events: DataChangeEvent[] = [];
  return { events, listener: (event) => events.push(event) };
}

beforeEach(() => {
  cleanups = [];
});

afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
});

describe('services/domainEventBus', () => {
  describe('publishDataChange', () => {
    it('delivers an event to a subscriber', () => {
      const { events, listener } = recorder();
      subscribe(listener);

      publishDataChange('inventory');

      assert.equal(events.length, 1);
      assert.deepEqual(events[0]?.domains, ['inventory']);
    });

    it('batches several domains into a single event', () => {
      const { events, listener } = recorder();
      subscribe(listener);

      // One user action — ringing up a retail sale — touches both.
      publishDataChange('payments', 'inventory');

      assert.equal(events.length, 1, 'one action should wake a subscriber once, not once per domain');
      assert.deepEqual(events[0]?.domains, ['payments', 'inventory']);
    });

    it('collapses duplicate domains', () => {
      const { events, listener } = recorder();
      subscribe(listener);

      publishDataChange('inventory', 'inventory', 'inventory');

      assert.deepEqual(events[0]?.domains, ['inventory']);
    });

    it('stamps an ISO-8601 instant', () => {
      const { events, listener } = recorder();
      subscribe(listener);

      const before = Date.now();
      publishDataChange('orders');
      const after = Date.now();

      const at = Date.parse(events[0]!.at);
      assert.ok(Number.isFinite(at), '`at` should parse as a date');
      assert.ok(at >= before && at <= after, '`at` should be the moment of publishing');
    });

    it('is a no-op when no domains are given', () => {
      const { events, listener } = recorder();
      subscribe(listener);

      const publishedBefore = countPublishedDataChanges();
      publishDataChange();

      assert.equal(events.length, 0);
      assert.equal(countPublishedDataChanges(), publishedBefore, 'an empty publish is not a publish');
    });

    it('reaches every subscriber', () => {
      const first = recorder();
      const second = recorder();
      subscribe(first.listener);
      subscribe(second.listener);

      publishDataChange('customers');

      assert.equal(first.events.length, 1);
      assert.equal(second.events.length, 1);
    });

    it('increments the publish counter even with no subscribers', () => {
      const before = countPublishedDataChanges();
      publishDataChange('designs');
      assert.equal(countPublishedDataChanges(), before + 1);
    });
  });

  describe('failure isolation', () => {
    it('keeps delivering when one subscriber throws', () => {
      const healthy = recorder();
      subscribe(() => {
        throw new Error('subscriber exploded');
      });
      subscribe(healthy.listener);

      // A write has already committed by the time this runs, so a broken
      // connection must never prevent the others from being told.
      publishDataChange('orders');

      assert.equal(healthy.events.length, 1);
    });

    it('survives a subscriber that unsubscribes during dispatch', () => {
      const healthy = recorder();
      let selfUnsubscribe: () => void = () => {};
      const self = recorder();

      selfUnsubscribe = subscribe((event) => {
        self.events.push(event);
        selfUnsubscribe();
      });
      subscribe(healthy.listener);

      // Iterating a copy is what makes this safe; iterating the live Set would
      // skip `healthy` because the Set shrank mid-loop.
      publishDataChange('inventory');

      assert.equal(self.events.length, 1);
      assert.equal(healthy.events.length, 1, 'the remaining subscriber must still be notified');
    });
  });

  describe('unsubscribe', () => {
    it('stops delivery', () => {
      const { events, listener } = recorder();
      const unsubscribe = subscribe(listener);

      publishDataChange('orders');
      unsubscribe();
      publishDataChange('orders');

      assert.equal(events.length, 1);
    });

    it('is idempotent', () => {
      const { listener } = recorder();
      const unsubscribe = subscribe(listener);
      const before = countDataChangeSubscribers();

      unsubscribe();
      unsubscribe();

      assert.equal(countDataChangeSubscribers(), before - 1);
    });

    it('tracks the subscriber count', () => {
      const before = countDataChangeSubscribers();
      const unsubscribe = subscribe(() => {});

      assert.equal(countDataChangeSubscribers(), before + 1);
      unsubscribe();
      assert.equal(countDataChangeSubscribers(), before);
    });
  });
});
