"use client";
// The whole product is one conversation: consent → core questions → decision (score or check-in) → ongoing chat with Claude.
import { useEffect, useRef, useState } from "react";
import { Callout } from "./Callout";
import { UrgentBanner, UrgentScreen } from "./Urgent";
import DecisionCard from "./DecisionCard";
import VoiceButton from "./VoiceButton";
import { nextStep, stepFor, interpret, isUrgent, remaining, roundIds, splitForCheckin, recheckExtra, expectedWeeksNow, previousLabel, Step, Scope } from "../lib/intake";
import { Answers, Decision, decide, fmt, impactSentence, plainSummary } from "../lib/score";
import { loadMemory, saveMemory, forgetMemory, Memory } from "../lib/memory";

// Saved answers being re-confirmed in a check-in round (empty outside check-ins).
type Recheck = { previous: Answers; expectedWeeks?: number };
const SAME = "Same as last time";

type Msg =
  | { role: "bot" | "me"; text: string }
  | { role: "callout"; step: Step }
  | { role: "consent" }
  | { role: "decision"; d: Decision; answers: Answers; updated?: boolean };
type Phase = "consent" | "intake" | "post";
const ACKS = ["Got it.", "Thanks.", "Okay, thank you.", "Thanks for sharing."];
const POST_CHIPS: Record<Decision["kind"], string[]> = {
  score: ["Why is my number what it is?", "What does \"in 1,000\" mean?", "What can I change?", "I have a new test result", "Answer a few more questions"],
  checkin: ["Why can't I get a number yet?", "What can I do now?", "Answer a few more questions", "I have a new test result"],
  planning: ["What should I focus on before pregnancy?", "I'm pregnant now"],
};

function offlineExplain(d: Decision): string {
  const r = d.result;
  const next = d.plan[0];
  if (d.kind === "score")
    return `${plainSummary(r)} ${r.contributions[0] ? `The biggest factor: ${impactSentence(r.contributions[0])}` : "None of your answers moved it much from the average."} I'm ${r.confidence.level.toLowerCase()}ly confident in this estimate.${next ? ` It's worth checking in again around week ${next.week}, ${next.title.toLowerCase()}.` : ""}`;
  if (d.kind === "checkin" && d.elevated)
    return `I can't give you a precise number, but several of your answers are strong risk factors (${d.elevatedFactors.join("; ")}). Please talk to your provider soon, ideally this week, rather than waiting. In the meantime, keep an eye on your baby's movements and the warning signs at the top of the screen.`;
  if (d.kind === "checkin")
    return `I'm going to hold off on a number for now. ${d.reasons.join(" ")} ${next ? `The next good time to check in is around week ${next.week} (${next.title.toLowerCase()}). ` : ""}You can save your progress on this device so we can pick up where we left off, or answer a few more questions now.`;
  return "Since you're not pregnant yet, there's no estimate to give. The changeable factors still matter, though, so I've listed them. Check in again once you're pregnant.";
}

function offlineAnswer(q: string, d: Decision): string {
  const r = d.result;
  const s = q.toLowerCase();
  if (/can'?t i get|no number|why not/.test(s)) return d.reasons.join(" ") || "You have an estimate above.";
  if (/why|driv|number what/.test(s)) return r.contributions.length ? r.contributions.slice(0, 2).map(impactSentence).join(" ") : "None of your answers moved the estimate much from the average.";
  if (/mean|1,000|1000/.test(s)) return plainSummary(r);
  if (/change|do now|focus|help/.test(s)) return r.actions.slice(0, 3).join(" ");
  return "The AI chat isn't connected in this demo. Tap a suggestion, or bring this question to your provider.";
}

export default function Conversation() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>("consent");
  const [scope, setScope] = useState<Scope>("core");
  const [answers, setAnswers] = useState<Answers>({});
  const [mode, setMode] = useState<"claude" | "guided" | null>(null);
  const [step, setStep] = useState<Step | undefined>();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [mem, setMem] = useState<Memory>({ enabled: false, answers: {}, notes: [], visits: [], updatedAt: "" });
  const [returning, setReturning] = useState(false);
  const [rememberChoice, setRememberChoice] = useState(false);
  const recheck = useRef<Recheck>({ previous: {} });
  const extra = () => recheckExtra(recheck.current.previous);
  const booted = useRef(false);

  // Scroll to the very bottom of the page (including .chat's bottom padding) so the newest
  // message sits above the fixed composer instead of behind it. Wait a frame for layout.
  useEffect(() => {
    const id = requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
    return () => cancelAnimationFrame(id);
  }, [msgs, busy]);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const m = loadMemory();
    if (m?.enabled && Object.keys(m.answers ?? {}).length) {
      setMem(m);
      const s = m.session;
      if (s?.status === "intake") {
        // Unfinished round (e.g. the page was refreshed): pick up exactly where they left off.
        recheck.current = { previous: s.previous ?? {}, expectedWeeks: s.expectedWeeks };
        setAnswers(m.answers); setScope(s.scope); setReturning(s.returning);
        setMsgs([{ role: "bot", text: "Welcome back. Let's pick up where we left off." }]);
        setPhase("intake");
        start(m.answers, s.scope, s.returning, [{ role: "bot", text: "" }], true);
      } else {
        // Check-in: keep stable answers; re-confirm the ones that can change (time has passed).
        const { keep, previous } = splitForCheckin(m.answers);
        const last = m.visits[m.visits.length - 1];
        recheck.current = { previous, expectedWeeks: expectedWeeksNow(previous, last?.at ?? m.updatedAt) };
        setReturning(true); setAnswers(keep);
        // Open with a personal check-in and wait for their reply. Claude responds to how they're feeling
        // (and the urgent-symptom check runs on it) before the check-in questions start.
        setMsgs([{ role: "bot", text: "Welcome back. How are you feeling today?" }]);
        setPhase("intake");
      }
    } else {
      setMsgs([{ role: "bot", text: "Hi, I'm StillSafe. I'll ask you a few questions about your health and pregnancy (about 3 minutes). Then I'll either give you an estimate of your stillbirth risk, or, if it's too early to say with confidence, suggest when to check in again." }, { role: "consent" }]);
    }
  }, []);

  // When "remember me" is on, save after every change, with where they are in the flow,
  // so a refresh resumes mid-intake and a later visit becomes a check-in.
  useEffect(() => {
    if (!booted.current || !mem.enabled || phase === "consent") return;
    saveMemory({ ...mem, answers, session: { status: phase === "post" ? "done" : "intake", scope, returning, previous: recheck.current.previous, expectedWeeks: recheck.current.expectedWeeks } });
  }, [mem, answers, phase, scope, returning]);

  const persist = (a: Answers, d: Decision | null, enabled = mem.enabled) => {
    setMem((m) => {
      const visit = d ? { at: new Date().toISOString(), per1000: d.kind === "score" ? d.result.per1000 : 0, baseline: d.result.baseline, top: d.result.contributions.slice(0, 3).map((c) => c.label) } : null;
      const today = new Date().toISOString().slice(0, 10);
      const visits = visit ? [...m.visits.filter((v) => v.at.slice(0, 10) !== today), visit] : m.visits;
      const next = { ...m, enabled, answers: a, visits };
      if (enabled) saveMemory(next);
      return next;
    });
  };
  const toggleMemory = (on: boolean) => {
    if (!on) { forgetMemory(); setMem({ enabled: false, answers: {}, notes: [], visits: [], updatedAt: "" }); return; }
    persist(answers, decision, true);
  };

  const pushAsk = (list: Msg[], s: Step | undefined, lead: string | null): Msg[] =>
    s ? [...list, { role: "bot", text: lead ? `${lead} ${s.question}` : s.question }, { role: "callout", step: s }] : list;

  async function api(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  }
  const historyOf = (list: Msg[]) =>
    list.filter((m): m is { role: "bot" | "me"; text: string } => (m.role === "bot" || m.role === "me") && !!m.text).map((m) => ({ role: m.role === "me" ? ("user" as const) : ("assistant" as const), content: m.text }));

  async function start(a: Answers, sc: Scope, ret: boolean, base?: Msg[], resumed = false) {
    setBusy(true);
    const baseMsgs = base ?? [];
    try {
      const { status, data } = await api("/api/chat", { history: historyOf(baseMsgs.filter((m) => m.role !== "bot" || (m as any).text)), answers: a, scope: sc, returning: ret, resumed, ...recheck.current });
      if (status === 200 && !data.error) {
        setMode("claude");
        const na = data.answers ?? a;
        setAnswers(na);
        const s = data.askNext ? stepFor(data.askNext, na) : nextStep(na, sc, extra());
        setStep(s);
        setMsgs((m) => [...m.filter((x) => !(x.role === "bot" && !x.text)), { role: "bot", text: data.text }, ...(s ? [{ role: "callout" as const, step: s }] : [])]);
        setBusy(false);
        return;
      }
    } catch { /* fall back to guided mode */ }
    setMode("guided");
    const s = nextStep(a, sc, extra());
    setStep(s);
    setMsgs((m) => pushAsk(m.filter((x) => !(x.role === "bot" && !x.text)), s, resumed ? null : ret ? "Has anything changed since last time, like a scan, a test result or a new diagnosis? You can tell me any time. First:" : sc === "deep" ? "Great, a few optional questions." : null));
    setBusy(false);
  }

  async function finishRound(a: Answers, list: Msg[], updated = false) {
    const d = decide(a);
    setDecision(d);
    setPhase("post");
    setStep(undefined);
    // The check-in round (if any) is complete: everything is confirmed, so it is all used in decide() above.
    recheck.current = { previous: {} };
    setReturning(false);
    persist(a, d);
    const withCard: Msg[] = [...list, { role: "decision", d, answers: a, updated }];
    setMsgs(withCard);
    if (mode === "claude") {
      setBusy(true);
      const reply = await askClaude(withCard, a, d);
      setBusy(false);
      if (reply === "__handled__") return;
      if (reply !== null) { setMsgs((m) => [...m, { role: "bot", text: reply }]); return; }
    }
    setMsgs((m) => [...m, { role: "bot", text: offlineExplain(d) }]);
  }

  async function askClaude(list: Msg[], a: Answers, d: Decision): Promise<string | null> {
    const r = d.result;
    const context = {
      decision: d.kind, decision_reasons: d.reasons, elevated_needs_provider_soon: d.elevated, elevated_factors: d.elevated ? d.elevatedFactors : [],
      ...(d.kind === "score" ? { estimate_per_1000: +fmt(r.per1000), range_per_1000: [+fmt(r.low), +fmt(r.high)], band: r.band } : {}),
      average_per_1000: +fmt(r.baseline), average_is_for: r.baselineShort,
      confidence: { level: r.confidence.level, score: r.confidence.score, reasons: r.confidence.reasons, improve: r.confidence.improve },
      factors: r.contributions.map((c) => ({ factor: c.label, answer: c.answer, ...(d.kind === "score" ? { change_per_1000: +c.per1000.toFixed(1) } : {}), changeable: c.changeable })),
      check_ins: d.plan.map((c) => ({ week: c.week, date: c.date, what: c.title, bring: c.bring })),
      current_answers: a, actions: r.actions, provider_questions: r.questions,
      memory_enabled: mem.enabled, saved_notes: mem.notes, previous_visits: mem.visits.slice(0, -1).map((v) => ({ date: v.at.slice(0, 10), estimate_per_1000: v.per1000 ? +fmt(v.per1000) : null })),
    };
    try {
      const { data } = await api("/api/ask", { history: historyOf(list), context });
      if (data.urgent) { setUrgent(true); return ""; }
      if (data.error) return null;
      (data.notes ?? []).forEach((n: string) => setMem((m) => { const next = { ...m, notes: [...m.notes, n] }; if (m.enabled) saveMemory(next); return next; }));
      if (data.updates && Object.keys(data.updates).length) {
        const na = { ...a, ...data.updates };
        setAnswers(na);
        setTimeout(() => finishRound(na, [...list, { role: "bot", text: data.text }], true), 50);
        return "__handled__";
      }
      return data.text || "";
    } catch { return null; }
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    const withMe: Msg[] = [...msgs, { role: "me", text: t }];
    setMsgs(withMe);
    if (isUrgent(t)) { setUrgent(true); return; }

    if (phase === "consent") {
      if (rememberChoice) setMem((m) => ({ ...m, enabled: true })); // opt-in from the consent card; autosave takes it from here
      setPhase("intake");
      return start(answers, "core", false, withMe);
    }

    if (phase === "post") {
      if (/answer a few more|more questions/i.test(t)) { setScope("deep"); setPhase("intake"); return start(answers, "deep", false, withMe); }
      if (/i'?m pregnant now/i.test(t)) { const a = { ...answers }; delete a.weeks; setAnswers(a); setScope("core"); setPhase("intake"); return start(a, "core", false, withMe); }
      if (mode === "claude" && decision) {
        setBusy(true);
        const reply = await askClaude(withMe, answers, decision);
        setBusy(false);
        if (reply === "__handled__") return;
        if (reply !== null) { if (reply) setMsgs((m) => [...m, { role: "bot", text: reply }]); return; }
      }
      if (/new (test|result|diagnos)/i.test(t)) { setMsgs([...withMe, { role: "bot", text: "Tell me what changed, for example \"gestational diabetes: yes\" or \"baby measuring small\". In this demo without AI, the easiest way is to answer a few more questions." }]); return; }
      setMsgs([...withMe, { role: "bot", text: offlineAnswer(t, decision!) }]);
      return;
    }

    // Intake
    if (mode === "guided") {
      const id = step!.id;
      const prev = recheck.current.previous;
      const v = t.startsWith(SAME) && prev[id] !== undefined ? prev[id] : interpret(id, t);
      if (v === undefined) {
        setMsgs([...withMe, { role: "bot", text: id === "country" ? "I don't have data for that country in this demo yet. Please pick the closest one from the list." : "Sorry, I didn't quite catch that. Could you tap one of the options or try again?" }]);
        return;
      }
      const a = { ...answers, [id]: v };
      setAnswers(a);
      if (id === "movement" && v === "changed") { setUrgent(true); return; }
      const s = nextStep(a, scope, extra());
      if (!s) return finishRound(a, [...withMe, { role: "bot", text: "Thank you, that's everything for now. Let me pull that together." }]);
      let lead = ACKS[Object.keys(a).length % ACKS.length];
      if (id === "prior_stillbirth" && String(v).startsWith("yes")) lead = "I'm so sorry for your loss. Thank you for telling me.";
      if (id === "weeks" && /not pregnant/i.test(t)) return finishRound(a, [...withMe, { role: "bot", text: "Thanks, that helps." }]);
      setStep(s);
      setMsgs(pushAsk(withMe, s, lead));
      return;
    }

    setBusy(true);
    try {
      const { data } = await api("/api/chat", { history: historyOf(withMe), answers, scope, returning, ...recheck.current });
      if (data.urgent) { setUrgent(true); setBusy(false); return; }
      if (data.error) throw new Error(data.detail || data.error);
      const a = data.answers ?? answers;
      setAnswers(a);
      setBusy(false);
      if (data.finished || /not pregnant/i.test(String(a.weeks ?? ""))) return finishRound(a, [...withMe, { role: "bot", text: data.text || "Thanks, let me pull that together." }]);
      const s = data.askNext ? stepFor(data.askNext, a) : nextStep(a, scope, extra());
      setStep(s);
      setMsgs([...withMe, { role: "bot", text: data.text }, ...(s ? [{ role: "callout" as const, step: s }] : [])]);
    } catch {
      setMode("guided");
      const s = nextStep(answers, scope, extra());
      setStep(s);
      setMsgs(pushAsk(withMe, s, "Sorry, I lost my connection for a moment. Let's keep going."));
      setBusy(false);
    }
  }

  if (urgent) return <UrgentScreen onContinue={() => { setUrgent(false); setMsgs((m) => [...m, { role: "bot", text: "Thank you for getting checked. When you're ready, we can carry on." }]); }} />;

  // At a check-in, offer a one-tap "Same as last time" for answers being re-confirmed.
  const prevVal = step ? recheck.current.previous[step.id] : undefined;
  const sameChip = phase === "intake" && step && prevVal !== undefined
    ? (step.id === "weeks" ? (recheck.current.expectedWeeks !== undefined ? [`About ${recheck.current.expectedWeeks} weeks`] : []) : [`${SAME}: ${previousLabel(step.id, prevVal)}`])
    : [];
  // Quick replies to "How are you feeling today?" at the start of a check-in (typing or voice also work).
  const feelingChips = phase === "intake" && returning && !step && !busy ? ["Good, thanks", "A bit anxious", "Not great"] : [];
  const chips = phase === "consent" ? ["I understand, I'm 18 or older"] : phase === "post" && decision ? POST_CHIPS[decision.kind] : [...feelingChips, ...sameChip, ...(step?.chips ?? [])];
  const total = roundIds(answers, "core", extra()).length;
  const left = remaining(answers, "core", extra());

  return (
    <>
      <UrgentBanner />
      {phase === "intake" && scope === "core" && (
        <>
          <div className="progress" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={total} aria-valuenow={total - left}><div style={{ width: `${Math.min(100, ((total - left) / total) * 100)}%` }} /></div>
          <p className="small muted progress-text">{total - left} of {total} questions answered</p>
        </>
      )}
      {mode === "guided" && <p className="small muted">Guided mode (AI not connected). Answers stay on this device.</p>}
      <div className="chat">
        {msgs.map((m, i) => {
          if (m.role === "callout") return <Callout key={i} step={m.step} />;
          if (m.role === "consent") return (
            <div key={i} className="callout" style={{ maxWidth: "100%" }}>
              <div className="row"><span className="k">Before we start</span></div>
              <ul className="list small" style={{ margin: 0 }}>
                <li>This is an educational estimate, not a diagnosis. It doesn&apos;t replace your prenatal care.</li>
                <li>Every question shows <b>why we ask</b> and <b>how your answer is used</b>. Optional ones can be skipped.</li>
                <li>Your risk is calculated on your device. To run this chat, messages go to Claude (Anthropic&apos;s AI); StillSafe doesn&apos;t store them.</li>
                <li>You can answer by voice. Your browser turns speech into text (in Chrome, this uses Google&apos;s speech service), and you can check the text before sending.</li>
                <li>If your baby is moving less than usual, or you have bleeding or severe pain, contact your provider now instead.</li>
              </ul>
              {/* Opt-in (off by default): saving stays on this device only. */}
              <label className="memtoggle">
                <input type="checkbox" checked={phase === "consent" ? rememberChoice : mem.enabled} disabled={phase !== "consent"} onChange={(e) => setRememberChoice(e.target.checked)} />
                <span><b>Remember my answers on this device</b><br /><span className="small muted">So you can come back for check-ins without starting over. Saved only in this browser. You can turn it off any time.</span></span>
              </label>
            </div>
          );
          if (m.role === "decision") return <DecisionCard key={i} d={m.d} answers={m.answers} updated={m.updated} memoryOn={mem.enabled} onToggleMemory={toggleMemory} onMore={m.d.kind === "checkin" ? () => send("Answer a few more questions") : undefined} />;
          if (!m.text) return null;
          // Speaker is shown by color/position visually; say it in words for screen readers too.
          return <div key={i} className={`bubble ${m.role === "me" ? "me" : "bot"}`}><span className="sr-only">{m.role === "me" ? "You said: " : "StillSafe said: "}</span>{m.text}</div>;
        })}
        {busy && <div className="typing">StillSafe is typing…</div>}
      </div>
      <div className="composer">
        <div className="inner">
          {chips.length > 0 && !busy && <div className="chips">{chips.map((c) => <button key={c} className="chip" onClick={() => send(c)}>{c}</button>)}</div>}
          <form className="inputrow" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} disabled={phase === "consent"} placeholder={phase === "consent" ? "Tap to agree and start" : phase === "post" ? "Ask anything, or tell me what's changed…" : step?.freeText ? "Type or speak your answer…" : "Tap an option, type or speak…"} aria-label="Message" />
            {/* Voice fills the box; the user reviews and taps Send (no auto-send, so misheard answers can be fixed). */}
            <VoiceButton onText={setInput} disabled={busy || phase === "consent"} />
            <button className="btn" disabled={busy || !input.trim()}>Send</button>
          </form>
        </div>
      </div>
    </>
  );
}
