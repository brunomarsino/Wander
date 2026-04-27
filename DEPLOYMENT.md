# Wander Web Demo Deployment

This app can run as a static frontend plus Supabase Edge Functions.

## Architecture

- Frontend: GitHub Pages, served over HTTPS.
- OpenAI: proxied through `supabase/functions/openai-chat` so the OpenAI key is not exposed in browser code.
- Odyssey: private demo mode uses a password gate backed by Supabase secrets. The browser receives short-lived Odyssey client credentials; the Odyssey API key stays server-side.

## Local Development

Keep real local keys in `config.js`. This file is git-ignored.

```js
window.OPENAI_API_KEY = 'local-only-openai-key';
window.ODYSSEY_API_KEY = 'local-only-odyssey-key';
```

Run:

```powershell
npm run dev
```

## Supabase Setup

Install and log in to the Supabase CLI, then link this repo to your Supabase project:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Set the OpenAI secret:

```powershell
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

The current deployed demo is expected to run from GitHub Pages, so browser calls are restricted to this origin:

```powershell
supabase secrets set ALLOWED_ORIGIN=https://brunomarsino.github.io
```

Deploy the OpenAI proxy:

```powershell
supabase functions deploy openai-chat
```

Your function base URL will be:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1
```

## Frontend Production Config

Current `config.public.js` production values:

```js
window.WANDER_SUPABASE_URL = 'https://hluhgxiqrwapunshvdqk.supabase.co';
window.WANDER_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_UDO4s_9wzG9BKF9olybQjw_ubML-VwR';
window.WANDER_API_BASE = 'https://hluhgxiqrwapunshvdqk.supabase.co/functions/v1';
window.WANDER_OPENAI_PROXY_URL = '';
window.WANDER_ODYSSEY_CREDENTIALS_URL = '';
window.OPENAI_API_KEY = '';
window.ODYSSEY_API_KEY = '';
window.WANDER_ALLOW_ODYSSEY_KEY_PROMPT = true;
```

Do not put real OpenAI or Odyssey keys in `config.public.js`.

## Private Odyssey Demo Flow

When no Odyssey key is configured locally, the app shows a simple demo access screen:

1. Enter the demo password.
2. Click `Start`.
3. Supabase validates the password and mints short-lived Odyssey client credentials with `createClientCredentials()`.
4. Stream cards connect through the Odyssey browser SDK using `connectWithCredentials()`.

This keeps the Odyssey API key out of browser code. The short-lived credentials are single-session and expire quickly; demo access still depends on keeping the password private.

Odyssey-2 Max access is controlled by the Odyssey account/API key. The current JavaScript SDK `startStream()` options do not document a `model` or `quality` field, so the app intentionally lets Odyssey choose the account's default streaming model instead of sending unsupported fields.

## GitHub Pages

The repo includes `.github/workflows/pages.yml`. After pushing to `main`:

1. Open the GitHub repo settings.
2. Go to `Pages`.
3. Set the source to `GitHub Actions`.
4. Run or re-run the `Deploy static demo to GitHub Pages` workflow.

## Required Manual Decisions

- If you use a custom domain later, update `ALLOWED_ORIGIN` in Supabase secrets and redeploy/retest the function.
