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

CRITICAL SIZING RULES:
1. First, check if there is a product-specific size chart table in the HTML or if one is visible in the attached images. Set "size_chart_detected" to true if a specific size chart is found. Set it to false if no size chart exists or if you cannot read it.
2. If "size_chart_detected" is false, you MUST set "recommended_size" to null. You are strictly FORBIDDEN from guessing, estimating, or recommending any size based on standard sizing.
3. If "size_chart_detected" is true, you MUST only recommend a size that actually exists in that size chart. For example, if the size chart only lists M, L, XL, 2XL, 3XL, do NOT recommend a size 'Small' or 'XS'. If they are smaller than the smallest size, recommend the smallest available size (e.g. Medium) and explain that the brand does not make a smaller size.
4. HEADERS/LABELS AS SIZE NAMES: Ensure your recommended size matches the exact label in the main size headers or option labels of the size chart (which could be column headers OR row headers/labels in the first column, e.g., 'S', 'M', 'L', 'XL', etc.). Do NOT use internal measurement metrics from data cells (like collar size '38' or chest size '46') as the recommended size name. Always identify which axis (rows or columns) represents the size options, and which axis represents the measurement types, and select the name of the recommended size option only.
5. STRICT SIZE EXISTENCE: The recommended size name MUST exist as a size option name in the provided size chart. Do NOT output a standard size letter (like 'M') if the chart only lists numerical sizes (like '38', '40', '42'). You are strictly forbidden from inventing size names or mapping them to standard sizes unless they are written in the chart. Output the EXACT size name/number that the customer needs to select from the checkout button options.
6. MATCH THE CORRECT PRODUCT: If there are multiple size charts or tables present (e.g. for different product categories, men vs women, tops vs bottoms, or unrelated products), you MUST look at the Product Title and Description, identify what type of garment it is (e.g., blazer, pants, shirt), and only use the size chart/table that matches this garment type. Ignore all unrelated or non-matching size charts.
7. CONCISE & STRUCTURED RESPONSES: The "explanation" field in the JSON response MUST be extremely brief and concise (maximum 1-2 short sentences, under 30 words total). Cut all fluff. Do NOT repeat the user's measurements (e.g., "for your 35 chest") or repeat details already shown in the fit breakdown list. Focus only on the primary deciding factor (e.g., "Size 40 fits best in chest; size 38/S would be too tight in the waist.").

You MUST return ONLY valid JSON. Do not include markdown code blocks or any other text.
The JSON must have this exact structure:
{
  "size_chart_detected": false, // boolean: true if a product-specific size chart is found in the HTML or images, false otherwise
  "recommended_size": null, // MUST be null if size_chart_detected is false. If size_chart_detected is true, must be a size from the chart.
  "fit_breakdown": {
    "chest": "Perfect fit, slightly relaxed",
    "waist": "Tight, 1 inch smaller than your body",
    "hips": "Relaxed"
  },
  "explanation": "Extremely concise 1-2 sentence fit summary (max 30 words). No measurements/fluff.",
  "warning": "A warning explaining that no size chart was detected, and telling the user to find the chart on the page and make sure it is open/visible, then click find size again. Otherwise null."
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
