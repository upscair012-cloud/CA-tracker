// ══════════════════════════════════════════════════════
// CA Vault — Cloudflare Worker
// Proxies requests to Gemini API so the key stays
// server-side and never appears in the browser.
// Deploy at: workers.cloudflare.com (free tier)
// ══════════════════════════════════════════════════════

export default {
  async fetch(request, env) {

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const { prompt, system, maxTokens = 900 } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    // ── Call Gemini API ──────────────────────────────
    // env.GEMINI_API_KEY is set in Cloudflare Worker env vars
    const GEMINI_KEY = env.GEMINI_API_KEY;
    return new Response(
  JSON.stringify({
    prefix: GEMINI_KEY?.substring(0, 12),
    length: GEMINI_KEY?.length
  }),
  {
    headers: { "Content-Type": "application/json" }
  }
);
    const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
    const fullPrompt = system
      ? `${system}\n\n${prompt}`
      : prompt;

    const geminiBody = {
      contents: [
        {
          parts: [{ text: fullPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
    };

    let geminiRes;
    try {
      geminiRes = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": GEMINI_KEY
        },
        body: JSON.stringify(geminiBody),
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Failed to reach Gemini API", detail: e.message }), {
        status: 502,
        headers: corsHeaders(),
      });
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(JSON.stringify({ error: "Gemini API error", detail: errText }), {
        status: geminiRes.status,
        headers: corsHeaders(),
      });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ text }), {
      headers: corsHeaders(),
    });
  },
};

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
