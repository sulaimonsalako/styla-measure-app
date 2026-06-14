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
      pageTitle, 
      pageText, 
      imagesBase64, 
      tableHtml 
    } = req.body;

    if (!chest || !waist || !belly || !hips) {
      return res.status(400).json({ error: 'Missing body measurements (Chest, Waist, Belly, Hips are required).' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    const prompt = `You are an expert fashion tailor and sizing assistant for STYLA.
The user has the following body measurements:
- Chest / Bust: ${chest}"
- Waist: ${waist}"
${belly ? `- Belly: ${belly}"` : ''}
- Hips: ${hips}"
${height ? `- Total Height: ${height}"` : ''}
${inseam ? `- Inseam: ${inseam}"` : ''}

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

YOUR TARGET:
Check the HTML sizing tables above and the attached images to locate the size chart.

PROFESSIONAL SIZING & APPAREL MATCHING RULES:
1. IDENTIFY CHART TYPE (CRITICAL):
   - Detect if the size chart contains "Product Measurements", "Garment Dimensions", "Flat Measurements", or "how a garment is measured".
   - If so, it is a GARMENT SPECIFICATION CHART (contains finished garment dimensions). Note: Chest values like 19.7" or 20.5" are flat lay half-chest measurements; you must multiply them by 2 to get the finished garment chest circumference (e.g. 39.4" or 41").
   - Otherwise, it is a BODY SIZE CHART (contains recommended target body measurements, like chest circumferences 36", 38", 40").

2. MATCHING LOGIC AND TRUE PHYSICAL EASE:
   - CASE A: BODY SIZE CHART (Recommended Body Dimensions)
     - The brand has pre-factored style ease into the garment patterns for that target body size. 
     - If the user's body measurement matches the recommended body dimensions, they experience the intended fit (fit_spectrum: 'ideal', fit_match_score: 100).
     - If the user's body is smaller than the recommended body size (e.g., user is 35" chest, recommended is 39.4" chest), they get EXTRA ease:
       True Physical Ease = Brand's Pre-Factored Ease (approx 3" for regular tops) + (Recommended Body Spec - User Body).
       For example, a 35" chest user buying a size designed for a 39.4" body gets 3" + 4.4" = 7.4" of physical ease. This fits looser than designed!
       - Recommending this size is fine if it is the best fit, but set fit_spectrum to 'relaxed' or 'oversized', deduct score points (e.g., -6% per inch of body difference, so fit_match_score is 74), and state in the explanation that it fits looser than designed.
       - NEVER suggest sizing down if no smaller size exists in the chart. Instead, warn the user that this is the smallest available size.
     - If the user's body is larger than the recommended body spec, they get LESS ease (fit_spectrum: 'slim' or 'tight'). Deduct score points proportionally.

   - CASE B: GARMENT SPECIFICATION CHART (Finished Garment Dimensions)
     - Calculate the actual physical ease: Ease = Garment Circumference - User Body Measurement.
     - Evaluate the ease against the garment's fit intent and fabric:
       - Regular Fit Knit Polo: Standard chest ease is 3" to 5" (comfortably relaxed).
       - Slim Fit Knit: Standard chest ease is 1.5" to 3".
       - Oversized Fit: Standard chest ease is 6" to 10".
       - Woven Shirt / Jacket: Standard chest ease is 4" to 6".
     - Fit Match Score & Spectrum: If the calculated physical ease falls in the standard range, fit_spectrum is 'ideal' and score is 100. If it is wider than the target range, fit_spectrum is 'relaxed' or 'oversized' and score is lower. If narrower, fit_spectrum is 'slim' or 'tight' and score is lower. Deduct 10 points per inch outside the target ease range.

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
   - Recommend the size that is closest to an 'ideal' fit.
   - If the user is smaller than the smallest size (or larger than the largest size) in the chart, recommend the closest available size (e.g. M) and use the "warning" field to explain that it will fit looser/longer because a smaller size is not available/manufactured. Do NOT suggest sizing down if that size does not exist.

CRITICAL SIZING RULES:
1. First, check if there is a product-specific size chart table in the HTML or if one is visible in the attached images. Set "size_chart_detected" to true if a specific size chart is found. Set it to false if no size chart exists or if you cannot read it.
2. If "size_chart_detected" is false, you MUST set "recommended_size" to null. You are strictly FORBIDDEN from guessing, estimating, or recommending any size based on standard sizing.
3. If "size_chart_detected" is true, you MUST only recommend a size that actually exists in that size chart. For example, if the size chart only lists M, L, XL, 2XL, 3XL, do NOT recommend a size 'Small' or 'XS'. If they are smaller than the smallest size, recommend the closest available size (e.g. Medium) and explain that the brand does not make a smaller size.
4. HEADERS/LABELS AS SIZE NAMES: Ensure your recommended size matches the exact label in the main size headers or option labels of the size chart (which could be column headers OR row headers/labels in the first column, e.g., 'S', 'M', 'L', 'XL', etc.). Do NOT use internal measurement metrics from data cells (like collar size '38' or chest size '46') as the recommended size name. Always identify which axis (rows or columns) represents the size options, and which axis represents the measurement types, and select the name of the recommended size option only.
5. STRICT SIZE EXISTENCE: The recommended size name MUST exist as a size option name in the provided size chart. Do NOT output a standard size letter (like 'M') if the chart only lists numerical sizes (like '38', '40', '42'). You are strictly forbidden from inventing size names or mapping them to standard sizes unless they are written in the chart. Output the EXACT size name/number that the customer needs to select from the checkout button options.
6. MATCH THE CORRECT PRODUCT: If there are multiple size charts or tables present (e.g. for different product categories, men vs women, tops vs bottoms, or unrelated products), you MUST look at the Product Title and Description, identify what type of garment it is (e.g., blazer, pants, shirt), and only use the size chart/table that matches this garment type. Ignore all unrelated or non-matching size charts.
7. CONCISE & STRUCTURED RESPONSES: Keep the explanation under 30 words total.

You MUST return ONLY valid JSON. Do not include markdown code blocks or any other text.
The JSON must have this exact structure:
{
  "size_chart_detected": false, // boolean: true if a product-specific size chart is found in the HTML or images, false otherwise
  "recommended_size": null, // MUST be null if size_chart_detected is false. If size_chart_detected is true, must be a size from the chart.
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

    const parts = [{ text: prompt }];
    
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

    const geminiPayload = {
      contents: [{ parts: parts }],
      generationConfig: {
        temperature: 0.1
      }
    };

    // Call Gemini 2.5 Flash API
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

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      console.error("Gemini empty response payload:", data);
      return res.status(500).json({ error: "Empty or invalid response from Gemini." });
    }

    let textAnswer = data.candidates[0].content.parts[0].text;
    textAnswer = textAnswer.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const jsonAnswer = JSON.parse(textAnswer);
      if (jsonAnswer.size_chart_detected === false || jsonAnswer.size_chart_detected === "false") {
        jsonAnswer.recommended_size = null;
      }
      res.status(200).json(jsonAnswer);
    } catch (e) {
      console.error("Failed to parse Gemini response as JSON. Raw text:", textAnswer);
      res.status(500).json({ error: "AI returned invalid format.", raw: textAnswer });
    }

  } catch (error) {
    console.error("Extension decode handler error:", error);
    res.status(500).json({ error: 'Server error processing sizing request.' });
  }
}
