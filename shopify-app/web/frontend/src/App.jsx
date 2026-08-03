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

  const includes = (TAX.find((t) => t.slug === cat) || {}).inc || '';

  const loadCharts = useCallback(async () => {
    try { const r = await authFetch('/api/merchant/charts'); const d = await r.json(); setCharts(d.charts || []); } catch (e) { /* ignore */ }
  }, [authFetch]);
  useEffect(() => { loadCharts(); }, [loadCharts]);

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
