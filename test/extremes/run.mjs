// Adversarial harness for the Shopify widget stack.
//   node test/extremes/run.mjs            # summary
//   node test/extremes/run.mjs --verbose  # every violation, with the case data
//
// This does NOT assert "the answer is right" -- for most of these fixtures there
// is no right answer. It asserts the engine stays HONEST: it must not crash, must
// not leak NaN/undefined to the widget, and above all must not return a confident
// size when it had nothing to compare.

import { createRequire } from 'module';
import { readFileSync } from 'fs';
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

// ------------------------- 6. MOVED IDENTIFIERS STILL REFERENCED ----
// When i18n/units moved into shared/fit-ui.js, `var UNIT` and `var LOCALE` went
// with them -- but ten call sites still read the bare identifiers. Each threw
// ReferenceError at click time and silently killed a whole flow (the gift form,
// the unit toggle, Calculate Fit). node --check can't see it: the syntax is fine,
// the reference is only wrong at runtime. Grep for it instead.
{
  const src = readFileSync(new URL('../../shopify-app/extensions/styla-fit-widget/assets/styla-widget.js',
                                   import.meta.url), 'utf8');
  // Identifier -> what it must be reached through now.
  const MOVED = { UNIT: 'FUI.getUnit()', LOCALE: 'FUI.getLocale()', STR: 'FUI.t()' };
  for (const [name, via] of Object.entries(MOVED)) {
    // bare read: not preceded by a dot or word char, not a property key
    const bare = new RegExp(`(?<![\\w.$])${name}\\b(?!\\s*:)`, 'g');
    const hits = (src.match(bare) || []).length;
    if (hits) add('CRITICAL', 'refactor', 'moved identifiers are not referenced bare',
                  `${name} read directly ${hits}x — use ${via}`, 'styla-widget.js');
  }
}

// ------------------- 7. A SOLD-OUT SIZE IS NOT A LICENCE TO MIS-SELL ----
// When the best size is out of stock the widget may offer an alternative, but
// only one that actually fits. It used to take the first AVAILABLE variant in
// chart order, which offered a 34 to a shopper the engine had sized at 38.
{
  const ALT_MIN = 70;   // must match ALT_MIN_SCORE in styla-widget.js
  const chart = { chart_type: 'body', garment_category: 'suits', fabric_type: 'woven', sizes:
    [34, 36, 38, 40, 42].map((n) => ({ name: String(n), chest: n, waist: n - 6 })) };
  const r = runSizingEngine({ chest: 38, waist: 32 }, chart);
  const offered = r.candidates
    .filter((c) => c.name !== r.recommended_size && c.wearable !== false && c.fits && c.score >= ALT_MIN)
    .map((c) => c.name);
  for (const bad of ['34', '36']) {
    if (offered.includes(bad))
      add('CRITICAL', 'stock', 'a sold-out size never justifies a worse one',
          `would offer ${bad} to a shopper sized ${r.recommended_size}`, 'sold-out fallback');
  }
  // Visual weight must track confidence, not sales opportunity. Assert the two
  // thresholds stay ordered and that the widget still reads them; a silent edit
  // to either turns a compromise back into a primary call to action.
  {
    const w = readFileSync(new URL('../../shopify-app/extensions/styla-fit-widget/assets/styla-widget.js',
                                   import.meta.url), 'utf8');
    const min = (w.match(/ALT_MIN_SCORE\s*=\s*(\d+)/) || [])[1];
    const strong = (w.match(/ALT_STRONG_SCORE\s*=\s*(\d+)/) || [])[1];
    if (!min || !strong)
      add('CRITICAL', 'stock', 'alternative thresholds are defined', 'ALT_MIN_SCORE / ALT_STRONG_SCORE missing', 'styla-widget.js');
    else if (Number(strong) < Number(min))
      add('CRITICAL', 'stock', 'strong threshold is above the floor',
          `ALT_STRONG_SCORE ${strong} < ALT_MIN_SCORE ${min}`, 'styla-widget.js');
    if (!/styla-action-link/.test(w))
      add('BUG', 'stock', 'a compromised alternative uses the quiet style',
          'styla-action-link not used', 'styla-widget.js');
  }
  if (!r.candidates.every((c) => 'wearable' in c))
    add('BUG', 'stock', 'candidates carry wearable',
        'the widget can only sort by chart order without it', 'sizing-engine');
}

// --------------------- 8. SERVERLESS IMPORTS MUST BE TRACEABLE ----
// api/store-api.js imports every route at module level, so ONE unresolvable
// import kills the whole dispatcher -- and with it the CORS headers it sets.
// The browser then reports "blocked by CORS policy" and the real error is never
// seen. createRequire() and dynamic import() of a computed path are invisible to
// Vercel's module tracer, so the file isn't bundled and the failure only appears
// in production. Static imports are traced.
{
  const files = ['api/_catalog/ingest.js', 'api/_catalog/search.js', 'api/extension-chat.js',
                 'api/_match/widget-size.js', 'api/_match/rank-brands.js', 'api/store-api.js'];
  for (const f of files) {
    let src;
    try { src = readFileSync(new URL('../../' + f, import.meta.url), 'utf8'); } catch { continue; }
    if (/createRequire\s*\(/.test(src.replace(/^\s*\/\/.*$/gm, '')))
      add('CRITICAL', 'bundling', 'no createRequire in serverless code',
          'the required file will not be bundled', f);
    if (/await\s+import\s*\(\s*['"`][^'"`]*shared\//.test(src))
      add('CRITICAL', 'bundling', 'shared/ modules are imported statically',
          'a dynamic import of shared/ may not be deployed', f);
  }
}

// ------------------------------ 8. MERCHANT-SAFETY RULES IN PROMPT ----
// The widget runs on the merchant's own product page. A styling AI that names
// another retailer is a breach of the deal, and it's the kind of thing that
// quietly disappears in a prompt edit. Assert the rules are present.
{
  const chat = readFileSync(new URL('../../api/extension-chat.js', import.meta.url), 'utf8');
  const MUST = [
    [/NEVER name another shop, retailer or marketplace/i, 'no competitor referrals'],
    [/never state a policy as fact/i, 'no invented policies'],
    [/Never claim a material, colour or detail that isn't in the product information/i,
     'no invented product facts'],
  ];
  for (const [re, what] of MUST) {
    if (!re.test(chat))
      add('CRITICAL', 'prompt', 'merchant-safety rules are present', `missing: ${what}`, 'extension-chat.js');
  }
}

// ------------------------------------- 8. OUTFIT PAIRING SANITY ----
// Styling retrieval filters on these category slugs. A typo means the RPC
// filters on a category that doesn't exist and silently returns nothing, which
// looks exactly like "the store has no trousers".
{
  const OUT = require('../../shared/outfit-pairing.js');
  const slugs = new Set((TAX.TAXONOMY || []).map((t) => t.slug));
  for (const [cat, comps] of Object.entries(OUT.PAIRS)) {
    if (!slugs.has(cat))
      add('BUG', 'pairing', 'pairing keys are real taxonomy slugs', `"${cat}" is not a category`, 'outfit-pairing');
    for (const c of comps) {
      if (!slugs.has(c))
        add('BUG', 'pairing', 'pairing targets are real taxonomy slugs', `${cat} -> "${c}"`, 'outfit-pairing');
      if (c === cat)
        add('CRITICAL', 'pairing', 'a category never completes itself',
            `${cat} pairs to itself — that is similarity, not styling`, 'outfit-pairing');
    }
  }
  // A fit question must NOT trigger complementary retrieval, or "does this run
  // small" comes back with trousers.
  for (const q of ['does this run small?', 'what size am I?', 'will it fit my chest?']) {
    if (OUT.retrievalCategories('tops', q).length)
      add('BUG', 'pairing', 'fit questions use similarity, not complements', `"${q}" asked for complements`, 'outfit-pairing');
  }
  // And a styling question MUST.
  for (const q of ['what would go with this?', 'what should I wear with it?', 'can I wear this to a wedding?']) {
    if (!OUT.retrievalCategories('tops', q).length)
      add('BUG', 'pairing', 'styling questions retrieve complements', `"${q}" fell back to similarity`, 'outfit-pairing');
  }
}

// ------------------------- 8. CONTROLS THAT EXIST BUT DO NOTHING ----
// Twice now a control shipped that rendered, looked interactive, and had no
// handler at all: styla-k-save ("Find my size here") and styla-g-build
// (Slim/Average/Broad). Nothing throws, so nothing catches it. Every id the
// liquid declares for a button or a segment must be referenced by the JS.
{
  const liquid = readFileSync(new URL('../../shopify-app/extensions/styla-fit-widget/blocks/styla-widget.liquid',
                                      import.meta.url), 'utf8');
  const js = readFileSync(new URL('../../shopify-app/extensions/styla-fit-widget/assets/styla-widget.js',
                                  import.meta.url), 'utf8');
  const ids = [...liquid.matchAll(/id="(styla-[a-z0-9-]+)-\{\{ block\.id \}\}"/g)].map((m) => m[1]);
  // Only interactive things: buttons and segment hosts. Panels/labels are fine.
  const interactive = ids.filter((id) => /(-btn|-save|-cancel|-go|btn-|-build|-sys|-system|-gender|-seg)$|(-btn|-save|-cancel|-build)-/.test(id));
  for (const id of [...new Set(interactive)]) {
    // Some ids are reached as a prefix ('styla-trigger-btn-' + blockId) rather
    // than through el(). Accept either form -- the point is that SOMETHING
    // references it, not how.
    if (!js.includes(`'${id}'`) && !js.includes(`'${id}-'`))
      add('CRITICAL', 'dead-control', 'every interactive id is referenced by the JS',
          `${id} is rendered but never wired`, 'styla-widget.liquid');
  }
}

// ------------------- 8. NOTHING IS SAVED THE SHOPPER DIDN'T NAME ----
// The gift flow used to persist every estimate to localStorage as "Friend 1",
// "Friend 2" -- a permanent entry nobody asked for, with a name that meant
// nothing a week later, and no way to remove it. Saving must be opt-in (they
// type a name) and reversible (a forget control).
{
  const js = readFileSync(new URL('../../shopify-app/extensions/styla-fit-widget/assets/styla-widget.js',
                                  import.meta.url), 'utf8');
  const liquid = readFileSync(new URL('../../shopify-app/extensions/styla-fit-widget/blocks/styla-widget.liquid',
                                      import.meta.url), 'utf8');
  if (/name:\s*['"`]Friend/.test(js) || /Friend '\s*\+/.test(js))
    add('CRITICAL', 'privacy', 'no auto-generated saved people',
        'a person is persisted under a generated "Friend N" name', 'styla-widget.js');
  if (!liquid.includes('styla-g-name-{{ block.id }}'))
    add('CRITICAL', 'privacy', 'the gift form asks for a name before saving',
        'no name field in the estimate-for-someone form', 'styla-widget.liquid');
  if (!js.includes('styla-who-x'))
    add('BUG', 'privacy', 'saved people can be forgotten',
        'no forget control rendered on a locally saved person', 'styla-widget.js');
}

// --------------- 8. A FUNCTION IS NEVER COMPARED TO A VALUE ----
// This has now shipped TWICE from the same cause. Extracting the presentation
// layer into shared/fit-ui.js turned bare `UNIT` reads into `FUI.setUnit`
// -- a mechanical rename to the wrong member. `FUI.setUnit == 'cm'` compares a
// FUNCTION to a string, so it is always false, and nothing throws.
//
// The damage is silent and not cosmetic: both cm/inch toggles stopped
// switching, and worse, measurements typed in centimetres were passed to the
// engine as inches, so the shopper was sized off a body ~2.5x too small.
//
// Rule: an exported function may be ALIASED (var len = FUI.len) but must never
// appear on either side of a comparison.
{
  const surfaces = [
    ['shopify-app/extensions/styla-fit-widget/assets/styla-widget.js', 'FUI'],
    ['widget.html', 'FUI'],
  ];
  const FUI_MOD = require('../../shared/fit-ui.js');
  const fns = Object.keys(FUI_MOD).filter((k) => typeof FUI_MOD[k] === 'function');
  for (const [rel, ns] of surfaces) {
    let src;
    try { src = readFileSync(new URL('../../' + rel, import.meta.url), 'utf8'); } catch { continue; }
    for (const fn of fns) {
      const left  = new RegExp(`\\b${ns}\\.${fn}\\s*(===|==|!==|!=)`);
      const right = new RegExp(`(===|==|!==|!=)\\s*${ns}\\.${fn}\\b(?!\\s*\\()`);
      if (left.test(src) || right.test(src))
        add('CRITICAL', 'shared', 'an exported function is never compared to a value',
            `${ns}.${fn} is compared, not called — did you mean ${ns}.${fn}()?`, rel);
    }
  }
  // And the unit accessor must actually round-trip, or every conversion is wrong.
  FUI_MOD.setUnit('cm');
  if (FUI_MOD.getUnit() !== 'cm') add('CRITICAL', 'shared', 'setUnit/getUnit round-trip', 'setUnit("cm") did not stick', 'fit-ui');
  FUI_MOD.setUnit('in');
  if (FUI_MOD.getUnit() !== 'in') add('CRITICAL', 'shared', 'setUnit/getUnit round-trip', 'setUnit("in") did not stick', 'fit-ui');
}

// ------------------ 8. LEAVING FRIEND MODE ACTUALLY LEAVES IT ----
// "Shop for me" repainted the buttons and did nothing else, because it took an
// early return when there was no SELECTED friend. An estimated-but-unsaved
// friend has no shopForId, so the panel said "Shop for me" while still showing
// the friend's size -- stuck, with no way back to your own body.
//
// Every piece of friend state must be cleared on that branch. This is a source
// check, not a behavioural one: there is no DOM in this sandbox (the registry
// blocks jsdom), so it proves the clears are PRESENT, not that a click works.
{
  const js = readFileSync(new URL('../../shopify-app/extensions/styla-fit-widget/assets/styla-widget.js',
                                  import.meta.url), 'utf8');
  const start = js.indexOf("data-mode') === 'me'");
  const end = start >= 0 ? js.indexOf('} else {', start) : -1;
  if (start < 0 || end < 0) {
    add('CRITICAL', 'shop-for', 'the "me" branch is findable', 'could not locate the mode handler', 'styla-widget.js');
  } else {
    // Strip comments first: the branch DOCUMENTS the old early-return bug, and
    // scanning raw text made the guard fire on its own explanation.
    const branch = js.slice(start, end).replace(/\/\/[^\n]*/g, '');
    for (const clear of ['STATE.shopForId = null', 'STATE.shopForProfile = null',
                         'STATE.shopForAnswers = null', 'STATE.friendMode = false'])
      if (!branch.includes(clear))
        add('CRITICAL', 'shop-for', 'switching back to "me" clears every piece of friend state',
            `missing: ${clear}`, 'me branch');
    // The early return was the actual defect -- a `return` before the clears.
    const firstClear = Math.min(...['STATE.shopForId = null', 'STATE.shopForAnswers = null']
      .map((c) => branch.indexOf(c)).filter((i) => i >= 0));
    const earlyReturn = branch.indexOf('return');
    if (earlyReturn >= 0 && earlyReturn < firstClear)
      add('CRITICAL', 'shop-for', 'no early return before the friend state is cleared',
          'the branch returns before clearing', 'me branch');
  }

  // And the gift flow must read the name field and hand it to savePerson --
  // otherwise "saving a friend" silently keeps nothing.
  const giftStart = js.indexOf('giftSave.addEventListener');
  const gift = giftStart >= 0 ? js.slice(giftStart, giftStart + 2200) : '';
  if (!gift.includes("el('styla-g-name')"))
    add('CRITICAL', 'shop-for', 'the gift form reads the name the shopper typed',
        'styla-g-name is never read on save', 'styla-widget.js');
  if (!gift.includes('savePerson('))
    add('CRITICAL', 'shop-for', 'a named friend is persisted',
        'savePerson is never called from the gift save', 'styla-widget.js');
}

// ------------------------- 8. NO PERCENTAGE MATCH ANYWHERE ----
// Agreed removed: a shopper cannot calibrate "92% match". It came back once
// already, from a second line that overwrote the verdict after it was set.
{
  for (const rel of ['shopify-app/extensions/styla-fit-widget/assets/styla-widget.js', 'widget.html']) {
    let src; try { src = readFileSync(new URL('../../' + rel, import.meta.url), 'utf8'); } catch { continue; }
    // Only flag CONSTRUCTION of the string, not the fit-ui key that still backs
    // the hover title.
    if (/["'`]% match/.test(src.replace(/conf_match[^\n]*/g, '')))
      add('BUG', 'copy', 'no "% match" is rendered to the shopper',
          'a percentage string is built here', rel);
  }
}

// ------------------------------------------- 8. SHARED-COPY DRIFT ----
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
