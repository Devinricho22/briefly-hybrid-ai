# Briefly — Hybrid AI Text Studio

Briefly is a web app that summarizes, rewrites, translates and answers
questions about any text — powered by **Firebase AI Logic hybrid
inference**: **Gemini Nano on-device** in Chrome first (private, fast,
offline-capable), with **cloud Gemini** as a transparent fallback when
the on-device model can't serve the request.

Built for **#BuildHybridAI 2026** (Google Firebase × Devpost), Web/Chrome
category.

## Why hybrid?

- **Privacy** — in Auto mode your text is processed on the device
  whenever possible; nothing leaves the machine for on-device runs.
- **Speed & offline** — Gemini Nano answers in milliseconds and works
  with no connection at all.
- **Power when needed** — long or complex requests fall back to cloud
  Gemini through the same Firebase AI Logic call.
- **Control** — the inference-mode switch (Auto / On-device only /
  Cloud only) and the engine badge on every result show exactly which
  engine produced the output.

## Features

- Summarize (paragraph + key-point bullets)
- Rewrite: Formal · Casual · Shorter
- Translate: English → Indonesian, Indonesian → English
- Ask: free-form questions answered strictly from the provided text
- Live engine status (on-device availability + cloud configuration)
- Per-result engine badge and latency readout

## Tech

- Firebase AI Logic (Web SDK) with `InferenceMode.PREFER_ON_DEVICE`,
  `ONLY_ON_DEVICE` and `ONLY_IN_CLOUD`
- Chrome built-in AI (Gemini Nano / Prompt API) as the direct
  on-device path when no Firebase project is configured
- Vanilla HTML/CSS/JS — no build step

## Run it

1. Serve the folder with any static server, e.g.:
   `npx serve .` or `python3 -m http.server 8080`
2. Open it in a recent Chrome.
   - On-device mode works out of the box where Gemini Nano is
     available (Chrome may need the model downloaded:
     `chrome://components` → "Optimization Guide On Device Model").
   - For the cloud + hybrid modes, create a free Firebase project:
     1. https://console.firebase.google.com → create project (Spark plan)
     2. Build → **AI Logic** → enable the Gemini API (free tier)
     3. Project settings → register a Web app → copy the config into
        `firebase-config.js`
3. Reload — the header shows both engines ready.

## Project layout

- `index.html` — UI
- `styles.css` — styling
- `app.js` — engine routing (Firebase AI Logic hybrid + Prompt API),
  prompts, UI wiring
- `firebase-config.js` — your Firebase web config + cloud model choice

## License

MIT — see `LICENSE`.
