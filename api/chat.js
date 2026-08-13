import { supabaseAdmin } from './_helpers/supabase-admin.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

// Journal mode: public Q&A on the blog, grounded in OUR size-chart database.
async function journalAnswer(req, res, apiKey) {
  const question = String(req.body.question || '').trim().slice(0, 400);
  if (!question) return res.status(400).json({ error: 'Ask a question first.' });

  // Pull charts for any brands mentioned in the question (max 3).
  let chartContext = 'No specific brand from our database was mentioned.';
  try {
    const { data: brands } = await supabaseAdmin.from('brands').select('id, name');
    const q = question.toLowerCase();
    const mentioned = (brands || []).filter(b => b.name && q.includes(b.name.toLowerCase())).slice(0, 3);
    if (mentioned.length) {
      const { data: charts } = await supabaseAdmin
        .from('size_charts').select('brand_id, category, gender, chart_data')
        .in('brand_id', mentioned.map(b => b.id)).or('source.neq.import,verified.eq.true');
      const lines = [];
      (charts || []).forEach(c => {
        const bn = (mentioned.find(b => b.id === c.brand_id) || {}).name;
        const sizes = ((c.chart_data || {}).sizes || []).map(s => {
          const dim = (v) => Array.isArray(v) ? v.join('–') : v;
          const parts = [];
          if (s.chest != null) parts.push('bust ' + dim(s.chest));
          if (s.waist != null) parts.push('waist ' + dim(s.waist));
          if (s.hips != null) parts.push('hips ' + dim(s.hips));
          return s.name + ' (' + parts.join(', ') + ')';
        }).join('; ');
        if (sizes) lines.push(bn + ' — ' + (c.category || 'general') + ' (' + (c.gender || 'unisex') + '): ' + sizes);
      });
      if (lines.length) chartContext = 'Size charts from our database (inches):\n' + lines.join('\n');
    }
  } catch (e) { /* answer without chart context */ }

  const sys = `You are Styla's sizing stylist, answering a public question on the Styla Journal.
Ground rules:
- Answer in 2–5 plain, friendly sentences. No markdown headers or bullet lists.
- Use ONLY the size-chart data below for specific numbers. Never invent chart figures.
- If the data below doesn't cover the question, say so honestly and give general sizing guidance.
- End with one short sentence inviting them to take the free 2-minute fit quiz at styla.ca/start.html for their exact size.

${chartContext}`;

  const payload = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: question }] }],
    generationConfig: { temperature: 0.2 },
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (data.error) return res.status(500).json({ error: data.error.message });
  const reply = data.candidates && data.candidates[0] && data.candidates[0].content
    && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
    && data.candidates[0].content.parts[0].text;
  if (!reply) return res.status(500).json({ error: 'No answer generated — try rephrasing.' });
  return res.status(200).json({ reply });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { chest, waist, belly, hips, history } = req.body;

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    if (req.body.mode === 'journal') {
      return await journalAnswer(req, res, apiKey);
    }

    if (!history || !Array.isArray(history)) {
      return res.status(400).json({ error: 'Invalid conversation history.' });
    }

    // Prepare system prompt containing context
    const systemInstruction = `You are an expert STYLA tailor and fashion consultant. 
The user is asking questions about sizing, fit, or fashion. 
Keep your answers extremely brief and highly actionable (1-2 short sentences max). Avoid verbose introductory or concluding fluff.

The user's current measurements are:
- Chest: ${chest}"
- Waist: ${waist}"
${belly ? `- Belly: ${belly}"\\n` : ''}- Hips: ${hips}"

Always answer from the perspective of an expert tailor. Understand ease rules, fabric stretch properties, and garment comfort limits. If they ask about tailoring, tell them exactly what can and cannot be easily altered (e.g., taking in a waist is easy, letting out shoulders is hard).

PROFESSIONAL SIZING & APPAREL MATCHING RULES:
1. BODY-TO-BODY MATCHING (DEFAULT): Assume size charts are target body sizes, not finished garment dimensions, unless explicitly labeled "garment specifications".
   - You MUST compare the user's body measurements directly to the brand's recommended body dimensions in the size chart.
   - Do NOT add ease requirements (like +3 inches) on top of the chart body values; the brand has already built ease into the sizing patterns.

2. STRETCH & COMPRESSION ALLOWANCES (How much larger a user's body can be than the brand's chart spec):
   - Woven / Structured (Suits, Coats, Blazers, Woven Shirts): Max tolerance of +0.5". The user's body measurement must not exceed the brand's body spec by more than 0.5", otherwise size up.
   - Knits / Stretch (T-shirts, hoodies, knitwear): Max tolerance of +1.5". Since knits stretch, the user's body can exceed the spec by up to 1.5".
   - Activewear / Compression (Spandex, Leggings): Max tolerance of +3.0". Since compression items fit tightly, the user can be up to 3.0" larger than the spec.

3. LOOSENESS LIMITS (How much smaller a user's body can be before the item is too loose):
   - Pants/Bottoms (Waist): User's body must not be smaller than the brand spec by more than -1.5" (otherwise they fall off).
   - Woven/Structured Tops: User's body must not be smaller than the spec by more than -2.5" (otherwise too loose/droopy).
   - Knits/Casual Tops: User's body must not be smaller than the spec by more than -4.0" (for an oversized look).
   - Compression Activewear: User's body must not be smaller than the spec by more than -1.0" (otherwise saggy).

4. BELLY & WAIST INTEGRATION:
   - For shirts, tops, outerwear, and dresses: the user's belly size MUST fit within the midsection/waist specification of the garment. If the chart lacks a separate "Belly" measurement, compare the user's Belly measurement to the brand's Waist specification.
   - For bottoms (pants, trousers, jeans, shorts, skirts): do NOT evaluate or compare the user's belly size to the waistband or waist spec. Men and women wear pants on the waist/hips, not the belly. The waist ease on bottoms must be snug (0" to 1.5" ease). A garment waist that is 0.1" larger than the user's waist (like a 31.5" waist pant on a 31.4" body waist) is an EXCELLENT/PERFECT fit, and must be recommended over larger sizes. Sizing up to M (33.75") for a 31.4" waist body is incorrect as it creates a loose waist that will slip down.

5. DECISION ENGINE:
   - Identify the item category and fabric type.
   - Filter sizes that are compatible (i.e. not too tight, and not too loose).
   - From the compatible sizes, recommend the one where the difference (UserBody - BrandBody) is closest to 0 (or slightly negative for a comfortable drape).

6. SLEEVE LENGTH MEASUREMENT TYPE COMPARISON:
   - Identify whether the brand's sleeve length in the chart represents:
     a) Center Back to Wrist (Neck-to-Wrist): Usually > 28" for adults. Compare directly to the user's Neck-to-Wrist Sleeve Length.
     b) Shoulder to Wrist (Arm Length): Usually < 26" for adults. Compare to the user's Shoulder-to-Wrist Arm Length, which is equal to (User's Sleeve Length) - (User's Shoulder Width / 2).`;

    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: history,
      generationConfig: {
        temperature: 0.1
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
    });

    const data = await response.json();

    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return res.status(500).json({ error: data.error.message });
    }

    const reply = data.candidates[0].content.parts[0].text;
    
    res.status(200).json({ reply });

  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: 'Server error processing chat request.' });
  }
}
