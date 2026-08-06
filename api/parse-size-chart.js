import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // size chart images or PDFs can be larger
    },
  },
};

// Deterministic tidy-up for length options: coerce to numbers, order shortest ->
// tallest by length, and chain the height bands so they're ascending and
// non-overlapping (shortest = no lower bound, tallest = no upper bound). The AI's
// extraction is faithful but real charts are often sparse; this gives the merchant
// a clean ladder to review.
function normalizeLengthOptions(list) {
  if (!Array.isArray(list) || !list.length) return list;
  const num = (v) => (v != null && v !== '' && !isNaN(+v)) ? +v : null;
  const opts = list.map((o) => ({
    name: o && o.name != null ? String(o.name) : '',
    inseam: num(o && o.inseam),
    height_min: num(o && o.height_min),
    height_max: num(o && o.height_max),
    note: (o && o.note) || '',
  }));
  if (opts.every((o) => o.inseam != null)) opts.sort((a, b) => a.inseam - b.inseam);
  for (let i = 1; i < opts.length; i++) {
    if (opts[i - 1].height_max != null) opts[i].height_min = opts[i - 1].height_max;
  }
  opts[0].height_min = null;                    // shortest: no lower bound
  opts[opts.length - 1].height_max = null;      // tallest: no upper bound
  return opts;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { fileData, mimeType, files } = req.body;

    // Accept either a single image (fileData+mimeType) or MULTIPLE images
    // (files:[{fileData,mimeType}]) — sections of one chart too wide/long for a
    // single screenshot. All images are merged into ONE chart by the model.
    let images = [];
    if (Array.isArray(files) && files.length) {
      images = files.filter((f) => f && f.fileData && f.mimeType).map((f) => ({ data: f.fileData, mime: f.mimeType }));
    } else if (fileData && mimeType) {
      images = [{ data: fileData, mime: mimeType }];
    }
    if (!images.length) {
      return res.status(400).json({ error: 'Missing image(s): provide fileData+mimeType or files:[{fileData,mimeType}].' });
    }
    if (images.length > 6) images = images.slice(0, 6);

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    // Strip dataURL prefixes.
    images = images.map((im) => ({ mime: im.mime, data: im.data.includes(';base64,') ? im.data.split(';base64,')[1] : im.data }));

    const prompt = `You are a professional fashion data parser.
Analyze the provided size chart image(s) or PDF document.
Extract ALL size rows/columns and ALL Point of Measurement (POM) details present in the document.

CRITICAL — MULTIPLE IMAGES: You may be given SEVERAL images. They are SECTIONS of ONE size chart (a chart too wide or too tall to capture in a single screenshot), or the chart plus its surrounding fit guidance. Treat ALL images together as a SINGLE chart: merge their rows and columns, align rows by size label, append columns that appear only in some images, and DE-DUPLICATE any rows/columns that overlap between images. Output ONE unified chart, never one-per-image.

CRITICAL — CHART ORIENTATION: Size charts come in two layouts. You MUST detect which one and read it correctly:
  (A) Sizes as ROWS: each row is a size (S, M, L…) and each column is a measurement (Bust, Waist…).
  (B) Sizes as COLUMNS (transposed): the size labels run across the TOP row, and each following ROW is a measurement (e.g. left cell "Chest" then its value under each size). Many Asian/men's shirt charts use this layout.
In BOTH cases your output "sizes" array MUST contain the SIZE LABELS (never the measurement names), and every size must map to EVERY measurement present for it. Do not stop after the first column or first row — read the entire grid.

CRITICAL — COMPLETENESS: For every size, extract a value for EVERY measurement column/row that exists in the chart. Never return a size object with only one measurement when the chart clearly has more.

CRITICAL — NUMBERS ONLY: values in "sizeChart" must be plain numbers (or a "min-max" string for ranges), never include units like "cm" or "\\"" or "in" in the value.

Standard Point of Measurements (POMs) you should look for and extract (but not limited to):
- Chest / Bust (or Chest Width, Bust Width)
- Waist
- Hips
- Shoulder Width (or Shoulder)
- Sleeve Length (or Sleeve)
- Inseam
- Neck (or Collar)
- Thigh
- Bicep (or Upper Arm)
- Wrist (or Cuff)
- Length (or Back Length, Torso, Body Length)

Strict Sizing Processing Rules:
1. MEASUREMENT UNIT: All measurements in the output JSON MUST be in inches (in). 
   - If the original document specifies values in centimeters (cm), convert them to inches (multiply by 0.3937 and round to 1 decimal place).
   - If they are already in inches (typically values under 55 for chest/waist/length, e.g. 30 to 48), do NOT convert them.
2. POM COLUMN NAMES: Extract the names of the columns (POMs) exactly as detected (or standard naming: Chest, Waist, Hips, Sleeve Length, Shoulder Width, Inseam, Neck, Thigh, Bicep, Wrist, Length).
3. ESTIMATIONS: Do NOT invent values, only extract what is in the document. However, if a column is missing (e.g. Waist/Hips is missing for a Top product), do NOT guess unless it is essential. Only extract what is present in the source size chart.
4. MEASUREMENT CONVENTIONS: detect and report which convention the chart uses, so downstream can normalize:
   - "sleeve_convention": "shoulder-to-wrist" if the sleeve figures are ~22–26 in (measured from shoulder seam), or "center-back" if ~32–37 in (measured from center-back-neck across the shoulder). Use "unknown" if no sleeve column.
   - "shoulder_convention": "full" if shoulder figures are ~14–20 in (seam-to-seam cross-back), or "half" if ~7–10 in (center-back to one shoulder). Use "unknown" if no shoulder column.
5. LENGTH / PROPORTION OPTIONS: If the chart defines LENGTH or PROPORTION variants (e.g. Petite / Regular / Tall inseam or length, Short/Long, often tied to the shopper's HEIGHT), extract them into "length_options" (convert cm to inches). These are garment LENGTH choices, NOT per-size body measurements — keep them OUT of "sizeChart". Omit (or []) if none. HEIGHT RANGE rules:
   - "recommended for X and under" -> height_max = X (in inches), height_min = null.
   - "X and over / up / and taller" -> height_min = X, height_max = null.
   - Order options from SHORTEST length to LONGEST: the shortest inseam/length is for the SHORTEST people (e.g. Petite), the longest is for the TALLEST (e.g. Tall). "Tall" always means the tallest people.
   - Make the height bands ASCENDING and NON-OVERLAPPING: the shortest option has no lower bound, the tallest has no upper bound, and each option's lower bound = the previous option's upper bound. If the source is sparse or contradictory, INFER sensible contiguous bands from whatever thresholds are given so the set forms a clean ladder short->tall.

5b. LENGTH BUILT INTO THE SIZE NAME (suits, blazers, trousers): many charts encode the length variant IN the size label — "38S / 38R / 38L", "40 Short / 40 Regular / 40 Long", "R", "S", "L" suffixes — where S=Short, R=Regular, L=Long (careful: here L means LONG, not Large). When you see this:
   - Keep the FULL label as the size name (e.g. "38S"), so it matches what the shopper selects on the product page.
   - ALSO return "length_variants": the distinct variants found, with the height guidance the chart gives for each, e.g. [{"name":"Short","height_max":68},{"name":"Regular","height_min":68,"height_max":74},{"name":"Long","height_min":74}]. Convert cm to inches. Typical menswear guidance if the chart states it in words ("Short: under 5'8\"", "Long: 6'1\" and above") must be converted to inches.
   - Do NOT invent height bands that the chart does not state — omit the field instead.

6. NOTES / CONTEXT: Extract any FIT GUIDANCE or context printed with the chart into "notes" (a short plain string the AI can use to answer shopper questions): e.g. "Runs small — size up for a relaxed fit.", "Model is 5'9\" wearing size S.", fabric/stretch/care notes, "measurements are body measurements, not garment." Empty string if none.

7. OUTPUT FORMAT:
   - You MUST return ONLY valid JSON. Do not include markdown code block backticks or any other text.
   - The JSON structure must match:
{
  "sizes": ["S", "M", "L", "XL"],
  "poms": ["Chest", "Waist", "Hips", "Sleeve Length", "Shoulder Width"],
  "sleeve_convention": "shoulder-to-wrist",
  "shoulder_convention": "full",
  "length_options": [
    { "name": "Petite", "inseam": 28.3, "height_min": null, "height_max": 64, "note": "recommended for 5'4\" and under" },
    { "name": "Regular", "inseam": 30.3, "height_min": 64, "height_max": 69, "note": "" },
    { "name": "Tall", "inseam": 33.5, "height_min": 69, "height_max": null, "note": "recommended for 5'9\" and up" }
  ],
  "notes": "Bust/Waist/Hips are body measurements in cm. Petite/Regular/Tall change the inseam only.",
  "sizeChart": {
    "S": { "Chest": 38, "Waist": 30, "Hips": 36, "Sleeve Length": 32.5, "Shoulder Width": 17.5 },
    "M": { "Chest": 40, "Waist": 32, "Hips": 38, "Sleeve Length": 33.2, "Shoulder Width": 18 },
    "L": { "Chest": 42, "Waist": 34, "Hips": 40, "Sleeve Length": 34, "Shoulder Width": 18.5 },
    "XL": { "Chest": 44, "Waist": 36, "Hips": 42, "Sleeve Length": 34.8, "Shoulder Width": 19 }
  }
}`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: prompt },
            ...images.map((im) => ({ inlineData: { mimeType: im.mime, data: im.data } })),
          ]
        }
      ]
    };

    console.log(`Sending ${images.length} size-chart image(s) to Gemini for full POM extraction...`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
    });

    const data = await response.json();

    if (data.error) {
      console.error("Gemini Sizer API Error:", data.error);
      return res.status(500).json({ error: data.error.message });
    }

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
      console.error("Gemini returned empty response:", JSON.stringify(data));
      return res.status(500).json({ error: "Gemini did not return content candidates." });
    }

    let textAnswer = data.candidates[0].content.parts[0].text;
    
    // Strip markdown formatting if any
    textAnswer = textAnswer.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        const jsonAnswer = JSON.parse(textAnswer);
        
        // Validation: ensure structure is correct
        if (!jsonAnswer.sizes || !Array.isArray(jsonAnswer.sizes) || !jsonAnswer.poms || !jsonAnswer.sizeChart) {
          throw new Error("Invalid output JSON structure from AI");
        }
        if (jsonAnswer.length_options) jsonAnswer.length_options = normalizeLengthOptions(jsonAnswer.length_options);

        res.status(200).json(jsonAnswer);
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", textAnswer, e);
        res.status(500).json({ error: "AI returned invalid size chart format." });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error processing request.' });
  }
}
