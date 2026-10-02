import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

/**
 * The image-format gate is a verification tool, so this suite verifies the tool.
 *
 * A gate that passes when it cannot find anything is worse than no gate: it
 * launders "we did not look" into "everything is fine". The first draft of
 * `check-image-formats.mjs` did exactly that — a wrong repo-root calculation made
 * it scan zero directories and print "pass" — so the empty-scan cases below are
 * the point of this file, not padding.
 *
 * Each case copies the real script into a throwaway directory and controls what
 * surrounds it, because the script's whole job is a property of the file tree.
 */

const SCRIPT_SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../../scripts/check-image-formats.mjs');

/** A real JPEG: the repository's own logo, which begins FF D8 FF E0. */
const REAL_JPEG = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/brand-logo.jpg');

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs the gate from `<sandbox>/backend/scripts/` so its `../..` repo-root
 * calculation lands on the sandbox and not on the real repository.
 */
function runGate(sandbox: string): RunResult {
  const scriptDir = join(sandbox, 'backend', 'scripts');
  mkdirSync(scriptDir, { recursive: true });
  cpSync(SCRIPT_SOURCE, join(scriptDir, 'check-image-formats.mjs'));
  // The gate imports `image-size`; the sandbox is inside the repo's temp dir, so
  // resolving through the real `node_modules` keeps this test hermetic without a
  // second install.
  try {
    const stdout = execFileSync(process.execPath, [join(scriptDir, 'check-image-formats.mjs')], {
      cwd: sandbox,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

function makeRepoLocalSandbox(): string {
  const parent = resolve(dirname(fileURLToPath(import.meta.url)), '../..', '.tmp-image-gate');
  mkdirSync(parent, { recursive: true });
  return mkdtempSync(join(parent, 'case-'));
}

describe('check-image-formats gate', () => {
  it('passes when every shipped image matches its extension', () => {
    if (!existsSync(REAL_JPEG)) {
      // The fixture is the repository's own logo. If it is missing the gate
      // cannot be exercised meaningfully, and silently passing would hide that.
      assert.fail(`expected the repo logo fixture at ${REAL_JPEG}`);
    }

    const sandbox = makeRepoLocalSandbox();
    try {
      const publicDir = join(sandbox, 'frontend', 'public');
      mkdirSync(publicDir, { recursive: true });
      cpSync(REAL_JPEG, join(publicDir, 'honest-logo.jpg'));

      const result = runGate(sandbox);

      assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /pass \(1 shipped images verified/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('fails when an image is named for a format its bytes are not', () => {
    const sandbox = makeRepoLocalSandbox();
    try {
      const publicDir = join(sandbox, 'frontend', 'public');
      mkdirSync(publicDir, { recursive: true });
      // JPEG bytes under a `.png` name — the exact defect this gate was written
      // for, and the exact defect the repository shipped.
      cpSync(REAL_JPEG, join(publicDir, 'lying-logo.png'));

      const result = runGate(sandbox);

      assert.equal(result.status, 1, 'a mislabelled image must fail the gate');
      assert.match(result.stderr, /named "\.png" but the bytes are JPG/);
      assert.match(result.stderr, /lying-logo\.png/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('treats .jpeg as an honest name for JPEG bytes', () => {
    const sandbox = makeRepoLocalSandbox();
    try {
      const publicDir = join(sandbox, 'frontend', 'public');
      mkdirSync(publicDir, { recursive: true });
      // `.jpg` and `.jpeg` are the same format; both names are truthful and the
      // gate must not force a rename between them.
      cpSync(REAL_JPEG, join(publicDir, 'logo.jpeg'));

      const result = runGate(sandbox);

      assert.equal(result.status, 0, `expected pass, got:\n${result.stderr}`);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('refuses to pass when it finds nothing to scan', () => {
    // The regression guard. An empty scan is indistinguishable from a correct
    // repository unless the gate says so, and this is how the first draft
    // silently passed.
    const sandbox = makeRepoLocalSandbox();
    try {
      mkdirSync(join(sandbox, 'frontend', 'public'), { recursive: true });
      // No images anywhere, but the roots exist.

      const result = runGate(sandbox);

      assert.equal(result.status, 1, 'an empty scan must not report success');
      assert.match(result.stderr, /contain no images to verify/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('refuses to pass when the scanned roots do not exist at all', () => {
    const sandbox = makeRepoLocalSandbox();
    try {
      // Nothing created: this is the "wrong repo root" case.
      const result = runGate(sandbox);

      assert.equal(result.status, 1, 'missing roots must not report success');
      assert.match(result.stderr, /none of the scanned roots exist/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('reports a shipped image that cannot be decoded at all', () => {
    const sandbox = makeRepoLocalSandbox();
    try {
      const publicDir = join(sandbox, 'frontend', 'public');
      mkdirSync(publicDir, { recursive: true });
      // A truncated/absent header: named like an image, decodable as nothing.
      writeFileSync(join(publicDir, 'broken.png'), Buffer.from('this is not an image'));

      const result = runGate(sandbox);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /broken\.png/);
      assert.match(result.stderr, /could not be decoded/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('does not scan generated build output', () => {
    const sandbox = makeRepoLocalSandbox();
    try {
      const publicDir = join(sandbox, 'frontend', 'public');
      mkdirSync(publicDir, { recursive: true });
      cpSync(REAL_JPEG, join(publicDir, 'honest-logo.jpg'));

      // A stale, mislabelled copy in the build output must not be able to fail
      // the gate — regenerating the build is the fix, not renaming source.
      const distDir = join(publicDir, 'dist');
      mkdirSync(distDir, { recursive: true });
      cpSync(REAL_JPEG, join(distDir, 'stale-copy.png'));

      const result = runGate(sandbox);

      assert.equal(result.status, 0, `dist must be skipped, got:\n${result.stderr}`);
      assert.match(result.stdout, /pass \(1 shipped images verified/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('ignores shipped files that are not raster images', () => {
    const sandbox = makeRepoLocalSandbox();
    try {
      const publicDir = join(sandbox, 'frontend', 'public');
      mkdirSync(join(publicDir, 'fonts'), { recursive: true });
      cpSync(REAL_JPEG, join(publicDir, 'honest-logo.jpg'));
      // An SVG is text, and a woff2 is a font; neither is in scope.
      writeFileSync(join(publicDir, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
      writeFileSync(join(publicDir, 'fonts', 'geist.woff2'), Buffer.alloc(16));

      const result = runGate(sandbox);

      assert.equal(result.status, 0, `non-images must be ignored, got:\n${result.stderr}`);
      assert.match(result.stdout, /2 non-image files ignored/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
