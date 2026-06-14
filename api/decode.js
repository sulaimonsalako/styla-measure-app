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
    const { chest, waist, belly, hips, height, inseam, chartImagesBase64, styleImagesBase64 } = req.body;

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

    const prompt = `You are an expert fashion tailor and sizing assistant. 
The user has the following body measurements:
- Chest / Bust: ${chest}"
- Waist: ${waist}"
${belly ? `- Belly: ${belly}"` : ''}
- Hips: ${hips}"
${height ? `- Total Height: ${height}"` : ''}
${inseam ? `- Inseam: ${inseam}"` : ''}

${(height && inseam) ? `IMPORTANT RATIO: The user's estimated torso length is Total Height - Inseam - 11 inches. Compare their leg length to their torso length to determine if they are proportionally long-legged, short-legged, or average.` : ''}

Look at the attached size chart image(s) as your primary sizing data.
Determine the absolute best size for this user.

PROFESSIONAL SIZING & APPAREL MATCHING RULES:
1. IDENTIFY CHART TYPE (CRITICAL):
   - Detect if the size chart contains "Product Measurements", "Garment Dimensions", "Flat Measurements", or "how a garment is measured".
   - If so, it is a GARMENT SPECIFICATION CHART (contains finished garment dimensions). Note: Chest values like 19.7" or 20.5" are flat lay half-chest measurements; you must multiply them by 2 to get the finished garment chest circumference (e.g. 39.4" or 41").
   - Otherwise, it is a BODY SIZE CHART (contains recommended target body measurements, like chest circumferences 36", 38", 40").

2. MATCHING LOGIC FOR EACH CHART TYPE:
   - CASE A: BODY SIZE CHART (Recommended Body Dimensions)
     - Compare the user's body measurements directly to the recommended body sizes in the chart.
     - The brand has already built styling ease into the garment patterns for that target body size. Do NOT add ease requirements (like +3 inches) on top of the chart body values.
   - CASE B: GARMENT SPECIFICATION CHART (Finished Garment Dimensions)
     - Calculate the actual physical ease: Ease = Garment Circumference - User Body Measurement.
     - Evaluate the ease against the garment's fit intent and fabric:
       - Regular Fit Knit Polo: Standard chest ease is 3" to 5" (comfortably relaxed).
       - Slim Fit Knit: Standard chest ease is 1.5" to 3".
       - Oversized Fit: Standard chest ease is 6" to 10".
       - Woven Shirt / Jacket: Standard chest ease is 4" to 6".
     - Compare the user's chest (35") directly to the garment finished chest (e.g. 39.4" for M, which gives exactly 4.4" of ease). A garment chest of 39.4" is appropriate for a regular fit knit polo on a 35" chest.
     - Explicitly state in the breakdown that these are finished garment dimensions, and the ease represents the physical spacing between the garment and their body.

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

6. DECISION ENGINE:
   - Identify the item category, fit intent, and fabric type.
   - For Body Size Charts: recommend the size where the difference (UserBody - BrandBody) is closest to 0 (or slightly negative for a comfortable drape).
   - For Garment Specification Charts: recommend the size where the actual ease (GarmentCircumference - UserBody) matches the styling ease (e.g. 3" to 5" for regular chest ease, 1.5" to 3" for slim chest ease, etc.).

CRITICAL SIZING RULE:
1. SIZE NAMES FROM HEADERS/LABELS: You MUST recommend the size using the exact name from the main size headers or option labels of the size chart (which could be column headers OR row headers/labels in the first column, e.g., 'S', 'M', 'L', 'XL', '2XL', etc.). Do NOT use measurement metrics from data cells inside the table (like collar size '38' or chest width '46') as the recommended size name. Always identify which axis (rows or columns) represents the size options, and which axis represents the measurement types, and select the name of the recommended size option only.
2. NO EXTRAPOLATION: You MUST ONLY recommend a size that is EXPLICITLY listed in the size chart image(s). Do NOT extrapolate, assume, guess, or invent sizes that do not appear in the size chart. For example, if the smallest size on the size chart is 'S', you must NOT recommend 'XS' under any circumstances. If the user's measurements are smaller than the smallest size (or larger than the largest size) in the chart, you must recommend the closest available size in the chart (e.g., the smallest size 'S') and use the "warning" field in the JSON response to explain that the item may fit looser/longer than ideal because a smaller size is not manufactured.
3. STRICT SIZE EXISTENCE: The recommended size name MUST exist as a size option name in the provided size chart. Do NOT output a standard size letter (like 'M') if the chart only lists numerical sizes (like '38', '40', '42'). You are strictly forbidden from inventing size names or mapping them to standard sizes unless they are written in the chart. Output the EXACT size name/number that the customer needs to select from the checkout button options.
4. CONCISE & STRUCTURED RESPONSES: The "explanation" field in the JSON response MUST be extremely brief and concise (maximum 1-2 short sentences, under 30 words total). Cut all fluff. Do NOT repeat the user's measurements (e.g., "for your 35 chest") or repeat details already shown in the fit breakdown list. Focus only on the primary deciding factor (e.g., "Size 40 fits best in chest; size 38/S would be too tight in the waist.").

${(styleImagesBase64 && styleImagesBase64.length > 0) ? `I have also attached ${styleImagesBase64.length} image(s) of the garment itself (on model or flat).
Follow these strict analytical rules based on the garment images:
1. FIT INTENT: Analyze the model's fit. Is it oversized, relaxed, or high-compression? Match the user to the size that will recreate THAT specific look on the user's body.
2. NEGATIVE EASE: If the fabric looks like stretchy activewear (spandex/yoga wear) and fits tight to the model (negative ease), expect the fabric to stretch horizontally. Apply a "Stretch Penalty" to the garment's vertical length (it will fit shorter).
3. PROPORTION EXTRAPOLATION: Look at where the garment's hem or sleeves hit the model in the photo. Compare that to the user's Total Height and Inseam. If the user is taller or has longer legs/torso than average, output a warning about how the garment will be cropped.` : ''}

IMPORTANT: You MUST return ONLY valid JSON. Do not include markdown code blocks or any other text.
The JSON must have this exact structure:
{
  "recommended_size": "Medium",
  "fit_breakdown": {
    "chest": "Perfect fit, slightly relaxed",
    "waist": "Tight, 1 inch smaller than your body",
    "hips": "Relaxed"
  },
  "explanation": "Extremely concise 1-2 sentence fit summary (max 30 words). No measurements/fluff.",
  "warning": "Use this field ONLY if none of the sizes will fit the user reasonably well. Otherwise leave it empty or null."
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

