// Briefly — Hybrid AI Text Studio
// Engine layer:
//   * Firebase AI Logic with hybrid inference (Gemini Nano on-device in
//     Chrome, cloud Gemini fallback) — the primary path.
//   * Chrome's built-in Prompt API (LanguageModel) as a direct on-device
//     path when no Firebase project is configured yet.


import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-ai.js";


const $ = (id) => document.getElementById(id);
const inputEl = $("inputText");
const outputEl = $("outputText");
const badgeEl = $("engineBadge");
const metaEl = $("runMeta");


const PROMPTS = {
  "summarize": (t) =>
    `Summarize the following text in a clear, faithful way. Use a short paragraph, then up to 5 bullet points with the key facts. Do not add information that is not in the text.\n\nTEXT:\n${t}`,
  "rewrite-formal": (t) =>
    `Rewrite the following text in a polished, formal, professional tone. Keep every fact and the original meaning. Output only the rewritten text.\n\nTEXT:\n${t}`,
  "rewrite-casual": (t) =>
    `Rewrite the following text in a friendly, casual, conversational tone. Keep every fact and the original meaning. Output only the rewritten text.\n\nTEXT:\n${t}`,
  "rewrite-shorter": (t) =>
    `Rewrite the following text to be at most half as long while keeping every important fact. Output only the rewritten text.\n\nTEXT:\n${t}`,
  "translate-id": (t) =>
    `Translate the following text into natural, fluent Indonesian (Bahasa Indonesia). Output only the translation.\n\nTEXT:\n${t}`,
  "translate-en": (t) =>
    `Translate the following text into natural, fluent English. Output only the translation.\n\nTEXT:\n${t}`,
  "ask": (t, q) =>
    `Answer the question using only the text below. If the text does not contain the answer, say so honestly.\n\nTEXT:\n${t}\n\nQUESTION: ${q}`,
};


// ---------- Firebase AI Logic (hybrid) ----------


let firebaseModelCache = {};


function firebaseConfigured() {
  const cfg = window.BRIEFLY_FIREBASE_CONFIG || {};
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId);
}


function getFirebaseModel(mode) {
  if (!firebaseConfigured()) return null;
  if (firebaseModelCache[mode]) return firebaseModelCache[mode];
  const app = initializeApp(window.BRIEFLY_FIREBASE_CONFIG);
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const inferenceModes = {
    auto: InferenceMode.PREFER_ON_DEVICE,
    device: InferenceMode.ONLY_ON_DEVICE,
    cloud: InferenceMode.ONLY_IN_CLOUD,
  };
  const model = getGenerativeModel(ai, {
    model: window.BRIEFLY_CLOUD_MODEL || "gemini-2.5-flash-lite",
    inference: { mode: inferenceModes[mode] },
  });
  firebaseModelCache[mode] = model;
  return model;
}
