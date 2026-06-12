// ══════════════════════════════════════════════════════
// CA Vault — Vercel API Route  /api/proxy.js
// CommonJS format — most reliable on Vercel Node runtime
// ══════════════════════════════════════════════════════

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

module.exports = async function handler(req, res) {

  // ── Always attach CORS headers, every response ──────
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  // ── OPTIONS preflight ───────────────────────────────
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // ── Only POST allowed ───────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Parse body ──────────────────────────────────────
  const { prompt, system, maxTokens = 900 } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  // ── API key from Vercel env var ─────────────────────
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not set on server" });
  }

  // ── Build request ───────────────────────────────────
  const GEMINI_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`;

  const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

  const geminiBody = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  };

  // ── Call Gemini ─────────────────────────────────────
  let geminiRes;
  try {
    geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "X-goog-api-key":  GEMINI_KEY,
      },
      body: JSON.stringify(geminiBody),
    });
  } catch (e) {
    return res.status(502).json({
      error:  "Failed to reach Gemini API",
      detail: e.message,
    });
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return res.status(geminiRes.status).json({
      error:  "Gemini API error",
      detail: errText,
    });
  }

  const data = await geminiRes.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return res.status(200).json({ text });
};
