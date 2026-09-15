import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCsvHeaders, formatCsvRow } from '../../src/shared/csv.js';

describe('shared/csv', () => {
  describe('formatCsvRow', () => {
    it('joins plain values with commas and terminates with CRLF', () => {
      assert.equal(formatCsvRow(['order-1', 'Acme', '250']), 'order-1,Acme,250\r\n');
    });

    it('stringifies numbers and booleans', () => {
      assert.equal(formatCsvRow([1, 2.5, true, false]), '1,2.5,true,false\r\n');
    });

    it('renders null and undefined as empty cells', () => {
      assert.equal(formatCsvRow([null, undefined, 'x']), ',,x\r\n');
    });

    it('quotes cells containing a comma', () => {
      assert.equal(formatCsvRow(['Banner, large format', 'ok']), '"Banner, large format",ok\r\n');
    });

    it('escapes embedded quotes by doubling them', () => {
      assert.equal(formatCsvRow(['12" x 18" poster']), '"12"" x 18"" poster"\r\n');
    });

    it('quotes cells containing a line break', () => {
      assert.equal(formatCsvRow(['line one\nline two']), '"line one\nline two"\r\n');
      assert.equal(formatCsvRow(['line one\r\nline two']), '"line one\r\nline two"\r\n');
    });

    it('preserves a lone carriage return', () => {
      assert.equal(formatCsvRow(['a\rb']), '"a\rb"\r\n');
    });

    it('handles a row with a single empty value', () => {
      assert.equal(formatCsvRow(['']), '\r\n');
    });

    it('handles an empty row', () => {
      assert.equal(formatCsvRow([]), '\r\n');
    });

    it('escapes a cell that mixes quotes, commas and newlines', () => {
      assert.equal(formatCsvRow(['He said "hi", then\nleft']), '"He said ""hi"", then\nleft"\r\n');
    });

    it('produces one line per row so the stream stays parseable', () => {
      const csv = formatCsvRow(['a', 'b']) + formatCsvRow(['c', 'd']);

      assert.equal(csv, 'a,b\r\nc,d\r\n');
      assert.equal(csv.split('\r\n').filter(Boolean).length, 2);
    });
  });

  describe('formatCsvHeaders', () => {
    it('formats headers with the same rules as data rows', () => {
      assert.equal(formatCsvHeaders(['Order ID', 'Customer', 'Total']), 'Order ID,Customer,Total\r\n');
    });

    it('escapes header names that need quoting', () => {
      assert.equal(formatCsvHeaders(['Notes, internal', 'Total']), '"Notes, internal",Total\r\n');
    });
  });
});
