// StillSafe scoring engine — deterministic, runs on-device. Claude never computes the number.
import modelJson from "../data/model.json";

export type Model = typeof modelJson;
export const model: Model = modelJson;

export type Answers = Record<string, string | number | undefined>;

type Band = { value: string; label: string; max: number; or: number };
type Option = { value: string; label: string; or?: number };
export interface Factor {
  id: string; label: string; question?: string; type: string; group: string; scored: boolean; optional: boolean;
  importance: string; why: string; how_used: string; approx: boolean; source: { label: string; url: string };
  bands?: Band[]; options?: Option[]; upstream_of?: string[]; usOnly?: boolean; unit?: string;
}

export const factors = model.factors as unknown as Factor[];
export const factorById = (id: string) => factors.find((f) => f.id === id) as Factor | undefined;

const logit = (p: number) => Math.log(p / (1 - p));
const expit = (x: number) => 1 / (1 + Math.exp(-x));

// ---------- Input parsing ----------
export function parseHeightCm(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") return v < 3 ? v * 100 : v;
  const s = String(v).toLowerCase().trim();
  const ftin = s.match(/(\d)\s*(?:'|ft|feet|foot)\s*(\d{1,2})?/);
  if (ftin) return Math.round((Number(ftin[1]) * 12 + Number(ftin[2] || 0)) * 2.54);
  const n = parseFloat(s);
  if (isNaN(n)) return undefined;
  if (s.includes("in")) return Math.round(n * 2.54);
  if (n < 3) return n * 100; // metres
  return n;
}

export function parseWeightKg(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).toLowerCase().trim();
  const n = parseFloat(s);
  if (isNaN(n)) return undefined;
  if (s.includes("lb") || s.includes("pound")) return Math.round(n * 0.4536 * 10) / 10;
  if (s.includes("kg")) return n;
  return n > 140 ? Math.round(n * 0.4536 * 10) / 10 : n; // bare number: guess lb if implausibly large for kg
}

export function findCountry(v: unknown) {
  if (!v) return undefined;
  const s = String(v).toLowerCase().trim();
  const aliases: Record<string, string> = { us: "USA", usa: "USA", america: "USA", "united states of america": "USA", uk: "GBR", england: "GBR", britain: "GBR" };
  const iso = aliases[s];
  return model.countries.find((c) => c.iso === iso || c.iso.toLowerCase() === s || c.name.toLowerCase() === s);
}

export function findCity(country: ReturnType<typeof findCountry>, v: unknown) {
  if (!country || !v) return undefined;
  const s = String(v).toLowerCase().trim();
  return country.cities.find((c) => c.name.toLowerCase() === s || s.includes(c.name.toLowerCase()));
}

function bandFor(f: Factor, x: number): Band | undefined {
  return f.bands?.find((b) => x <= b.max);
}

/** Turn raw answers into a resolved value per scored factor. */
export function resolve(raw: Answers) {
  const r: Record<string, string> = {};
  const age = Number(raw.age);
  if (!isNaN(age) && raw.age !== undefined && raw.age !== "") r.age = bandFor(factorById("age")!, age)!.value;
  const h = parseHeightCm(raw.height);
  const w = parseWeightKg(raw.weight);
  let bmi: number | undefined;
  if (h && w) {
    bmi = Math.round((w / (h / 100) ** 2) * 10) / 10;
    r.bmi = bandFor(factorById("bmi")!, bmi)!.value;
  }
  for (const f of factors) {
    if (f.options && raw[f.id] !== undefined && raw[f.id] !== "") {
      const val = String(raw[f.id]);
      const opt = f.options.find((o) => o.value === val || o.label.toLowerCase() === val.toLowerCase());
      if (opt) r[f.id] = opt.value;
    }
  }
  const country = findCountry(raw.country) ?? findCountry("USA")!;
  const city = findCity(country, raw.city);
  return { values: r, bmi, heightCm: h, weightKg: w, country, city, countryGiven: !!findCountry(raw.country) };
}

// ---------- Coefficients ----------
function orFor(id: string, value: string | undefined): number {
  if (!value) return 1;
  const f = factorById(id);
  if (!f) return 1;
  const b = f.bands?.find((x) => x.value === value);
  if (b) return b.or;
  const o = f.options?.find((x) => x.value === value);
  return o?.or ?? 1;
}

/** Expected log-OR of a factor in a population, from prevalence (used for centering). */
function expectedBeta(id: string, prev: Record<string, number>): number {
  const map: Record<string, [string, string][]> = {
    smoking: [["current", "smoking"]],
    bmi: [["over", "bmi_over"], ["obese1", "bmi_obese1"], ["obese2", "bmi_obese2"]],
    age: [["lt20", "age_lt20"], ["35_39", "age_35_39"], ["40p", "age_40p"]],
    multiple: [["twins", "twins"]],
  };
  let e = 0;
  for (const [val, key] of map[id] ?? []) {
    if (prev[key] !== undefined) e += prev[key] * Math.log(orFor(id, val));
  }
  return e;
}
const CENTERED = ["smoking", "bmi", "age", "multiple"];

// ---------- Scoring ----------
export type Contribution = {
  id: string;
  label: string;
  answer: string;
  or: number; // effective OR applied
  per1000: number; // change in risk per 1,000 vs. if this factor were at the reference level
  direction: "up" | "down" | "none";
  changeable: boolean;
  importance: string;
  why: string;
  howUsed: string;
  source: { label: string; url: string };
  approx: boolean;
};

export type Confidence = { score: number; level: "High" | "Moderate" | "Low"; reasons: string[]; improve: string[] };

export type Result = {
  p: number; // probability, 28+ weeks
  per1000: number;
  low: number;
  high: number;
  baseline: number; // country (or US race-specific) average per 1,000
  baselineLabel: string;
  baselineShort: string;
  baselineApprox: boolean;
  ratio: number;
  band: "Around average" | "Above average" | "Well above average";
  oneInN: number;
  contributions: Contribution[];
  airQuality?: { city: string; pm25: number; countryPm25: number };
  bmi?: number;
  missing: string[];
  capped: boolean;
  confidence: Confidence;
  actions: string[];
  questions: string[];
  urgentSigns: string[];
};

const CHANGEABLE = new Set(["smoking", "secondhand_smoke", "alcohol", "prenatal_care", "bmi", "substance_use"]);

export const URGENT_SIGNS = [
  "Your baby is moving less than usual, or the pattern of movements has changed",
  "Any vaginal bleeding",
  "Fluid leaking from the vagina",
  "Severe or constant tummy pain",
  "Sudden swelling, severe headache, or changes in your vision",
];

function logOddsParts(values: Record<string, string>, ctx: ReturnType<typeof resolve>) {
  const shrink = model.caps.downstreamShrink;
  const parts: Record<string, number> = {};
  const upstreamActive: Record<string, boolean> = {};
  if (["over", "obese1", "obese2"].includes(values.bmi)) for (const d of ["preexisting_diabetes", "gestational_diabetes", "hypertension"]) upstreamActive[d] = true;
  if (["current", "current_heavy"].includes(values.smoking)) upstreamActive["small_baby"] = true;
  for (const f of factors) {
    if (!f.scored || ["country", "city", "race"].includes(f.id)) continue;
    let b = Math.log(orFor(f.id, values[f.id]));
    if (upstreamActive[f.id] && b > 0) b *= shrink;
    parts[f.id] = b;
  }
  if (ctx.city) {
    // Cap the excess at ±30 µg/m³: exposure–response curves flatten at high levels (Xue et al. 2022)
    const diff = Math.max(-30, Math.min(30, ctx.city.pm25 - ctx.country.pm25));
    parts.city = Math.log(model.pm25.orPer10) * (diff / 10);
  }
  return parts;
}

function baselineFor(ctx: ReturnType<typeof resolve>, values: Record<string, string>) {
  const isUS = ctx.country.iso === "USA";
  if (isUS && values.race && values.race !== "skip") {
    const r = (model.us.sbr28ByRace as Record<string, number>)[values.race];
    if (r) { const g = factorById("race")!.options!.find((o) => o.value === values.race)!.label; return { rate: r, label: `US average for ${g} mothers (CDC 2024)`, short: `${g} mothers in the US`, approx: false }; }
  }
  return { rate: ctx.country.sbr28, label: `${ctx.country.name} average (WHO / UN IGME)`, short: `pregnancies in ${ctx.country.name}`, approx: ctx.country.approxRate };
}

export function score(raw: Answers): Result {
  const ctx = resolve(raw);
  const v = ctx.values;
  const base = baselineFor(ctx, v);
  const p0 = base.rate / 1000;
  const prev = ctx.country.prev as Record<string, number>;

  // Step 2: re-center the population average to a reference person
  let centering = 0;
  for (const id of CENTERED) centering += expectedBeta(id, prev);
  const refLogit = logit(p0) - centering;

  // Step 3: personal adjustment
  const rawParts = logOddsParts(v, ctx);
  const capLog = Math.log(model.caps.maxCombinedOR);
  const rawTotal = Object.values(rawParts).reduce((a, b) => a + b, 0);
  // If the combined adjustment exceeds the cap, scale every factor down evenly so each keeps its share.
  const scale = rawTotal > capLog ? capLog / rawTotal : 1;
  const parts: Record<string, number> = Object.fromEntries(Object.entries(rawParts).map(([k, b]) => [k, b * scale]));
  const capped = scale < 1;
  const sum = (ps: Record<string, number>) => Object.values(ps).reduce((a, b) => a + b, 0);
  const total = sum(parts);
  const p = expit(refLogit + total);

  // Uncertainty (demo): scale all log-ORs ×0.6 / ×1.4 and widen by baseline uncertainty
  const baseUnc = base.approx ? 0.25 : 0.1;
  const low = expit(logit(p0 * (1 - baseUnc)) - centering + total * 0.6);
  const high = expit(logit(p0 * (1 + baseUnc)) - centering + total * 1.4);

  // Per-factor impact: risk now vs. risk if this factor were at the reference level
  const contributions: Contribution[] = [];
  for (const [id, b] of Object.entries(parts)) {
    if (Math.abs(b) < 1e-9) continue;
    const pWithoutCheck = expit(refLogit + sum({ ...parts, [id]: 0 }));
    if (Math.abs(p - pWithoutCheck) * 1000 < 0.05) continue;
    const without = { ...parts, [id]: 0 };
    const pWithout = expit(refLogit + sum(without));
    const f = factorById(id)!;
    let answer = "";
    if (id === "bmi") answer = `${ctx.bmi}`;
    else if (id === "age") answer = `${raw.age}`;
    else if (id === "city") answer = `${ctx.city!.name}: PM2.5 ${ctx.city!.pm25} µg/m³ vs ${ctx.country.name} average ${ctx.country.pm25}`;
    else answer = f.options?.find((o) => o.value === v[id])?.label ?? String(v[id]);
    contributions.push({
      id,
      label: id === "bmi" ? "BMI" : id === "city" ? `Air quality (${ctx.city!.name})` : f.label,
      answer,
      or: Math.exp(rawParts[id]),
      per1000: (p - pWithout) * 1000,
      direction: b > 0 ? "up" : b < 0 ? "down" : "none",
      changeable: CHANGEABLE.has(id),
      importance: f.importance,
      why: f.why,
      howUsed: f.how_used,
      source: f.source,
      approx: f.approx,
    });
  }
  contributions.sort((a, b) => Math.abs(b.per1000) - Math.abs(a.per1000));

  const per1000 = p * 1000;
  const ratio = per1000 / base.rate;
  const band = ratio <= 1.5 ? "Around average" : ratio <= 3 ? "Above average" : "Well above average";

  const required = ["age", "height", "weight", "country", "multiple", "parity", "prior_stillbirth", "prior_complication", "prior_miscarriage", "preexisting_diabetes", "gestational_diabetes", "hypertension", "small_baby", "prenatal_care", "smoking", "secondhand_smoke", "alcohol"];
  const missing = required.filter((id) => raw[id] === undefined || raw[id] === "" || raw[id] === "skip");

  return {
    p,
    per1000,
    low: low * 1000,
    high: high * 1000,
    baseline: base.rate,
    baselineLabel: base.label,
    baselineShort: base.short,
    baselineApprox: base.approx,
    ratio,
    band,
    oneInN: Math.round(1 / p),
    contributions,
    airQuality: ctx.city ? { city: ctx.city.name, pm25: ctx.city.pm25, countryPm25: ctx.country.pm25 } : undefined,
    bmi: ctx.bmi,
    missing,
    capped,
    confidence: confidenceFor({ raw, v, base, parts, rawParts, capped, missing, ctx }),
    actions: buildActions(v, raw),
    questions: buildQuestions(v, band),
    urgentSigns: URGENT_SIGNS,
  };
}

function buildActions(v: Record<string, string>, raw: Answers): string[] {
  const a: string[] = [];
  if (v.smoking === "current" || v.smoking === "current_heavy") a.push("Quitting smoking now still lowers risk. Ask your provider about free quit support, or call a quitline (in the US: 1-800-QUIT-NOW).");
  if (v.secondhand_smoke === "yes") a.push("Ask people around you to smoke outside, away from you, and keep your home and car smoke-free.");
  if (v.alcohol === "1_4" || v.alcohol === "5p") a.push("Stopping alcohol for the rest of your pregnancy removes this risk. If cutting down is hard, your provider can help without judgment.");
  if (v.prenatal_care === "some_missed" || v.prenatal_care === "none") a.push("Try to get to your next prenatal visit. If cost, transport or time is the barrier, ask the clinic what help is available.");
  if (["obese1", "obese2"].includes(v.bmi)) a.push("Pregnancy isn't the time to diet, but ask your provider about healthy weight gain, blood-sugar testing and safe activity.");
  if (v.substance_use === "yes") a.push("Talk to your provider about drug use — they can connect you with treatment that's safe in pregnancy. Stopping some drugs suddenly can be risky, so get help rather than going it alone.");
  if (v.stress_events === "3" || v.stress_events === "4") a.push("You've had a lot to deal with this year. Tell your provider — many clinics can connect you with social work, counselling, or financial and housing support. If you're not safe at home, ask for help privately.");
  if (raw.activity === "0") a.push("Gentle activity like a daily walk is usually safe in pregnancy — check with your provider what's right for you.");
  a.push("From 28 weeks, go to sleep on your side rather than your back.");
  a.push("Get to know your baby's usual pattern of movements, and call straight away if it slows down or changes. Don't wait until the next day.");
  return a;
}

function buildQuestions(v: Record<string, string>, band: string): string[] {
  const q: string[] = [];
  if (v.prior_stillbirth?.startsWith("yes")) q.push("Because I've had a stillbirth before, should I have extra growth scans or earlier monitoring this time?");
  if (v.prior_complication === "yes") q.push("Given my past pregnancy complications, what extra checks do you recommend?");
  if (v.small_baby === "yes") q.push("How often will you check the baby's growth and blood flow, and what would change the plan?");
  if (v.preexisting_diabetes === "yes" || v.gestational_diabetes === "yes") q.push("What blood-sugar targets should I aim for, and how will we monitor the baby?");
  if (v.hypertension === "yes") q.push("How often should my blood pressure be checked, and which symptoms mean I should call right away?");
  if (v.prior_miscarriage === "3p") q.push("I've had three or more earlier losses — should I have testing for recurrent pregnancy loss?");
  if (v.family_history === "yes") q.push("Stillbirth has happened in my family — would genetic counselling be useful for me?");
  if (v.prior_stillbirth?.startsWith("yes")) q.push("Is there a specialist pregnancy-after-loss clinic I could be referred to (like the University of Utah's Pregnancy After Loss Program)?");
  if (v.multiple === "twins") q.push("What's the monitoring schedule for my twin pregnancy?");
  if (band !== "Around average") q.push("My estimate is above average for my country — is there anything you'd do differently for me?");
  q.push("What should I do if I notice my baby moving less?");
  return q;
}

// ---------- CDC proof-of-concept check ----------
export function cdcPredict(set: Record<string, string>): number {
  const us = model.countries.find((c) => c.iso === "USA")!;
  const prev = us.prev as Record<string, number>;
  let x = logit(model.cdcCheck.baseline20 / 1000);
  for (const [id, val] of Object.entries(set)) x += Math.log(orFor(id, val)) - expectedBeta(id, prev);
  return expit(x) * 1000;
}

export function cdcCheck() {
  return model.cdcCheck.groups.map((g) => {
    const predicted = cdcPredict(g.set as Record<string, string>);
    const diffPct = ((predicted - g.observed) / g.observed) * 100;
    return { ...g, predicted, diffPct, within25: Math.abs(diffPct) <= 25 };
  });
}

// ---------- Plain-language helpers ----------
export function fmt(n: number, d = 1) {
  return n >= 10 ? Math.round(n).toString() : n.toFixed(d);
}

export function plainSummary(r: Result): string {
  const survive = 1000 - Math.round(r.per1000);
  return `Out of 1,000 pregnancies like yours, about ${fmt(r.per1000)} would end in stillbirth and about ${survive} would not. That's roughly 1 in ${r.oneInN}. The average for ${r.baselineShort} is about ${fmt(r.baseline)} in 1,000.`;
}

export function impactSentence(c: Contribution): string {
  const amt = fmt(Math.abs(c.per1000));
  if (c.id === "city") return c.direction === "up" ? `Your city's air is more polluted than your country's average, which adds about ${amt} in 1,000.` : `Your city's air is cleaner than your country's average, which takes away about ${amt} in 1,000.`;
  const what = `${c.label}: ${c.answer.charAt(0).toLowerCase() + c.answer.slice(1)}`;
  return c.direction === "up" ? `${what}. This adds about ${amt} in 1,000.` : `${what}. This lowers your estimate by about ${amt} in 1,000.`;
}


// ---------- Confidence in the estimate ----------
const DONT_KNOW: Record<string, string[]> = { small_baby: ["unknown"], gestational_diabetes: ["not_tested"], race: ["skip"], stress_events: ["skip"], substance_use: ["skip"], family_history: ["unsure"], prior_stillbirth: ["yes_unexplained"] };

function confidenceFor(o: { raw: Answers; v: Record<string, string>; base: { approx: boolean }; parts: Record<string, number>; rawParts: Record<string, number>; capped: boolean; missing: string[]; ctx: ReturnType<typeof resolve> }): Confidence {
  let score = 100;
  const reasons: string[] = [];
  const improve: string[] = [];

  // 1. Quality of the starting rate
  if (o.base.approx) { score -= 15; reasons.push("Your country's starting rate is an approximate demo value (UN estimates also carry uncertainty in countries with less birth registration)."); }
  else reasons.push(o.ctx.country.iso === "USA" ? "Your starting rate comes from complete US birth and fetal-death records (CDC)." : "Your starting rate comes from official UN / WHO estimates.");

  // 2. Missing and "don't know" answers
  const missing = o.missing.filter((m) => (!["height", "weight"].includes(m) || !o.ctx.bmi) && coreIds(o.raw).includes(m));
  const wk = gestWeeks(o.raw);
  if (wk !== undefined && wk < 20) { score -= 10; reasons.push("It's early in pregnancy: growth scans and diabetes tests haven't happened yet, and they add a lot of information."); improve.push("Check in again after your 20-week scan."); }
  const deepLeft = unanswered(DEEP_IDS, o.raw).filter((id) => coreIds(o.raw).indexOf(id) === -1);
  if (deepLeft.length >= 4) { score -= 5; improve.push("Answer the optional follow-up questions (about 2 minutes) for a more precise estimate."); }
  if (missing.length) {
    score -= Math.min(40, missing.length * 5);
    reasons.push(`${missing.length} question${missing.length > 1 ? "s were" : " was"} left unanswered, so we assumed average for ${missing.length > 1 ? "those" : "that one"}.`);
    improve.push(`Answer the skipped question${missing.length > 1 ? "s" : ""}: ${missing.map((m) => factorById(m)?.label ?? m).join(", ")}.`);
  }
  const dk = Object.entries(DONT_KNOW).filter(([id, vals]) => vals.includes(o.v[id]));
  if (dk.length) {
    score -= dk.length * 3;
    reasons.push(`Some answers were "don't know" or skipped (${dk.map(([id]) => factorById(id)!.label.toLowerCase()).join(", ")}).`);
    if (o.v.small_baby === "unknown") improve.push("Ask your provider whether the baby is growing as expected. This is one of the most informative factors.");
    if (o.v.gestational_diabetes === "not_tested") improve.push("Re-check after your glucose test (usually around 24–28 weeks).");
  }

  // 3. How much of the adjustment rests on approximate effect sizes
  const totalAbs = Object.values(o.rawParts).reduce((a, b) => a + Math.abs(b), 0);
  if (totalAbs > 0) {
    const approxAbs = Object.entries(o.rawParts).filter(([id]) => id !== "city" && factorById(id)?.approx).reduce((a, [, b]) => a + Math.abs(b), 0);
    const share = approxAbs / totalAbs;
    const pen = Math.round(Math.min(share, approxAbs) * 20); // scale by how much those factors actually move the estimate
    if (pen >= 3) { score -= pen; reasons.push(`About ${Math.round(share * 100)}% of the adjustment uses effect sizes we still need to verify against the original studies.`); }
  }

  // 4. Many strong factors combined
  if (o.capped) { score -= 15; reasons.push("Several strong factors combine, and published research has few people with all of them, so the exact number is less certain."); improve.push("Share this with your provider. They can use scans and tests this tool can't see."); }

  // 5. Transportability: effect sizes mostly come from high-income countries
  if (o.ctx.country.sbr28 > 8) { score -= 10; reasons.push("Most effect sizes come from studies in high-income countries, so they may fit less well where stillbirth rates are higher."); }

  // 6. Early-pregnancy factors explain only part of stillbirth risk (SCRN)
  reasons.push("Even with complete answers, factors known early in pregnancy explain only part of stillbirth risk. Checks later in pregnancy (growth, blood pressure, movements) add a lot.");

  score = Math.max(10, Math.min(100, score));
  const level = score >= 75 ? "High" : score >= 50 ? "Moderate" : "Low";
  if (!improve.length) improve.push("Re-check if anything changes, such as a new diagnosis or a growth scan result.");
  return { score, level, reasons, improve };
}


// ---------- Pregnancy stage, core questions, and the score-or-check-in decision ----------
export function gestWeeks(raw: Answers): number | undefined {
  const w = String(raw.weeks ?? "").toLowerCase().trim();
  if (!w || /not pregnant|planning/.test(w)) return undefined;
  const range = w.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const n = parseInt(w.replace(/[^0-9]/g, " ").trim().split(/\s+/)[0], 10);
  if (isNaN(n)) return undefined;
  if (/under|less|<|before/.test(w)) return Math.max(6, n - 2);
  if (/\+|more|over/.test(w)) return n + 1;
  return n;
}

export function isPlanning(raw: Answers) {
  return /not pregnant|planning/i.test(String(raw.weeks ?? ""));
}

/** Core questions for a first estimate. Stage-aware: growth only after 20 weeks, glucose only after 24. */
export function coreIds(raw: Answers): string[] {
  const w = gestWeeks(raw);
  const ids = ["weeks"];
  if (w !== undefined && w >= 28) ids.push("movement");
  ids.push("country");
  if (findCountry(raw.country)?.iso === "USA") ids.push("race");
  ids.push("age", "height", "weight", "multiple", "parity", "prior_stillbirth", "preexisting_diabetes", "hypertension");
  if (w !== undefined && w >= 20) ids.push("small_baby");
  if (w !== undefined && w >= 24) ids.push("gestational_diabetes");
  ids.push("smoking", "alcohol", "prenatal_care");
  return ids;
}
export const DEEP_IDS = ["city", "prior_complication", "prior_miscarriage", "family_history", "secondhand_smoke", "substance_use", "stress_events", "small_baby", "gestational_diabetes", "activity"];

export function unanswered(ids: string[], raw: Answers) {
  return ids.filter((id) => raw[id] === undefined || raw[id] === "");
}

export type CheckIn = { week: number; date?: string; title: string; why: string; bring: string[] };

export function checkInPlan(raw: Answers): CheckIn[] {
  const w = gestWeeks(raw);
  const plan: CheckIn[] = [];
  const dateAt = (week: number) => {
    if (w === undefined) return undefined;
    const d = new Date(Date.now() + (week - w) * 7 * 86400000);
    return d.toISOString().slice(0, 10);
  };
  const add = (week: number, title: string, why: string, bring: string[]) => { if (w === undefined || week > w) plan.push({ week, date: dateAt(week), title, why, bring }); };
  add(21, "After your 20-week scan", "The anatomy scan checks the baby's growth and the placenta, two of the most informative factors.", ["Was the baby measuring as expected?", "Anything noted about the placenta?"]);
  add(28, "After your glucose test (24–28 weeks)", "Your gestational diabetes result will be known, and from 28 weeks, your baby's movements become an important daily signal.", ["Glucose test result", "Any blood pressure readings", "How your baby usually moves"]);
  add(34, "Around 32–36 weeks", "Late-pregnancy growth and blood pressure checks matter most for stillbirth risk.", ["Latest growth scan or fundal height", "Blood pressure", "Any changes in movements"]);
  return plan.slice(0, 3);
}

export type Decision = {
  kind: "score" | "checkin" | "planning";
  result: Result;
  reasons: string[];
  missingCore: string[];
  plan: CheckIn[];
  /** Strong risk factors present: even without a number, the user should talk to their provider soon. */
  elevated: boolean;
  elevatedFactors: string[];
};

/** Deterministic rule — Claude explains the decision but doesn't make it. */
export function decide(raw: Answers): Decision {
  const result = score(raw);
  const missingCore = coreIds(raw).filter((id) => !["race", "movement"].includes(id) && (raw[id] === undefined || raw[id] === "" || raw[id] === "skip"));
  const plan = checkInPlan(raw);
  const strong = result.contributions.filter((c) => c.importance === "High" && c.direction === "up" && c.or >= 1.8).map((c) => `${c.label}: ${c.answer.charAt(0).toLowerCase() + c.answer.slice(1)}`);
  const elevated = result.ratio >= 3 || strong.length >= 2;
  if (isPlanning(raw)) return { kind: "planning", result, reasons: ["You're not pregnant yet, so there's no pregnancy to estimate. The changeable factors still matter before conception."], missingCore, plan: [], elevated: false, elevatedFactors: [] };
  const reasons: string[] = [];
  if (missingCore.length > 2) reasons.push(`${missingCore.length} of the core questions were skipped (${missingCore.map((id) => factorById(id)?.label.toLowerCase() ?? id).join(", ")}).`);
  if (result.confidence.score < 50) reasons.push(`Confidence would be low (${result.confidence.score}/100), so a single number could mislead more than help.`);
  if (gestWeeks(raw) === undefined) reasons.push("We don't know how far along you are yet.");
  const kind = reasons.length ? "checkin" : "score";
  return { kind, result, reasons, missingCore, plan, elevated, elevatedFactors: strong.length ? strong : result.contributions.slice(0, 3).map((c) => c.label) };
}
