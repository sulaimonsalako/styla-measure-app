import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // size chart images or PDFs can be larger
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { fileData, mimeType } = req.body;

    if (!fileData || !mimeType) {
      return res.status(400).json({ error: 'Missing fileData or mimeType.' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    // Clean up base64 payload if it has dataURL prefix
    let base64Data = fileData;
    if (base64Data.includes(';base64,')) {
      base64Data = base64Data.split(';base64,')[1];
    }

    const prompt = `You are a professional fashion data parser. 
Analyze the provided size chart image or PDF document.
Extract ALL size rows/columns and ALL Point of Measurement (POM) details present in the document.

Standard Point of Measurements (POMs) you should look for and extract (but not limited to):
- Chest / Bust (or Chest Width, Bust Width)
- Waist
- Hips
- Shoulder Width (or Shoulder)
- Sleeve Length (or Sleeve)
- Inseam
- Neck (or Collar)
- Thigh
- Bicep (or Upper Arm)
- Wrist (or Cuff)
- Length (or Back Length, Torso, Body Length)

Strict Sizing Processing Rules:
1. MEASUREMENT UNIT: All measurements in the output JSON MUST be in inches (in). 
   - If the original document specifies values in centimeters (cm), convert them to inches (multiply by 0.3937 and round to 1 decimal place).
   - If they are already in inches (typically values under 55 for chest/waist/length, e.g. 30 to 48), do NOT convert them.
2. POM COLUMN NAMES: Extract the names of the columns (POMs) exactly as detected (or standard naming: Chest, Waist, Hips, Sleeve Length, Shoulder Width, Inseam, Neck, Thigh, Bicep, Wrist, Length).
3. ESTIMATIONS: Do NOT invent values, only extract what is in the document. However, if a column is missing (e.g. Waist/Hips is missing for a Top product), do NOT guess unless it is essential. Only extract what is present in the source size chart.
4. OUTPUT FORMAT:
   - You MUST return ONLY valid JSON. Do not include markdown code block backticks or any other text.
   - The JSON structure must match:
{
  "sizes": ["S", "M", "L", "XL"],
  "poms": ["Chest", "Waist", "Hips", "Sleeve Length", "Shoulder Width"],
  "sizeChart": {
    "S": { "Chest": 38, "Waist": 30, "Hips": 36, "Sleeve Length": 32.5, "Shoulder Width": 17.5 },
    "M": { "Chest": 40, "Waist": 32, "Hips": 38, "Sleeve Length": 33.2, "Shoulder Width": 18 },
    "L": { "Chest": 42, "Waist": 34, "Hips": 40, "Sleeve Length": 34, "Shoulder Width": 18.5 },
    "XL": { "Chest": 44, "Waist": 36, "Hips": 42, "Sleeve Length": 34.8, "Shoulder Width": 19 }
  }
}`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ]
    };

    console.log(`Sending size chart to Gemini for full POM extraction (mimeType: ${mimeType})...`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
    });

    const data = await response.json();

    if (data.error) {
      console.error("Gemini Sizer API Error:", data.error);
      return res.status(500).json({ error: data.error.message });
    }

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
      console.error("Gemini returned empty response:", JSON.stringify(data));
      return res.status(500).json({ error: "Gemini did not return content candidates." });
    }

    let textAnswer = data.candidates[0].content.parts[0].text;
    
    // Strip markdown formatting if any
    textAnswer = textAnswer.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        const jsonAnswer = JSON.parse(textAnswer);
        
        // Validation: ensure structure is correct
        if (!jsonAnswer.sizes || !Array.isArray(jsonAnswer.sizes) || !jsonAnswer.poms || !jsonAnswer.sizeChart) {
          throw new Error("Invalid output JSON structure from AI");
        }
        
        res.status(200).json(jsonAnswer);
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", textAnswer, e);
        res.status(500).json({ error: "AI returned invalid size chart format." });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error processing request.' });
  }
}
