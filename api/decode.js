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
    const { chest, waist, belly, hips, height, inseam, api_scans, measurement_overrides, chartImagesBase64, styleImagesBase64 } = req.body;

    if (!chartImagesBase64 || chartImagesBase64.length === 0) {
      return res.status(400).json({ error: 'No size chart provided.' });
    }
    if (!styleImagesBase64 || styleImagesBase64.length === 0) {
      return res.status(400).json({ error: 'No garment photos provided.' });
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

    const prompt = `You are an expert fashion tailor and sizing assistant. 
The user has the following body measurements:
- Chest / Bust: ${pChest}"
- Waist: ${pWaist}"
${pBelly ? `- Belly: ${pBelly}"` : ''}
- Hips: ${pHips}"
${pHeight ? `- Total Height: ${pHeight}"` : ''}
${pInseam ? `- Inseam: ${pInseam}"` : ''}
${pShoulder ? `- Across Back Shoulder Width: ${pShoulder}"` : ''}
${pSleeve ? `- Sleeve Length: ${pSleeve}"` : ''}
${pThigh ? `- Thigh Girth: ${pThigh}"` : ''}

${(pHeight && pInseam) ? `IMPORTANT RATIO: The user's estimated torso length is Total Height - Inseam - 11 inches. Compare their leg length to their torso length to determine if they are proportionally long-legged, short-legged, or average.` : ''}

Look at the attached size chart image(s) as your primary sizing data.
Determine the absolute best size for this user.

PROFESSIONAL SIZING & APPAREL MATCHING RULES:
1. IDENTIFY CHART TYPE (CRITICAL):
   - Detect if the size chart represents body measurements or garment measurements using these rules:
     * CHARTS WITH LENGTH (Usually Garment Measurements): If a chart includes any "Length" attributes (like top length, body length, inseam, outseam, or sleeve length), it almost always reflects actual physical GARMENT DIMENSIONS. This is because body length doesn't change based on fit preference. In this case, treat it as a GARMENT SPECIFICATION CHART. A length measurement tells the user exactly where the fabric will hit their body (e.g., a 70 cm shirt length tells them how far down their torso the shirt hangs).
     * CHARTS WITH ONLY CIRCUMFERENCES (Usually Body Measurements): If a chart only lists circumferences (like chest, waist, and hips) without any length measurements, it typically reflects BODY MEASUREMENTS. In this case, treat it as a BODY SIZE CHART. Brands use these to tell what size human body the item was designed to fit, leaving length and "ease" up to the clothing style.
     * EXCEPTIONS TO WATCH OUT FOR:
       a) Unisex/Oversized Streetwear: These charts might list only circumferences (like "Chest Width" or "Bust Width") but represent finished GARMENT MEASUREMENTS (usually flat half-chest width) to show exactly how baggy/oversized the item is.
       b) Knitwear and Leggings (High-stretch): High-stretch items sometimes list flat finished garment circumferences that look impossibly small (e.g., a 24" chest for an adult shirt) because the fabric is meant to stretch out on the body. Do not confuse these small dimensions for children's sizes; identify them as unstretched garment measurements.
   - Note: In a GARMENT SPECIFICATION CHART, flat lay half-chest/waist values (e.g., 19.7" or 20.5") must be multiplied by 2 to get the finished garment circumference (e.g., 39.4" or 41").

2. MATCHING LOGIC AND TRUE PHYSICAL EASE:
   - CASE A: BODY SIZE CHART (Recommended Target Body Dimensions, e.g. M is for 38" chest)
     - Compare the user's body measurements directly to the recommended target body sizes in the chart. The brand has already built styling ease into the garment patterns for that target body size.
     - The ideal fit (fit_spectrum: 'ideal', fit_match_score: 100) is when the user's body size matches the recommended body spec exactly.
     - If the user's body is smaller than the recommended body size (e.g., user is 35" chest, recommended is 39.4" chest), they get EXTRA ease:
       True Physical Ease = Brand's Pre-Factored Ease (approx 2" for regular tops) + (Recommended Body Spec - User Body).
       For example, a 35" user buying a size designed for a 39.4" body gets 2" + 4.4" = 6.4" of physical ease. This fits looser than designed!
       - In this case, recommend the size that matches their body closest (e.g., Size S designed for a 36.2" chest is a much better match than M). 
       - If M is recommended because S does not exist or is unavailable, set fit_spectrum to 'relaxed' or 'oversized', deduct score points (e.g., -6% per inch of body difference, so fit_match_score is ~74%), and explain that it fits looser than designed.
       - If the user's body is larger than the recommended body spec, they get LESS ease (fit_spectrum: 'slim' or 'tight'). Deduct score points proportionally.

   - CASE B: GARMENT SPECIFICATION CHART (Finished Garment Dimensions, e.g. flat measurements)
     - Flat measurements represent the fabric itself. The brand has already built styling ease into these dimensions.
     - To find the target body size the garment was designed for, subtract the standard design ease from the finished garment circumference:
       - Regular Fit Knit / Polo: Standard design ease is 1.5" to 2.5". (e.g. M with 39.4" finished chest is designed for a ~37.4" body chest).
       - Slim Fit: Standard design ease is 0.5" to 1.5".
       - Oversized Fit: Standard design ease is 4" to 6".
       - Woven Shirt / Jacket: Standard design ease is 3" to 4".
     - Calculate the user's difference from the target body chest:
       Difference = Target Body Spec - User Body.
       - If the difference is close to 0 (within +/- 1"), the fit is 'ideal' (fit_match_score: 95-100, fit_spectrum: 'ideal').
       - If the user's body is significantly smaller than the target body spec, the fit is 'relaxed' or 'oversized' (score is lower, fit_spectrum is 'relaxed' or 'oversized').
       - If the user's body is larger than the target body spec, the fit is 'slim' or 'tight' (score is lower, fit_spectrum is 'slim' or 'tight').
       - Example: A polo with finished chest 39.4" (Size M) is designed for a ~37.4" body chest. A 35" chest user is 2.4" smaller than the target body. Thus, M is a 'relaxed' fit (score ~85%). S (finished chest ~37.4", designed for a ~35.4" body) is the 'ideal' fit (score ~97%). Recommending M as 100% ideal is wrong when S is available.

3. STRETCH & COMPRESSION ALLOWANCES (How much larger a user's body can be than the brand's body spec or target body size):
   - Woven / Structured: Max tolerance of +0.5". The user's body measurement must not exceed the target body size by more than 0.5", otherwise size up.
   - Knits / Stretch: Max tolerance of +1.5". Since knits stretch, the user's body can exceed the body size spec by up to 1.5".
   - Activewear / Compression: Max tolerance of +3.0".

4. LOOSENESS LIMITS (How much smaller a user's body can be before the item is too loose):
   - Pants/Bottoms (Waist): User's body must not be smaller than the body spec by more than -1.5" (otherwise they fall off).
   - Woven/Structured Tops: User's body must not be smaller than the spec by more than -2.5" (otherwise too loose/droopy).
   - Knits/Casual Tops: User's body must not be smaller than the spec by more than -4.0" (for an oversized look).
   - Compression Activewear: User's body must not be smaller than the spec by more than -1.0".

5. BELLY & WAIST INTEGRATION:
   - For shirts, tops, outerwear, and high-waisted pants: the user's belly size MUST fit within the midsection/waist specification of the garment.
   - If the chart lacks a separate "Belly" measurement, compare the user's Belly measurement to the brand's Waist specification.
   - If the user's Belly size exceeds the brand's Waist spec by more than the stretch allowance, that size is TOO TIGHT and must NOT be recommended.

6. DECISION ENGINE & NO EXTRAPOLATION:
   - Recommend the size that is closest to an 'ideal' fit (closest target body spec to user's body).
   - If the user is smaller than the smallest size (or larger than the largest size) in the chart, recommend the closest available size (e.g. M) and use the "warning" field to explain that it will fit looser/longer because a smaller size is not available/manufactured. Do NOT suggest sizing down if that size does not exist.

CRITICAL SIZING RULES:
1. SIZE NAMES FROM HEADERS/LABELS: You MUST recommend the size using the exact name from the size chart.
2. NO EXTRAPOLATION: You MUST ONLY recommend a size that is EXPLICITLY listed in the size chart.
3. CONCISE & STRUCTURED RESPONSES: Keep the explanation under 30 words total.

IMPORTANT: You MUST return ONLY valid JSON. Do not include markdown code blocks or any other text.
The JSON must have this exact structure:
{
  "recommended_size": "M",
  "fit_match_score": 75, // integer 0-100 representing how close the recommended size's measurements are to the user's body measurements, taking brand pre-factored ease into account.
  "fit_spectrum": "relaxed", // string: MUST be one of: 'tight', 'slim', 'ideal', 'relaxed', 'oversized'
  "fit_breakdown": {
    "chest": "Comfortably relaxed (7.4\" physical ease)",
    "waist": "Comfortable",
    "hips": "Relaxed"
  },
  "explanation": "Size M fits but will be looser than the designer's intended fit.",
  "warning": "Warning message if user is smaller than the smallest size and cannot size down. Otherwise null."
}`;
    
    const parts = [
        { text: prompt }
    ];

    if (chartImagesBase64 && Array.isArray(chartImagesBase64)) {
        for (const imgBase64 of chartImagesBase64) {
            const cleanBase64 = imgBase64.replace(/^data:image\/\w+;base64,/, "");
            parts.push({
                inlineData: {
                  mimeType: "image/jpeg",
                  data: cleanBase64
                }
            });
        }
    }

    if (styleImagesBase64 && Array.isArray(styleImagesBase64)) {
        for (const imgBase64 of styleImagesBase64) {
            const cleanBase64 = imgBase64.replace(/^data:image\/\w+;base64,/, "");
            parts.push({
                inlineData: {
                  mimeType: "image/jpeg",
                  data: cleanBase64
                }
            });
        }
    }

    const geminiPayload = {
      contents: [
        { parts: parts }
      ],
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

    let textAnswer = data.candidates[0].content.parts[0].text;
    
    // Clean up potential markdown code blocks
    textAnswer = textAnswer.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        const jsonAnswer = JSON.parse(textAnswer);
        res.status(200).json(jsonAnswer);
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", textAnswer);
        res.status(500).json({ error: "AI returned invalid format." });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error processing request.' });
  }
}

