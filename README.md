# Wander

**Steer a real-time world model with voice, facial expression, and a pointed hand.**

A prompt bar makes creating single-player. One person types, everyone else
watches. Wander takes the interface off the keyboard and puts it in the room:
three ambient channels feed a live world model at once, so the scene answers to
whoever is talking.

Built in four hours for the 2026 Odyssey Hackathon, developed for months after.

> **Status.** Odyssey has retired the API this was built against, so the hosted
> demo no longer generates. The input layer is the interesting part and it is
> model-agnostic, so Wander now ships as something you run yourself with your
> own credentials. See [Swapping the world model](#swapping-the-world-model) if
> you want to point it at something else.

## The three senses

| Channel | How it is read | What it controls |
|---|---|---|
| **Voice** | Web Speech API, streaming | The story. Words land mid-sentence, so a scene can turn while you are still talking. |
| **Expression** | face-api.js, 7 emotions with confidence | The mood. Confidence picks the wording, so a hesitant smile writes *cheerful* into the prompt and a certain one writes *ecstatic*. |
| **Gesture** | MediaPipe Hands, 21 landmarks | The target. Pointing crops the frame at your fingertip and runs it through a vision model, which is how "make this blue" arrives already naming the object. |

The three never carry equal weight. Voice sets the story, a gesture interrupts
it, a face only tints what is there. Deciding how they compete was more of the
design work than any single channel.

## Running it

No build step and no bundler. It is static files plus two optional Edge
Functions.

```bash
git clone https://github.com/brunomarsino/Wander.git
cd Wander
cp config.example.js config.js   # keys go here, gitignored
python3 -m http.server 8000      # or any static server
```

You can skip the `cp` and still run, since `config.js` is optional. The browser
just logs a harmless 404 for it on load.

Open `http://localhost:8000`. Wander asks for an Odyssey API key straight away
and keeps it in `localStorage` for that browser. Paste one, press **Start**, and
allow microphone and camera access when the browser prompts for them.

Serve it over HTTP rather than opening `index.html` directly. `getUserMedia`
and the Web Speech API require a secure context, which means `localhost` or
HTTPS.

### What you need

| | Required | Without it |
|---|---|---|
| **Odyssey API key** | Yes | Nothing generates. |
| **OpenAI API key** | No | Speech and expression still work. Pointing falls back to raw coordinates, so you have to name what you mean. |
| **Modern Chrome** | Effectively | The Web Speech API is still the least portable piece. |

### Keys

Two routes, and the mode is decided by whether `WANDER_API_BASE` is set in
`config.public.js`:

**Bring your own key (default).** `WANDER_API_BASE` empty. The start gate asks
each visitor for a key and stores it in their browser. No backend. This is the
right choice for local use and personal forks.

**Server-side keys.** Deploy `supabase/functions` and set `WANDER_API_BASE` to
your functions URL. The start gate becomes a demo password, keys stay on the
server, and the browser only ever receives short-lived credentials. See
[DEPLOYMENT.md](DEPLOYMENT.md). This is the right choice for anything public.

Put personal keys in `config.js`, never `config.public.js`. `config.js` is
gitignored and loads second, so its values win. A key placed in browser config
is readable by anyone who can open the page.

## Swapping the world model

Odyssey integration is reached through a small surface, so replacing it is a
contained job rather than a rewrite. The parts to look at in `app-main.js`:

- `getOdysseyApiKey()` and `buildOdysseyStartOptions()` for credentials and
  session setup
- The connect and streaming helpers around `ODYSSEY_CONNECT_MAX_ATTEMPTS`
- `applyLocationHintToPrompt()` for how a pointed-at region is folded into the
  prompt text

Everything upstream of those is model-agnostic. The senses produce one prompt
stream; what consumes it is up to you. A model that accepts a text prompt and
returns streaming frames is the shape that fits with the least work.

## Layout

```
index.html            markup and the start gate
app-main.js           senses, prompt composition, model transport, canvas
style.css             all styling
config.public.js      committed defaults, no secrets
config.example.js     template for the gitignored config.js
supabase/functions/   optional proxies that keep keys off the client
```

## Credits

Bruno Marsino, system and UI/UX architecture, cognitive philosophy, prompt
strategy, and fullstack development on later versions. Yves Chen, system
architecture and Odyssey integration. Renzo Marsino, story guidance. Ahmed
Hesham, early build support.

Demoed live to Odyssey's CEO and Soleio, both judging. It didn't place.

## License

MIT. See [LICENSE](LICENSE).
