#!/usr/bin/env node
/**
 * Image-format drift gate — the "does what it says on the tin" check.
 *
 * ### Why this exists
 *
 * The repository shipped a logo named `brand-logo.png` whose bytes began
 * `FF D8 FF E0` — a JPEG. Alongside it were fourteen product and design images
 * named `.png` of which twelve were WebP, JPEG or AVIF. Nothing failed, because
 * every layer that touches an image in the normal path identifies it by its
 * **extension** and then sniffs the real bytes: Webpack copies it, Vite serves
 * it, and the browser renders it. The mismatch is invisible until something
 * stops sniffing.
 *
 * It stopped being invisible when the logo became an *upload*. Storage serves an
 * object back under the content type it was stored with, so seeding JPEG bytes
 * as `image/png` publishes a mislabelled object — and an AVIF, which is not on
 * the allowlist at all, could never be uploaded through the app's own
 * validation even though the file appears to be a perfectly ordinary PNG.
 *
 * So: every image this repository ships must have a name that matches its bytes.
 * A `.jpg` and a `.jpeg` both count as JPEG, because both are honest.
 *
 * ### What it scans
 *
 * Directories that hold **shipped, committed assets**: anything under a `public/`
 * folder, and the backend's `assets/`. Generated output (`dist/`, `build/`) is
 * skipped — re-checking a copy of a checked file adds nothing but noise, and a
 * stale `dist/` should not be able to fail a build.
 *
 * ### What it cannot catch
 *
 * A file whose *extension* is right but whose bytes are a barely-valid image —
 * a truncated JPEG, say. Decoding the dimensions proves the header is a real
 * format header; it does not prove the pixels are intact. That is a job for a
 * rendering test, not a static gate.
 *
 * Exit code 0 = pass, 1 = a shipped image's extension does not match its bytes.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from 'image-size';

/** This file lives at `<repo>/backend/scripts/`, so the repo root is two levels up. */
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

/**
 * Roots to scan, relative to the repo root.
 *
 * Listed explicitly rather than walked from `/` so a new `node_modules` deep in
 * the tree can never be scanned by accident.
 */
const SCAN_ROOTS = ['frontend/public', 'backend/assets'];

/** Directories that hold build output, not source, and are skipped wherever they appear. */
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);

/**
 * Extension -> the format names that legitimately describe it.
 *
 * Keys are lower-case, without the leading dot. Values are the `type` strings
 * `image-size` reports. One extension may map to several formats only when they
 * are genuinely the same thing under different names (`.jpg` / `.jpeg`).
 */
const EXTENSION_FORMATS = {
  png: ['png'],
  jpg: ['jpg'],
  jpeg: ['jpg'],
  webp: ['webp'],
  gif: ['gif'],
  avif: ['avif', 'heic'],
  bmp: ['bmp'],
};

/** Extensions the gate knows how to verify. Anything else is reported, not ignored. */
const CHECKED_EXTENSIONS = new Set(Object.keys(EXTENSION_FORMATS));

function walk(directory, found = []) {
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      walk(full, found);
    } else {
      found.push(full);
    }
  }
  return found;
}

/**
 * A root the gate cannot read is a hard failure, never a quiet skip.
 *
 * The first draft of this file caught any read error and `continue`d, which meant
 * a wrong repo-root calculation made the gate scan nothing and print "pass". A
 * verification gate that passes when it cannot find the thing it verifies is
 * worse than no gate at all — it launders an unknown into an "ok". So the two
 * cases are separated: a genuinely absent optional root is tolerated *and said
 * out loud*, while an unreadable one stops the run.
 */
function collectFiles(absoluteRoot) {
  if (!existsSync(absoluteRoot)) return { files: [], present: false };
  return { files: walk(absoluteRoot), present: true };
}

const failures = [];
let checked = 0;
let skippedUnknown = 0;
const absentRoots = [];

for (const root of SCAN_ROOTS) {
  const absoluteRoot = join(REPO_ROOT, root);
  const { files, present } = collectFiles(absoluteRoot);

  if (!present) {
    absentRoots.push(root);
    continue;
  }

  for (const file of files.sort()) {
    const extension = extname(file).slice(1).toLowerCase();
    const shown = relative(REPO_ROOT, file).split('\\').join('/');

    if (!CHECKED_EXTENSIONS.has(extension)) {
      // A shipped file that is not an image at all (`.svg`, `.woff2`, a stray
      // `.md`) is out of scope, not a problem. Counted so the summary is honest
      // about how much was actually verified.
      skippedUnknown += 1;
      continue;
    }

    checked += 1;

    let detected;
    try {
      detected = imageSize(readFileSync(file)).type;
    } catch (error) {
      failures.push({
        file: shown,
        reason: `could not be decoded as any known image format (${error instanceof Error ? error.message : String(error)})`,
      });
      continue;
    }

    const allowed = EXTENSION_FORMATS[extension] ?? [];
    if (!allowed.includes(detected)) {
      failures.push({
        file: shown,
        reason: `named ".${extension}" but the bytes are ${detected.toUpperCase()}`,
      });
    }
  }
}

/*
 * Refuse to pass on an empty scan.
 *
 * Every root absent, or no image found in any of them, means the gate is not
 * looking where it thinks it is — the exact bug it was written to catch. Report
 * it as a failure so a misconfigured root is loud instead of green.
 */
if (absentRoots.length === SCAN_ROOTS.length) {
  console.error(
    `image-format gate: FAIL — none of the scanned roots exist (${SCAN_ROOTS.join(', ')}) under ${REPO_ROOT}.\n` +
      'The gate is not looking at this repository; fix the root calculation before trusting a pass.',
  );
  process.exit(1);
}

if (checked === 0) {
  console.error(
    `image-format gate: FAIL — the roots exist (${SCAN_ROOTS.filter((r) => !absentRoots.includes(r)).join(', ')}) ` +
      `but contain no images to verify, under ${REPO_ROOT}.\n` +
      'An empty scan cannot distinguish "everything is correct" from "nothing was looked at".',
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error(`image-format gate: FAIL (${failures.length} of ${checked} shipped images mislabelled)\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}\n    ${failure.reason}`);
  }
  console.error(
    '\nRename the file to match its real bytes, or re-encode it to the format the name claims.\n' +
      'If the bytes are right and only the name is wrong, renaming is always preferred:\n' +
      'a shipped asset should be the artwork that was supplied, not a re-compressed copy.',
  );
  process.exit(1);
}

console.log(
  `image-format gate: pass (${checked} shipped images verified, ${skippedUnknown} non-image files ignored)` +
    (absentRoots.length > 0 ? ` — absent roots skipped: ${absentRoots.join(', ')}` : ''),
);
