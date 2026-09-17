/**
 * Placeholder artwork for the demo dataset.
 *
 * These are generated SVGs, not photographs: a print shop's real artwork is
 * customer-supplied and cannot be shipped with a seed script. Each file is a
 * clean, on-brand mock so the design library and product grid render properly
 * instead of showing empty frames.
 */

interface Palette {
  bg: string;
  accent: string;
  ink: string;
}

const CATEGORY_PALETTE: Record<string, Palette> = {
  Tarpaulin: { bg: '#E1F5EE', accent: '#0F6E56', ink: '#04342C' },
  'Large Format': { bg: '#E6F1FB', accent: '#185FA5', ink: '#042C53' },
  'Stickers & Decals': { bg: '#FAECE7', accent: '#993C1D', ink: '#4A1B0C' },
  'Photo & Paper': { bg: '#EEEDFE', accent: '#534AB7', ink: '#26215C' },
  'Cards & Stationery': { bg: '#FAEEDA', accent: '#854F0B', ink: '#412402' },
  'Toner & Ink': { bg: '#F1EFE8', accent: '#5F5E5A', ink: '#2C2C2A' },
  Apparel: { bg: '#FBEAF0', accent: '#993556', ink: '#4B1528' },
  Giveaways: { bg: '#EAF3DE', accent: '#3B6D11', ink: '#173404' },
  Finishing: { bg: '#FCEBEB', accent: '#A32D2D', ink: '#501313' },
};

const FALLBACK_PALETTE: Palette = { bg: '#F1EFE8', accent: '#5F5E5A', ink: '#2C2C2A' };

function paletteFor(category: string): Palette {
  return CATEGORY_PALETTE[category] ?? FALLBACK_PALETTE;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Splits a label into lines of roughly equal length without breaking words. */
function wrapLabel(label: string, maxChars: number, maxLines: number): string[] {
  const words = label.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines);
}

export function productArtwork(name: string, category: string, sku: string): string {
  const { bg, accent, ink } = paletteFor(category);
  const lines = wrapLabel(name, 20, 3);
  const textBlock = lines
    .map((line, index) => `<text x="240" y="${196 + index * 30}" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="600" fill="${ink}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
<rect width="480" height="360" fill="${bg}"/>
<rect x="40" y="52" width="400" height="256" rx="18" fill="#FFFFFF" opacity="0.85"/>
<rect x="40" y="52" width="400" height="48" rx="18" fill="${accent}"/>
<rect x="40" y="88" width="400" height="12" fill="${accent}"/>
<text x="240" y="82" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600" fill="#FFFFFF" text-anchor="middle">${escapeXml(category.toUpperCase())}</text>
<circle cx="240" cy="140" r="26" fill="${accent}" opacity="0.18"/>
<rect x="200" y="128" width="80" height="24" rx="6" fill="${accent}" opacity="0.55"/>
${textBlock}
<text x="240" y="288" font-family="Consolas, monospace" font-size="15" fill="${accent}" text-anchor="middle" letter-spacing="2">${escapeXml(sku)}</text>
</svg>`;
}

export function designArtwork(name: string, category: string, tags: readonly string[]): string {
  const { bg, accent, ink } = paletteFor(category);
  const lines = wrapLabel(name, 22, 3);
  const textBlock = lines
    .map((line, index) => `<text x="400" y="${470 + index * 44}" font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="600" fill="${ink}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join('');
  const tagText = tags.slice(0, 3).join('  ·  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
<rect width="800" height="800" fill="${bg}"/>
<rect x="64" y="96" width="672" height="608" rx="24" fill="#FFFFFF"/>
<rect x="64" y="96" width="672" height="96" rx="24" fill="${accent}"/>
<rect x="64" y="168" width="672" height="24" fill="${accent}"/>
<text x="400" y="158" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="600" fill="#FFFFFF" text-anchor="middle">${escapeXml(category.toUpperCase())}</text>
<circle cx="400" cy="330" r="86" fill="${accent}" opacity="0.16"/>
<rect x="272" y="300" width="256" height="60" rx="14" fill="${accent}" opacity="0.6"/>
<rect x="272" y="382" width="160" height="20" rx="10" fill="${accent}" opacity="0.35"/>
${textBlock}
<rect x="240" y="620" width="320" height="4" rx="2" fill="${accent}" opacity="0.4"/>
<text x="400" y="662" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="${accent}" text-anchor="middle">${escapeXml(tagText)}</text>
</svg>`;
}

export function businessLogo(businessName: string): string {
  const initials = businessName
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 3)
    .toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="#185FA5"/>
<rect x="96" y="128" width="320" height="256" rx="28" fill="#FFFFFF" opacity="0.94"/>
<rect x="128" y="160" width="256" height="32" rx="16" fill="#185FA5" opacity="0.35"/>
<rect x="128" y="216" width="192" height="24" rx="12" fill="#185FA5" opacity="0.55"/>
<rect x="128" y="264" width="224" height="24" rx="12" fill="#185FA5" opacity="0.4"/>
<rect x="128" y="312" width="144" height="24" rx="12" fill="#185FA5" opacity="0.28"/>
<text x="256" y="440" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="4">${escapeXml(initials)}</text>
</svg>`;
}
