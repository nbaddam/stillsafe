import { cdcCheck, model } from "../../lib/score";

export default function CdcPage() {
  const rows = cdcCheck();
  const pass = rows.filter((r) => r.within25).length;
  const W = 320, H = 320, P = 36, MAXV = 18;
  const x = (v: number) => P + (v / MAXV) * (W - P - 10);
  const y = (v: number) => H - P - (v / MAXV) * (H - P - 10);
  const ticks = [0, 5, 10, 15];
  return (
    <main className="wrap">
      <div className="brand"><span className="dot" /> StillSafe <small><a href="/">← Back</a></small></div>
      <h1>Proof of concept: does the method match real US data?</h1>
      <p className="muted">We set the calculator to the US (CDC&apos;s 20+ week definition, baseline {model.cdcCheck.baseline20} per 1,000) and predicted the stillbirth rate for each group CDC reports. Then we compared the predictions with CDC&apos;s observed 2024 rates.</p>
      <div className="card">
        <p><b className="ok">{pass} of {rows.length} groups</b> are within ±25% of the observed CDC rate.</p>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Predicted versus observed stillbirth rates">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} y1={y(0)} x2={x(t)} y2={y(MAXV)} stroke="#efe5ef" />
              <line x1={x(0)} y1={y(t)} x2={x(MAXV)} y2={y(t)} stroke="#efe5ef" />
              <text x={x(t)} y={H - P + 16} fontSize="10" textAnchor="middle" fill="#6c6274">{t}</text>
              <text x={P - 6} y={y(t) + 3} fontSize="10" textAnchor="end" fill="#6c6274">{t}</text>
            </g>
          ))}
          <polygon points={`${x(0)},${y(0)} ${x(MAXV)},${y(MAXV * 1.25)} ${x(MAXV)},${y(MAXV * 0.75)}`} fill="#efe6f7" opacity=".6" />
          <line x1={x(0)} y1={y(0)} x2={x(MAXV)} y2={y(MAXV)} stroke="#6d4c91" strokeDasharray="4 3" />
          {rows.map((r) => (
            // Within ±25% = filled dot; outside = hollow dot (shape + color, and explained in the caption and table).
            <circle key={r.label} cx={x(r.observed)} cy={y(r.predicted)} r="4.5" fill={r.within25 ? "#b0532f" : "#fff"} stroke={r.within25 ? "none" : "#a3261b"} strokeWidth={r.within25 ? 0 : 2}>
              <title>{`${r.label}: observed ${r.observed}, predicted ${r.predicted.toFixed(2)} (${r.within25 ? "within" : "outside"} ±25%)`}</title>
            </circle>
          ))}
          <text x={(W + P) / 2} y={H - 4} fontSize="11" textAnchor="middle" fill="#2e2833">CDC observed, per 1,000</text>
          <text x={12} y={(H - P) / 2} fontSize="11" textAnchor="middle" fill="#2e2833" transform={`rotate(-90 12 ${(H - P) / 2})`}>StillSafe predicted, per 1,000</text>
        </svg>
        <p className="small muted">Each dot is one group. Dashed line = perfect agreement. Shaded band = within ±25%. Filled dot = within ±25%; hollow dot = outside it.</p>
      </div>
      <div className="card">
        <table className="cdc">
          <thead><tr><th>Group</th><th className="num">CDC</th><th className="num">StillSafe</th><th className="num">Diff</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}{r.note ? <span className="muted small"> ({r.note})</span> : null}</td>
                <td className="num">{r.observed.toFixed(2)}</td>
                <td className="num">{r.predicted.toFixed(2)}</td>
                <td className={`num ${r.within25 ? "ok" : "bad"}`}>{r.diffPct > 0 ? "+" : ""}{r.diffPct.toFixed(0)}% <span className="small">{r.within25 ? "within" : "outside"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: 8 }}>Source: <a href={model.cdcCheck.source.url} target="_blank" rel="noreferrer">{model.cdcCheck.source.label}</a>. Race isn&apos;t in this check because it sets the US starting rate directly from the same CDC data.</p>
      </div>
    </main>
  );
}
