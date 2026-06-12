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
      hips, 
      height, 
      inseam, 
      pageTitle, 
      pageText, 
      imagesBase64, 
      tableHtml 
    } = req.body;

    if (!chest || !waist || !hips) {
      return res.status(400).json({ error: 'Missing body measurements (Chest, Waist, Hips are required).' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    const prompt = `You are an expert fashion tailor and sizing assistant for STYLA.
The user has the following body measurements:
- Chest / Bust: ${chest}"
- Waist: ${waist}"
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

CRITICAL SIZING RULES:
1. First, check if there is a product-specific size chart table in the HTML or if one is visible in the attached images. Set "size_chart_detected" to true if a specific size chart is found. Set it to false if no size chart exists or if you cannot read it.
2. If "size_chart_detected" is false, you MUST set "recommended_size" to null. You are strictly FORBIDDEN from guessing, estimating, or recommending any size based on standard sizing.
3. If "size_chart_detected" is true, you MUST only recommend a size that actually exists in that size chart. For example, if the size chart only lists M, L, XL, 2XL, 3XL, do NOT recommend a size 'Small' or 'XS'. If they are smaller than the smallest size, recommend the smallest available size (e.g. Medium) and explain that the brand does not make a smaller size.
4. Ensure your recommended size matches the exact label in the chart (e.g., if the chart uses numbers like '32', '34' or letters like 'M', 'L', use that exact size label).

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
  "explanation": "Overall explanation of why you chose this size, or stating that no size chart was found.",
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
      contents: [{ parts: parts }]
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
