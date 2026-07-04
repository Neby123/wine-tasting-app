// supabase/functions/enrich-wine/index.ts
//
// Auto-fills descriptive wine metadata from a name (+ optional vintage/producer).
// Deploy with:  supabase functions deploy enrich-wine --no-verify-jwt
// Set the key:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// WHY the key lives here and not in the app: anything shipped to the browser is
// public. Edge functions run server-side, so the key stays secret. The app calls
// this via supabase.functions.invoke('enrich-wine', ...).
//
// On price: an LLM cannot know what a bottle costs at YOUR store this week, and
// price is exactly what drives your value/giant-killer stats. So we return only a
// rough `estimated_price_usd` as a starting point; the app treats it as a hint to
// confirm, never as the source of truth.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ENRICH_MODEL") ?? "claude-haiku-4-5-20251001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-voter-token, x-host-passcode",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EnrichRequest {
  name?: string;
  vintage?: string;
  producer?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Pull the first JSON object out of a model response, tolerating code fences
// or stray prose despite our instruction to return JSON only.
function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse(
      { error: "Server is missing ANTHROPIC_API_KEY. Set it with `supabase secrets set`." },
      500,
    );
  }

  let payload: EnrichRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const name = (payload.name ?? "").trim();
  if (!name) {
    return jsonResponse({ error: "A wine `name` is required." }, 400);
  }
  const vintage = (payload.vintage ?? "").trim();
  const producer = (payload.producer ?? "").trim();

  const descriptor = [producer, name, vintage].filter(Boolean).join(" ");

  const systemPrompt =
    "You are a sommelier's reference assistant. Given a wine's name (and maybe " +
    "producer/vintage), infer its most likely attributes. Respond with a SINGLE " +
    "JSON object and NOTHING else — no prose, no code fences. Use these keys, " +
    "omitting any you cannot infer with reasonable confidence: " +
    '"producer" (string), "varietal" (grape or blend, e.g. "Cabernet Sauvignon", ' +
    '"Red Blend"), "region" (e.g. "Napa Valley", "Barossa Valley"), "country", ' +
    '"style" (one of: "Red - Light", "Red - Medium", "Red - Full-bodied", ' +
    '"White - Crisp", "White - Rich", "Rosé", "Sparkling", "Dessert", "Fortified"), ' +
    '"estimated_price_usd" (number; a rough typical US retail price — a hint only), ' +
    'and "descriptor" (a short one-line style summary under 12 words). ' +
    "Do not invent a specific producer if the name does not imply one. " +
    "If the wine is essentially unknown, return the best genre-level guess you can.";

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: `Wine: ${descriptor}` }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return jsonResponse(
        { error: `Enrichment model error (${resp.status}).`, detail: detail.slice(0, 500) },
        502,
      );
    }

    const data = await resp.json();
    const textBlock = Array.isArray(data.content)
      ? data.content.find((b: { type?: string }) => b.type === "text")
      : null;
    const raw: string = textBlock?.text ?? "";

    const parsed = extractJson(raw);
    if (!parsed) {
      return jsonResponse({ error: "Could not parse enrichment result.", raw: raw.slice(0, 500) }, 502);
    }

    // Whitelist + coerce fields so the client gets a predictable shape.
    const num = Number(parsed["estimated_price_usd"]);
    const result = {
      producer: typeof parsed["producer"] === "string" ? parsed["producer"] : undefined,
      varietal: typeof parsed["varietal"] === "string" ? parsed["varietal"] : undefined,
      region: typeof parsed["region"] === "string" ? parsed["region"] : undefined,
      country: typeof parsed["country"] === "string" ? parsed["country"] : undefined,
      style: typeof parsed["style"] === "string" ? parsed["style"] : undefined,
      estimated_price_usd: Number.isFinite(num) && num > 0 ? num : undefined,
      descriptor: typeof parsed["descriptor"] === "string" ? parsed["descriptor"] : undefined,
    };

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: "Enrichment request failed.", detail: String(err).slice(0, 300) }, 500);
  }
});
