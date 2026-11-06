"use client";
// Full breakdown of an estimate, opened from the decision card inside the chat.
import { Answers, Result as R, factorById, fmt, impactSentence, model, resolve, score } from "../lib/score";
import { Badge } from "./Callout";

const REF: Record<string, string> = { smoking: "never", alcohol: "none", secondhand_smoke: "no", prenatal_care: "regular", substance_use: "no" };
const WHATIF: Record<string, string> = { smoking: "If you stopped smoking now", alcohol: "If you stopped drinking", secondhand_smoke: "If you avoided second-hand smoke", prenatal_care: "With regular check-ups from here", substance_use: "With support to stop drug use" };

export function IconArray({ you, avg }: { you: number; avg: number }) {
  const y = Math.max(1, Math.round(you));
  const a = Math.round(avg);
  const dots = Array.from({ length: 1000 }, (_, i) => (you >= avg ? (i < a ? "b" : i < y ? "y" : "") : i < y ? "y" : ""));
  return (
    <>
      {/* The dot colors are backed by this sentence, so the picture never carries meaning by color alone. */}
      <p className="small" style={{ margin: "4px 0 0" }}>
        {you >= avg
          ? <>Out of 1,000 pregnancies like yours, about <b>{y}</b> would end in stillbirth: <b>{a}</b> is the average, and your answers add about <b>{y - a}</b> more.</>
          : <>Out of 1,000 pregnancies like yours, about <b>{y}</b> would end in stillbirth, which is below the average of <b>{a}</b>.</>}
      </p>
      <div className="dots" role="img" aria-label={you >= avg ? `Picture of 1,000 dots: ${a} marked as the average, ${y - a} more marked as added by your answers, and ${1000 - y} unmarked for no stillbirth.` : `Picture of 1,000 dots: ${y} marked as your estimate, and ${1000 - y} unmarked for no stillbirth.`}>{dots.map((c, i) => <i key={i} className={c} />)}</div>
      <div className="legend">
        {you >= avg ? (
          <>
            <span style={{ ["--c" as any]: "var(--base)" }}>{a} = average</span>
            <span style={{ ["--c" as any]: "var(--warm)" }}>+{y - a} = added by your answers</span>
          </>
        ) : (
          <span style={{ ["--c" as any]: "var(--warm)" }}>{y} = your estimate (below the average of {a})</span>
        )}
        <span style={{ ["--c" as any]: "#ebe2ec" }}>{1000 - y} = no stillbirth</span>
      </div>
    </>
  );
}

export default function Breakdown({ answers, r }: { answers: Answers; r: R }) {
  const ctx = resolve(answers);
  const max = Math.max(...r.contributions.map((c) => Math.abs(c.per1000)), 0.1);
  const notAdding = Object.entries(ctx.values)
    .filter(([id]) => !["race", "country", "city"].includes(id) && !r.contributions.find((c) => c.id === id))
    .map(([id, v]) => {
      const f = factorById(id)!;
      return `${f.label}: ${f.bands?.find((b) => b.value === v)?.label ?? f.options?.find((o) => o.value === v)?.label ?? v}`;
    });

  return (
    <div className="breakdown">
      <h3>Picture 1,000 pregnancies like yours</h3>
      <IconArray you={r.per1000} avg={r.baseline} />

      <h3 style={{ marginTop: 16 }}>What&apos;s shaping your estimate</h3>
      <p className="small muted">We start from the average for {r.baselineShort}, then each answer moves the estimate up or down. Factors combine, so the amounts don&apos;t add up exactly.</p>
      <div className="ladder">
        <div className="step"><span className="endpoint">Starting point: average for {r.baselineShort}</span><span className="amt">{fmt(r.baseline)}</span>
          <div className="meta">{r.baselineLabel}{r.baselineApprox ? " · demo value, approximate" : ""}</div></div>
        {r.contributions.map((c) => {
          const whatIf = REF[c.id] ? score({ ...answers, [c.id]: REF[c.id] }).per1000 : null;
          return (
            <div className="step" key={c.id}>
              <span className="name">{c.label}</span>
              <span className={`amt ${c.direction}`}>{c.per1000 >= 0 ? "+" : "−"}{fmt(Math.abs(c.per1000))}</span>
              <div className="bar"><div style={{ width: `${(Math.abs(c.per1000) / max) * 100}%`, background: c.direction === "up" ? "var(--warm)" : "var(--accent)" }} /></div>
              <div className="meta"><Badge level={c.importance} /><span className={`tag ${c.changeable ? "" : "fixed"}`}>{c.changeable ? "Can change" : "Can't change"}</span><span>about {c.or.toFixed(1)}× the odds</span></div>
              <p className="small" style={{ gridColumn: "1 / -1", margin: 0 }}>{impactSentence(c)}</p>
              {whatIf !== null && <div className="whatif">{WHATIF[c.id]}: about <b>{fmt(whatIf)} in 1,000</b> instead of {fmt(r.per1000)}.</div>}
              <details>
                <summary>Why this matters</summary>
                <p>{c.why}</p>
                <p><b>How we used it:</b> {c.howUsed}</p>
                <p className="muted">Source: <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a>{c.approx ? " (approximate effect size, to be verified)" : ""}</p>
              </details>
            </div>
          );
        })}
        <div className="step"><span className="endpoint">Your estimate</span><span className="amt">{fmt(r.per1000)}</span></div>
      </div>
      {r.capped && <p className="small muted">Several strong factors combine here, so we capped the total adjustment at 6× to avoid overstating risk.</p>}

      {notAdding.length > 0 && (<><h3>Not adding to your risk</h3><ul className="list small">{notAdding.map((n) => <li key={n}>{n}</li>)}</ul></>)}

      <h3>How confident is this?</h3>
      <ul className="list small">{r.confidence.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="small"><b>To make it more precise:</b> {r.confidence.improve.join(" ")}</p>

      <h3>Questions for your next visit</h3>
      <ol className="list small">{r.questions.map((q) => <li key={q}>{q}</li>)}</ol>

      <details className="small" style={{ marginTop: 8 }}>
        <summary><b>How this estimate works</b></summary>
        <ul className="list">
          <li>Starting point: your country&apos;s stillbirth rate at 28+ weeks from WHO / UN IGME (US users who share race/ethnicity: CDC 2024).</li>
          <li>Adjusted to a &quot;reference&quot; person using how common smoking, high BMI, older age and twins are in your country, then by published adjusted odds ratios for your answers.</li>
          <li>Factors on the same pathway are reduced so they aren&apos;t counted twice; the total adjustment is capped at 6×.</li>
          <li>Validated against US CDC records: 13 of 13 groups within ±25%. <a href="/cdc">See the check</a>.</li>
          <li>Model {model.version}. An educational estimate, not a diagnosis or medical advice.</li>
        </ul>
      </details>
    </div>
  );
}
