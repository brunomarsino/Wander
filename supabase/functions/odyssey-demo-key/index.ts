import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

function isAllowedOrigin(req: Request) {
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN")?.trim();
  if (!allowedOrigin) return true;

  const requestOrigin = req.headers.get("Origin") || "";
  return allowedOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .includes(requestOrigin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  if (!isAllowedOrigin(req)) {
    return jsonResponse({ error: "Origin is not allowed" }, { status: 403 });
  }

  const expectedPassword = Deno.env.get("DEMO_ACCESS_PASSWORD") || "";
  const odysseyApiKey = Deno.env.get("ODYSSEY_API_KEY") || "";
  const model = Deno.env.get("ODYSSEY_MODEL") || "odyssey-2-max";

  if (!expectedPassword || !odysseyApiKey) {
    return jsonResponse({ error: "Demo access is not configured" }, { status: 500 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch (_) {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (String(body.password || "") !== expectedPassword) {
    return jsonResponse({ error: "Incorrect demo password" }, { status: 401 });
  }

  return jsonResponse({
    odysseyApiKey,
    model,
  });
});
