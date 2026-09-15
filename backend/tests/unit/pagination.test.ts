import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateRange,
  createPaginatedResponse,
  parsePaginationQuery,
} from '../../src/shared/pagination.js';
import { assertAppError } from './helpers/assertAppError.js';

describe('shared/pagination', () => {
  describe('parsePaginationQuery', () => {
    it('defaults to page 1 and limit 20 when nothing is supplied', () => {
      assert.deepEqual(parsePaginationQuery({}), { page: 1, limit: 20 });
    });

    it('coerces query-string values, which always arrive as strings', () => {
      assert.deepEqual(parsePaginationQuery({ page: '3', limit: '50' }), { page: 3, limit: 50 });
    });

    it('ignores unrelated query parameters', () => {
      assert.deepEqual(parsePaginationQuery({ page: '2', limit: '10', search: 'banner', sort: 'name' }), {
        page: 2,
        limit: 10,
      });
    });

    it('accepts the documented boundaries', () => {
      assert.deepEqual(parsePaginationQuery({ page: 1, limit: 1 }), { page: 1, limit: 1 });
      assert.deepEqual(parsePaginationQuery({ page: '1', limit: '100' }), { page: 1, limit: 100 });
    });

    it('rejects a page below 1', async () => {
      await assertAppError(async () => parsePaginationQuery({ page: '0' }), 400, 'INVALID_PAGINATION');
      await assertAppError(async () => parsePaginationQuery({ page: '-4' }), 400, 'INVALID_PAGINATION');
    });

    it('rejects a limit outside 1..100', async () => {
      await assertAppError(async () => parsePaginationQuery({ limit: '0' }), 400, 'INVALID_PAGINATION');
      await assertAppError(async () => parsePaginationQuery({ limit: '101' }), 400, 'INVALID_PAGINATION');
    });

    it('rejects non-numeric and fractional values', async () => {
      await assertAppError(async () => parsePaginationQuery({ page: 'abc' }), 400, 'INVALID_PAGINATION');
      await assertAppError(async () => parsePaginationQuery({ limit: '2.5' }), 400, 'INVALID_PAGINATION');
    });

    it('rejects malformed query objects', async () => {
      await assertAppError(async () => parsePaginationQuery(null), 400, 'INVALID_PAGINATION');
      await assertAppError(async () => parsePaginationQuery('page=1'), 400, 'INVALID_PAGINATION');
    });
  });

  describe('calculateRange', () => {
    it('produces an inclusive range for the first page', () => {
      assert.deepEqual(calculateRange(1, 20), { start: 0, end: 19 });
    });

    it('offsets subsequent pages by the page size', () => {
      assert.deepEqual(calculateRange(2, 20), { start: 20, end: 39 });
      assert.deepEqual(calculateRange(3, 10), { start: 20, end: 29 });
    });

    it('handles a page size of one', () => {
      assert.deepEqual(calculateRange(5, 1), { start: 4, end: 4 });
    });

    it('always spans exactly `limit` rows', () => {
      for (const limit of [1, 5, 20, 100]) {
        const { start, end } = calculateRange(7, limit);
        assert.equal(end - start + 1, limit, `limit ${limit}`);
      }
    });
  });

  describe('createPaginatedResponse', () => {
    it('wraps rows in the pagination envelope', () => {
      const rows = [{ id: 'a' }, { id: 'b' }];

      assert.deepEqual(createPaginatedResponse(rows, 42, 2, 20), {
        data: rows,
        total: 42,
        page: 2,
        limit: 20,
      });
    });

    it('supports an empty result set', () => {
      assert.deepEqual(createPaginatedResponse([], 0, 1, 20), { data: [], total: 0, page: 1, limit: 20 });
    });
  });
});
