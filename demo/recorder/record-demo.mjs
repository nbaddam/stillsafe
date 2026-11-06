// Records a scripted StillSafe demo: a persona answers the Claude-powered intake, then views the estimate.
//
// Usage (app must be running at APP_URL, default http://localhost:3000, with an API key):
//   node record-demo.mjs <persona-id | path/to/persona.json> [--per-message N] [--headed]
//
// A persona is { id, name, answers: { field: value, ... } } using the same fields/values as
// project/stillsafe/data/personas.json. To keep the demo short, the persona answers several
// questions per message (Claude records them all), so most questions are "jumped past".
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, "../../project/stillsafe");
const OUT_DIR = path.resolve(HERE, "..");
const APP = process.env.APP_URL || "http://localhost:3000";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const personaArg = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--per-message");
const PER_MESSAGE = Number(opt("--per-message", 4));
if (!personaArg) { console.error("Usage: node record-demo.mjs <persona-id | persona.json> [--per-message N] [--headed]"); process.exit(1); }

// ---- Persona + plain-language phrasing --------------------------------------------------------
const personas = JSON.parse(fs.readFileSync(path.join(PROJECT, "data/personas.json"), "utf8"));
const list = Array.isArray(personas) ? personas : personas.personas;
const persona = fs.existsSync(personaArg) ? JSON.parse(fs.readFileSync(personaArg, "utf8")) : list.find((p) => p.id === personaArg);
if (!persona) { console.error(`Persona not found: ${personaArg}`); process.exit(1); }
const A = persona.answers;

const model = JSON.parse(fs.readFileSync(path.join(PROJECT, "data/model.json"), "utf8"));
const optLabel = (id, v) => model.factors.find((f) => f.id === id)?.options?.find((o) => o.value === v)?.label ?? String(v);

// Same order the app asks in (lib/intake.ts ORDER).
const ORDER = ["weeks", "movement", "country", "city", "age", "height", "weight", "race", "multiple", "parity", "prior_stillbirth", "prior_complication", "prior_miscarriage", "family_history", "preexisting_diabetes", "gestational_diabetes", "hypertension", "small_baby", "prenatal_care", "smoking", "secondhand_smoke", "alcohol", "substance_use", "stress_events", "activity"];

function weeksNumber(v) {
  const s = String(v);
  const range = s.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (range) return Math.round((+range[1] + +range[2]) / 2);
  if (/28 or more|28\+/.test(s)) return 31;
  if (/36\+/.test(s)) return 37;
  return s.match(/\d+/)?.[0] ?? s;
}
const yesNo = (v, yes, no) => (v === "yes" ? yes : v === "no" ? no : null);
const PHRASE = {
  weeks: (v) => `I'm ${weeksNumber(v)} weeks pregnant`,
  movement: (v) => (/normal/i.test(v) ? "the baby is moving normally" : /not sure|unsure/i.test(v) ? "I'm not sure about the baby's movements" : "the baby has been moving less"),
  country: (v) => `I live in ${v === "United States" ? "the US" : v === "United Kingdom" ? "the UK" : v}`,
  city: (v) => `in ${v}`,
  age: (v) => `I'm ${v}`,
  height: (v) => `I'm ${v} tall`,
  weight: (v) => `I weighed about ${v} before I got pregnant`,
  race: (v) => (v === "skip" ? "I'd rather not share my race" : `I'm ${optLabel("race", v)}`),
  multiple: (v) => (v === "twins" ? "I'm having twins" : "it's one baby"),
  parity: (v) => (v === "0" ? "this is my first baby" : v === "1_2" ? "I've given birth once or twice before" : "I've given birth three or more times before"),
  prior_stillbirth: (v) => (v === "no" ? "I haven't had a stillbirth" : v === "yes_explained" ? "I had a stillbirth before, and they found the cause" : "I had a stillbirth before, and they never found out why"),
  prior_complication: (v) => yesNo(v, "I had a complication in a past pregnancy", "no complications in past pregnancies"),
  prior_miscarriage: (v) => (v === "0" ? "no earlier losses" : `I've had ${optLabel("prior_miscarriage", v)} earlier losses`),
  family_history: (v) => yesNo(v, "there's been a stillbirth in my family", "no stillbirths in my family") ?? "I'm not sure about my family history",
  preexisting_diabetes: (v) => yesNo(v, "I had diabetes before this pregnancy", "I didn't have diabetes before this pregnancy"),
  gestational_diabetes: (v) => (v === "not_tested" ? "I haven't been tested for gestational diabetes yet" : yesNo(v, "I have gestational diabetes", "no gestational diabetes")),
  hypertension: (v) => yesNo(v, "I have high blood pressure", "my blood pressure is fine"),
  small_baby: (v) => (v === "unknown" ? "I don't know if the baby is measuring small" : yesNo(v, "they said the baby is measuring small", "the baby is measuring fine")),
  prenatal_care: (v) => (v === "regular" ? "I've been going to all my check-ups" : v === "some_missed" ? "I've missed some check-ups" : "I haven't had any check-ups yet"),
  smoking: (v) => ({ never: "I don't smoke", quit_t1: "I quit smoking in the first 3 months", current: "I still smoke", current_heavy: "I smoke about 10 or more a day" })[v],
  secondhand_smoke: (v) => yesNo(v, "people smoke around me", "nobody smokes around me"),
  alcohol: (v) => ({ none: "I don't drink", lt1: "I have less than one drink a week", "1_4": "I have 1 to 4 drinks a week", "5p": "I have 5 or more drinks a week" })[v],
  substance_use: (v) => (v === "skip" ? "I'd rather not say about drugs" : yesNo(v, "I've used drugs", "no drug use")),
  stress_events: (v) => (v === "0" ? "no big stresses this year" : v === "skip" ? "I'd rather not talk about stress" : "it's been a stressful year"),
  activity: (v) => `I'm active ${optLabel("activity", v)} a week`,
};
// Optional per-persona demo settings (see personas/danielle.json):
//   firstMessageSize, perMessage: how many answers per typed message (jumping past questions)
//   soloFields: answered in their own message so Claude's response to them is visible
//   showWhyFor: open the "Why we ask" card on this question (default: the first question)
//   voiceField: answer the message containing this field by voice typing (default: the 2nd message)
//   phrases: custom wording per field (null = leave it out of the sentence)
//   highlight: heading in the full breakdown to pause on; followUp: question typed to Claude at the end
const DEMO = persona.demo ?? {};
const phrase = (id) => {
  if (A[id] === undefined) return null;
  if (DEMO.phrases && id in DEMO.phrases) return DEMO.phrases[id];
  return PHRASE[id]?.(A[id]) ?? `${id}: ${optLabel(id, A[id])}`;
};
function sentence(parts) {
  const s = parts.filter(Boolean);
  const joined = s.length > 1 ? `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}` : s[0];
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}

// ---- Browser helpers ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);
const isPost = (p) => (r) => r.url().endsWith(p) && r.request().method() === "POST";

async function smoothScrollTo(page, locator, block = "start") {
  await locator.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
  await sleep(1200);
}
async function slowScroll(page, px, steps = 8, pause = 450) {
  for (let i = 0; i < steps; i++) { await page.evaluate((d) => window.scrollBy({ top: d, behavior: "smooth" }), px / steps); await sleep(pause); }
}

// ---- Run ----------------------------------------------------------------------------------------
const VIEW = { width: 480, height: 960 };
const tmpVideo = fs.mkdtempSync(path.join(OUT_DIR, ".video-"));
const browser = await chromium.launch({ channel: "chrome", headless: !flag("--headed") });
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, recordVideo: { dir: tmpVideo, size: VIEW } });
// Stand-in for the browser's speech recognizer (DEMO ONLY): there's no microphone in an automated browser,
// so this "hears" window.__demoVoiceText and streams it into the app word by word, like real dictation.
// The app's real Voice typing button, listening state and review-before-send flow are what's shown.
await context.addInitScript(() => {
  class DemoRecognition {
    constructor() { this.lang = "en-US"; this.interimResults = true; this.continuous = false; }
    start() {
      const words = String(window.__demoVoiceText || "").split(" ");
      let i = 0;
      const tick = () => {
        i++;
        const transcript = words.slice(0, i).join(" ");
        this.onresult?.({ results: [[{ transcript }]] });
        if (i < words.length) this.timer = setTimeout(tick, 260);
        else this.timer = setTimeout(() => this.onend?.(), 700);
      };
      this.timer = setTimeout(tick, 900); // brief "listening" moment before words arrive
    }
    stop() { clearTimeout(this.timer); this.onend?.(); }
    abort() { clearTimeout(this.timer); }
  }
  window.SpeechRecognition = DemoRecognition;
  window.webkitSpeechRecognition = DemoRecognition;
});
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") log("browser error:", m.text()); });
page.on("pageerror", (e) => log("page error:", e.message));

async function sendMessage(text, { voice = false, endpoint = "/api/chat" } = {}) {
  const input = page.getByLabel("Message");
  if (voice) {
    // Tap "Voice typing", let the words stream in, pause on the review step, then Send.
    await page.evaluate((t) => { window.__demoVoiceText = t; }, text);
    await page.getByRole("button", { name: "Answer by voice" }).click();
    await page.waitForFunction((t) => document.querySelector('input[aria-label="Message"]')?.value === t, text, { timeout: 60000 });
    await page.getByRole("button", { name: "Answer by voice" }).waitFor({ timeout: 10000 }); // listening finished
    await sleep(1800);
  } else {
    await input.click();
    await input.pressSequentially(text, { delay: 28 });
    await sleep(500);
  }
  const resp = page.waitForResponse(isPost(endpoint), { timeout: 120000 });
  await page.getByRole("button", { name: "Send" }).click();
  return (await resp).json();
}

// Tap a quick-reply chip and wait for Claude's reply.
async function tapChip(name) {
  const resp = page.waitForResponse(isPost("/api/chat"), { timeout: 120000 });
  await page.locator("button.chip", { hasText: name }).first().click();
  return (await resp).json();
}

// Full-screen title card drawn over the page (e.g. "Three weeks later"). Not part of the app.
async function titleCard(text, ms = 3500) {
  await page.evaluate((t) => {
    const d = document.createElement("div");
    d.id = "demo-title";
    d.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:#6d4c91;color:#fff;font:600 24px/1.35 system-ui,-apple-system,sans-serif;text-align:center;padding:32px;opacity:0;transition:opacity .5s";
    t.split("\n").forEach((line, i) => { const p = document.createElement("div"); p.textContent = line; if (i) p.style.cssText = "font-size:17px;font-weight:500;opacity:.9"; d.appendChild(p); });
    document.body.appendChild(d);
    requestAnimationFrame(() => (d.style.opacity = "1"));
  }, text);
  await sleep(ms);
  await page.evaluate(() => { const d = document.getElementById("demo-title"); if (d) { d.style.opacity = "0"; setTimeout(() => d.remove(), 600); } });
  await sleep(700);
}

// Wait for the estimate card and Claude's explanation under it.
async function waitForExplanation() {
  const bubble = page.locator(".decision").last().locator("xpath=following-sibling::div[contains(@class,'bubble')]").first();
  await bubble.waitFor({ timeout: 120000 });
  return bubble.innerText();
}

async function showCard({ breakdown = false, highlight } = {}) {
  await smoothScrollTo(page, page.locator(".decision").last(), "start");
  await sleep(3500);
  await slowScroll(page, 500);
  await sleep(1500);
  const btn = page.getByRole("button", { name: "See full breakdown" });
  if (breakdown && (await btn.count())) {
    await btn.last().click();
    await sleep(1500);
    await slowScroll(page, 1400, 14, 550);
    await sleep(1500);
    if (highlight) {
      const h = page.getByRole("heading", { name: highlight }).last();
      if (await h.count()) { await smoothScrollTo(page, h, "start"); await sleep(6000); }
    }
  }
}

try {
  log(`Persona ${persona.id ?? ""}: ${persona.name ?? ""}`);
  await page.goto(APP, { waitUntil: "networkidle" });
  if (DEMO.intro) await titleCard(DEMO.intro, 4000);
  await sleep(3000); // welcome + consent

  // Opt in to "remember me" (shows the saving feature), then agree.
  await page.getByText("Remember my answers on this device").click();
  await sleep(1200);
  let first = page.waitForResponse(isPost("/api/chat"), { timeout: 120000 });
  await page.getByRole("button", { name: /I understand, I.m 18 or older/ }).click();
  let data = await (await first).json();
  if (data.error) throw new Error(`Claude mode not available: ${JSON.stringify(data)}`);
  await sleep(2200);

  // Show the "Why we ask" explainer once: open it, let it be read, close it.
  async function showWhy() {
    const why = page.locator("details.whyask summary").last();
    if (await why.count()) { await why.click(); await sleep(5000); await why.click(); await sleep(800); }
  }
  let shownWhy = false;
  const solo = DEMO.soloFields ?? [];

  let turns = 0;
  while (!data.finished && !data.urgent && turns++ < 15) {
    const answered = data.answers ?? {};
    if (!shownWhy && (DEMO.showWhyFor ? data.askNext === DEMO.showWhyFor : true)) { await showWhy(); shownWhy = true; }
    const startAt = Math.max(0, ORDER.indexOf(data.askNext));
    // Answer the asked question plus the next few the persona has answers for (jumps past them in the video).
    // A "solo" field always gets its own message.
    const size = turns === 1 ? (DEMO.firstMessageSize ?? PER_MESSAGE + 1) : (DEMO.perMessage ?? PER_MESSAGE);
    const ids = [];
    for (const id of ORDER.slice(startAt).filter((x) => A[x] !== undefined && answered[x] === undefined)) {
      if (solo.includes(id)) { if (!ids.length) ids.push(id); break; }
      ids.push(id);
      if (ids.length >= size) break;
    }
    const text = ids.length ? sentence(ids.map(phrase)) : "I'm not sure.";
    const voice = DEMO.voiceField ? ids.includes(DEMO.voiceField) : turns === 2;
    log(`asked=${data.askNext} -> ${voice ? "VOICE " : ""}answering [${ids.join(", ")}]: ${text}`);
    data = await sendMessage(text, { voice });
    log(`  claude: ${String(data.text ?? "").replace(/\n/g, " ").slice(0, 120)}`);
    if (data.error) throw new Error(JSON.stringify(data));
    if (!data.finished) await sleep(2200);
  }
  if (data.urgent) throw new Error("Intake stopped with the urgent-symptoms screen.");

  // Estimate card + Claude's explanation.
  log("explanation:", (await waitForExplanation()).replace(/\n/g, " ").slice(0, 200));
  await sleep(4500); // read the explanation at the bottom
  await showCard({ breakdown: true, highlight: DEMO.highlight });

  // One follow-up question to Claude.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
  await sleep(1500);
  const chip = page.getByRole("button", { name: "What can I change?" });
  if (DEMO.followUp) {
    const a = await sendMessage(DEMO.followUp, { endpoint: "/api/ask" });
    log("follow-up:", String(a.text ?? "").replace(/\n/g, " ").slice(0, 200));
    await sleep(9000);
  } else if (await chip.count()) {
    const ask = page.waitForResponse(isPost("/api/ask"), { timeout: 120000 });
    await chip.click();
    const a = await (await ask).json();
    log("follow-up:", String(a.text ?? "").replace(/\n/g, " ").slice(0, 160));
    await sleep(7000);
  }

  // ---- Scene 2: the same person returns for a check-in ------------------------------------------
  const R = DEMO.returning;
  if (R) {
    await titleCard(R.title ?? "Some weeks later", 4000);
    // Move the page's clock forward so the app sees the time that has passed (expected weeks, dates).
    await page.clock.setFixedTime(new Date(Date.now() + (R.weeksLater ?? 3) * 7 * 86400000));
    await page.reload({ waitUntil: "networkidle" });
    log("returning; page date:", await page.evaluate(() => new Date().toDateString()));
    await page.getByText("How are you feeling today?").waitFor({ timeout: 15000 });
    await sleep(3000);

    let d = await sendMessage(R.feeling ?? "Good, thanks");
    log(`  claude: ${String(d.text ?? "").replace(/\n/g, " ").slice(0, 140)}`);
    let taps = 0, saidRest = false, n = 0;
    while (!d.finished && !d.urgent && n++ < 15) {
      await sleep(2200);
      const f = d.askNext;
      const same = page.locator("button.chip", { hasText: "Same as last time" });
      if (f === "weeks" && (await page.locator("button.chip", { hasText: /^About \d+ weeks/ }).count())) {
        log("asked=weeks -> tap 'About N weeks'");
        d = await tapChip(/^About \d+ weeks/);
      } else if (R.phrases?.[f]) {
        const voice = R.voiceField === f;
        log(`asked=${f} -> ${voice ? "VOICE " : ""}${R.phrases[f]}`);
        d = await sendMessage(R.phrases[f], { voice });
      } else if (taps < (R.sameChipTaps ?? 2) && (await same.count())) {
        taps++;
        log(`asked=${f} -> tap 'Same as last time'`);
        d = await tapChip("Same as last time");
      } else if (R.restSame && !saidRest) {
        saidRest = true;
        log(`asked=${f} -> ${R.restSame}`);
        d = await sendMessage(R.restSame);
      } else if (await same.count()) {
        log(`asked=${f} -> tap 'Same as last time'`);
        d = await tapChip("Same as last time");
      } else {
        const text = phrase(f) ? sentence([phrase(f)]) : "I'm not sure.";
        log(`asked=${f} -> ${text}`);
        d = await sendMessage(text);
      }
      log(`  claude: ${String(d.text ?? "").replace(/\n/g, " ").slice(0, 140)}`);
      if (d.error) throw new Error(JSON.stringify(d));
    }
    if (d.urgent) throw new Error("Check-in stopped with the urgent-symptoms screen.");
    log("explanation:", (await waitForExplanation()).replace(/\n/g, " ").slice(0, 200));
    await sleep(5000);
    await showCard();
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
    await sleep(4000);
  }
} catch (e) {
  log("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  const src = await video.path();
  const name = `stillsafe-demo-${(persona.id ?? "persona").toString().toLowerCase()}.webm`;
  const dest = path.join(OUT_DIR, name);
  fs.renameSync(src, dest);
  fs.rmSync(tmpVideo, { recursive: true, force: true });
  log("video:", dest);
  // Also make an .mp4 (QuickTime/Keynote/Slides-friendly) with the bundled ffmpeg.
  try {
    const { default: ffmpeg } = await import("ffmpeg-static");
    const mp4 = dest.replace(/\.webm$/, ".mp4");
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", dest, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", mp4]);
    log("video:", mp4);
  } catch (e) { log("mp4 conversion skipped:", e.message); }
}
