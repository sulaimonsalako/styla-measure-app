export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS — the widget runs on the merchant's storefront domain (Shopify/Woo/custom).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let { locale, units, derivedFrom, accessToken, chest, waist, belly, hips, height, inseam, shoulder, sleeve, thigh, neck, api_scans, measurement_overrides, recommendedSize, pageTitle, pageText, imagesBase64, tableHtml, history, sizeChart, stock } = req.body;

    // Logged-in shopper: load saved measurements server-side (bookmarklet/widget).
    if (accessToken && (!chest || !waist || !hips)) {
      try {
        const { supabaseAdmin } = await import('./_helpers/supabase-admin.js');
        const { data: au } = await supabaseAdmin.auth.getUser(accessToken);
        if (au && au.user) {
          const { data: prof } = await supabaseAdmin.from('profiles')
            .select('chest,waist,hips,belly,shoulder,height,inseam,thigh,neck,sleeve').eq('id', au.user.id).maybeSingle();
          if (prof) {
            chest = chest || prof.chest; waist = waist || prof.waist; hips = hips || prof.hips;
            belly = belly || prof.belly; height = height || prof.height;
            inseam = inseam || prof.inseam; shoulder = shoulder || prof.shoulder;
          }
        }
      } catch (e) { /* fall through to validation */ }
    }
    if (!belly) belly = waist;

    if (!chest || !waist || !belly || !hips) {
      return res.status(400).json({ error: 'Missing body measurements (Chest, Waist, Hips are required).' });
    }

    // Answer in the shopper's language and their measurement system. Cheap to
    // add and it makes the whole widget feel localized well before every label is.
    const langLine = (locale && String(locale).slice(0,2).toLowerCase() !== 'en')
      ? `\nIMPORTANT: Reply in the shopper's language (BCP-47 "${String(locale).slice(0,5)}"). Keep size names and brand names exactly as written.`
      : '';
    // Be honest in the answer when the body itself is an estimate.
    const estLine = derivedFrom
      ? `\nNOTE: these measurements were ESTIMATED from ${derivedFrom.suit ? `a suit size ${derivedFrom.suit}` : derivedFrom.system ? `a ${String(derivedFrom.system).toUpperCase()} ${derivedFrom.size}` : 'height and build'}, not measured. Say "based on" rather than stating them as fact, and don't quote them to one decimal place.`
      : '';
    const unitLine = (units === 'cm')
      ? `\nExpress all measurements in CENTIMETRES (the figures you are given are in inches; convert them).`
      : '';

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on server.' });
    }

    const activeScan = api_scans ? api_scans.find(s => s.is_active) : null;
    let pChest = chest;
    let pWaist = waist;
    let pBelly = belly || waist;
    let pHips = hips;
    let pHeight = height;
    let pInseam = inseam;
    let pShoulder = shoulder;
    let pSleeve = sleeve;
    let pThigh = thigh;
    let pNeck = neck;

    if (activeScan) {
      pChest = activeScan.volume_params.chest || pChest;
      pWaist = activeScan.volume_params.waist || pWaist;
      pBelly = activeScan.volume_params.abdomen || activeScan.volume_params.waist || pBelly;
      pHips = activeScan.volume_params.low_hips || pHips;
      pShoulder = activeScan.front_params.shoulders || pShoulder;
      pSleeve = activeScan.front_params.back_neck_point_to_wrist_length || 
                   (activeScan.front_params.sleeve_length ? (activeScan.front_params.sleeve_length + (activeScan.front_params.shoulders || 0) / 2) : null) || 
                   pSleeve;
      pInseam = activeScan.front_params.inseam_from_crotch_to_floor || activeScan.front_params.inseam || pInseam;
      pThigh = activeScan.volume_params.thigh || pThigh;
      pNeck = activeScan.volume_params.neck || pNeck;
    }

    if (measurement_overrides) {
      if (measurement_overrides.chest) pChest = measurement_overrides.chest;
      if (measurement_overrides.waist) pWaist = measurement_overrides.waist;
      if (measurement_overrides.hips) pHips = measurement_overrides.hips;
      if (measurement_overrides.shoulder) pShoulder = measurement_overrides.shoulder;
      if (measurement_overrides.sleeve) pSleeve = measurement_overrides.sleeve;
      if (measurement_overrides.inseam) pInseam = measurement_overrides.inseam;
      if (measurement_overrides.thigh) pThigh = measurement_overrides.thigh;
      if (measurement_overrides.neck) pNeck = measurement_overrides.neck;
    }

    // Cross-catalog awareness: when the shopper asks about OTHER products (not
    // just the item on the page), pull the best-matching products from this
    // store's semantic index so the AI can recommend across the whole catalog
    // instead of only the current product. Best-effort — never blocks the chat.
    let catalogContext = '';
    try {
      const shopDom = req.body.shop || req.body.domain || null;
      const bId = req.body.brandId || null;
      const lastMsg = Array.isArray(history) && history.length
        ? String(history[history.length - 1].text || history[history.length - 1].content || '')
        : '';
      const wantsCatalog = /\b(other|another|alternativ|instead|recommend|do you (have|sell|carry)|something (else|similar)|similar|show me|options?|browse|what else|anything|looking for|suggest)\b/i.test(lastMsg);
      if ((shopDom || bId) && wantsCatalog && lastMsg) {
        const { retrieveCatalog } = await import('./_catalog/retrieve.js');
        const hits = await retrieveCatalog({ query: lastMsg, brandId: bId, shop: shopDom, count: 6 });
        if (hits && hits.length) {
          catalogContext = 'OTHER PRODUCTS IN THIS STORE (semantically ranked for the shopper\'s request — when they ask for alternatives or other items, recommend from THESE, and include the price and link):\n'
            + hits.map((h) => `- ${h.title}${h.price != null ? ` ($${h.price})` : ''}${h.category ? ` [${h.category}]` : ''}${h.url ? ` — ${h.url}` : ''}`).join('\n');
        }
      }
    } catch (e) { /* retrieval is optional context; ignore failures */ }

    const systemPrompt = `You are an expert fashion tailor and sizing/styling assistant for STYLA.
The user has the following body measurements:
- Chest / Bust: ${pChest}"
- Waist: ${pWaist}"
- Belly: ${pBelly}"
- Hips: ${pHips}"
${pHeight ? `- Total Height: ${pHeight}"` : ''}
${pInseam ? `- Inseam: ${pInseam}"` : ''}
${pShoulder ? `- Across Back Shoulder Width: ${pShoulder}"` : ''}
${pSleeve ? `- Sleeve Length: ${pSleeve}"` : ''}
${pThigh ? `- Thigh Girth: ${pThigh}"` : ''}
${pNeck ? `- Neck / Collar: ${pNeck}"` : ''}

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
${sizeChart && sizeChart.notes ? `\nBRAND FIT NOTES (written by the brand — use these to answer fit questions):\n"""${sizeChart.notes}"""\n` : ''}${sizeChart && sizeChart.length_options && sizeChart.length_options.length ? `\nLENGTH / PROPORTION OPTIONS (e.g. Petite/Regular/Tall — pick by the shopper's height): ${JSON.stringify(sizeChart.length_options)}\n` : ''}
${catalogContext ? `\n${catalogContext}\n` : ''}
You also have access to the attached images of the product. Use them to understand the design, style, fit on the model, fabric texture, and size chart details.

Your role is to advise the customer, answer their questions about sizing, fabric quality, styling, fit options, and how different sizes would fit them.
For example, if they ask about buying a size other than their recommended size (e.g. "What if I buy size XL?"), compare the measurements of that size in the size chart to their body measurements and give a professional, tailored opinion.

PROFESSIONAL SIZING & APPAREL MATCHING RULES:
1. IDENTIFY CHART TYPE (CRITICAL):
   - Detect if the size chart represents body measurements or garment measurements using these rules:
     * CHARTS WITH LENGTH (Usually Garment Measurements): If a chart includes any "Length" attributes (like top length, body length, inseam, outseam, or sleeve length), it almost always reflects actual physical GARMENT DIMENSIONS. Treat it as a GARMENT SPECIFICATION CHART.
     * CHARTS WITH ONLY CIRCUMFERENCES (Usually Body Measurements): If a chart only lists circumferences (like chest, waist, and hips) without any length measurements, it typically reflects BODY MEASUREMENTS. Treat it as a BODY SIZE CHART.
     * EXCEPTIONS TO WATCH OUT FOR:
       a) Unisex/Oversized Streetwear: These charts might list only circumferences (like "Chest Width" or "Bust Width") but represent finished flat half-chest width GARMENT MEASUREMENTS.
       b) Knitwear and Leggings (High-stretch): High-stretch items sometimes list flat finished garment circumferences that look smaller because the fabric stretches on the body.
   - Note: In a GARMENT SPECIFICATION CHART, flat lay half-chest/waist values (e.g., 19.7" or 20.5") must be multiplied by 2 to get the finished garment circumference (e.g., 39.4" or 41"). Lengths are never doubled.

2. MATCHING LOGIC AND TRUE PHYSICAL EASE:
   - CASE A: BODY SIZE CHART (Recommended Target Body Dimensions, e.g. M is for 38" chest)
     - Compare the user's body measurements directly to the recommended target body sizes in the chart. The brand has already built styling ease into the garment patterns for that target body size.
   - CASE B: GARMENT SPECIFICATION CHART (Finished Garment Dimensions, e.g. flat measurements)
     - Flat width measurements represent the fabric itself. Double the flat width to get the finished circumference. Subtract the user's body measurement from the finished circumference to find the ease:
       Ease = Garment Circumference - User Body.
     - Compare the calculated ease to standard design ease rules (Woven Chest: 3-5", Slim: 1-3", Knits: 1-3"). If the user's body circumference exceeds the finished garment circumference (negative ease), it will fit extremely tight or stretch, which is only acceptable in stretch knits or compression garments.

3. STRETCH & COMPRESSION ALLOWANCES (How much larger a user's body can be than the brand's chart spec or finished garment circumference):
   - Woven / Structured (Suits, Coats, Blazers, Woven Shirts): Max tolerance of +0.5" over target body size.
   - Knits / Stretch (T-shirts, hoodies, knitwear): Max tolerance of +1.5".
   - Activewear / Compression (Spandex, Leggings): Max tolerance of +3.0".

4. LOOSENESS LIMITS (How much smaller a user's body can be before the item is too loose):
   - Pants/Bottoms (Waist): User's body must not be smaller than the brand waist spec by more than -1.5" (otherwise they fall off).
   - Woven/Structured Tops: User's body must not be smaller than the chest spec by more than -2.5".
   - Knits/Casual Tops: User's body must not be smaller than the chest spec by more than -4.0".

5. BELLY & WAIST INTEGRATION:
   - For shirts, tops, outerwear, and dresses: the user's belly size MUST fit within the midsection/waist specification of the garment. If the chart lacks a separate "Belly" measurement, compare the user's Belly measurement to the brand's Waist specification.
   - For bottoms (pants, trousers, jeans, shorts, skirts): do NOT evaluate or compare the user's belly size to the waistband or waist spec. Men and women wear pants on the waist/hips, not the belly. The waist ease on bottoms must be snug (0" to 1.5" ease). A garment waist that is 0.1" larger than the user's waist (like a 31.5" waist pant on a 31.4" body waist) is an EXCELLENT/PERFECT fit, and must be recommended over larger sizes. Sizing up to M (33.75") for a 31.4" waist body is incorrect as it creates a loose waist that will slip down.

6. DECISION ENGINE:
   - Identify the item category, fabric type, and fit intent.
   - Recommend the size that is closest to an 'ideal' fit.

7. SLEEVE LENGTH MEASUREMENT TYPE COMPARISON:
   - Identify whether the brand's sleeve length in the chart represents:
     a) Center Back to Wrist (Neck-to-Wrist): Usually > 28" for adults. Compare directly to the user's Neck-to-Wrist Sleeve Length.
     b) Shoulder to Wrist (Arm Length): Usually < 26" for adults. Compare to the user's Shoulder-to-Wrist Arm Length, which is equal to (User's Sleeve Length) - (User's Shoulder Width / 2).

${stock && Object.keys(stock).length ? `\nLIVE STOCK for this product (size -> in stock): ${JSON.stringify(stock)}\nIf asked about availability, answer from THIS data only — say plainly whether their size is in stock, and suggest an alternative size that fits AND is in stock if theirs is sold out.\n` : ''}
GROUNDING — what you may and may not answer:
- You may answer from: the shopper's measurements, this product's page details, the brand's size chart and fit notes, the live stock data above, and the other in-store products listed above.
- You must NOT invent or guess shipping times, delivery dates, prices not shown, discount codes, return/exchange policies, order status, or stock you were not given. If asked, say you don't have that information and suggest they check the store's own page or contact the store. Never state a policy as fact.
- If the size chart lacks a measurement needed to answer, say so honestly rather than estimating.

CRITICAL RULES:
1. Always be extremely polite, helpful, and professional.
2. If the user asks about a specific size, refer to the size chart (HTML table or images) if available. If no size chart is detected, remind them that no size chart is present on the page and advise them accordingly.
3. Keep your responses concise (around 2-4 sentences or a bulleted list if necessary) so it fits well in a small Chrome Extension popup window.
4. Keep the tone premium, stylish, and direct. Avoid repeating system prompt details or writing overly long preambles.${langLine}${unitLine}${estLine}`;

    const contents = [];

    if (Array.isArray(history) && history.length > 0) {
      history.forEach((msg, idx) => {
        const parts = [];
        const msgText = msg.text || msg.content || "";
        const role = (msg.role === 'model' || msg.role === 'assistant') ? 'model' : 'user';
        
        if (idx === 0) {
          let firstMsgText = `User Profile:
- Chest: ${pChest}"
- Waist: ${pWaist}"
- Hips: ${pHips}"
${pHeight ? `- Height: ${pHeight}"` : ''}
${pInseam ? `- Inseam: ${pInseam}"` : ''}
${pShoulder ? `- Shoulder Width: ${pShoulder}"` : ''}
${pSleeve ? `- Sleeve Length: ${pSleeve}"` : ''}
${pThigh ? `- Thigh Girth: ${pThigh}"` : ''}
${pNeck ? `- Neck / Collar: ${pNeck}"` : ''}

Product Info:
- Title: "${pageTitle || 'Unknown Product'}"
- Details: ${pageText || 'No description.'}
- Size Chart Table: ${tableHtml || 'None'}
${sizeChart ? `- Structured Size Chart Data: ${JSON.stringify(sizeChart.sizes || sizeChart)}` : ''}
- Recommended Size by STYLA: "${recommendedSize || 'Unknown'}"

User message: ${msgText}`;

          parts.push({ text: firstMsgText });
          
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
        } else {
          parts.push({ text: msgText });
        }

        contents.push({
          role: role,
          parts: parts
        });
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello!' }]
      });
    }

    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.1,
        // Gemini 2.5 models THINK by default and thinking tokens are billed
        // against maxOutputTokens. At 400 the harder questions ("what else here
        // would fit me?", which needs catalog reasoning) spent the budget
        // thinking and the visible answer was cut off mid-sentence. Turn thinking
        // off for this task — it's grounded Q&A over data we supply, not a
        // reasoning problem — and leave real headroom for the reply.
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 1024
      }
    };

    // FAST PATH: stream tokens to the client as they're generated (feels instant).
    //
    // This used to fail SILENTLY. gRes.ok was never checked, so if Google
    // returned an error (bad model id, quota, bad key) the body contained a JSON
    // error, no line began with "data:", nothing was written, and we ended a 200
    // with an EMPTY body — the widget rendered a blank grey bubble and the
    // shopper saw the AI "not respond". Now: verify the response, count what we
    // actually emit, and fall back rather than return nothing.
    const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    const MODEL = MODELS[0];
    let streamedAny = false;

    if (req.body && req.body.stream) {
      for (const model of MODELS) {
        if (streamedAny) break;
        try {
          const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiPayload)
          });
          if (!gRes.ok || !gRes.body) {
            const detail = await gRes.text().catch(() => '');
            console.error(`extension-chat: ${model} stream HTTP ${gRes.status}: ${detail.slice(0, 400)}`);
            continue; // try the next model, then the non-streaming path
          }
          const reader = gRes.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
              if (!line.startsWith('data:')) continue;
              const json = line.slice(5).trim();
              if (json === '[DONE]') continue;
              try {
                const t = JSON.parse(json)?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (t) {
                  if (!streamedAny) {
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-cache, no-transform');
                    streamedAny = true;
                  }
                  res.write(t);
                }
              } catch (e) {}
            }
          }
          // A 200 that yielded no text is a failure too (safety block, empty
          // candidate). Don't close an empty response — let the fallback run.
          if (streamedAny) return res.end();
          console.error(`extension-chat: ${model} streamed 0 tokens; falling back.`);
        } catch (e) {
          console.error(`extension-chat: ${model} stream threw: ${e.message}`);
        }
      }
      // Nothing streamed. Headers are untouched, so the non-streaming JSON path
      // below can still answer normally.
    }

    // Non-streaming path. Also tries each model, so one bad/unavailable model id
    // can't take the whole AI Tailor down — previously this used the same single
    // MODEL as the stream, meaning both paths failed together.
    let lastErr = 'No response from the model.';
    for (const model of MODELS) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload)
      });
      const data = await response.json().catch(() => ({}));

      if (data.error) {
        lastErr = data.error.message || lastErr;
        console.error(`extension-chat: ${model} generateContent error:`, lastErr);
        continue;
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastErr = 'Empty response from the model.';
        console.error(`extension-chat: ${model} returned no candidate text.`);
        continue;
      }
      return res.status(200).json({ reply: text.trim(), model });
    }
    return res.status(502).json({ error: "The AI tailor couldn't answer just now. Please try again.", detail: lastErr });

  } catch (error) {
    console.error("Extension chat handler error:", error);
    res.status(500).json({ error: 'Server error processing chat request.' });
  }
}

