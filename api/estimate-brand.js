export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      gender,
      heightFeet,
      heightInches,
      weight,
      maleApparel,
      maleSize,
      maleBrand,
      maleFit,
      maleWaist,
      maleLength,
      femaleDress,
      femalePants,
      femaleBrand,
      femaleFit
    } = req.body;

    if (!gender || !weight) {
      return res.status(400).json({ error: 'Missing required physical stats (gender, weight).' });
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

    let bodyReferenceText = '';
    if (gender === 'male') {
      bodyReferenceText = `
User Gender: Male / Men
- Upper body reference: ${maleApparel !== 'none' ? `Normally buys size ${maleSize} in ${maleBrand} ${maleApparel} which fits him in a ${maleFit} style.` : 'No upper body clothing reference supplied.'}
- Lower body reference: Normally buys Pants with waist size ${maleWaist} inches and inseam length ${maleLength} inches, which is a perfect fit without a belt.
`;
    } else {
      bodyReferenceText = `
User Gender: Female / Women
- Dress reference: Normally buys US Dress Size ${femaleDress} in ${femaleBrand} which fits her in a ${femaleFit} style.
- Lower body reference: Normally buys Pants with waist size ${femalePants} (US/waist size).
`;
    }

    const prompt = `You are a professional apparel tailor and sizing expert.
Your job is to estimate standard human body measurements in inches based on the reference clothing sizes that fit them well from specific brands, and their general height/weight.

Inputs:
- Gender: ${gender}
- Height: ${totalHeightInches} inches (${ft}'${inc}")
- Weight: ${weight} lbs
${bodyReferenceText}

Please estimate the following five body measurements (in inches, as positive numeric decimals):
1. Chest (or Bust) circumference (around fullest part)
2. Natural Waist circumference (narrowest part of waist, above belly button)
3. Belly circumference (at the belly button/midsection line)
4. Hips circumference (widest part of hips/buttocks)
5. Inseam (length from crotch to ankle bone)

Aesthetic & Anatomical Guidelines:
- The measurements must be realistic and consistent for a person of gender ${gender}, height ${totalHeightInches} inches, and weight ${weight} lbs.
- Take the apparel reference brand sizing into account. For instance:
  - If a man wears a size ${maleSize} Uniqlo T-shirt which fits regular, their chest is likely close to the standard chest spec for a Uniqlo ${maleSize} (usually 37-40 inches). If it fits oversized/loose, their actual body chest is smaller. If it fits tight/fitted, their actual body chest is larger.
  - If a man's perfect pants fit is waist ${maleWaist}", their natural waist circumference is typically around ${maleWaist}" or slightly different depending on rise, and their belly is usually close.
  - If a woman wears a dress size ${femaleDress} in Zara, Zara's size ${femaleDress} bust, waist, and hips specs should guide the estimation.
  - Inseam: For men, the perfect pants inseam length ${maleLength || 'unknown'}" is a very strong estimator of their actual body inseam. For women, their height ${totalHeightInches}" suggests an inseam of approximately ${Math.round(totalHeightInches * 0.43)}" to ${Math.round(totalHeightInches * 0.46)}".

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
