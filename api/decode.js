import { runSizingEngine } from './_helpers/sizing-engine.js';

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
    const { 
      chest, 
      waist, 
      belly, 
      hips, 
      height, 
      inseam, 
      shoulder,
      sleeve,
      thigh,
      neck,
      api_scans, 
      measurement_overrides, 
      chartImagesBase64, 
      styleImagesBase64 
    } = req.body;

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
${pNeck ? `- Neck / Collar: ${pNeck}"` : ''}

Look at the attached size chart image(s) as your primary sizing data.
CRITICAL RULE: DO NOT use customer reviews, comments, feedback text, dates, or other user post details to extract sizes or sizing measurements. Sizing charts are tables or lists mapping sizes (e.g. S, M, L) to physical body or garment measurements.
If you cannot find a real size chart (with dimensions like chest, waist, hip, or sleeve length per size) in the attached size chart image(s):
- You MUST set "size_chart_detected": false
- You MUST set "recommended_size": null
- You MUST set "warning": "No size chart was detected in the uploaded image. Please ensure the image contains a clear brand size chart."
Determine the absolute best size for this user ONLY if a real size chart is detected.

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

3. STRETCH & COMPRESSION ALLOWANCES:
   - Woven / Structured: Max tolerance of +0.5".
   - Knits / Stretch: Max tolerance of +1.5".
   - Activewear / Compression: Max tolerance of +3.0".

4. LOOSENESS LIMITS:
   - Pants/Bottoms (Waist): User's body must not be smaller than the body spec by more than -1.5".
   - Woven/Structured Tops: User's body must not be smaller than the spec by more than -2.5".
   - Knits/Casual Tops: User's body must not be smaller than the spec by more than -4.0".

5. BELLY & WAIST INTEGRATION:
   - For shirts, tops, outerwear, and high-waisted pants: the user's belly size MUST fit within the midsection/waist specification of the garment.
   - If the chart lacks a separate "Belly" measurement, compare the user's Belly measurement to the brand's Waist specification.

6. DECISION ENGINE & NO EXTRAPOLATION:
   - Recommend the size that is closest to an 'ideal' fit.
   - If the user is smaller than the smallest size (or larger than the largest size) in the chart, recommend the closest available size and use the "warning" field to explain that it will fit looser/longer because a smaller size is not available.

7. SLEEVE LENGTH MEASUREMENT TYPE COMPARISON:
   - Identify whether the brand's sleeve length in the chart represents:
     a) Center Back to Wrist (Neck-to-Wrist): Usually > 28" for adults.
     b) Shoulder to Wrist (Arm Length): Usually < 26" for adults.

You MUST parse and extract the entire size chart and output BOTH the sizing recommendation for the current user and the parsed structured size chart details.

Your output must be ONLY valid JSON. Do not include markdown code blocks or any other text.
The JSON must have this exact structure:
{
  "size_chart_detected": true, // false if no size chart can be found in images or tables
  "brand_name": "Zara", // String: name of the brand
  "garment_category": "tops", // String: MUST be one of: 'tops', 'bottoms', 'dresses', 'outerwear', 'unspecified'
  "fabric_type": "knits", // String: MUST be one of: 'knits', 'woven', 'activewear'
  "chart_type": "body", // String: MUST be one of: 'body', 'garment'
  "sizes": [
    {
      "name": "S",
      "chest": 36.0, // Number or Array: e.g. 36.0 or [35, 37]
      "waist": 30.0,
      "hips": 38.0,
      "belly": 32.0, // optional
      "inseam": 30.0, // optional
      "neck": 15.0, // optional (collar/neck girth, extract if present in chart)
      "shoulder": 17.5, // optional (across back shoulder width, extract if present in chart)
      "sleeve": 33.0, // optional (sleeve length, extract if present)
      "thigh": 22.0 // optional (thigh girth, extract if present)
    },
    {
      "name": "M",
      "chest": 38.0,
      "waist": 32.0,
      "hips": 40.0,
      "belly": 34.0,
      "inseam": 30.0
    }
  ],
  "recommended_size": "M",
  "fit_match_score": 85, // integer 0-100
  "fit_spectrum": "relaxed", // 'tight', 'slim', 'ideal', 'relaxed', 'oversized'
  "fit_breakdown": {
    "chest": "Comfortably relaxed",
    "waist": "Perfect fit"
  },
  "explanation": "Size M fits but will be slightly loose.",
  "warning": null // or warning string
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
    textAnswer = textAnswer.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        const jsonAnswer = JSON.parse(textAnswer);
        
        if (jsonAnswer.size_chart_detected === false || jsonAnswer.size_chart_detected === "false") {
          jsonAnswer.recommended_size = null;
        }

        // Resolve local sizing engine recommendation to ensure 100% stable matching rules
        let finalResult = jsonAnswer;
        if (jsonAnswer.size_chart_detected && jsonAnswer.sizes && jsonAnswer.sizes.length > 0) {
          const user = { chest, waist, belly, hips, height, inseam, shoulder, sleeve, thigh, neck, api_scans, measurement_overrides };
          const localResult = runSizingEngine(user, jsonAnswer);
          finalResult = {
            ...jsonAnswer,
            recommended_size: localResult.recommended_size,
            fit_match_score: localResult.fit_match_score,
            fit_spectrum: localResult.fit_spectrum,
            fit_breakdown: localResult.fit_breakdown,
            explanation: localResult.explanation,
            warning: localResult.warning
          };
        }

        // Return clean response to user
        const clientResponse = {
          size_chart_detected: finalResult.size_chart_detected,
          recommended_size: finalResult.recommended_size,
          fit_match_score: finalResult.fit_match_score,
          fit_spectrum: finalResult.fit_spectrum,
          fit_breakdown: finalResult.fit_breakdown,
          explanation: finalResult.explanation,
          warning: finalResult.warning
        };

        res.status(200).json(clientResponse);
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", textAnswer);
        res.status(500).json({ error: "AI returned invalid format.", raw: textAnswer });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error processing request.' });
  }
}
