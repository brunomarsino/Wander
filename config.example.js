// Copy this file to config.js and fill in what you have.
// config.js is gitignored and loads after config.public.js, so anything set
// here overrides the public defaults. Never commit config.js.

// Optional. Skips the start gate by supplying the Odyssey key directly.
// Leave it empty to let the app ask for a key and store it in localStorage.
window.ODYSSEY_API_KEY = '';

// Optional. Enables the vision pass that names whatever you point at, so
// "make this blue" works without saying what "this" is. Without it, speech and
// expression still drive the model and pointing falls back to raw coordinates.
// The key is readable by anyone who can open the page, so keep this local.
window.OPENAI_API_KEY = '';
