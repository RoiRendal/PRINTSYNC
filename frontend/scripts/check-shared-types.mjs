#!/usr/bin/env node
/**
 * Shared-contract drift gate — the source half.
 *
 * `src/shared/contracts/contract-guard.ts` asserts, at compile time, that each
 * feature module's exported types *are* the ones `@printsync/shared-types`
 * publishes. This script catches the move that precedes a divergence: a frontend
 * file going back to *declaring* a type the package owns instead of re-exporting
 * it. The two are complementary — the guard proves the current types agree, this
 * proves nobody has started a second copy.
 *
 * ### Why a text scan and not a type check
 *
 * By the time a hand-written copy has drifted far enough to be a type error, the
 * damage is already in the tree and the error points at the wrong file. The
 * declaration itself is the smell, and it is visible in the source.
 *
 * ### What it does not catch
 *
 * A copy under a *different* name — `MyOrder` duplicating `Order` — is invisible to
 * both halves of the guard. That is a naming problem rather than a drift problem,
 * and it is what code review is for.
 *
 * Exit code 0 = pass, 1 = a package-owned name is declared in the frontend.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const SHARED_SRC = path.join(REPO_ROOT, 'packages', 'shared-types', 'src');
const FRONTEND_SRC = path.join(FRONTEND_ROOT, 'src');
const PACKAGE_NAME = '@printsync/shared-types';

/**
 * Names the frontend may declare even though the package owns them.
 *
 * Each entry is a name collision that is *not* drift, so it needs a reason — if
 * the reason stops being true, the entry should go.
 */
const ALLOW = [
  {
    file: 'src/features/orders/types.ts',
    name: 'Transaction',
    reason:
      "the history table's own row shape, not the API's transaction. The package's " +
      '`Transaction` is the till row and is re-exported from `api/paymentsApi.ts` as ' +
      '`PaymentTransaction`; this one is a different concept that happens to share the ' +
      'name.',
  },
];

/** The type names `@printsync/shared-types` publishes. */
function packageOwnedNames() {
  const names = new Set();
  // Matches `export interface X` and `export type X = …`. Deliberately does not
  // match `export type { X } from …`, which is a re-export and is the pattern we
  // want; the `{` cannot start the capture group.
  const declaration = /^export\s+(?:interface|type)\s+([A-Za-z_$][\w$]*)/gm;
  for (const entry of fs.readdirSync(SHARED_SRC, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    const source = fs.readFileSync(path.join(SHARED_SRC, entry.name), 'utf8');
    for (const match of source.matchAll(declaration)) names.add(match[1]);
  }
  return names;
}

/** Every `.ts`/`.tsx` under `src`, tests excluded. */
function frontendFiles() {
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(full);
    }
  })(FRONTEND_SRC);
  return files;
}

const owned = packageOwnedNames();
if (owned.size === 0) {
  console.error(
    `shared-types drift gate: could not read any types from ${path.relative(REPO_ROOT, SHARED_SRC)}`,
  );
  process.exit(1);
}

const allowed = new Set(ALLOW.map((entry) => `${entry.file}\u0000${entry.name}`));
const violations = [];

/*
 * A declaration, and only a declaration.
 *
 * The trailing `(?:<|=|extends|\{)` is what distinguishes `type Foo = …` from the
 * inline `type Foo,` of an import specifier — `import { type DataDomain } from …`
 * reads as a type declaration to a naive pattern and produced exactly one false
 * positive here. A declaration is always followed by a generic list, `=`,
 * `extends` or the body brace; an import specifier is followed by `,` or `}`.
 */
const DECLARATION = /^\s*(?:export\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)\s*(?:<|=|extends|\{)/;

for (const file of frontendFiles()) {
  const relative = path.relative(FRONTEND_ROOT, file).split(path.sep).join('/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = DECLARATION.exec(line);
    if (!match) return;
    const name = match[1];
    if (!owned.has(name)) return;
    if (allowed.has(`${relative}\u0000${name}`)) return;
    violations.push({ file: relative, line: index + 1, name });
  });
}

if (violations.length) {
  console.error(`shared-types drift gate: ${violations.length} violation(s)`);
  console.error(
    `\n${PACKAGE_NAME} owns these names. Re-export them rather than declaring a copy:`,
  );
  for (const v of violations) {
    console.error(`\n  ${v.file}:${v.line}  declares \`${v.name}\``);
    console.error(`    → export type { ${v.name} } from '${PACKAGE_NAME}';`);
  }
  console.error(
    '\nIf a name is a genuinely different concept, add it to ALLOW in ' +
      'scripts/check-shared-types.mjs with a reason.\n',
  );
  process.exit(1);
}

console.log(
  `shared-types drift gate: pass (${owned.size} package names, ${frontendFiles().length} files scanned)`,
);
