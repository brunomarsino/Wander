// Public, commit-safe runtime config. Never put a secret in this file.
//
// Out of the box Wander runs in "bring your own key" mode: leaving
// WANDER_API_BASE empty means the app asks the visitor for an Odyssey API key
// and keeps it in their browser's localStorage. Nothing is proxied and no
// backend is required.
//
// Set WANDER_API_BASE only if you deploy the Supabase Edge Functions in
// supabase/functions and want to hold the keys server-side. Doing so switches
// the start gate from "paste an API key" to "enter a demo password".
window.WANDER_API_BASE = '';

// Optional explicit overrides. When WANDER_API_BASE is set these are derived
// from it automatically, so most deployments can leave them blank.
window.WANDER_SUPABASE_URL = '';
window.WANDER_SUPABASE_PUBLISHABLE_KEY = '';
window.WANDER_OPENAI_PROXY_URL = '';
window.WANDER_ODYSSEY_CREDENTIALS_URL = '';

// Secrets live in config.js, which is gitignored and loaded after this file so
// its values win. Copy config.example.js to config.js to get started.
//
// OPENAI_API_KEY powers the vision pass that identifies whatever you point at.
// Without it, speech and expression still work and pointing falls back to raw
// coordinates. Browser-side keys are visible to anyone using the page, so use
// a local config.js for personal use and the Supabase proxy for anything
// public.
window.OPENAI_API_KEY = '';

// Usually left empty so the start gate collects it per browser. Setting it
// here would ship your Odyssey key to every visitor.
window.ODYSSEY_API_KEY = '';

// Set to false to remove the start gate entirely (only useful when a key is
// already supplied by one of the routes above).
window.WANDER_ALLOW_ODYSSEY_KEY_PROMPT = true;
