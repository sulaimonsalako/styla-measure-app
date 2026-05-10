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
    const { chest, waist, hips, height, inseam, chartImagesBase64, styleImagesBase64 } = req.body;

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
- Hips: ${hips}"
${height ? `- Total Height: ${height}"` : ''}
${inseam ? `- Inseam: ${inseam}"` : ''}

${(height && inseam) ? `IMPORTANT RATIO: The user's estimated torso length is Total Height - Inseam - 11 inches. Compare their leg length to their torso length to determine if they are proportionally long-legged, short-legged, or average.` : ''}

Look at the attached size chart image(s) as your primary sizing data.
Determine the absolute best size for this user.

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
  "explanation": "Overall short explanation of why you chose this size.",
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
      ]
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
