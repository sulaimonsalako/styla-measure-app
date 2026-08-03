import React, { useState, useEffect, useCallback } from 'react';
import { AppProvider, Page } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticatedFetch } from '@shopify/app-bridge/utilities';

const STYLA = 'https://www.styla.ca';
const TAX = [
  { slug: 'tops', label: 'Tops', inc: 'T-shirts, shirts, knitwear' },
  { slug: 'outerwear', label: 'Outerwear', inc: 'Jackets, coats, blazers' },
  { slug: 'suits', label: 'Suits', inc: 'Suits, tuxedos' },
  { slug: 'pants', label: 'Pants', inc: 'Trousers, jeans, chinos' },
  { slug: 'skirts', label: 'Skirts', inc: 'Mini, midi, maxi' },
  { slug: 'shorts', label: 'Shorts', inc: 'Denim, tailored, athletic' },
  { slug: 'leggings', label: 'Leggings', inc: 'Full-length, capri' },
  { slug: 'dresses', label: 'Dresses', inc: 'Everyday, cocktail, formal' },
  { slug: 'jumpsuits', label: 'Jumpsuits', inc: 'Jumpsuits, rompers' },
  { slug: 'bridal', label: 'Bridal', inc: 'Wedding gowns' },
  { slug: 'bridesmaid', label: 'Bridesmaid', inc: 'Bridesmaid dresses' },
  { slug: 'bras', label: 'Bras', inc: 'Band + cup' },
  { slug: 'shapewear', label: 'Shapewear', inc: 'Bodysuits, slips' },
  { slug: 'swimwear', label: 'Swimwear', inc: 'One-piece, bikini' },
];
const MCOLS = ['chest', 'waist', 'hips', 'inseam'];
const POM = [['inseam', 'inseam'], ['bust', 'chest'], ['chest', 'chest'], ['seat', 'hips'], ['hip', 'hips'], ['waist', 'waist']];
const mapPom = (n) => { n = (n || '').toLowerCase().trim(); for (const [k, v] of POM) if (n.indexOf(k) > -1) return v; return null; };
const parseVal = (s) => { s = String(s || '').trim(); if (!s) return undefined; if (s.indexOf('-') > 0) { const p = s.split('-').map(Number); if (!isNaN(p[0]) && !isNaN(p[1])) return [p[0], p[1]]; } const n = parseFloat(s); return isNaN(n) ? undefined : n; };
const emptyRow = () => ({ name: '', chest: '', waist: '', hips: '', inseam: '' });

export default function App() {
  const app = useAppBridge();
  const authFetch = authenticatedFetch(app);

  const [cat, setCat] = useState('dresses');
  const [sub, setSub] = useState('');
  const [gender, setGender] = useState('women');
  const [rows, setRows] = useState([emptyRow(), emptyRow(), emptyRow()]);
  const [aimsg, setAimsg] = useState('');
  const [savemsg, setSavemsg] = useState('');
  const [charts, setCharts] = useState([]);
  const [syncmsg, setSyncmsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [products, setProducts] = useState([]);
  const [assignmsg, setAssignmsg] = useState('');

  const includes = (TAX.find((t) => t.slug === cat) || {}).inc || '';

  const loadCharts = useCallback(async () => {
    try { const r = await authFetch('/api/merchant/charts'); const d = await r.json(); setCharts(d.charts || []); } catch (e) { /* ignore */ }
  }, [authFetch]);
  const loadProducts = useCallback(async () => {
    try { const r = await authFetch('/api/merchant/products'); const d = await r.json(); setProducts(d.products || []); } catch (e) { /* ignore */ }
  }, [authFetch]);
  useEffect(() => { loadCharts(); loadProducts(); }, [loadCharts, loadProducts]);

  const chartOptionLabel = (c) =>
    `${c.category}${c.subcategory ? '/' + c.subcategory : ''} · ${c.gender} (${((c.chart_data || {}).sizes || []).length})`;

  async function assignChart(body, note) {
    setAssignmsg('Saving assignment…');
    try {
      const r = await authFetch('/api/merchant/assign-chart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setAssignmsg('✓ ' + (note || ('Updated ' + (d.updated || 0) + ' product(s).')));
      loadProducts();
    } catch (e) { setAssignmsg('Failed: ' + (e.message || e)); }
  }
  const assignType = (type, val) => assignChart({ productType: type, chartId: val === '__auto' ? null : val }, 'Updated all "' + type + '".');

  async function parseFile(file) {
    if (!file) return;
    setAimsg('Reading your chart…');
    try {
      const dataUrl = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = rej; rd.readAsDataURL(file); });
      const resp = await fetch(STYLA + '/api/parse-size-chart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileData: dataUrl, mimeType: file.type || 'image/png' }) });
      const j = await resp.json();
      if (j.error) throw new Error(j.error);
      const next = []; const cols = {};
      (j.sizes || []).forEach((name) => {
        const src = (j.sizeChart || {})[name] || {}; const row = { name: String(name), chest: '', waist: '', hips: '', inseam: '' };
        Object.keys(src).forEach((p) => { const k = mapPom(p); if (k && src[p] != null && src[p] !== '') { row[k] = String(src[p]); cols[k] = 1; } });
        next.push(row);
      });
      setRows(next.length ? next : [emptyRow()]);
      setAimsg('✓ Parsed ' + (j.sizes || []).length + ' sizes × ' + Object.keys(cols).length + ' measurements — review, then save.');
    } catch (e) { setAimsg('Could not read that: ' + (e.message || e)); }
  }

  useEffect(() => {
    const onPaste = (e) => { const it = (e.clipboardData || {}).items || []; for (let i = 0; i < it.length; i++) if (it[i].type.indexOf('image') === 0) { parseFile(it[i].getAsFile()); break; } };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const setCell = (i, k, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  async function save() {
    const sizes = rows.filter((r) => r.name.trim()).map((r) => { const o = { name: r.name.trim() }; MCOLS.forEach((k) => { const v = parseVal(r[k]); if (v !== undefined) o[k] = v; }); return o; });
    if (!sizes.length) { setSavemsg('Add at least one size.'); return; }
    setSavemsg('Saving…');
    const chart_data = { garment_category: cat, subcategory: sub.trim().toLowerCase() || null, gender, chart_type: 'body', sizes };
    try {
      const r = await authFetch('/api/merchant/charts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: cat, subcategory: sub.trim().toLowerCase() || null, gender, chart_data }) });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setSavemsg('✓ Saved! Shoppers now get their size in your ' + cat + '.');
      loadCharts();
    } catch (e) { setSavemsg(e.message || 'Save failed.'); }
  }

  async function del(id) {
    try { await authFetch('/api/merchant/delete-chart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); loadCharts(); } catch (e) { /* ignore */ }
  }

  async function syncCatalog() {
    setSyncing(true);
    setSyncmsg('Reading your products and teaching the AI… this can take a moment for large catalogs.');
    try {
      const r = await authFetch('/api/merchant/sync-catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setSyncmsg('✓ ' + (d.message || ('Synced ' + (d.synced || 0) + ' products.')));
      loadProducts();
    } catch (e) { setSyncmsg('Sync failed: ' + (e.message || e)); }
    setSyncing(false);
  }

  const input = { width: '100%', padding: '9px 11px', border: '1px solid #d3d5da', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
  const th = { textAlign: 'left', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', padding: '4px 6px' };
  const pill = { fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: '#eef0f4', textTransform: 'capitalize' };

  return (
    <AppProvider i18n={enTranslations}>
      <Page title="Your size charts" subtitle="Add your size guide once — Styla gives every shopper their correct size and answers fit questions on your product pages.">
        <div style={{ background: '#fff', border: '1px solid #e3e5ea', borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Add / update a size chart</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Category</label>
              <select value={cat} onChange={(e) => setCat(e.target.value)} style={input}>{TAX.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}</select></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Sub-tag (optional)</label>
              <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="e.g. slim, denim" style={input} /></div>
            <div><label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Fit for</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} style={input}><option value="women">Women</option><option value="men">Men</option><option value="unisex">Unisex</option></select></div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Includes: {includes}</div>

          <label style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14, border: '1.5px dashed #d3d5da', borderRadius: 12, padding: 16, cursor: 'pointer', background: '#fafbfc' }}>
            <span style={{ fontSize: 24 }}>{'📷'}</span>
            <div style={{ flex: 1 }}><b>Paste a screenshot (Ctrl/⌘+V) or click to upload your size chart.</b>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Our AI reads it and fills the table — review, then save. Centimeters convert automatically.</div></div>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{aimsg}</span>
            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => { parseFile(e.target.files[0]); e.target.value = ''; }} />
          </label>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 14 }}>
            <thead><tr><th style={th}>Size</th><th style={th}>Chest/Bust</th><th style={th}>Waist</th><th style={th}>Hips</th><th style={th}>Inseam</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: 3 }}><input value={r.name} onChange={(e) => setCell(i, 'name', e.target.value)} placeholder="M" style={input} /></td>
                {MCOLS.map((k) => <td key={k} style={{ padding: 3 }}><input value={r[k]} onChange={(e) => setCell(i, k, e.target.value)} placeholder="—" style={input} /></td>)}
              </tr>
            ))}</tbody>
          </table>
          <button onClick={() => setRows((rs) => [...rs, emptyRow()])} style={{ marginTop: 8, padding: '7px 13px', border: '1px solid #d3d5da', borderRadius: 100, background: '#fff', cursor: 'pointer', fontSize: 13 }}>+ Add size</button>

          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={save} style={{ padding: '11px 20px', border: 'none', borderRadius: 100, background: 'linear-gradient(135deg,#e11d48,#ff2a75)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Save chart</button>
            <span style={{ fontSize: 14, color: savemsg.indexOf('✓') === 0 ? '#0f7a54' : '#c0392b' }}>{savemsg}</span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e5ea', borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>Teach the AI your catalog</h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            Sync your products so Styla's AI can answer shoppers across your whole store — recommending
            other items that fit them, not just the product they're looking at. Re-run any time you add products.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={syncCatalog} disabled={syncing}
              style={{ padding: '11px 20px', border: 'none', borderRadius: 100, background: syncing ? '#9aa0a6' : '#111827', color: '#fff', fontWeight: 700, cursor: syncing ? 'default' : 'pointer' }}>
              {syncing ? 'Syncing…' : 'Sync catalog to Styla AI'}
            </button>
            <span style={{ fontSize: 13, color: syncmsg.indexOf('✓') === 0 ? '#0f7a54' : '#6b7280' }}>{syncmsg}</span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e5ea', borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>Assign charts to products <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 13 }}>(optional)</span></h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            By default every product uses the chart for its category — no work needed. If you keep a different
            chart for a specific product or product type, override it here. Sync your catalog first to see products.
          </div>
          {products.length === 0
            ? <div style={{ color: '#6b7280', fontSize: 14 }}>No products yet — click “Sync catalog to Styla AI” above.</div>
            : Object.entries(products.reduce((g, p) => { const t = p.product_type || 'Uncategorized'; (g[t] = g[t] || []).push(p); return g; }, {})).map(([type, items]) => (
              <div key={type} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <b style={{ fontSize: 14 }}>{type}</b>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{items.length} products</span>
                  <select defaultValue="" onChange={(e) => { if (e.target.value !== '') assignType(type, e.target.value); }}
                    style={{ ...input, width: 'auto', marginLeft: 'auto', fontSize: 12, padding: '6px 8px' }}>
                    <option value="">Assign all to…</option>
                    <option value="__auto">Auto (by category)</option>
                    {charts.map((c) => <option key={c.id} value={c.id}>{chartOptionLabel(c)}</option>)}
                  </select>
                </div>
                {items.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid #f1f2f4' }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{p.title}</span>
                    <select value={p.size_chart_id || ''} onChange={(e) => assignChart({ externalId: p.external_id, chartId: e.target.value || null }, 'Updated “' + p.title + '”.')}
                      style={{ ...input, width: 240, fontSize: 12, padding: '6px 8px' }}>
                      <option value="">Auto (by category)</option>
                      {charts.map((c) => <option key={c.id} value={c.id}>{chartOptionLabel(c)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          {assignmsg && <div style={{ fontSize: 13, color: assignmsg.indexOf('✓') === 0 ? '#0f7a54' : '#c0392b', marginTop: 6 }}>{assignmsg}</div>}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e5ea', borderRadius: 14, padding: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Charts you've added</h2>
          {charts.length === 0 ? <div style={{ color: '#6b7280', fontSize: 14 }}>No charts yet — add your first one above.</div> :
            charts.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid #eef0f4' }}>
                <span style={pill}>{c.category}</span>
                {c.subcategory && <span style={pill}>{c.subcategory}</span>}
                <span style={pill}>{c.gender}</span>
                <span style={{ flex: 1, fontSize: 12, color: '#6b7280' }}>{((c.chart_data || {}).sizes || []).length} sizes</span>
                <button onClick={() => del(c.id)} style={{ padding: '6px 12px', border: '1px solid #d3d5da', borderRadius: 100, background: '#fff', cursor: 'pointer', fontSize: 12 }}>Delete</button>
              </div>
            ))}
        </div>
      </Page>
    </AppProvider>
  );
}
