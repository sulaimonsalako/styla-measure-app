export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { category, fit, stretch, baseSize, measurements } = req.body;

    if (!category || !fit || !stretch || !baseSize || !measurements) {
      return res.status(400).json({ error: 'Missing required parameters.' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    const prompt = `You are a professional fashion patternmaker, apparel grader, and tech pack developer.
The user wants to generate a graded manufacturer size chart from size XS to 4XL based on a single base sample size.

Inputs:
- Garment Category: ${category}
- Fit Silhouette: ${fit}
- Fabric Stretch Profile: ${stretch}
- Base Sample Size: ${baseSize}
- Base Measurements provided (in inches):
${JSON.stringify(measurements, null, 2)}

Your task is to mathematically and realistically "grade" (scale) these measurements across the entire size range: XS, S, M, L, XL, 2XL (XXL), 3XL (XXXL), 4XL (XXXXL).

Strict Apparel Grading Guidelines:
1. GRADING INCREMENTS: 
   - For Tops/Jackets (Chest Width): Standard grading jumps are usually 1 inch to 1.5 inches between XS through XL. For plus sizes (2XL to 4XL), standard increments increase to 2 inches per size jump to accommodate different body proportions.
   - For Bottoms (Waist/Hips): Standard grading jumps are 1 to 1.5 inches per size for normal sizes, and 2 inches for plus sizes.
   - For Lengths (Body length, inseam): Length grading increments are much smaller, typically 0.5 inches to 0.75 inches per size scale.
2. FABRIC STRETCH CORRECTION:
   - High-stretch fabrics (e.g., spandex/rib-knit activewear) require smaller grading jumps because the fabric stretches to fit.
   - Woven/non-stretch fabrics (e.g., heavy cotton canvas, denim) require larger grading increments and larger fit ease so that clothes are wearable.
3. FIT INTENT:
   - Oversized items scale differently than high-compression or slim-fit clothing items. Ensure the grading steps preserve the target fit silhouette.
4. CONSISTENCY:
   - Ensure the calculations are mathematically progressive. The measurements should increase sequentially from XS to 4XL.
   - Use the base measurement values provided for the target Base Size (${baseSize}) EXACTLY. Do not change the input measurements for the base size.

IMPORTANT: You MUST return ONLY valid JSON. Do not include markdown code blocks or any other text.
The JSON must have this exact structure:
{
  "graded_chart": [
    { 
      "pom": "Chest Width", 
      "xs": "18", 
      "s": "19", 
      "m": "20", 
      "l": "21.5", 
      "xl": "23", 
      "xxl": "25", 
      "xxxl": "27", 
      "xxxxl": "29" 
    }
  ],
  "tolerance": "+/- 0.5 inches",
  "grading_explanation": "Explain why you chose these specific grading steps based on the stretch, category, and fit."
}`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

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

    let textAnswer = data.candidates[0].content.parts[0].text;
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
