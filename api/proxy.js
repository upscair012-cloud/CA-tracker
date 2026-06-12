// ══════════════════════════════════════════════════════
// CA Vault — Vercel API Route  (/api/proxy.js)
// Proxies requests to Gemini so the key stays
// server-side and never appears in the browser.
// ══════════════════════════════════════════════════════

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default async function handler(req, res) {
  // ── CORS preflight ──────────────────────────────────
  if (req.method === "OPTIONS") {
    res.status(204).set(CORS_HEADERS).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).set(CORS_HEADERS).json({ error: "Method not allowed" });
    return;
  }

  // ── Parse body ─────────────────────────────────────
  const { prompt, system, maxTokens = 900 } = req.body || {};

  if (!prompt) {
    res.status(400).set(CORS_HEADERS).json({ error: "prompt is required" });
    return;
  }

  // ── Read API key (Vercel style) ─────────────────────
  // In Vercel, environment variables are accessed via process.env,
  // NOT via `env` object like in Cloudflare Workers.
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_KEY) {
    res.status(500).set(CORS_HEADERS).json({
      error: "GEMINI_API_KEY not configured on server",
    });
    return;
  }

  // ── Build Gemini request ────────────────────────────
  // Model string must match AI Studio exactly: gemini-flash-latest
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
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_KEY,   // header auth (matches AI Studio cURL exactly)
      },
      body: JSON.stringify(geminiBody),
    });
  } catch (e) {
    res.status(502).set(CORS_HEADERS).json({
      error: "Failed to reach Gemini API",
      detail: e.message,
    });
    return;
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    res.status(geminiRes.status).set(CORS_HEADERS).json({
      error: "Gemini API error",
      detail: errText,
    });
    return;
  }

  const geminiData = await geminiRes.json();
  const text =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  res.status(200).set(CORS_HEADERS).json({ text });
}
