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
    const { chest, waist, hips, history } = req.body;

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    if (!history || !Array.isArray(history)) {
      return res.status(400).json({ error: 'Invalid conversation history.' });
    }

    // Prepare system prompt containing context
    const systemInstruction = `You are an expert STYLA tailor and fashion consultant. 
The user is asking questions about sizing, fit, or fashion. 
Keep your answers very brief, friendly, and highly actionable (1-3 short sentences max).

The user's current measurements are:
- Chest: ${chest}"
- Waist: ${waist}"
- Hips: ${hips}"

Always answer from the perspective of an expert tailor. If they ask about tailoring, tell them exactly what can and cannot be easily altered (e.g., taking in a waist is easy, letting out shoulders is hard).`;

    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: history
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

    const reply = data.candidates[0].content.parts[0].text;
    
    res.status(200).json({ reply });

  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: 'Server error processing chat request.' });
  }
}
