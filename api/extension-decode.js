export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

// Helper function to download an image from a URL and convert it to base64 format for Gemini
async function downloadImageAsBase64(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) {
      console.warn(`Failed to fetch image ${url}: status ${response.status}`);
      return null;
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    return {
      inlineData: {
        mimeType: contentType.split(';')[0],
        data: base64Data
      }
    };
  } catch (error) {
    console.error(`Error downloading image ${url}:`, error);
    return null;
  }
}

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
      imageUrls, 
      tableHtml 
    } = req.body;

    if (!chest || !waist || !hips) {
      return res.status(400).json({ error: 'Missing body measurements (Chest, Waist, Hips are required).' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    // Download relevant images concurrently (cap at 4 images to keep execution fast and payload small)
    const imagesToProcess = Array.isArray(imageUrls) ? imageUrls.slice(0, 4) : [];
    const imagePromises = imagesToProcess.map(url => downloadImageAsBase64(url));
    const downloadedImages = await Promise.all(imagePromises);
    const validImages = downloadedImages.filter(img => img !== null);

    const prompt = `You are an expert fashion tailor and sizing assistant for STYLA.
The user has the following body measurements:
- Chest / Bust: ${chest}"
- Waist: ${waist}"
- Hips: ${hips}"
${height ? `- Total Height: ${height}"` : ''}
${inseam ? `- Inseam: ${inseam}"` : ''}

We are analyzing a product page for a garment:
Product Title: "${pageTitle || 'Unknown Product'}"

Product Details & Description scraped from page:
"""
${pageText || 'No description found.'}
"""

${tableHtml ? `We found this size chart table on the page:
"""
${tableHtml}
"""` : 'No size chart table was found in the HTML. Please check if any attached images contain size chart data.'}

Your task:
1. Determine the absolute best size for this user.
2. Analyze the fabric details (e.g. stretch, spandex, polyester vs. 100% rigid cotton or linen) and fit silhouette (e.g. oversized, slim fit, regular fit) from the description.
3. If the product is oversized, advise if they should size down for a normal fit. If it has no stretch and is slim-fit, recommend if they need to size up for comfort.
4. Look at the attached image(s) to verify style details, fit intent, or read size charts embedded in images.

CRITICAL SIZING RULES:
- You MUST ONLY recommend a size that actually exists in the size chart (either in the HTML table or in the size chart images).
- For example, if the size chart only lists M, L, XL, 2XL, 3XL, do NOT recommend a size 'Small' or 'XS', even if you believe a Small would fit their body measurements better. If they are smaller than the smallest size, recommend the smallest available size (e.g. Medium) and explain in the warning/explanation that the item may fit slightly relaxed since the brand does not make a smaller size.
- Ensure your recommended size matches the exact label in the chart (e.g., if the chart uses numbers like '32', '34' or letters like 'M', 'L', use that exact size label).

You MUST return ONLY valid JSON. Do not include markdown code blocks or any other text.
The JSON must have this exact structure:
{
  "recommended_size": "Medium",
  "fit_breakdown": {
    "chest": "Perfect fit, slightly relaxed",
    "waist": "Tight, 1 inch smaller than your body",
    "hips": "Relaxed"
  },
  "explanation": "Overall explanation of why you chose this size, mentioning fabric/silhouette details.",
  "warning": "Any warnings about length, torso proportions, or fit issues (e.g. cropped length). Otherwise null."
}`;

    const parts = [{ text: prompt }];
    
    // Add downloaded image parts to Gemini payload
    validImages.forEach(img => {
      parts.push(img);
    });

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
    
    // Clean up potential markdown code blocks
    textAnswer = textAnswer.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const jsonAnswer = JSON.parse(textAnswer);
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
