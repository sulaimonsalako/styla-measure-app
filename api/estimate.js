export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { heightFeet, heightInches, weight, age, bellyShape, hipShape, fitPreference } = req.body;

    if (!weight || !age || !bellyShape || !hipShape) {
      return res.status(400).json({ error: 'Missing required estimation parameters (weight, age, bellyShape, hipShape).' });
    }

    const ft = parseInt(heightFeet, 10) || 0;
    const inc = parseInt(heightInches, 10) || 0;
    const totalHeightInches = (ft * 12) + inc;

    if (totalHeightInches < 36 || totalHeightInches > 96) {
      return res.status(400).json({ error: 'Invalid height provided.' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    const prompt = `You are a professional apparel tailor and sizing expert.
Your job is to estimate standard human body measurements in inches based on the following demographic and shape details.
Inputs:
- Total Height: ${totalHeightInches} inches (approx ${ft}'${inc}")
- Weight: ${weight} lbs
- Age: ${age} years
- Belly Shape: ${bellyShape} (options: flat, average, rounded)
- Hip Shape: ${hipShape} (options: narrow, average, curvy)
- Fit Preference: ${fitPreference || 'regular'} (options: slim, regular, relaxed)

Please estimate the following five body measurements (in inches, as positive numeric decimals):
1. Chest (or Bust) circumference (around fullest part)
2. Natural Waist circumference (narrowest part of waist, above belly button)
3. Belly circumference (at the belly button/midsection line)
4. Hips circumference (widest part of hips/buttocks)
5. Inseam (length from crotch to ankle bone)

Aesthetic & Anatomical Guidelines:
- The measurements must be realistic for a person of height ${totalHeightInches} inches and weight ${weight} lbs.
- Age affects body distribution: older age usually has slightly larger waist/belly measurements for the same weight.
- Belly shape:
  - 'flat' belly: belly circumference should be close to or slightly smaller than waist, or waist + 0.5".
  - 'average' belly: belly circumference should be waist + 1" to 2".
  - 'rounded' belly: belly circumference should be waist + 2.5" to 5".
- Hip shape:
  - 'narrow' hips: hips should be waist + 4" to 6".
  - 'average' hips: hips should be waist + 7" to 9".
  - 'curvy' hips: hips should be waist + 10" to 14".
- Inseam: A typical inseam for height ${totalHeightInches}" is around ${Math.round(totalHeightInches * 0.44)}" to ${Math.round(totalHeightInches * 0.47)}".

You MUST return ONLY valid JSON. Do not include markdown code blocks or any other text.
The JSON must have this exact structure:
{
  "chest": 38.5,
  "waist": 32.0,
  "belly": 33.5,
  "hips": 40.0,
  "inseam": 30.0,
  "height": ${totalHeightInches}
}`;

    const geminiPayload = {
      contents: [
        { parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature: 0.2
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
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
        res.status(200).json(jsonAnswer);
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", textAnswer);
        res.status(500).json({ error: "AI returned invalid format." });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error estimating measurements.' });
  }
}
