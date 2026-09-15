import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { uploadDesignAsset, DESIGN_ASSET_BUCKET } from '../../src/services/designAssetService.js';
import {
  uploadBusinessLogo,
  BUSINESS_ASSET_BUCKET,
  MAX_BUSINESS_LOGO_BYTES,
} from '../../src/services/businessAssetService.js';
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  objectPathFromPublicUrl,
} from '../../src/services/imageAssetService.js';
import { createFakeSupabase, FakeSupabase } from './helpers/fakeSupabase.js';
import { assertAppError } from './helpers/assertAppError.js';

/** Smallest valid PNG; the services decode whatever bytes they are handed. */
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64').length;

const pngDataUrl = () => `data:image/png;base64,${PNG_BASE64}`;

/** A syntactically valid PNG data URL whose decoded payload is `bytes` long. */
function pngDataUrlOfSize(bytes: number): string {
  return `data:image/png;base64,${Buffer.alloc(bytes, 0x41).toString('base64')}`;
}

const ACTOR = 'actor-1';

function dbWithBuckets(): FakeSupabase {
  return createFakeSupabase()
    .onBucket(DESIGN_ASSET_BUCKET)
    .onBucket(BUSINESS_ASSET_BUCKET);
}

describe('image asset uploads', () => {
  describe('uploadDesignAsset', () => {
    it('writes the decoded bytes to the design-assets bucket', async () => {
      const db = dbWithBuckets();

      await uploadDesignAsset(db.client, {
        dataUrl: pngDataUrl(),
        fileName: 'artwork.png',
        contentType: 'image/png',
        sizeBytes: PNG_BYTES,
      }, ACTOR);

      const [upload] = db.storageUploadsFor(DESIGN_ASSET_BUCKET);
      assert.ok(upload, 'expected one upload to design-assets');
      assert.equal(upload.options?.contentType, 'image/png');
      assert.equal(upload.options?.upsert, false);
      assert.equal(upload.bytes.length, PNG_BYTES);
      // Byte-for-byte, so base64 decoding is proven correct rather than assumed.
      // Wrapped in Buffer because the fake records a plain Uint8Array.
      assert.deepEqual(Buffer.from(upload.bytes), Buffer.from(PNG_BASE64, 'base64'));
    });

    it('namespaces the object by actor and gives it a unique id', async () => {
      const db = dbWithBuckets();
      const input = {
        dataUrl: pngDataUrl(),
        fileName: 'artwork.png',
        contentType: 'image/png',
        sizeBytes: PNG_BYTES,
      };

      await uploadDesignAsset(db.client, input, ACTOR);
      await uploadDesignAsset(db.client, input, ACTOR);

      const [first, second] = db.storageUploadsFor(DESIGN_ASSET_BUCKET);
      assert.match(first!.path, new RegExp(`^${ACTOR}/[0-9a-f-]{36}\\.png$`));
      assert.notEqual(first!.path, second!.path);
    });

    it('returns the public URL for the stored object', async () => {
      const db = dbWithBuckets();

      const asset = await uploadDesignAsset(db.client, {
        dataUrl: pngDataUrl(),
        fileName: 'artwork.png',
        contentType: 'image/png',
        sizeBytes: PNG_BYTES,
      }, ACTOR);

      const [upload] = db.storageUploadsFor(DESIGN_ASSET_BUCKET);
      assert.equal(asset.imageUrl, `https://fake.supabase.co/storage/v1/object/public/design-assets/${upload!.path}`);
      assert.equal(asset.assetType, 'image/png');
      assert.equal(asset.assetSizeBytes, PNG_BYTES);
    });

    it('reports the decoded size, not the client-declared one', async () => {
      const db = dbWithBuckets();

      const asset = await uploadDesignAsset(db.client, {
        dataUrl: pngDataUrl(),
        fileName: 'artwork.png',
        contentType: 'image/png',
        // A client is free to under-report; the service must not trust it.
        sizeBytes: 1,
      }, ACTOR);

      assert.equal(asset.assetSizeBytes, PNG_BYTES);
    });

    it('stores a JPEG under a .jpg extension', async () => {
      const db = dbWithBuckets();

      await uploadDesignAsset(db.client, {
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        fileName: 'photo.jpeg',
        contentType: 'image/jpeg',
        sizeBytes: 12,
      }, ACTOR);

      assert.match(db.storageUploadsFor(DESIGN_ASSET_BUCKET)[0]!.path, /\.jpg$/);
    });

    it('accepts every documented content type', async () => {
      const db = dbWithBuckets();

      for (const contentType of ALLOWED_IMAGE_CONTENT_TYPES) {
        await uploadDesignAsset(db.client, {
          dataUrl: `data:${contentType};base64,QUJD`,
          fileName: 'asset',
          contentType,
          sizeBytes: 3,
        }, ACTOR);
      }

      assert.equal(db.storageUploadsFor(DESIGN_ASSET_BUCKET).length, ALLOWED_IMAGE_CONTENT_TYPES.length);
    });

    it('rejects a content type the bucket does not allow', async () => {
      const db = dbWithBuckets();

      await assertAppError(
        () => uploadDesignAsset(db.client, {
          dataUrl: 'data:image/gif;base64,R0lGODlh',
          fileName: 'anim.gif',
          contentType: 'image/gif',
          sizeBytes: 8,
        }, ACTOR),
        400,
        'INVALID_DESIGN_ASSET',
        'PNG, JPG, WebP, or SVG',
      );
      assert.equal(db.storageUploads.length, 0);
    });

    it('rejects a client-declared size above the 5 MB ceiling', async () => {
      const db = dbWithBuckets();

      await assertAppError(
        () => uploadDesignAsset(db.client, {
          dataUrl: pngDataUrl(),
          fileName: 'huge.png',
          contentType: 'image/png',
          sizeBytes: 5 * 1024 * 1024 + 1,
        }, ACTOR),
        400,
        'INVALID_DESIGN_ASSET',
      );
      assert.equal(db.storageUploads.length, 0);
    });

    it('rejects a payload whose decoded size exceeds the ceiling despite a small declared size', async () => {
      const db = dbWithBuckets();

      await assertAppError(
        () => uploadDesignAsset(db.client, {
          dataUrl: pngDataUrlOfSize(5 * 1024 * 1024 + 1),
          fileName: 'sneaky.png',
          contentType: 'image/png',
          sizeBytes: 10,
        }, ACTOR),
        400,
        'INVALID_DESIGN_ASSET',
        'exceeds',
      );
      assert.equal(db.storageUploads.length, 0);
    });

    it('accepts a payload that fits the design ceiling but not the logo ceiling', async () => {
      const db = dbWithBuckets();

      const asset = await uploadDesignAsset(db.client, {
        dataUrl: pngDataUrlOfSize(3 * 1024 * 1024),
        fileName: 'print.png',
        contentType: 'image/png',
        sizeBytes: 3 * 1024 * 1024,
      }, ACTOR);

      assert.equal(asset.assetSizeBytes, 3 * 1024 * 1024);
    });

    it('rejects a data URL that is not base64 image data', async () => {
      const db = dbWithBuckets();

      await assertAppError(
        () => uploadDesignAsset(db.client, {
          dataUrl: 'https://example.com/logo.png',
          fileName: 'logo.png',
          contentType: 'image/png',
          sizeBytes: 100,
        }, ACTOR),
        400,
        'INVALID_DESIGN_ASSET',
        'invalid',
      );
      assert.equal(db.storageUploads.length, 0);
    });

    it('rejects a payload whose declared type disagrees with the data URL', async () => {
      const db = dbWithBuckets();

      await assertAppError(
        () => uploadDesignAsset(db.client, {
          dataUrl: pngDataUrl(),
          fileName: 'mismatch.webp',
          contentType: 'image/webp',
          sizeBytes: PNG_BYTES,
        }, ACTOR),
        400,
        'INVALID_DESIGN_ASSET',
      );
      assert.equal(db.storageUploads.length, 0);
    });

    it('rejects a payload that decodes to zero bytes', async () => {
      const db = dbWithBuckets();

      await assertAppError(
        () => uploadDesignAsset(db.client, {
          // Base64 padding only: matches the data-URL shape but yields no bytes.
          dataUrl: 'data:image/png;base64,==',
          fileName: 'empty.png',
          contentType: 'image/png',
          sizeBytes: 1,
        }, ACTOR),
        400,
        'INVALID_DESIGN_ASSET',
        'empty',
      );
      assert.equal(db.storageUploads.length, 0);
    });

    it('maps a Storage failure to a 503 DESIGN_ASSET_UPLOAD_FAILED', async () => {
      const db = createFakeSupabase()
        .onBucket(DESIGN_ASSET_BUCKET, { error: { message: 'The resource already exists' } })
        .onBucket(BUSINESS_ASSET_BUCKET);

      await assertAppError(
        () => uploadDesignAsset(db.client, {
          dataUrl: pngDataUrl(),
          fileName: 'artwork.png',
          contentType: 'image/png',
          sizeBytes: PNG_BYTES,
        }, ACTOR),
        503,
        'DESIGN_ASSET_UPLOAD_FAILED',
      );
    });

    it('fails loudly when the bucket was never configured', async () => {
      const db = createFakeSupabase().onBucket(BUSINESS_ASSET_BUCKET);

      await assert.rejects(
        () => uploadDesignAsset(db.client, {
          dataUrl: pngDataUrl(),
          fileName: 'artwork.png',
          contentType: 'image/png',
          sizeBytes: PNG_BYTES,
        }, ACTOR),
        /no bucket configured with id "design-assets"/,
      );
    });
  });

  describe('uploadBusinessLogo', () => {
    it('writes to the business-assets bucket', async () => {
      const db = dbWithBuckets();

      const asset = await uploadBusinessLogo(db.client, {
        dataUrl: pngDataUrl(),
        fileName: 'logo.png',
        contentType: 'image/png',
        sizeBytes: PNG_BYTES,
      }, ACTOR);

      const [upload] = db.storageUploadsFor(BUSINESS_ASSET_BUCKET);
      assert.ok(upload, 'expected one upload to business-assets');
      assert.match(upload.path, new RegExp(`^${ACTOR}/[0-9a-f-]{36}\\.png$`));
      assert.equal(asset.imageUrl, `https://fake.supabase.co/storage/v1/object/public/business-assets/${upload.path}`);
      // Nothing may leak into the design bucket.
      assert.equal(db.storageUploadsFor(DESIGN_ASSET_BUCKET).length, 0);
    });

    it('rejects an oversized logo with the logo-specific requirement', async () => {
      const db = dbWithBuckets();

      await assertAppError(
        () => uploadBusinessLogo(db.client, {
          dataUrl: pngDataUrl(),
          fileName: 'logo.png',
          contentType: 'image/png',
          sizeBytes: MAX_BUSINESS_LOGO_BYTES + 1,
        }, ACTOR),
        400,
        'INVALID_BUSINESS_LOGO',
        '2 MB',
      );
      assert.equal(db.storageUploads.length, 0);
    });

    it('maps a Storage failure to a 503 BUSINESS_LOGO_UPLOAD_FAILED', async () => {
      const db = createFakeSupabase()
        .onBucket(DESIGN_ASSET_BUCKET)
        .onBucket(BUSINESS_ASSET_BUCKET, { error: { message: 'Bucket not found' } });

      await assertAppError(
        () => uploadBusinessLogo(db.client, {
          dataUrl: pngDataUrl(),
          fileName: 'logo.png',
          contentType: 'image/png',
          sizeBytes: PNG_BYTES,
        }, ACTOR),
        503,
        'BUSINESS_LOGO_UPLOAD_FAILED',
      );
    });

    it('rejects a non-image content type', async () => {
      const db = dbWithBuckets();

      await assertAppError(
        () => uploadBusinessLogo(db.client, {
          dataUrl: 'data:application/pdf;base64,JVBERi0=',
          fileName: 'logo.pdf',
          contentType: 'application/pdf',
          sizeBytes: 8,
        }, ACTOR),
        400,
        'INVALID_BUSINESS_LOGO',
      );
      assert.equal(db.storageUploads.length, 0);
    });
  });

  describe('bucket wiring', () => {
    it('uses the bucket ids the migrations created', () => {
      assert.equal(DESIGN_ASSET_BUCKET, 'design-assets');
      assert.equal(BUSINESS_ASSET_BUCKET, 'business-assets');
    });

    it('keeps the logo ceiling at or below the bucket file_size_limit', () => {
      // `20260915000000_storage_bucket.sql` sets file_size_limit = 2097152.
      assert.equal(MAX_BUSINESS_LOGO_BYTES, 2097152);
    });
  });

  describe('objectPathFromPublicUrl', () => {
    it('round-trips a URL built by getPublicUrl', () => {
      const db = dbWithBuckets();

      const { data } = db.storage.from(BUSINESS_ASSET_BUCKET).getPublicUrl('actor-1/logo.webp');

      assert.equal(objectPathFromPublicUrl(BUSINESS_ASSET_BUCKET, data.publicUrl), 'actor-1/logo.webp');
    });

    it('returns null for the bundled fallback logo', () => {
      // The same-origin fallback is not a Storage object, so there is nothing to
      // protect — and nothing to delete.
      assert.equal(objectPathFromPublicUrl(BUSINESS_ASSET_BUCKET, '/brand-logo.png'), null);
    });

    it('returns null for null or empty input', () => {
      assert.equal(objectPathFromPublicUrl(BUSINESS_ASSET_BUCKET, null), null);
      assert.equal(objectPathFromPublicUrl(BUSINESS_ASSET_BUCKET, ''), null);
    });

    it('returns null for a URL belonging to another bucket', () => {
      const url = `https://fake.supabase.co/storage/v1/object/public/${DESIGN_ASSET_BUCKET}/actor-1/art.png`;

      assert.equal(objectPathFromPublicUrl(BUSINESS_ASSET_BUCKET, url), null);
      assert.equal(objectPathFromPublicUrl(DESIGN_ASSET_BUCKET, url), 'actor-1/art.png');
    });

    it('returns null for an externally hosted logo', () => {
      assert.equal(objectPathFromPublicUrl(BUSINESS_ASSET_BUCKET, 'https://cdn.example.com/logo.png'), null);
    });

    it('drops the query string', () => {
      const url = `https://fake.supabase.co/storage/v1/object/public/${BUSINESS_ASSET_BUCKET}/actor-1/abc.png?v=2`;
      assert.equal(objectPathFromPublicUrl(BUSINESS_ASSET_BUCKET, url), 'actor-1/abc.png');
    });

    it('decodes percent-escaped path segments', () => {
      const url = `https://fake.supabase.co/storage/v1/object/public/${BUSINESS_ASSET_BUCKET}/actor%201/my%20logo.png`;
      assert.equal(objectPathFromPublicUrl(BUSINESS_ASSET_BUCKET, url), 'actor 1/my logo.png');
    });

    it('returns null when the URL stops at the bucket', () => {
      const url = `https://fake.supabase.co/storage/v1/object/public/${BUSINESS_ASSET_BUCKET}/`;
      assert.equal(objectPathFromPublicUrl(BUSINESS_ASSET_BUCKET, url), null);
    });
  });
});
