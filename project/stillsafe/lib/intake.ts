// Question order, quick-reply chips and the urgent-symptom rule. Shared by Claude mode and guided (no-API) mode.
import { factors, factorById, model, findCountry, Answers, Factor, coreIds, DEEP_IDS, gestWeeks, unanswered } from "./score";

export type Step = {
  id: string;
  question: string;
  chips: string[];
  freeText: boolean;
  callout?: { importance: string; why: string; howUsed: string; optional: boolean; source?: { label: string; url: string } };
};

// Pseudo-questions (not scored) used for triage.
const WEEKS: Step = {
  id: "weeks",
  question: "How many weeks pregnant are you? (A rough guess is fine.)",
  chips: ["Under 12", "12–19", "20–27", "28–35", "36+", "Not pregnant yet"],
  freeText: true,
  callout: {
    importance: "Context only",
    why: "What can be known changes through pregnancy. Growth scans happen around 20 weeks, diabetes tests at 24–28 weeks, and movements matter most from 28 weeks.",
    howUsed: "Used to choose which questions to ask now, whether we can give an estimate yet, and when to suggest checking in again. Not scored.",
    optional: false,
  },
};
const MOVEMENT: Step = {
  id: "movement",
  question: "Has your baby been moving less than usual, or has the pattern of movements changed?",
  chips: ["No, movements are normal", "Yes, less or different", "Not sure"],
  freeText: false,
  callout: {
    importance: "High",
    why: "A change in your baby's movements can be an early sign that the baby needs to be checked. It's one of the most important things to act on quickly.",
    howUsed: "Not scored. If movements have slowed or changed, we'll stop and show you who to contact now.",
    optional: false,
  },
};

export const ORDER: string[] = ["weeks", "movement", "country", "city", "age", "height", "weight", "race", "multiple", "parity", "prior_stillbirth", "prior_complication", "prior_miscarriage", "family_history", "preexisting_diabetes", "gestational_diabetes", "hypertension", "small_baby", "prenatal_care", "smoking", "secondhand_smoke", "alcohol", "substance_use", "stress_events", "activity"];

export function stepFor(id: string, answers: Answers): Step | undefined {
  if (id === "weeks") return WEEKS;
  if (id === "movement") return MOVEMENT;
  const f = factorById(id) as Factor | undefined;
  if (!f) return undefined;
  let chips: string[] = [];
  if (id === "country") chips = model.countries.map((c) => c.name);
  else if (id === "city") chips = [...(findCountry(answers.country)?.cities.map((c) => c.name) ?? []), "Skip"];
  else if (f.options) chips = f.options.map((o) => o.label);
  if (!f.optional && !["country"].includes(id)) chips = [...chips, "Skip"];
  return {
    id,
    question: (f as any).question,
    chips,
    freeText: ["number", "height", "weight", "country", "city"].includes((f as any).type),
    callout: { importance: f.importance, why: f.why, howUsed: f.how_used, optional: !!f.optional, source: f.source },
  };
}

export function isLate(answers: Answers) {
  const w = gestWeeks(answers);
  return w !== undefined && w >= 28;
}

export type Scope = "core" | "deep";

// ---- Check-ins -------------------------------------------------------------
// When a returning user checks in again, these saved answers are cleared and asked again
// (showing the previous answer so they can confirm it). Everything else is kept.
// weeks/movement: time has passed. The rest can change during pregnancy:
// pregnancy conditions, habits, and care/wellbeing.
export const ALWAYS_REASK = ["weeks", "movement"];
export const RECHECK_IDS = ["hypertension", "small_baby", "gestational_diabetes", "smoking", "alcohol", "secondhand_smoke", "substance_use", "prenatal_care", "stress_events", "activity"];

/** Saved answers to re-confirm at a check-in. */
export function splitForCheckin(saved: Answers): { keep: Answers; previous: Answers } {
  const keep: Answers = {}, previous: Answers = {};
  for (const [k, v] of Object.entries(saved)) ((ALWAYS_REASK.includes(k) || RECHECK_IDS.includes(k)) ? previous : keep)[k] = v;
  return { keep, previous };
}

/** Optional (deep) questions that were answered before must be re-asked in the core check-in round too. */
export function recheckExtra(previous: Answers = {}): string[] {
  return Object.keys(previous).filter((id) => DEEP_IDS.includes(id));
}

/** How far along they're likely to be now, from the weeks they gave on a past date. */
export function expectedWeeksNow(previous: Answers, savedAt?: string): number | undefined {
  const w = gestWeeks(previous);
  if (w === undefined || !savedAt) return undefined;
  const days = (Date.now() - new Date(savedAt).getTime()) / 86400000;
  return days >= 0 ? Math.min(42, Math.floor(w + days / 7)) : undefined;
}

/** Plain-language version of a previous answer, for "Same as last time" buttons and prompts. */
export function previousLabel(id: string, value: unknown): string {
  const f = factorById(id) as Factor | undefined;
  return String(f?.options?.find((o) => o.value === value)?.label ?? value);
}

/** Every question in the current round. Core = the stage-aware first set (+ any re-checked optional ones); deep = optional follow-ups. */
export function roundIds(answers: Answers, scope: Scope = "core", extra: string[] = []): string[] {
  const w = gestWeeks(answers);
  if (scope === "deep")
    return DEEP_IDS.filter((id) => !(id === "small_baby" && (w === undefined || w < 20)) && !(id === "gestational_diabetes" && (w === undefined || w < 24)) && !(id === "city" && !findCountry(answers.country)));
  // coreIds depends on weeks/country, so it's recomputed as those are answered
  const core = coreIds(answers);
  return [...core, ...extra.filter((id) => !core.includes(id))];
}

/** Next unanswered question in the current round. */
export function nextStep(answers: Answers, scope: Scope = "core", extra: string[] = []): Step | undefined {
  const id = unanswered(roundIds(answers, scope, extra), answers)[0];
  return id ? stepFor(id, answers) : undefined;
}

export function remaining(answers: Answers, scope: Scope = "core", extra: string[] = []) {
  return unanswered(roundIds(answers, scope, extra), answers).length;
}

/** Map a typed or tapped reply onto the stored value for a question (guided mode). */
export function interpret(id: string, text: string): string | number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (/^skip$/i.test(t)) return "skip";
  if (id === "age") {
    const n = parseInt(t, 10);
    return isNaN(n) ? undefined : n;
  }
  if (["height", "weight", "weeks"].includes(id)) return t;
  if (id === "movement") return /^no\b|normal/i.test(t) ? "normal" : /yes|less|different|changed/i.test(t) ? "changed" : "unsure";
  if (id === "country") return findCountry(t)?.name;
  if (id === "city") return /^skip$/i.test(t) ? "skip" : t;
  const f = factorById(id);
  const opt = f?.options?.find((o) => o.label.toLowerCase() === t.toLowerCase() || o.value === t);
  if (opt) return opt.value;
  if (/^(no|nope|none|never)\b/i.test(t)) return f?.options?.find((o) => ["no", "none", "never", "regular", "single", "1_2"].includes(o.value))?.value;
  if (/^(yes|yeah|yep)\b/i.test(t)) return f?.options?.find((o) => o.value.startsWith("yes") || o.value === "yes" || o.value === "current")?.value;
  if (/don.?t know|not sure|unsure/i.test(t)) return f?.options?.find((o) => ["unknown", "yes_unexplained", "not_tested", "skip"].includes(o.value))?.value ?? f?.options?.[0]?.value;
  return undefined;
}

// Rule-based urgent-symptom check, run on every user message (not left to the model).
// "blood" counts as a symptom unless it's part of a routine term ("blood pressure", "blood sugar", "blood test"...),
// which the questionnaire itself asks about.
const URGENT_RE = /(not|n't|less|stopp?ed|no|reduced|decreased|fewer|slow(ed|er)?)\s+(moving|movements?|kicks?|kicking)|(moving|kicking)\s+(less|much less|a lot less)|(baby|movements?).{0,20}(slowed|changed|stopped)|bleed|blood(?!\s*(pressure|sugars?|glucose|tests?|work|type|count|levels?|draws?))|leak(ing)?\s+(fluid|water)|waters?\s+broke|severe\s+(pain|headache|cramp)|vision\s+(changes?|blurr)|blurr?y\s+vision/i;
export function isUrgent(text: string) {
  return URGENT_RE.test(text) && !/no\s+bleeding|not\s+bleeding|no\s+pain/i.test(text) || /^yes, less or different$/i.test(text.trim());
}

export function scoredFieldIds() {
  return factors.filter((f) => (f as any).type !== "derived").map((f) => f.id);
}
