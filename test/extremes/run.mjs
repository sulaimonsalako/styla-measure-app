// Adversarial harness for the Shopify widget stack.
//   node test/extremes/run.mjs            # summary
//   node test/extremes/run.mjs --verbose  # every violation, with the case data
//
// This does NOT assert "the answer is right" -- for most of these fixtures there
// is no right answer. It asserts the engine stays HONEST: it must not crash, must
// not leak NaN/undefined to the widget, and above all must not return a confident
// size when it had nothing to compare.

import { createRequire } from 'module';
import { runSizingEngine } from '../../api/_helpers/sizing-engine.js';
import { BODIES, CHARTS, SIZE_INPUTS, COLUMN_LABELS, PRODUCTS } from './cases.mjs';

const require = createRequire(import.meta.url);
const SZ = require('../../shared/size-conversion.js');
const CK = require('../../shared/chart-keys.js');
const TAX = require('../../shared/taxonomy.js');
const VAR = require('../../shared/variant-size.js');   // the SHIPPED size-axis resolver

const VERBOSE = process.argv.includes('--verbose');
const findings = [];
const add = (sev, area, rule, detail, ctx) => findings.push({ sev, area, rule, detail, ctx });

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const deepScan = (v, hit, path = '') => {
  if (v === undefined) return hit.push(path + ' = undefined');
  if (typeof v === 'number' && !Number.isFinite(v)) return hit.push(`${path} = ${v}`);
  if (typeof v === 'string' && /\b(NaN|undefined|\[object Object\])\b/.test(v)) hit.push(`${path} contains "${v.match(/\b(NaN|undefined|\[object Object\])\b/)[0]}"`);
  if (v && typeof v === 'object') for (const k of Object.keys(v)) deepScan(v[k], hit, path ? `${path}.${k}` : k);
  return hit;
};

// The full output contract. Every return path in the engine must carry all of
// these -- a path that omits `candidates`/`insufficient_data` silently defeats
// the widget's "can't size this" guard and shows a bogus size to a shopper.
const CONTRACT = ['recommended_size', 'fit_match_score', 'dimensions_compared', 'fit_spectrum',
                  'fit_breakdown', 'fit_facts', 'explanation', 'candidates'];

// ------------------------------------------------- 1. ENGINE: body x chart ----
let ran = 0;
for (const b of BODIES) {
  for (const c of CHARTS) {
    const ctx = `${b.id} x ${c.id}`;
    let out;
    ran++;
    try {
      out = runSizingEngine(b.user, c.chart);
    } catch (e) {
      add('CRASH', 'engine', 'must not throw', `${e.name}: ${e.message}`, ctx);
      continue;
    }
    if (out === null || typeof out !== 'object') {
      add('CRASH', 'engine', 'must return an object', String(out), ctx); continue;
    }

    // Compare against NAMED rows only: the engine deliberately drops rows with no
    // name, because a shopper cannot select a size called "undefined".
    const names = (Array.isArray(c.chart.sizes) ? c.chart.sizes : [])
      .filter((s) => s && s.name != null && String(s.name).trim() !== '').map((s) => s.name);
    const score = out.fit_match_score;
    const dims = out.dimensions_compared;

    // null is a legitimate answer now: it means no size in the chart can physically
    // be worn. It must be accompanied by no_fit so the widget can explain why.
    if (out.recommended_size === null) {
      if (!out.no_fit)
        add('CRITICAL', 'engine', 'a null size is explained by no_fit', 'recommended_size null without no_fit', ctx);
      if (!Array.isArray(out.blocked_by) || !out.blocked_by.length)
        add('BUG', 'engine', 'no_fit names the blocking dimension', 'blocked_by empty', ctx);
    } else if (typeof out.recommended_size !== 'string' && out.recommended_size !== undefined) {
      add('BUG', 'engine', 'recommended_size is a string', `got ${typeof out.recommended_size}`, ctx);
    }

    if (!isNum(score))
      add('BUG', 'engine', 'score is a finite number', `got ${String(score)}`, ctx);
    else if (score < 0 || score > 100)
      add('BUG', 'engine', 'score within 0..100', `got ${score}`, ctx);

    if (out.recommended_size && out.recommended_size !== 'Unknown' && !names.includes(out.recommended_size))
      add('BUG', 'engine', 'recommends a size that exists in the chart',
          `got "${out.recommended_size}", chart has [${names.join(', ')}]`, ctx);

    // The one that actually hurts a shopper: a confident answer from no evidence.
    if (isNum(score) && score > 0 && (!isNum(dims) || dims === 0) && out.recommended_size !== 'Unknown')
      add('CRITICAL', 'engine', 'no confident size without a compared dimension',
          `size "${out.recommended_size}" at ${score}% with dimensions_compared=${String(dims)}`, ctx);

    if (Array.isArray(out.candidates)) {
      if (out.candidates.length !== names.length)
        add('BUG', 'engine', 'one candidate per chart size',
            `${out.candidates.length} candidates vs ${names.length} sizes`, ctx);
      for (const cand of out.candidates)
        if (!isNum(cand.score)) { add('BUG', 'engine', 'every candidate score is finite', `"${cand.name}" -> ${String(cand.score)}`, ctx); break; }
    } else add('BUG', 'engine', 'candidates is an array', typeof out.candidates, ctx);

    const missing = CONTRACT.filter((k) => !(k in out));
    if (missing.length)
      add('CRITICAL', 'engine', 'same output shape on every return path',
          `missing: ${missing.join(', ')}`, ctx);

    // Scoring 0 having COMPARED something is a legitimate "this fits terribly".
    // Scoring 0 having compared NOTHING is the dangerous case: the widget cannot
    // tell the two apart without the flag, and renders the size as a real answer.
    if (isNum(score) && score === 0 && dims === 0 && !out.insufficient_data && out.recommended_size !== 'Unknown')
      add('CRITICAL', 'engine', 'zero score with no compared dimension is flagged',
          `size "${out.recommended_size}" at 0%, dims=0, no insufficient_data`, ctx);

    const leaks = deepScan(out, []);
    if (leaks.length) add('BUG', 'engine', 'no NaN/undefined reaches the widget', leaks.slice(0, 3).join('; '), ctx);
  }
}

// -------------------------------------------- 2. SIZE-LABEL INPUT PARSING ----
for (const raw of SIZE_INPUTS) {
  const label = typeof raw === 'string' && raw.length > 40 ? raw.slice(0, 30) + `…(${raw.length})` : JSON.stringify(raw);
  try {
    const p = SZ.parseSizeText(raw);
    if (p !== null && typeof p !== 'object')
      add('BUG', 'input', 'parseSizeText returns object or null', `got ${typeof p}`, label);
    if (p && p.size !== undefined && typeof p.size === 'string' && p.size.length > 100)
      add('BUG', 'input', 'parsed size is bounded in length', `${p.size.length} chars`, label);
  } catch (e) {
    add('CRASH', 'input', 'parseSizeText must not throw', `${e.name}: ${e.message}`, label);
  }
  try { SZ.toMeasurements({ label: raw }); }
  catch (e) { add('CRASH', 'input', 'toMeasurements must not throw', `${e.name}: ${e.message}`, label); }
  try { SZ.fromSuitSize(raw, 'us'); }
  catch (e) { add('CRASH', 'input', 'fromSuitSize must not throw', `${e.name}: ${e.message}`, label); }
}

// ------------------------------------------------ 3. CHART COLUMN LABELS ----
for (const [col, expect] of COLUMN_LABELS) {
  const label = col.length > 40 ? col.slice(0, 30) + `…(${col.length})` : JSON.stringify(col);
  let got;
  try { got = CK.canonKeyFor(col); }
  catch (e) { add('CRASH', 'chart-keys', 'canonKeyFor must not throw', `${e.name}: ${e.message}`, label); continue; }
  if (expect === null && got) add('BUG', 'chart-keys', 'ambiguous labels map to null (never guess)', `"${col}" -> ${got}`, label);
  if (expect && got !== expect) add(expect ? 'GAP' : 'BUG', 'chart-keys', 'known labels map to the right key', `"${col}" -> ${got === null ? 'null' : got}, expected ${expect}`, label);
}

// ----------------------------------------------- 4. PRODUCT / CATEGORY ----
for (const p of PRODUCTS) {
  const ctx = p.id;
  // Category inference: does the taxonomy survive junk, and does it over-claim?
  try {
    const pt = String(p.product_type || '').toLowerCase();
    const cats = !pt ? [] : (TAX.TAXONOMY || []).filter((t) =>
      (t.includes || []).some((inc) => {
        const i = String(inc).toLowerCase();
        return i.includes(pt) || pt.includes(i);   // "Jeans" vs "Jeans / denim"
      }));
    if (cats.length > 1) add('GAP', 'product', 'product_type maps to one category', `"${p.product_type}" -> [${cats.map((c) => c.slug).join(', ')}]`, ctx);
  } catch (e) { add('CRASH', 'product', 'taxonomy lookup must not throw', `${e.name}: ${e.message}`, ctx); }

  // The option-axis bug from LIVERPOOL.md: option1 is assumed to be size.
  // Drive the SHIPPED resolver, not a copy of it. Build a variant whose option
  // values are the first value of each axis, then assert we read the size axis.
  const opts = p.options || [];
  const variant = {};
  opts.forEach((o, i) => { variant['option' + (i + 1)] = (o.values || [])[0]; });
  const sizeAxis = opts.find((o) => VAR.SIZE_OPTION.test(String((o && o.name) || '').trim()));
  let got;
  try { got = VAR.variantSize(p, variant); }
  catch (e) { add('CRASH', 'product', 'variantSize must not throw', `${e.name}: ${e.message}`, ctx); got = undefined; }
  if (sizeAxis) {
    const want = (sizeAxis.values || [])[0];
    if (got !== want)
      add('CRITICAL', 'product', 'size axis resolved by NAME, not position',
          `read "${got}" but the size axis holds "${want}"`, ctx);
  } else if (opts.length > 1 && got != null) {
    add('CRITICAL', 'product', 'no size axis means no guessed size',
        `guessed "${got}" from options [${opts.map((o) => o.name).join(', ')}]`, ctx);
  }
}

// ------------------------------- 5. HONESTY PARITY ACROSS SURFACES ----
// Both widget surfaces must reach the SAME verdict on "may we show this as a
// recommendation?". They previously disagreed: the Shopify widget checked
// candidates+insufficient_data, widget.html checked only that a size existed, so
// the bookmarklet showed confident sizes the storefront widget refused to show.
const FUI = require('../../shared/fit-ui.js');
for (const c of CHARTS) {
  const ctx = c.id;
  const r = runSizingEngine({ chest: 38, waist: 31, hips: 41, height: 66 }, c.chart);
  // Shape the engine output the way api/_match/widget-size.js does.
  const payload = { size: r.recommended_size, score: r.fit_match_score,
                    insufficient_data: !!r.insufficient_data, no_fit: !!r.no_fit, candidates: r.candidates };
  if (r.no_fit && r.recommended_size !== null)
    add('BUG', 'parity', 'no_fit means there is no size to show', `got "${r.recommended_size}"`, ctx);
  let v;
  try { v = FUI.shouldDecline(payload); }
  catch (e) { add('CRASH', 'parity', 'shouldDecline must not throw', `${e.name}: ${e.message}`, ctx); continue; }

  // The engine's own verdict is authoritative; the UI must not overrule it.
  if (r.insufficient_data && !v.decline)
    add('CRITICAL', 'parity', 'UI declines whenever the engine says it cannot size',
        `engine insufficient_data but UI would render "${r.recommended_size}"`, ctx);
  if (r.recommended_size === 'Unknown' && !v.decline)
    add('CRITICAL', 'parity', 'the literal size "Unknown" is never rendered',
        'UI would show "Unknown" as a size', ctx);
  // And it must not decline a perfectly good answer.
  if (!r.insufficient_data && r.dimensions_compared > 0 && r.fit_match_score > 50 && v.decline)
    add('BUG', 'parity', 'a good answer is not suppressed',
        `declined "${r.recommended_size}" at ${r.fit_match_score}% (${v.reason})`, ctx);
}

// ------------------------------------------- 6. SHARED-COPY DRIFT ----
// The Shopify theme extension can only load local assets, so shared/ modules are
// COPIED into its assets folder. A copy that silently drifts is exactly how the
// two widget surfaces diverged in the first place.
try {
  const { execFileSync } = await import('child_process');
  execFileSync(process.execPath, [new URL('../../tools/sync-shared.mjs', import.meta.url).pathname, '--check'],
               { stdio: 'pipe' });
} catch (e) {
  add('CRITICAL', 'shared', 'generated copies match shared/ sources',
      'run: node tools/sync-shared.mjs', 'shopify extension assets');
}

// ------------------------------------------------------------- REPORT ----
const order = { CRASH: 0, CRITICAL: 1, BUG: 2, GAP: 3 };
findings.sort((a, b) => order[a.sev] - order[b.sev] || a.rule.localeCompare(b.rule));

const grouped = new Map();
for (const f of findings) {
  const k = `${f.sev} ${f.area} ${f.rule}`;
  if (!grouped.has(k)) grouped.set(k, []);
  grouped.get(k).push(f);
}

console.log(`\n  ${ran} engine runs (${BODIES.length} bodies x ${CHARTS.length} charts)`);
console.log(`  ${SIZE_INPUTS.length} size inputs, ${COLUMN_LABELS.length} column labels, ${PRODUCTS.length} products`);
console.log(`  ${findings.length} findings\n`);

if (!grouped.size) { console.log('  no violations\n'); process.exit(0); }

const pad = (s, n) => String(s).padEnd(n);
console.log(`  ${pad('SEV', 9)}${pad('AREA', 12)}${pad('RULE', 46)}COUNT`);
console.log('  ' + '-'.repeat(76));
for (const [k, list] of grouped) {
  const [sev, area, rule] = k.split(' ');
  console.log(`  ${pad(sev, 9)}${pad(area, 12)}${pad(rule.slice(0, 44), 46)}${list.length}`);
  const show = VERBOSE ? list : list.slice(0, 3);
  for (const f of show) console.log(`      · ${pad(f.ctx, 32)} ${f.detail}`);
  if (!VERBOSE && list.length > 3) console.log(`      … ${list.length - 3} more (--verbose)`);
}
console.log('');
process.exit(findings.some((f) => f.sev === 'CRASH' || f.sev === 'CRITICAL') ? 1 : 0);
