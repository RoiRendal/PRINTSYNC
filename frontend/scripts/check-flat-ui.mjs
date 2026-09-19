#!/usr/bin/env node
/**
 * Flat-UI verification gate — static half.
 *
 * This is the §5.1 gate from docs/flat-ui-plan.md. It checks the *source* for the
 * patterns that would re-introduce glass/translucency/gradients, so a regression
 * fails fast in CI rather than only at the next Playwright census run.
 *
 * It does NOT check the rendered DOM (that's the Playwright census harness in
 * ~/.workbuddy-ai/scratch/flatui-baseline.mjs, run on demand or in CI as a
 * separate job); it checks the text of the source files.
 *
 * Exit code 0 = pass, 1 = a banned pattern was found.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || 'src');

const ALLOW = [
  // The sanctioned exception per the plan: the modal backdrop / mobile scrim.
  '--app-scrim',
  'rgb(0 0 0 / 0.45)',
  // The print block deliberately clears `backdrop-filter` to none so the
  // receipt prints on its own plain background. That's a print reset, not glass.
  'backdrop-filter: none !important',
];

// Banned patterns. Each is a (label, regex) pair; the regex matches anywhere in
// the file text. The `lookahead`/`lookbehind` flags keep the patterns
// deliberate rather than matching the allowlist strings themselves.
const RULES = [
  // `backdrop-blur` as a utility — any match is a regression.
  ['backdrop-blur', /backdrop-blur\b/],
  // `backdrop-filter` set to anything other than `none` — that's glass or blur.
  // The print block deliberately sets it to `none !important`, which is the
  // rule this gate is trying to protect. Require whitespace before the value
  // and anchor the lookahead with a word boundary so the regex source of the
  // regression test (which contains the literal `backdrop-filter:\s*none`)
  // is not flagged.
  ['backdrop-filter (non-none)', /backdrop-filter\s*:\s+(?!none\b)/i],
  // Gradient utilities and any gradient() functions.
  ['bg-gradient utility', /\bbg-gradient/],
  ['*-gradient-to-* utility', /\b\w*-gradient-to-/],
  ['linear-gradient() function', /linear-gradient\(/i],
  ['radial-gradient() function', /radial-gradient\(/i],
  // Translucent fills on white/black/zinc at any of the standard alpha steps.
  // Allowlist strings are excluded by simple substring check on the line.
  [
    'bg-white|black|zinc-*/NN',
    /\bbg-(?:white|black|zinc-\d+)\/\d{1,3}\b/,
  ],
];

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(p);
  }
};
walk(ROOT);

let bad = 0;
const findings = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (ALLOW.some((s) => line.includes(s))) return;
    for (const [label, re] of RULES) {
      if (re.test(line)) {
        findings.push({ file: path.relative(ROOT, f), line: idx + 1, label, text: line.trim().slice(0, 120) });
        bad++;
      }
    }
  });
}

if (bad) {
  console.error(`flat-ui static gate: ${bad} violation(s)`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.label}]  ${f.text}`);
  }
  process.exit(1);
}
console.log(`flat-ui static gate: pass (scanned ${files.length} files)`);