/* Styla fit-engine test harness.
 * Runs 50 spanning body types (M/F, petite -> big&tall -> extremes) through the
 * REAL sizing engine against the REAL brand charts, and reports where it breaks.
 *
 * Run:  node tools/fit-test-harness.mjs
 */
import { runSizingEngine } from '../api/_helpers/sizing-engine.js';
import { normalizeChart } from '../api/_helpers/normalize-chart.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dir = dirname(fileURLToPath(import.meta.url));

// ---- 50 body types (measurements in inches; the profile the quiz would produce) ----
// F = female, M = male. belly defaults to waist. Values span the realistic range.
const B = (id, g, chest, waist, hips, height, shoulder, inseam, neck, note) =>
  ({ id, g, chest, waist, belly: waist, hips, height, shoulder, inseam, neck, note });

const BODIES = [
  // ---------------- FEMALE (25) ----------------
  B('F-petite-xxs','F',30.5,22.5,32.5,60,14.5,26,null,'very petite, tiny frame'),
  B('F-petite-xs','F',32,24,34.5,61,15,26.5,null,'petite XS'),
  B('F-petite-curvy','F',34,25,38,61,15,26,null,'petite but curvy (small waist, full hip)'),
  B('F-slim-s','F',34,27,36.5,64,15.5,29,null,'slim small'),
  B('F-average-m','F',37,29.5,39.5,65,16,29,null,'average/moderate M'),
  B('F-average-tall','F',37.5,30,40,70,16.5,32,null,'average build, tall'),
  B('F-hourglass-l','F',40,30,43,66,16.5,29,null,'curvy hourglass, defined waist'),
  B('F-pear-l','F',36,30,45,65,15.5,28.5,null,'pear — small top, wide hip'),
  B('F-apple-l','F',42,40,42,65,17,28,null,'apple — waist ~ bust/hip'),
  B('F-athletic-m','F',36,30,38,67,17.5,30,null,'athletic, broad shoulders, straight'),
  B('F-plus-1x','F',46,39,49,66,17,28.5,null,'plus 1X'),
  B('F-plus-2x','F',49,43,52,66,17.5,28,null,'plus 2X'),
  B('F-plus-3x','F',52,46,55,67,18,28,null,'plus 3X'),
  B('F-tall-plus','F',47,40,50,71,18,33,null,'tall + plus'),
  B('F-big-tall','F',54,49,58,72,19,33,null,'big & tall female'),
  B('F-extreme-plus','F',62,58,68,68,20,28,null,'extreme plus (beyond most charts)'),
  B('F-large-bust','F',42,29,38,64,15.5,29,null,'large bust on small frame'),
  B('F-small-bust','F',32,27,37,65,15,29,null,'small bust, average hip'),
  B('F-broad-shoulder','F',38,31,39,67,18.5,30,null,'broad-shouldered female'),
  B('F-narrow','F',33,26,35,63,14.5,28,null,'narrow all-over, small'),
  B('F-moderate-12','F',39,32.5,42,66,16.5,29,null,'true 12/L'),
  B('F-moderate-14','F',40.5,34,43.5,66,17,29,null,'true 14/L'),
  B('F-teen-petite','F',31,24,33,59,14,25,null,'very small teen frame'),
  B('F-lean-tall','F',34,26,36,72,16,33,null,'lean and very tall'),
  B('F-curvy-xl','F',44,35,47,67,17,29,null,'curvy XL, strong hip'),

  // ---------------- MALE (25) ----------------
  B('M-slim-short','M',36,30,36,64,16.5,29,14,'slim, short'),
  B('M-slim-tall','M',38,31,38,74,17,34,14.5,'slim, tall'),
  B('M-athletic-v','M',42,33,40,70,19,32,15.5,'athletic V-taper'),
  B('M-average-m','M',40,34,40,69,17.5,32,15.5,'average/moderate'),
  B('M-average-l','M',43,37,42,70,18,32,16,'average large'),
  B('M-muscular-bb','M',48,34,42,71,21,31,17,'bodybuilder — huge chest, small waist'),
  B('M-dad-bod','M',44,42,43,70,18,31,16.5,'dad bod — belly ~ chest'),
  B('M-big-tall-2xl','M',50,46,48,75,19.5,34,17.5,'big & tall 2XL'),
  B('M-very-tall-lean','M',40,33,40,78,17.5,36,15,'very tall, lean'),
  B('M-short-stocky','M',44,40,43,65,18,28,16.5,'short and stocky'),
  B('M-plus-3xl','M',54,50,52,71,20,31,18,'plus 3XL'),
  B('M-extreme-6xl','M',64,62,62,72,22,30,20,'extreme big (6XL+)'),
  B('M-broad-shoulder','M',44,34,41,71,21.5,32,16,'exceptionally broad shoulders'),
  B('M-narrow-shoulder','M',38,33,38,68,15.5,31,14.5,'narrow shoulders'),
  B('M-long-torso','M',41,35,40,70,17.5,29,15.5,'long torso, short legs'),
  B('M-athletic-42','M',43,35,41,72,19.5,33,15.5,'athletic 42'),
  B('M-slim-38','M',38,32,38,69,16.5,32,14.5,'slim 38'),
  B('M-husky-46','M',46,42,45,70,18.5,31,16.5,'husky 46'),
  B('M-tall-lean-42','M',42,34,41,76,18,35,15.5,'tall lean 42'),
  B('M-big-50','M',50,47,49,72,19.5,31,17.5,'big 50'),
  B('M-moderate-44','M',44,38,43,70,18,32,16,'moderate 44'),
  B('M-petite-34','M',34,29,35,63,15.5,28,13.5,'very small male frame (34)'),
  B('M-xxl-dad','M',52,52,52,71,19,30,18,'XXL, belly-dominant'),
  B('M-extreme-8xl','M',74,72,72,73,23,30,21,'extreme 8XL (beyond charts)'),
  B('M-teen-slim','M',35,28,35,66,15.5,30,13.5,'slim teen frame'),
];

function getCharts() {
  // Representative slice of the live charts (fetched from prod), embedded because
  // the test sandbox has no network. Refresh with the SQL in the repo when charts change.
  return JSON.parse(readFileSync(join(__dir, 'fit-test-charts.json'), 'utf8'));
}

function run() {
  return Promise.resolve(getCharts()).then(charts => {
    const findings = { noComparableDims: [], recommendedFirstSizeOnly: [], outOfRange: [], suspiciousChart: [], perfectHundredThin: [], ok: 0, total: 0 };
    const byBodyCoverage = {};

    // Chart sanity pre-scan (data-quality loopholes independent of bodies).
    for (const c of charts) {
      const cd = c.chart_data || {};
      const sizes = cd.sizes || [];
      const dims = new Set();
      sizes.forEach(s => Object.keys(s).forEach(k => { if (['chest','bust','waist','hips','hip','shoulder','shoulders','sleeve','inseam','thigh','neck','length'].includes(k)) dims.add(k); }));
      const onlyHeight = sizes.length && sizes.every(s => Object.keys(s).filter(k => k !== 'name').every(k => k === 'height'));
      if (onlyHeight) findings.suspiciousChart.push(`${c.brand}/${c.category}: chart has ONLY height ranges — engine scores no body dimension, recommends first size to everyone.`);
      // implausible chest (half-values labelled as body, or chest<waist for a suit)
      const firstChest = sizes[0] && (Array.isArray(sizes[0].chest) ? sizes[0].chest[0] : sizes[0].chest);
      if (firstChest != null && firstChest < 26 && (cd.chart_type === 'body')) findings.suspiciousChart.push(`${c.brand}/${c.category}: first chest ${firstChest}" on a BODY chart is implausibly small — likely half/flat values mislabelled.`);
      if (cd.chart_type === 'garment' && (cd.flat_measures||[]).includes('chest') && firstChest != null && firstChest > 34) findings.suspiciousChart.push(`${c.brand}/${c.category}: chest ${firstChest}" tagged flat_measures (will be DOUBLED to ${firstChest*2}") but looks like a full circumference already.`);
    }

    for (const body of BODIES) {
      const gCharts = charts.filter(c => {
        const cg = (c.gender||'').toLowerCase();
        if (cg === 'unisex') return true;
        return body.g === 'F' ? cg === 'women' : cg === 'men';
      });
      let covered = 0;
      for (const c of gCharts) {
        findings.total++;
        const cd = c.chart_data || {};
        const norm = normalizeChart(cd, { flatMeasures: cd.flat_measures || [] });
        if (!norm.sizes.length) continue;
        const r = runSizingEngine(body, norm);
        const dimsCompared = r.dimensions_compared || 0;
        const sizeList = norm.sizes.map(s => s.name);
        const isFirst = r.recommended_size === sizeList[0];
        const isLast = r.recommended_size === sizeList[sizeList.length-1];

        if (dimsCompared === 0) findings.noComparableDims.push(`${body.id} vs ${c.brand}/${c.category}: 0 dimensions compared -> meaningless size "${r.recommended_size}".`);
        else covered++;
        if (r.warning && (isFirst || isLast)) findings.outOfRange.push(`${body.id} (${body.note}) vs ${c.brand}/${c.category}: out of range -> "${r.recommended_size}" ${r.warning}`);
        if (dimsCompared <= 1 && r.fit_match_score >= 90) findings.perfectHundredThin.push(`${body.id} vs ${c.brand}/${c.category}: ${r.fit_match_score}% on only ${dimsCompared} dim(s).`);
        if (dimsCompared === 0 && isFirst) findings.recommendedFirstSizeOnly.push(`${body.id} vs ${c.brand}/${c.category}`);
      }
      byBodyCoverage[body.id] = covered;
    }
    return { findings, byBodyCoverage, chartCount: charts.length };
  });
}

run().then(({ findings, byBodyCoverage, chartCount }) => {
  const uniq = a => [...new Set(a)];
  const out = [];
  out.push(`# Styla fit-engine test — 50 bodies × ${chartCount} real charts\n`);
  out.push(`## A. Chart data-quality loopholes (independent of body)\n`);
  uniq(findings.suspiciousChart).forEach(s => out.push(`- ${s}`));
  out.push(`\n## B. Zero-dimension recommendations (engine returns a size it can't justify)\n`);
  uniq(findings.noComparableDims).slice(0,40).forEach(s => out.push(`- ${s}`));
  out.push(`\n## C. Out-of-range bodies (extremes falling off the chart)\n`);
  uniq(findings.outOfRange).slice(0,40).forEach(s => out.push(`- ${s}`));
  out.push(`\n## D. High score on thin coverage (should be dampened harder)\n`);
  uniq(findings.perfectHundredThin).slice(0,25).forEach(s => out.push(`- ${s}`));
  out.push(`\n## Coverage per body (how many charts gave a real, multi-dim answer)\n`);
  Object.entries(byBodyCoverage).sort((a,b)=>a[1]-b[1]).forEach(([id,n]) => out.push(`- ${id}: ${n}`));
  console.log(out.join('\n'));
}).catch(e => { console.error('harness error:', e); process.exit(1); });
