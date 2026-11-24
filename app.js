// Briefly — Hybrid AI Text Studio
// Engine layer:
//   * Firebase AI Logic with hybrid inference (Gemini Nano on-device in
//     Chrome, cloud Gemini fallback) — the primary path.
//   * Chrome's built-in Prompt API (LanguageModel) as a direct on-device
//     path when no Firebase project is configured yet.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.15.0/firebase-app.js";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "https://www.gstatic.com/firebasejs/11.15.0/firebase-ai.js";

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

async function runFirebase(mode, prompt) {
  const model = getFirebaseModel(mode);
  if (!model) throw new Error("NO_FIREBASE_CONFIG");
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ---------- Direct on-device Prompt API (Gemini Nano) ----------

function getLanguageModelCtor() {
  if (typeof LanguageModel !== "undefined") return LanguageModel;
  if (window.ai && window.ai.languageModel) return window.ai.languageModel;
  return null;
}

async function nanoAvailability() {
  const ctor = getLanguageModelCtor();
  if (!ctor) return "unavailable";
  try {
    if (typeof ctor.availability === "function") return await ctor.availability();
    if (typeof ctor.capabilities === "function") {
      const caps = await ctor.capabilities();
      return caps && caps.available === "readily" ? "available" : "unavailable";
    }
  } catch (_) { /* fall through */ }
  return "unavailable";
}

async function runOnDevice(prompt) {
  const ctor = getLanguageModelCtor();
  if (!ctor) throw new Error("NO_ON_DEVICE");
  const availability = await nanoAvailability();
  if (availability === "unavailable") throw new Error("NO_ON_DEVICE");
  const session = await ctor.create({
    systemPrompt: "You are Briefly, a precise text assistant. Follow the instruction exactly and output only the requested result.",
  });
  try {
    return await session.prompt(prompt);
  } finally {
    if (typeof session.destroy === "function") session.destroy();
  }
}

// ---------- Routing ----------

async function run(mode, prompt) {
  // Returns { text, engineLabel, engineClass }
  if (mode === "device") {
    if (firebaseConfigured()) {
      const text = await runFirebase("device", prompt);
      return { text, engineLabel: "On-device · Gemini Nano via Firebase AI Logic", engineClass: "device" };
    }
    const text = await runOnDevice(prompt);
    return { text, engineLabel: "On-device · Gemini Nano (Chrome built-in AI)", engineClass: "device" };
  }
  if (mode === "cloud") {
    const text = await runFirebase("cloud", prompt);
    return { text, engineLabel: "Cloud · Gemini via Firebase AI Logic", engineClass: "cloud" };
  }
  // auto: Firebase hybrid when configured; otherwise on-device direct.
  if (firebaseConfigured()) {
    const text = await runFirebase("auto", prompt);
    return { text, engineLabel: "Hybrid · Firebase AI Logic (on-device preferred)", engineClass: "device" };
  }
  const text = await runOnDevice(prompt);
  return { text, engineLabel: "On-device · Gemini Nano (Chrome built-in AI)", engineClass: "device" };
}

function friendlyError(err) {
  const msg = String((err && err.message) || err || "");
  if (msg.includes("NO_FIREBASE_CONFIG")) {
    return "Cloud engine is not configured yet. Add your Firebase project config in firebase-config.js (see README — free Spark plan is enough), or switch to “On-device only” in a Chrome browser with Gemini Nano.";
  }
  if (msg.includes("NO_ON_DEVICE")) {
    return "On-device Gemini Nano is not available in this browser. Use a recent Chrome with the built-in AI model enabled/downloaded, or configure the Firebase cloud engine in firebase-config.js.";
  }
  if (/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) {
    return "The cloud model hit its free-tier quota. Wait a moment and try again, or use the on-device engine.";
  }
  return "Something went wrong while running the model: " + msg;
}

// ---------- UI wiring ----------

function setBusy(busy) {
  document.querySelectorAll(".action").forEach((b) => (b.disabled = busy));
}

async function execute(actionKey, question) {
  const text = inputEl.value.trim();
  if (!text) {
    outputEl.textContent = "Paste some text first, then choose an action.";
    return;
  }
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const prompt = PROMPTS[actionKey](text, question);
  setBusy(true);
  badgeEl.textContent = "Running…";
  badgeEl.className = "badge";
  metaEl.textContent = "";
  const started = performance.now();
  try {
    const { text: out, engineLabel, engineClass } = await run(mode, prompt);
    outputEl.textContent = out && out.trim() ? out.trim() : "(The model returned an empty result.)";
    badgeEl.textContent = engineLabel;
    badgeEl.className = "badge " + engineClass;
    metaEl.textContent = `Mode: ${mode} · ${(performance.now() - started).toFixed(0)} ms · ${out.length} characters`;
  } catch (err) {
    outputEl.textContent = friendlyError(err);
    badgeEl.textContent = "Needs attention";
    badgeEl.className = "badge error";
    metaEl.textContent = `Mode: ${mode}`;
  } finally {
    setBusy(false);
  }
}

document.querySelectorAll(".action[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => execute(btn.dataset.action));
});
$("askBtn").addEventListener("click", () => {
  const q = $("askInput").value.trim();
  if (!q) { outputEl.textContent = "Type a question about the text first."; return; }
  execute("ask", q);
});
$("copyBtn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(outputEl.textContent); $("copyBtn").textContent = "Copied!"; }
  catch (_) { $("copyBtn").textContent = "Copy failed"; }
  setTimeout(() => ($("copyBtn").textContent = "Copy result"), 1500);
});
$("sampleBtn").addEventListener("click", () => {
  inputEl.value =
    "The city council voted on Tuesday to approve the new riverside park project after two years of debate. The $4.2 million plan includes a walking trail, a small amphitheater, and restored wetlands along the east bank. Construction is scheduled to begin in March and finish within eighteen months. Supporters say the park will reduce flooding and give residents their first direct access to the river in decades. Critics raised concerns about maintenance costs, which the council addressed by creating a dedicated annual fund of $150,000. The mayor called the vote a turning point for the district and promised that the first section of the trail will open before the end of next year.";
  updateCount();
});
function updateCount() { $("charCount").textContent = `${inputEl.value.length} characters`; }
inputEl.addEventListener("input", updateCount);
updateCount();

// ---------- Engine status header ----------

(async function initStatus() {
  const nano = await nanoAvailability();
  const nanoDot = $("nanoDot"), nanoLabel = $("nanoLabel");
  if (nano === "available") { nanoDot.className = "dot dot-ok"; nanoLabel.textContent = "On-device Gemini Nano: ready"; }
  else if (nano === "downloadable" || nano === "downloading") { nanoDot.className = "dot dot-unknown"; nanoLabel.textContent = "On-device Gemini Nano: downloadable"; }
  else { nanoDot.className = "dot dot-bad"; nanoLabel.textContent = "On-device Gemini Nano: unavailable"; }

  const cloudDot = $("cloudDot"), cloudLabel = $("cloudLabel");
  if (firebaseConfigured()) { cloudDot.className = "dot dot-ok"; cloudLabel.textContent = "Cloud Gemini (Firebase AI Logic): configured"; }
  else { cloudDot.className = "dot dot-bad"; cloudLabel.textContent = "Cloud Gemini: not configured (see README)"; }
})();
