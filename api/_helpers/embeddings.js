// Gemini text embeddings — the vectorization layer behind the product index.
//
// Uses Google's `text-embedding-004` model (768 dimensions, matching the
// vector(768) column on public.catalog_products) via the same GOOGLE_API_KEY
// the fit-chat already uses. No extra vendor, no extra secret.
//
// taskType materially improves retrieval quality: documents are embedded with
// RETRIEVAL_DOCUMENT, live search queries with RETRIEVAL_QUERY. Always pair them.

// gemini-embedding-001 replaced text-embedding-004 (retired by Google — v1beta
// returns "model not found" for it). Same API, supports outputDimensionality.
const MODEL = 'gemini-embedding-001';
const DIMS = 768;
const BATCH = 100; // Gemini batchEmbedContents caps at 100 requests per call.

function apiKey() {
  const k = process.env.GOOGLE_API_KEY;
  if (!k) throw new Error('GOOGLE_API_KEY not configured on server.');
  return k;
}

// Trim overly long text so a single product description can't blow the token
// budget. ~8k chars is plenty for a product blurb; the model truncates anyway.
function clean(t) {
  return String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, 8000);
}

/**
 * Embed one string. Returns a number[] of length 768.
 * @param {string} text
 * @param {'RETRIEVAL_DOCUMENT'|'RETRIEVAL_QUERY'} taskType
 */
export async function embedOne(text, taskType = 'RETRIEVAL_QUERY') {
  const [vec] = await embedMany([text], taskType);
  return vec;
}

/**
 * Embed many strings in batches. Returns number[][] aligned to the input order.
 * Empty/blank inputs come back as null (nothing to index/search).
 * @param {string[]} texts
 * @param {'RETRIEVAL_DOCUMENT'|'RETRIEVAL_QUERY'} taskType
 */
export async function embedMany(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  const key = apiKey();
  const items = (texts || []).map(clean);
  const out = new Array(items.length).fill(null);

  // Indices that actually have content — skip blanks to save quota.
  const idx = items.map((t, i) => (t ? i : -1)).filter((i) => i >= 0);

  for (let b = 0; b < idx.length; b += BATCH) {
    const slice = idx.slice(b, b + BATCH);
    const requests = slice.map((i) => ({
      model: `models/${MODEL}`,
      content: { parts: [{ text: items[i] }] },
      taskType,
      outputDimensionality: DIMS,
    }));

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      }
    );
    const data = await resp.json();
    if (data.error) throw new Error('Embedding API error: ' + (data.error.message || 'unknown'));

    const embs = data.embeddings || [];
    slice.forEach((origIdx, j) => {
      const values = embs[j] && embs[j].values;
      if (values && values.length) out[origIdx] = values;
    });
  }

  return out;
}

// Postgres/pgvector wants a bracketed string literal: "[0.1,0.2,...]".
export function toVectorLiteral(vec) {
  if (!vec || !vec.length) return null;
  return '[' + vec.join(',') + ']';
}

export const EMBED_DIMS = DIMS;
