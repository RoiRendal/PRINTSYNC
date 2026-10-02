import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

/**
 * The branch-source gate is a security tool, so this suite verifies the tool.
 *
 * Two properties matter and neither is self-evident:
 *
 *   1. It **catches** each way a branch could be taken from the client — query,
 *      body, params, headers, and destructuring. A gate that catches four of five
 *      is a gate that is trusted and wrong.
 *   2. It **refuses to pass on an empty scan**. A wrong backend-root calculation
 *      would make it scan zero files and print "pass", turning "we did not look"
 *      into "no client-controlled branch reads exist" — worse than having no gate
 *      at all, because it is believed.
 *
 * Each case copies the real script into a throwaway tree and controls what
 * surrounds it, because the script's whole job is a property of a file tree.
 */

const SCRIPT_SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '../../scripts/check-branch-source.mjs');

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs the gate from `<sandbox>/backend/scripts/` so its `..` backend-root
 * calculation lands on the sandbox rather than on the real repository.
 */
function runGate(sandbox: string): RunResult {
  const scriptDir = join(sandbox, 'backend', 'scripts');
  mkdirSync(scriptDir, { recursive: true });
  cpSync(SCRIPT_SOURCE, join(scriptDir, 'check-branch-source.mjs'));
  try {
    const stdout = execFileSync(process.execPath, [join(scriptDir, 'check-branch-source.mjs')], {
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

function makeSandbox(): string {
  const parent = resolve(dirname(fileURLToPath(import.meta.url)), '../..', '.tmp-branch-gate');
  mkdirSync(parent, { recursive: true });
  return mkdtempSync(join(parent, 'case-'));
}

/** Writes a source file under `<sandbox>/backend/src/routes/`. */
function writeRoute(sandbox: string, name: string, body: string): void {
  const routes = join(sandbox, 'backend', 'src', 'routes');
  mkdirSync(routes, { recursive: true });
  writeFileSync(join(routes, name), body, 'utf8');
}

/**
 * A route body that reads a branch legitimately — the control case. Without a
 * passing case, a gate that failed everything would satisfy every test below.
 */
const HONEST_ROUTE = `import { Router } from 'express';
import { getCallerBranch } from '../shared/branchContext.js';
export const r = Router();
r.get('/', (request, response) => {
  const branchId = getCallerBranch(request);
  response.json({ branchId });
});
`;

describe('check-branch-source gate', () => {
  it('passes when every route takes its branch from request.auth', () => {
    const sandbox = makeSandbox();
    try {
      writeRoute(sandbox, 'honest.routes.ts', HONEST_ROUTE);

      const result = runGate(sandbox);

      assert.equal(result.status, 0, `expected pass, got:\n${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /pass \(1 source files scanned/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('catches a branch read from the query string', () => {
    const sandbox = makeSandbox();
    try {
      writeRoute(sandbox, 'forged.routes.ts', `${HONEST_ROUTE}\nconst forged = request.query.branch_id;\n`);

      const result = runGate(sandbox);

      assert.equal(result.status, 1, 'a query-string branch must fail the gate');
      assert.match(result.stderr, /reads a branch from request\.query/);
      assert.match(result.stderr, /forged\.routes\.ts/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('catches a branch read from the request body', () => {
    const sandbox = makeSandbox();
    try {
      writeRoute(sandbox, 'forged.routes.ts', `${HONEST_ROUTE}\nconst forged = request.body.branchId;\n`);

      const result = runGate(sandbox);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /reads a branch from request\.body/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('catches a branch read from a route param', () => {
    const sandbox = makeSandbox();
    try {
      writeRoute(sandbox, 'forged.routes.ts', `${HONEST_ROUTE}\nconst forged = req.params.branch_id;\n`);

      const result = runGate(sandbox);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /reads a branch from request\.params/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('catches a branch read from a header, by both spellings', () => {
    const sandbox = makeSandbox();
    try {
      writeRoute(
        sandbox,
        'forged.routes.ts',
        `${HONEST_ROUTE}\nconst a = request.headers['x-branch-id'];\nconst b = request.get('x-branch');\n`,
      );

      const result = runGate(sandbox);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /reads a branch from a request header/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('catches a branch destructured out of the query string', () => {
    const sandbox = makeSandbox();
    try {
      writeRoute(sandbox, 'forged.routes.ts', `${HONEST_ROUTE}\nconst { branchId } = request.query;\n`);

      const result = runGate(sandbox);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /destructures a branch out of request\.query/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('does not flag a legitimate read of request.auth.profile.branchId', () => {
    // The gate must not be so eager that it forbids the one correct source — a
    // false positive here would be "fixed" by disabling the gate.
    const sandbox = makeSandbox();
    try {
      writeRoute(
        sandbox,
        'auth.routes.ts',
        `${HONEST_ROUTE}\nconst direct = request.auth?.profile.branchId;\n`,
      );

      const result = runGate(sandbox);

      assert.equal(result.status, 0, `expected pass, got:\n${result.stderr}`);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('does not flag the rule in a comment', () => {
    // Every docblock in this codebase says "never from the query string". If
    // comments were scanned, the gate would fail on its own documentation.
    const sandbox = makeSandbox();
    try {
      writeRoute(
        sandbox,
        'documented.routes.ts',
        `${HONEST_ROUTE}\n// Never read request.query.branch_id — it is attacker-controlled.\n/* request.body.branchId is equally unsafe. */\n`,
      );

      const result = runGate(sandbox);

      assert.equal(result.status, 0, `expected pass, got:\n${result.stderr}`);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('refuses to pass when the scanned roots contain no TypeScript source', () => {
    // The regression guard for the empty scan: the roots exist but hold nothing,
    // so the gate cannot distinguish "clean" from "did not look".
    const sandbox = makeSandbox();
    try {
      mkdirSync(join(sandbox, 'backend', 'src', 'routes'), { recursive: true });

      const result = runGate(sandbox);

      assert.equal(result.status, 1, 'an empty scan must not report success');
      assert.match(result.stderr, /contain no TypeScript source/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('refuses to pass when the scanned roots do not exist at all', () => {
    const sandbox = makeSandbox();
    try {
      // Nothing created: the "wrong backend root" case.
      const result = runGate(sandbox);

      assert.equal(result.status, 1, 'missing roots must not report success');
      assert.match(result.stderr, /none of the scanned roots exist/);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
