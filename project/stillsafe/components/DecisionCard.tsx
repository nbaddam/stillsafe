"use client";
import { useState } from "react";
import { Answers, Decision, fmt, impactSentence } from "../lib/score";
import Breakdown from "./Breakdown";

function icsFor(d: Decision) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StillSafe//EN"];
  for (const c of d.plan) {
    if (!c.date) continue;
    const day = c.date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:${day}-${c.week}@stillsafe`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:StillSafe check-in: ${c.title}`, `DESCRIPTION:${c.why} Bring: ${c.bring.join("; ")}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadIcs(d: Decision) {
  const blob = new Blob([icsFor(d)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "stillsafe-checkins.ics";
  a.click();
}

export default function DecisionCard({ d, answers, updated, memoryOn, onToggleMemory, onMore }: {
  d: Decision; answers: Answers; updated?: boolean; memoryOn: boolean; onToggleMemory: (on: boolean) => void; onMore?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const r = d.result;
  const conf = r.confidence;
  const confCls = conf.level === "High" ? "a" : conf.level === "Moderate" ? "b" : "c";
  const bandCls = r.band === "Around average" ? "a" : r.band === "Above average" ? "b" : "c";

  const Plan = () => d.plan.length ? (
    <>
      <h3 style={{ marginTop: 12 }}>{d.kind === "score" ? "When to check in again" : "When we'll know more"}</h3>
      <ol className="timeline">
        {d.plan.map((c) => (
          <li key={c.week}>
            <b>Week {c.week}{c.date ? ` · ${new Date(c.date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</b>: {c.title}
            <div className="small muted">{c.why}</div>
            <div className="small">Bring: {c.bring.join(" · ")}</div>
          </li>
        ))}
      </ol>
      <button className="btn secondary small-btn" onClick={() => downloadIcs(d)}>Add check-ins to my calendar</button>
    </>
  ) : null;

  const Memory = () => (
    <label className="memtoggle">
      <input type="checkbox" checked={memoryOn} onChange={(e) => onToggleMemory(e.target.checked)} />
      <span><b>Remember me on this device</b><br /><span className="small muted">Saves your answers and progress only in this browser so you can pick up at your next check-in.</span></span>
    </label>
  );

  return (
    <div className="card decision">
      {d.kind === "score" && (
        <>
          {updated && <div className="tag" style={{ marginBottom: 8 }}>Updated estimate</div>}
          <p className="muted small" style={{ marginBottom: 4 }}>Your estimated chance of stillbirth (28+ weeks)</p>
          <div className="big">about {fmt(r.per1000)} <span>in 1,000</span></div>
          <p className="small muted" style={{ marginTop: 6 }}>Likely range {fmt(r.low)}–{fmt(r.high)} · roughly 1 in {r.oneInN}</p>
          <div className="compare">
            <div className="you"><span className="small">You</span><b>{fmt(r.per1000)} in 1,000</b></div>
            <div className="avg"><span className="small">Average for {r.baselineShort}</span><b>{fmt(r.baseline)} in 1,000</b></div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span className={`bandchip ${bandCls}`}>{r.band}</span>
            <span className={`bandchip ${confCls}`}>{conf.level} confidence · {conf.score}/100</span>
          </div>
          {r.contributions.length > 0 && (
            <>
              <h3 style={{ marginTop: 12 }}>Biggest factors</h3>
              <ul className="list small">{r.contributions.slice(0, 3).map((c) => <li key={c.id}>{impactSentence(c)}{c.changeable ? " (can change)" : ""}</li>)}</ul>
            </>
          )}
          <Plan />
          <button className="btn small-btn" style={{ marginTop: 10 }} onClick={() => setOpen(!open)}>{open ? "Hide full breakdown" : "See full breakdown"}</button>
          {open && <Breakdown answers={answers} r={r} />}
        </>
      )}

      {d.kind === "checkin" && (
        <>
          {d.elevated && (
            <div className="urgent" style={{ marginBottom: 12 }}>
              <strong>Please talk to your provider soon, ideally this week.</strong> We can&apos;t give a precise number, but some of your answers are strong risk factors that your care team should know about now:
              <ul className="list" style={{ margin: "6px 0 0" }}>{d.elevatedFactors.map((f) => <li key={f}>{f}</li>)}</ul>
              Don&apos;t wait for the check-in dates below.
            </div>
          )}
          <span className="bandchip b">Not enough information for a number</span>
          <h2 style={{ marginTop: 10 }}>We&apos;ll hold off on a number for now</h2>
          <p className="small">A risk number is only useful if we can be reasonably confident in it. Right now:</p>
          <ul className="list small">{d.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
          <Plan />
          {onMore && <button className="btn small-btn" style={{ marginTop: 8 }} onClick={onMore}>Answer a few more questions now</button>}
          <h3 style={{ marginTop: 12 }}>What you can do in the meantime</h3>
          <ul className="list small">{r.actions.map((a) => <li key={a}>{a}</li>)}</ul>
        </>
      )}

      {d.kind === "planning" && (
        <>
          <span className="bandchip a">Planning a pregnancy</span>
          <h2 style={{ marginTop: 10 }}>Check in once you&apos;re pregnant</h2>
          <p className="small">There&apos;s no pregnancy to estimate yet, but some factors you can change now make a real difference later:</p>
          <ul className="list small">{r.actions.slice(0, -2).map((a) => <li key={a}>{a}</li>)}</ul>
          {r.actions.length <= 2 && <p className="small">From what you&apos;ve shared, you&apos;re already in a good place on the changeable factors. Keep it up, and see your provider for a pre-pregnancy check.</p>}
        </>
      )}
      <Memory />
    </div>
  );
}
