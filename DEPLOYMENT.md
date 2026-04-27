# Wander Web Demo Deployment

This app can run as a static frontend plus Supabase Edge Functions.

## Architecture

- Frontend: GitHub Pages, served over HTTPS.
- OpenAI: proxied through `supabase/functions/openai-chat` so the OpenAI key is not exposed in browser code.
- Odyssey: private demo mode uses an in-browser key entry screen. The key is stored only in that browser's `localStorage`.

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
window.OPENAI_API_KEY = '';
window.ODYSSEY_API_KEY = '';
window.WANDER_ALLOW_ODYSSEY_KEY_PROMPT = true;
```

Do not put real OpenAI or Odyssey keys in `config.public.js`.

## Private Odyssey Demo Flow

When no Odyssey key is configured locally, the app shows a simple start screen:

1. Paste any valid Odyssey API key.
2. Click `Start`.
3. The key is saved to that browser's `localStorage`.
4. Stream cards can then connect directly through the Odyssey browser SDK.

This is acceptable for a controlled private demo. It is not a fully public secret-hiding strategy because the Odyssey SDK still runs in the browser.

## GitHub Pages

The repo includes `.github/workflows/pages.yml`. After pushing to `main`:

1. Open the GitHub repo settings.
2. Go to `Pages`.
3. Set the source to `GitHub Actions`.
4. Run or re-run the `Deploy static demo to GitHub Pages` workflow.

## Required Manual Decisions

- If you use a custom domain later, update `ALLOWED_ORIGIN` in Supabase secrets and redeploy/retest the function.
