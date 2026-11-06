import type { Step } from "../lib/intake";

export function Badge({ level }: { level: string }) {
  const cls = level.startsWith("Context") ? "Context" : level;
  return <span className={`badge ${cls}`}>{level === "Context only" ? "Context only" : `${level} importance`}</span>;
}

export function Callout({ step }: { step: Step }) {
  const c = step.callout;
  if (!c) return null;
  return (
    // Collapsed by default to keep the chat light; tap to read the full explanation.
    <details className="callout whyask">
      <summary>
        <span className="k">Why we ask</span>
        {c.optional && <span className="tag fixed">Optional</span>}
      </summary>
      <div className="row"><Badge level={c.importance} /></div>
      <p><b>What it means:</b> {c.why}</p>
      <p><b>How we use your answer:</b> {c.howUsed}</p>
      {c.source && <p className="small muted">Source: <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a></p>}
    </details>
  );
}
