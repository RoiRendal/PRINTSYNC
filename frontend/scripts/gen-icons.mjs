#!/usr/bin/env node
/**
 * Icon codegen — vendors the Ionicons outline set into one in-repo module.
 *
 * PrintSync renders its icons as named React components. Ionicons publishes no
 * official React components, so rather than pull in a third-party wrapper we
 * copy the glyph geometry out of the `ionicons` package once and commit it as
 * `src/shared/components/ui/icons.tsx`. That keeps the runtime dependency count
 * unchanged (Ionicons is a devDependency, used only here) and matches the
 * project's self-hosted, no-CDN stance.
 *
 * Each export deliberately keeps the name it had under `lucide-react`, so every
 * call site changes only its import path — no JSX is touched. The mapping lives
 * in scripts/icon-map.mjs.
 *
 * Re-run after bumping `ionicons`:  node scripts/gen-icons.mjs
 *
 * Exit code 0 = written; 1 = a mapped glyph is missing from the package.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_MAP } from './icon-map.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(HERE, '..');
const SVG_DIR = path.join(FRONTEND_ROOT, 'node_modules', 'ionicons', 'dist', 'svg');
const OUT = path.join(FRONTEND_ROOT, 'src', 'shared', 'components', 'ui', 'icons.tsx');

/** SVG attribute -> JSX attribute. Ionicons only uses this small set. */
const ATTR_MAP = [
  ['stroke-width', 'strokeWidth'],
  ['stroke-linejoin', 'strokeLinejoin'],
  ['stroke-linecap', 'strokeLinecap'],
  ['stroke-miterlimit', 'strokeMiterlimit'],
  ['stroke-dasharray', 'strokeDasharray'],
  ['stroke-dashoffset', 'strokeDashoffset'],
  ['stroke-opacity', 'strokeOpacity'],
  ['fill-rule', 'fillRule'],
  ['fill-opacity', 'fillOpacity'],
  ['clip-rule', 'clipRule'],
  ['clip-path', 'clipPath'],
  ['font-size', 'fontSize'],
  ['text-anchor', 'textAnchor'],
  ['class', 'className'],
];

function toJsx(inner) {
  let s = inner;
  for (const [from, to] of ATTR_MAP) s = s.replaceAll(`${from}=`, `${to}=`);
  // Collapse the source whitespace; geometry is untouched.
  return s.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
}

const missing = [];
const blocks = [];

for (const [exportName, base] of Object.entries(ICON_MAP)) {
  const file = path.join(SVG_DIR, `${base}-outline.svg`);
  if (!fs.existsSync(file)) {
    missing.push(`${exportName} -> ${base}-outline.svg`);
    continue;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!match) {
    missing.push(`${exportName} -> ${base}-outline.svg (no <svg> body)`);
    continue;
  }
  const inner = toJsx(match[1]);
  blocks.push(
    `export const ${exportName} = ({ className, ...props }: SVGProps<SVGSVGElement>) => (\n` +
      `  <svg viewBox="0 0 512 512" width="24" height="24" fill="currentColor" className={className} {...props}>\n` +
      `    ${inner}\n` +
      `  </svg>\n` +
      `);`,
  );
}

if (missing.length) {
  console.error('gen-icons: mapped glyph(s) not found in ionicons package:');
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

const header = `/**
 * PrintSync icon set — Ionicons (outline).
 *
 * GENERATED FILE — do not edit by hand. Run \`node scripts/gen-icons.mjs\` after
 * bumping the \`ionicons\` devDependency.
 *
 * Every export keeps the name it had under the previous set (lucide-react), so
 * call sites change only their import path. See scripts/icon-map.mjs for which
 * Ionicons glyph sits behind each name.
 */
import type { ComponentType, SVGProps } from 'react';

/** The shape every icon in this module satisfies. */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
`;

fs.writeFileSync(OUT, `${header}\n${blocks.join('\n\n')}\n`, 'utf8');
console.log(`gen-icons: wrote ${blocks.length} icons to ${path.relative(FRONTEND_ROOT, OUT)}`);
