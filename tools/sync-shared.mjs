// Copy shared/ modules into the Shopify theme app extension.
//
// Theme app extensions can only load files that physically live in their assets
// folder — they cannot import from the repo root or fetch cross-origin at parse
// time. So the extension needs a COPY. A copy is only safe if it cannot silently
// drift, hence this script plus the `--check` mode that the extremes harness runs.
//
//   node tools/sync-shared.mjs          # copy
//   node tools/sync-shared.mjs --check  # exit 1 if a copy is stale

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'shopify-app/extensions/styla-fit-widget/assets');

// source in shared/  ->  filename inside the extension's assets/
export const SYNCED = [
  ['fit-ui.js', 'styla-fit-ui.js'],
  ['size-conversion.js', 'styla-size-conversion.js'],
];

const BANNER = (src) => `/* GENERATED COPY of shared/${src} — do not edit here.\n` +
  ` * Edit shared/${src} and run: node tools/sync-shared.mjs\n` +
  ` * Theme app extensions can only load local assets, so this copy exists on\n` +
  ` * purpose; tools/sync-shared.mjs --check fails the build if it drifts. */\n`;

const check = process.argv.includes('--check');
let stale = 0;

for (const [src, out] of SYNCED) {
  const from = join(ROOT, 'shared', src);
  const to = join(DEST, out);
  if (!existsSync(from)) { console.error(`missing source: shared/${src}`); process.exit(1); }
  const want = BANNER(src) + readFileSync(from, 'utf8');
  const have = existsSync(to) ? readFileSync(to, 'utf8') : null;
  if (have === want) { if (!check) console.log(`  up to date  ${out}`); continue; }
  if (check) { console.error(`  STALE       ${out}  (run: node tools/sync-shared.mjs)`); stale++; continue; }
  writeFileSync(to, want);
  console.log(`  ${have === null ? 'created    ' : 'updated    '} ${out}`);
}

if (check && stale) process.exit(1);
if (check) console.log(`  ${SYNCED.length} shared copies in sync`);
