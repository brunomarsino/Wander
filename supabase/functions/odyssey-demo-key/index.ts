import { Odyssey, credentialsToDict } from "npm:@odysseyml/odyssey@1.3.0";
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

  if (!expectedPassword || !odysseyApiKey) {
    return jsonResponse({ error: "Demo access is not configured" }, { status: 500 });
  }

  let body: { password?: string; validateOnly?: boolean };
  try {
    body = await req.json();
  } catch (_) {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (String(body.password || "") !== expectedPassword) {
    return jsonResponse({ error: "Incorrect demo password" }, { status: 401 });
  }

  if (body.validateOnly) {
    return jsonResponse({ ok: true });
  }

  try {
    const server = new Odyssey({ apiKey: odysseyApiKey });
    const credentials = await server.createClientCredentials();
    return jsonResponse({ credentials: credentialsToDict(credentials) });
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Failed to create Odyssey credentials",
    }, { status: 502 });
  }
});
