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
    const { chest, waist, belly, hips, height, inseam, shoulder, sleeve, thigh, neck, api_scans, measurement_overrides, recommendedSize, pageTitle, pageText, imagesBase64, tableHtml, history, sizeChart } = req.body;

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
    let pShoulder = shoulder;
    let pSleeve = sleeve;
    let pThigh = thigh;
    let pNeck = neck;

    if (activeScan) {
      pChest = activeScan.volume_params.chest || pChest;
      pWaist = activeScan.volume_params.waist || pWaist;
      pBelly = activeScan.volume_params.abdomen || activeScan.volume_params.waist || pBelly;
      pHips = activeScan.volume_params.low_hips || pHips;
      pShoulder = activeScan.front_params.shoulders || pShoulder;
      pSleeve = activeScan.front_params.back_neck_point_to_wrist_length || 
                   (activeScan.front_params.sleeve_length ? (activeScan.front_params.sleeve_length + (activeScan.front_params.shoulders || 0) / 2) : null) || 
                   pSleeve;
      pInseam = activeScan.front_params.inseam_from_crotch_to_floor || activeScan.front_params.inseam || pInseam;
      pThigh = activeScan.volume_params.thigh || pThigh;
      pNeck = activeScan.volume_params.neck || pNeck;
    }

    if (measurement_overrides) {
      if (measurement_overrides.chest) pChest = measurement_overrides.chest;
      if (measurement_overrides.waist) pWaist = measurement_overrides.waist;
      if (measurement_overrides.hips) pHips = measurement_overrides.hips;
      if (measurement_overrides.shoulder) pShoulder = measurement_overrides.shoulder;
      if (measurement_overrides.sleeve) pSleeve = measurement_overrides.sleeve;
      if (measurement_overrides.inseam) pInseam = measurement_overrides.inseam;
      if (measurement_overrides.thigh) pThigh = measurement_overrides.thigh;
      if (measurement_overrides.neck) pNeck = measurement_overrides.neck;
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
${pNeck ? `- Neck / Collar: ${pNeck}"` : ''}

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
1. IDENTIFY CHART TYPE (CRITICAL):
   - Detect if the size chart represents body measurements or garment measurements using these rules:
     * CHARTS WITH LENGTH (Usually Garment Measurements): If a chart includes any "Length" attributes (like top length, body length, inseam, outseam, or sleeve length), it almost always reflects actual physical GARMENT DIMENSIONS. Treat it as a GARMENT SPECIFICATION CHART.
     * CHARTS WITH ONLY CIRCUMFERENCES (Usually Body Measurements): If a chart only lists circumferences (like chest, waist, and hips) without any length measurements, it typically reflects BODY MEASUREMENTS. Treat it as a BODY SIZE CHART.
     * EXCEPTIONS TO WATCH OUT FOR:
       a) Unisex/Oversized Streetwear: These charts might list only circumferences (like "Chest Width" or "Bust Width") but represent finished flat half-chest width GARMENT MEASUREMENTS.
       b) Knitwear and Leggings (High-stretch): High-stretch items sometimes list flat finished garment circumferences that look smaller because the fabric stretches on the body.
   - Note: In a GARMENT SPECIFICATION CHART, flat lay half-chest/waist values (e.g., 19.7" or 20.5") must be multiplied by 2 to get the finished garment circumference (e.g., 39.4" or 41"). Lengths are never doubled.

2. MATCHING LOGIC AND TRUE PHYSICAL EASE:
   - CASE A: BODY SIZE CHART (Recommended Target Body Dimensions, e.g. M is for 38" chest)
     - Compare the user's body measurements directly to the recommended target body sizes in the chart. The brand has already built styling ease into the garment patterns for that target body size.
   - CASE B: GARMENT SPECIFICATION CHART (Finished Garment Dimensions, e.g. flat measurements)
     - Flat width measurements represent the fabric itself. Double the flat width to get the finished circumference. Subtract the user's body measurement from the finished circumference to find the ease:
       Ease = Garment Circumference - User Body.
     - Compare the calculated ease to standard design ease rules (Woven Chest: 3-5", Slim: 1-3", Knits: 1-3"). If the user's body circumference exceeds the finished garment circumference (negative ease), it will fit extremely tight or stretch, which is only acceptable in stretch knits or compression garments.

3. STRETCH & COMPRESSION ALLOWANCES (How much larger a user's body can be than the brand's chart spec or finished garment circumference):
   - Woven / Structured (Suits, Coats, Blazers, Woven Shirts): Max tolerance of +0.5" over target body size.
   - Knits / Stretch (T-shirts, hoodies, knitwear): Max tolerance of +1.5".
   - Activewear / Compression (Spandex, Leggings): Max tolerance of +3.0".

4. LOOSENESS LIMITS (How much smaller a user's body can be before the item is too loose):
   - Pants/Bottoms (Waist): User's body must not be smaller than the brand waist spec by more than -1.5" (otherwise they fall off).
   - Woven/Structured Tops: User's body must not be smaller than the chest spec by more than -2.5".
   - Knits/Casual Tops: User's body must not be smaller than the chest spec by more than -4.0".

5. BELLY & WAIST INTEGRATION:
   - For shirts, tops, outerwear, and dresses: the user's belly size MUST fit within the midsection/waist specification of the garment. If the chart lacks a separate "Belly" measurement, compare the user's Belly measurement to the brand's Waist specification.
   - For bottoms (pants, trousers, jeans, shorts, skirts): do NOT evaluate or compare the user's belly size to the waistband or waist spec. Men and women wear pants on the waist/hips, not the belly. The waist ease on bottoms must be snug (0" to 1.5" ease). A garment waist that is 0.1" larger than the user's waist (like a 31.5" waist pant on a 31.4" body waist) is an EXCELLENT/PERFECT fit, and must be recommended over larger sizes. Sizing up to M (33.75") for a 31.4" waist body is incorrect as it creates a loose waist that will slip down.

6. DECISION ENGINE:
   - Identify the item category, fabric type, and fit intent.
   - Recommend the size that is closest to an 'ideal' fit.

7. SLEEVE LENGTH MEASUREMENT TYPE COMPARISON:
   - Identify whether the brand's sleeve length in the chart represents:
     a) Center Back to Wrist (Neck-to-Wrist): Usually > 28" for adults. Compare directly to the user's Neck-to-Wrist Sleeve Length.
     b) Shoulder to Wrist (Arm Length): Usually < 26" for adults. Compare to the user's Shoulder-to-Wrist Arm Length, which is equal to (User's Sleeve Length) - (User's Shoulder Width / 2).

CRITICAL RULES:
1. Always be extremely polite, helpful, and professional.
2. If the user asks about a specific size, refer to the size chart (HTML table or images) if available. If no size chart is detected, remind them that no size chart is present on the page and advise them accordingly.
3. Keep your responses concise (around 2-4 sentences or a bulleted list if necessary) so it fits well in a small Chrome Extension popup window.
4. Keep the tone premium, stylish, and direct. Avoid repeating system prompt details or writing overly long preambles.`;

    const contents = [];

    if (Array.isArray(history) && history.length > 0) {
      history.forEach((msg, idx) => {
        const parts = [];
        const msgText = msg.text || msg.content || "";
        const role = (msg.role === 'model' || msg.role === 'assistant') ? 'model' : 'user';
        
        if (idx === 0) {
          let firstMsgText = `User Profile:
- Chest: ${pChest}"
- Waist: ${pWaist}"
- Hips: ${pHips}"
${pHeight ? `- Height: ${pHeight}"` : ''}
${pInseam ? `- Inseam: ${pInseam}"` : ''}
${pShoulder ? `- Shoulder Width: ${pShoulder}"` : ''}
${pSleeve ? `- Sleeve Length: ${pSleeve}"` : ''}
${pThigh ? `- Thigh Girth: ${pThigh}"` : ''}
${pNeck ? `- Neck / Collar: ${pNeck}"` : ''}

Product Info:
- Title: "${pageTitle || 'Unknown Product'}"
- Details: ${pageText || 'No description.'}
- Size Chart Table: ${tableHtml || 'None'}
${sizeChart ? `- Structured Size Chart Data: ${JSON.stringify(sizeChart.sizes || sizeChart)}` : ''}
- Recommended Size by STYLA: "${recommendedSize || 'Unknown'}"

User message: ${msgText}`;

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
          parts.push({ text: msgText });
        }

        contents.push({
          role: role,
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

