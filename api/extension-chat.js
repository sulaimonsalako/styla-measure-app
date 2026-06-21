export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { chest, waist, belly, hips, height, inseam, api_scans, measurement_overrides, pageTitle, pageText, imagesBase64, tableHtml, history } = req.body;

    if (!chest || !waist || !belly || !hips) {
      return res.status(400).json({ error: 'Missing body measurements (Chest, Waist, Hips are required).' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    const activeScan = api_scans ? api_scans.find(s => s.is_active) : null;
    let pChest = chest;
    let pWaist = waist;
    let pBelly = belly || waist;
    let pHips = hips;
    let pHeight = height;
    let pInseam = inseam;
    let pShoulder = null;
    let pSleeve = null;
    let pThigh = null;

    if (activeScan) {
      pChest = activeScan.volume_params.chest || pChest;
      pWaist = activeScan.volume_params.waist || pWaist;
      pBelly = activeScan.volume_params.abdomen || activeScan.volume_params.waist || pBelly;
      pHips = activeScan.volume_params.low_hips || pHips;
      pShoulder = activeScan.front_params.shoulders || pShoulder;
      pSleeve = activeScan.front_params.sleeve_length || pSleeve;
      pInseam = activeScan.front_params.inseam_from_crotch_to_floor || activeScan.front_params.inseam || pInseam;
      pThigh = activeScan.volume_params.thigh || pThigh;
    }

    if (measurement_overrides) {
      if (measurement_overrides.chest) pChest = measurement_overrides.chest;
      if (measurement_overrides.waist) pWaist = measurement_overrides.waist;
      if (measurement_overrides.hips) pHips = measurement_overrides.hips;
      if (measurement_overrides.shoulder) pShoulder = measurement_overrides.shoulder;
      if (measurement_overrides.sleeve) pSleeve = measurement_overrides.sleeve;
      if (measurement_overrides.inseam) pInseam = measurement_overrides.inseam;
      if (measurement_overrides.thigh) pThigh = measurement_overrides.thigh;
    }

    const systemPrompt = `You are an expert fashion tailor and sizing/styling assistant for STYLA.
The user has the following body measurements:
- Chest / Bust: ${pChest}"
- Waist: ${pWaist}"
- Belly: ${pBelly}"
- Hips: ${pHips}"
${pHeight ? `- Total Height: ${pHeight}"` : ''}
${pInseam ? `- Inseam: ${pInseam}"` : ''}
${pShoulder ? `- Across Back Shoulder Width: ${pShoulder}"` : ''}
${pSleeve ? `- Sleeve Length: ${pSleeve}"` : ''}
${pThigh ? `- Thigh Girth: ${pThigh}"` : ''}

We are analyzing a product page for a garment:
Product Title: "${pageTitle || 'Unknown Product'}"

Product Details & Description:
"""
${pageText || 'No description found.'}
"""

HTML Sizing Tables found on page:
"""
${tableHtml || 'None'}
"""

You also have access to the attached images of the product. Use them to understand the design, style, fit on the model, fabric texture, and size chart details.

Your role is to advise the customer, answer their questions about sizing, fabric quality, styling, fit options, and how different sizes would fit them.
For example, if they ask about buying a size other than their recommended size (e.g. "What if I buy size XL?"), compare the measurements of that size in the size chart to their body measurements and give a professional, tailored opinion.

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
   - For shirts, tops, outerwear, and high-waisted pants: the user's belly size MUST fit within the midsection/waist specification of the garment.
   - If the chart lacks a separate "Belly" measurement, compare the user's Belly measurement to the brand's Waist specification.
   - If the user's Belly size exceeds the brand's Waist spec by more than the stretch allowance, that size is TOO TIGHT and must NOT be recommended.

5. DECISION ENGINE:
   - Identify the item category and fabric type.
   - Filter sizes that are compatible (i.e. not too tight, and not too loose).
   - From the compatible sizes, recommend the one where the difference (UserBody - BrandBody) is closest to 0 (or slightly negative for a comfortable drape).

CRITICAL RULES:
1. Always be extremely polite, helpful, and professional.
2. If the user asks about a specific size, refer to the size chart (HTML table or images) if available. If no size chart is detected, remind them that no size chart is present on the page and advise them accordingly.
3. Keep your responses concise (around 2-4 sentences or a bulleted list if necessary) so it fits well in a small Chrome Extension popup window.
4. Keep the tone premium, stylish, and direct. Avoid repeating system prompt details or writing overly long preambles.`;

    const contents = [];

    if (Array.isArray(history) && history.length > 0) {
      history.forEach((msg, idx) => {
        const parts = [];
        
        if (idx === 0) {
          let firstMsgText = `User Profile:
- Chest: ${pChest}"
- Waist: ${pWaist}"
- Hips: ${pHips}"
${pHeight ? `- Height: ${pHeight}"` : ''}
${pInseam ? `- Inseam: ${pInseam}"` : ''}

Product Info:
- Title: "${pageTitle || 'Unknown Product'}"
- Details: ${pageText || 'No description.'}
- Size Chart Table: ${tableHtml || 'None'}

User message: ${msg.text}`;

          parts.push({ text: firstMsgText });
          
          if (Array.isArray(imagesBase64)) {
            imagesBase64.forEach(imgData => {
              const match = imgData.match(/^data:(image\/\w+);base64,(.+)$/);
              if (match) {
                parts.push({
                  inlineData: {
                    mimeType: match[1],
                    data: match[2]
                  }
                });
              }
            });
          }
        } else {
          parts.push({ text: msg.text });
        }

        contents.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: parts
        });
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello!' }]
      });
    }

    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: contents,
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
      console.error("Gemini Chat API Error:", data.error);
      return res.status(500).json({ error: data.error.message });
    }

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      console.error("Gemini Chat empty response payload:", data);
      return res.status(500).json({ error: "Empty or invalid response from Gemini." });
    }

    const textAnswer = data.candidates[0].content.parts[0].text.trim();
    res.status(200).json({ reply: textAnswer });

  } catch (error) {
    console.error("Extension chat handler error:", error);
    res.status(500).json({ error: 'Server error processing chat request.' });
  }
}

