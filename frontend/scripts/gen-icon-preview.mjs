#!/usr/bin/env node
/**
 * Icon review page — renders the whole PrintSync icon set (Ionicons outline)
 * into a single self-contained HTML file for visual review.
 *
 * Not part of the app or the build; a one-shot aid for eyeballing the mapping
 * in scripts/icon-map.mjs. Output: docs/icon-preview.html (docs/ is gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_MAP } from './icon-map.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const SVG_DIR = path.join(FRONTEND_ROOT, 'node_modules', 'ionicons', 'dist', 'svg');
const OUT = path.join(REPO_ROOT, 'docs', 'icon-preview.html');

const cards = [];
for (const [exportName, base] of Object.entries(ICON_MAP)) {
  const file = path.join(SVG_DIR, `${base}-outline.svg`);
  if (!fs.existsSync(file)) continue;
  const inner = fs.readFileSync(file, 'utf8').match(/<svg[^>]*>([\s\S]*?)<\/svg>/)[1].replace(/\s+/g, ' ').trim();
  cards.push(
    `<div class="card"><svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">${inner}</svg>` +
      `<div class="name">${exportName}</div><div class="glyph">${base}-outline</div></div>`,
  );
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PrintSync icons — Ionicons outline</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b0b0c; color: #e7e7ea;
         font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; padding: 32px; }
  h1 { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
  p.sub { color: #9a9aa2; font-size: 13px; margin: 0 0 24px; max-width: 720px; line-height: 1.6; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 12px; }
  .card { border: 1px solid #26262b; border-radius: 12px; padding: 18px 10px 14px; text-align: center; background: #141416; }
  .card svg { width: 28px; height: 28px; color: #e7e7ea; }
  .name { margin-top: 12px; font-size: 12px; font-weight: 500; color: #d7d7de; word-break: break-word; }
  .glyph { margin-top: 3px; font-size: 10px; color: #6f6f78; font-family: ui-monospace, monospace; }
</style>
</head>
<body>
  <h1>PrintSync icons — Ionicons (outline)</h1>
  <p class="sub">${cards.length} icons at 28px. The top label is the export name call sites import (unchanged from before, so no JSX changed); the small line is the Ionicons glyph now behind it.</p>
  <div class="grid">${cards.join('')}</div>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log(`gen-icon-preview: wrote ${cards.length} icons to ${path.relative(REPO_ROOT, OUT)}`);
