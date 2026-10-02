#!/usr/bin/env node
/**
 * Branch-source drift gate — "the branch comes from the session, never the client".
 *
 * ### Why this exists
 *
 * Phase 3's central rule is that a request's branch is read from
 * `request.auth.profile.branchId` — written there by the authenticate middleware
 * from the database row — and **never** from a query string, request body or
 * header. If a handler ever read a branch from one of those, any staff member
 * could read or write the other shop's orders, stock and customers simply by
 * adding a parameter. There would be no failing test, because the request would
 * succeed; the only symptom would be data appearing where it should not.
 *
 * That is a **source-level** property, and it is checkable as one. A behavioural
 * test would have to guess every parameter name on every endpoint and prove a
 * negative each time, and would still miss the next endpoint someone adds. This
 * gate reads the route and service sources and fails if a branch is ever taken
 * from a client-controlled location.
 *
 * ### What it looks for
 *
 * In `src/routes/**` and `src/modules/**`, any of:
 *
 *   - `request.query.branch_id` / `request.query.branchId`
 *   - `request.body.branch_id` / `request.body.branchId`
 *   - `request.headers[...branch...]` / `request.get('...branch...')`
 *   - `req.query|body|params|headers` followed by a branch-shaped key
 *   - destructuring a branch out of `request.query` / `request.body`
 *
 * The **sanctioned** source is `request.auth…branchId` (and its `getCallerBranch`
 * wrapper), which is not matched.
 *
 * ### The one allowed exception, stated rather than skipped
 *
 * Phase 4's head-office analytics selector is the single place a caller may *ask
 * for* another branch. It is read-only and analytics-only. Until it exists there
 * is nothing to exempt; when it is added, this gate must be taught about it
 * **explicitly** — a genuine entry in `ALLOWED`, with a reason — so that widening
 * the exception is a visible edit to a security gate rather than a quiet
 * parameter read. That is the point of listing it here now, empty.
 *
 * ### It refuses to pass on an empty scan
 *
 * A gate that finds no files and prints "pass" is worse than no gate: it turns an
 * unknown into an "ok". If the routes directory is missing or yields no files,
 * this exits 1.
 *
 * Exit code 0 = pass, 1 = a branch was read from a client-controlled source.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This file lives at `<repo>/backend/scripts/`, so the backend root is one level up. */
const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(HERE, '..');

/** Source roots to scan, relative to the backend root. */
const SCAN_ROOTS = ['src/routes', 'src/modules'];

/** Directories that hold no source and are skipped wherever they appear. */
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage']);

/**
 * Places a branch may legitimately be read from. Each entry names a file and a
 * LINE, so an exemption cannot be widened by accident.
 *
 * ### The one entry, and exactly what it covers
 *
 * Phase 4's head-office analytics selector is the single place a caller may *ask
 * for* a branch. It is read-only (no write path consults it — writes call
 * `getCallerBranch` and refuse head office the same as staff) and analytics-only.
 *
 * The exemption is **line-scoped on purpose**. `{ file, line }` rather than a bare
 * filename means a second branch read added anywhere else in the same file still
 * fails the gate, and moving the sanctioned read to a different line fails it too —
 * so the entry has to be re-affirmed rather than silently inherited.
 */
const ALLOWED = [
  {
    file: 'src/routes/analytics.routes.ts',
    line: 43,
    reason:
      'Head-office analytics selector: the `branch` field of the query schema that ' +
      '`effectiveBranch()` parses from `request.query`. Read-only and analytics-only — ' +
      '`resolveAnalyticsBranchFilter` refuses every account without `canViewAllBranches` ' +
      'with a 403, and no write path consults it.',
  },
  {
    file: 'src/routes/users.routes.ts',
    line: 27,
    reason:
      'User administration: `branchId` is a FIELD OF THE USER RECORD being created or ' +
      'edited, not a scope for the caller’s own request. An admin chooses which branch a ' +
      'new hire belongs to; the caller’s own branch is irrelevant to that and must not ' +
      'silently override it. Already gated by the `users.manage` permission, and it ' +
      'grants no read of any branch’s operational data.',
  },
];

/**
 * A `branch` key whose value is a **validator** — `branch: z.string()`, etc.
 *
 * ### Why this pattern had to be added
 *
 * The three patterns below catch a branch read *directly* off `request.query` etc.
 * They missed the shape this codebase actually uses: a Zod schema declares
 * `branch: z.string()`, and the handler passes `request.query` to `safeParse`. The
 * branch then arrives as `parsed.data.branch` — never touching `request.query.branch`
 * — so the read was invisible to the gate.
 *
 * That was a genuine hole, not a theoretical one: it meant someone could add
 * `branch: z.string().optional()` to the **orders** query schema, read
 * `parsed.data.branch`, and scope a list to another shop without the gate saying a
 * word. The decision to widen access would have been a one-line diff nobody was
 * forced to look at.
 *
 * ### Why it keys on the VALUE, not just the key
 *
 * A key named `branchId` is not by itself suspicious — it appears in response
 * payloads (`branchId: String(row.id)`) and in type annotations, which are not
 * request inputs at all. Flagging those would produce false positives on correct
 * code, and a gate with false positives is one people learn to work around. What is
 * worth flagging is a branch key bound to a **validator call** (`z.…`), because
 * that is what turns a client value into a parsed, trusted field.
 *
 * The value test is deliberately loose (`z.` or a `zod` import reference) rather
 * than a full parse: it is meant to force a human to justify the read, not to decide
 * the justification itself. A false positive costs one ALLOWED entry; a false
 * negative costs the other shop's data.
 */
const SCHEMA_BRANCH_KEY = /(?:^|[,{(\s])branch(?:_?[Ii][Dd]?)?\s*:\s*(?:z\.|zod\b|zodios)/m;

/**
 * `[clientSource].[branchKey]`, where clientSource is one of the four
 * client-controlled bags and branchKey matches `branch_id` or `branchId`.
 *
 * `params` is included: a route like `/orders/:branchId` would be just as
 * forgeable as a query string.
 */
const PATTERNS = [
  {
    // request.query.branch_id, request.body.branchId, req.params.branch_id …
    regex: /\b(?:request|req)\.(query|body|params)\s*\.\s*branch_?[Ii]d\b/g,
    what: (match) => `reads a branch from request.${match[1]}`,
  },
  {
    // request.headers['x-branch-id'], request.get('branch').
    regex: /\b(?:request|req)\.(?:headers|get|header)\s*[([]["'`][^"'`)]*branch[^"'`)]*["'`][)\]]/gi,
    what: () => 'reads a branch from a request header',
  },
  {
    // const { branchId } = request.query;  /  const { branch_id: b } = req.body;
    regex: /\bconst\s*\{[^}]*\bbranch_?[Ii]d\b[^}]*\}\s*=\s*(?:request|req)\.(query|body|params)\b/g,
    what: (match) => `destructures a branch out of request.${match[1]}`,
  },
  {
    // A `branch` key declared in a schema or object literal — the shape a branch
    // takes when it arrives via `schema.safeParse(request.query)`. See the note above.
    regex: SCHEMA_BRANCH_KEY,
    what: () => 'declares a branch key (e.g. in a query/body schema) that becomes client-controlled',
  },
];

function walk(directory, found = []) {
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      walk(full, found);
    } else if (full.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

const files = [];
const absentRoots = [];
for (const root of SCAN_ROOTS) {
  const absolute = join(BACKEND_ROOT, root);
  if (!existsSync(absolute)) {
    absentRoots.push(root);
    continue;
  }
  files.push(...walk(absolute));
}

/*
 * Refuse to pass on an empty scan — see the header. Every root absent, or no
 * TypeScript source found in any of them, means the gate is looking in the wrong
 * place, which is exactly the condition it must never report as "pass".
 */
if (absentRoots.length === SCAN_ROOTS.length) {
  console.error(
    `branch-source gate: FAIL — none of the scanned roots exist (${SCAN_ROOTS.join(', ')}) under ${BACKEND_ROOT}.\n` +
      'The gate is not looking at this repository; fix the root calculation before trusting a pass.',
  );
  process.exit(1);
}
if (files.length === 0) {
  console.error(
    `branch-source gate: FAIL — the roots exist (${SCAN_ROOTS.filter((r) => !absentRoots.includes(r)).join(', ')}) ` +
      `but contain no TypeScript source, under ${BACKEND_ROOT}.\n` +
      'An empty scan cannot distinguish "no branch is read from a client" from "nothing was looked at".',
  );
  process.exit(1);
}

const failures = [];
let checked = 0;

/**
 * Which ALLOWED entries actually matched a line.
 *
 * Tracked so a stale exemption is caught. An entry pointing at a line that has
 * moved — or at a file that no longer exists — is an exemption the gate is still
 * granting but nothing needs, and the dangerous version of that is an entry whose
 * line number has drifted onto a NEW, unexplained branch read. Requiring every
 * entry to match means the list cannot rot into a standing permission: the moment
 * the sanctioned read moves, the gate fails and the entry has to be re-justified.
 */
const matchedExemptions = new Set();

for (const file of files.sort()) {
  const shown = relative(BACKEND_ROOT, file).split('\\').join('/');
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, index) => {
    // Comments explain these rules and would otherwise trip the gate — every
    // docblock in this codebase says "never from the query string".
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    for (const { regex, what } of PATTERNS) {
      regex.lastIndex = 0;
      const match = regex.exec(code);
      if (!match) continue;

      checked += 1;
      const exemption = ALLOWED.find((entry) => entry.file === shown && entry.line === index + 1);
      if (exemption) {
        matchedExemptions.add(exemption);
      } else {
        failures.push({ file: shown, line: index + 1, source: line.trim(), reason: what(match) });
      }
    }
  });
}

const staleExemptions = ALLOWED.filter((entry) => !matchedExemptions.has(entry));

if (staleExemptions.length > 0) {
  console.error(
    `branch-source gate: FAIL (${staleExemptions.length} stale ALLOWED entr${staleExemptions.length === 1 ? 'y' : 'ies'})\n`,
  );
  for (const entry of staleExemptions) {
    console.error(`  ${entry.file}:${entry.line}\n    -> no client-controlled branch read is at this line (the read moved, or the file changed)`);
  }
  console.error(
    '\nAn ALLOWED entry exempts one specific file and line, and every entry must still\n' +
      'match something. This entry no longer does, so it is either a leftover exemption\n' +
      'granting permission nothing needed — or, worse, the line has drifted onto a new\n' +
      'branch read it was never written for. Re-check the file and remove or correct the\n' +
      'entry in scripts/check-branch-source.mjs.\n',
  );
  process.exit(1);
}

if (failures.length > 0) {
  console.error(`branch-source gate: FAIL (${failures.length} client-controlled branch read${failures.length === 1 ? '' : 's'})\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}\n    ${failure.source}\n    -> ${failure.reason}`);
  }
  console.error(
    '\nA branch must come from `request.auth.profile.branchId` (via `getCallerBranch`),\n' +
      'which the authenticate middleware writes from the database row. A branch taken from\n' +
      'the query string, body, params or a header is attacker-controlled: any staff member\n' +
      'could name the other shop and read or write its data.\n' +
      'If this is the sanctioned head-office analytics selector, add the file and line to\n' +
      'ALLOWED in scripts/check-branch-source.mjs with a written reason.\n',
  );
  process.exit(1);
}

console.log(
  `branch-source gate: pass (${files.length} source files scanned, 0 unexplained client-controlled branch reads` +
    (ALLOWED.length > 0 ? `; ${ALLOWED.length} sanctioned exemption${ALLOWED.length === 1 ? '' : 's'}` : '') +
    (absentRoots.length > 0 ? `; absent roots skipped: ${absentRoots.join(', ')}` : '') +
    ')',
);
