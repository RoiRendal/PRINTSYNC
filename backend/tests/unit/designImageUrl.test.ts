import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isAllowedDesignImageUrl } from '../../src/modules/designs/designImageUrl.js';

const SUPABASE_URL = 'https://ucpkqamnoizfpyhxywnv.supabase.co';

describe('isAllowedDesignImageUrl', () => {
  describe('accepts the only two shapes the app produces', () => {
    it('a bundled preview written as a rooted path', () => {
      assert.equal(isAllowedDesignImageUrl('/design-images/DSG-001.png', SUPABASE_URL), true);
    });

    it('a public URL on this project\'s own Storage origin', () => {
      const url = `${SUPABASE_URL}/storage/v1/object/public/design-assets/actor-1/asset.png`;
      assert.equal(isAllowedDesignImageUrl(url, SUPABASE_URL), true);
    });

    it('a value with surrounding whitespace', () => {
      assert.equal(isAllowedDesignImageUrl('  /design-images/DSG-001.png  ', SUPABASE_URL), true);
    });
  });

  describe('refuses the dangerous schemes', () => {
    /*
     * These all satisfy `z.string().url()` — `new URL()` accepts any scheme —
     * which is exactly the hole this validator closes. The stored value is
     * rendered as an `<img src>` and handed to `window.open` on the design grid,
     * the design table and the view dialog.
     */
    for (const value of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      it(`refuses ${value.split(':')[0]}:`, () => {
        assert.equal(isAllowedDesignImageUrl(value, SUPABASE_URL), false);
      });
    }
  });

  describe('refuses anything that resolves to another origin', () => {
    it('a protocol-relative URL', () => {
      assert.equal(isAllowedDesignImageUrl('//evil.example/a.png', SUPABASE_URL), false);
    });

    it('a third-party host', () => {
      assert.equal(isAllowedDesignImageUrl('https://images.example.com/a.png', SUPABASE_URL), false);
    });

    it('another Supabase project', () => {
      assert.equal(
        isAllowedDesignImageUrl('https://otherproject.supabase.co/storage/v1/object/public/design-assets/a.png', SUPABASE_URL),
        false,
      );
    });

    it('this origin on a different scheme', () => {
      assert.equal(isAllowedDesignImageUrl('http://ucpkqamnoizfpyhxywnv.supabase.co/a.png', SUPABASE_URL), false);
    });
  });

  it('refuses an absolute URL when the project is not configured', () => {
    // Nothing to vouch for the origin against, so nothing absolute is trusted.
    assert.equal(isAllowedDesignImageUrl(`${SUPABASE_URL}/storage/v1/a.png`, undefined), false);
    assert.equal(isAllowedDesignImageUrl('/design-images/DSG-001.png', undefined), true);
  });

  it('refuses blank and malformed values', () => {
    for (const value of ['', '   ', 'not a url', '/']) {
      assert.equal(isAllowedDesignImageUrl(value, SUPABASE_URL), false);
    }
  });
});
