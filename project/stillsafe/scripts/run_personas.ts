// Runs every test persona through the scoring engine and writes:
//   test-output/personas_input.csv   — the input dataset (one row per persona)
//   test-output/personas_results.csv — scores + top factors
//   test-output/persona_report.html  — plain-language report cards, as a user would read them
import fs from "node:fs";
import path from "node:path";
import personas from "../data/personas.json";
import { score, decide, fmt, plainSummary, impactSentence, factorById, resolve, cdcCheck, model } from "../lib/score";
import { ORDER } from "../lib/intake";

const out = path.join(process.cwd(), "test-output");
fs.mkdirSync(out, { recursive: true });
const csv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

// 1. Input dataset
const cols = ["id", "name", ...ORDER];
fs.writeFileSync(path.join(out, "personas_input.csv"), csv([cols, ...personas.map((p: any) => cols.map((c) => (c === "id" || c === "name" ? p[c] : p.answers[c] ?? "")))]));

// 2. Results
const res = personas.map((p: any) => { const d = decide(p.answers); return { p, r: d.result, d }; });
fs.writeFileSync(
  path.join(out, "personas_results.csv"),
  csv([
    ["id", "name", "decision", "see_provider_soon", "next_checkin_week", "estimate_per_1000", "range_low", "range_high", "average_per_1000", "average_for", "times_average", "band", "confidence", "confidence_score", "one_in_n", "top_factor_1", "top_factor_2", "top_factor_3", "missing_answers"],
    ...res.map(({ p, r, d }) => [p.id, p.name, d.kind, d.elevated && d.kind !== "score" ? "yes" : "", d.plan[0]?.week ?? "", fmt(r.per1000), fmt(r.low), fmt(r.high), fmt(r.baseline), r.baselineShort, r.ratio.toFixed(2), r.band, r.confidence.level, r.confidence.score, r.oneInN,
      ...[0, 1, 2].map((i) => (r.contributions[i] ? `${r.contributions[i].label} ${r.contributions[i].per1000 >= 0 ? "+" : "−"}${fmt(Math.abs(r.contributions[i].per1000))}` : "")), r.missing.join("; ")]),
  ])
);

// 3. Readable HTML report
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const card = ({ p, r, d }: any) => {
  const ctx = resolve(p.answers);
  const max = Math.max(...r.contributions.map((c: any) => Math.abs(c.per1000)), 0.1);
  const notAdding = Object.entries(ctx.values).filter(([id]) => !["race", "country", "city"].includes(id) && !r.contributions.find((c: any) => c.id === id))
    .map(([id, v]) => { const f = factorById(id)!; return `${f.label}: ${f.bands?.find((b) => b.value === v)?.label ?? f.options?.find((o) => o.value === v)?.label ?? v}`; });
  const y = Math.max(1, Math.round(r.per1000)), a = Math.round(r.baseline);
  const dots = Array.from({ length: 200 }, (_, i) => { const k = i * 5; return `<i class="${r.per1000 >= r.baseline ? (k < a ? "b" : k < y ? "y" : "") : k < y ? "y" : ""}"></i>`; }).join("");
  return `<section class="card">
  <div class="hdr"><span class="pid">${p.id}</span><h2>${esc(p.name)}</h2></div>
  <p class="muted">${esc(p.story)}</p>
  <p><b>Decision: ${d.kind === "score" ? "give an estimate" : d.kind === "checkin" ? (d.elevated ? "no number, but talk to a provider soon (strong risk factors present)" : "hold off and suggest checking in later") : "planning a pregnancy"}.</b> ${d.reasons.map(esc).join(" ")} ${d.plan.length ? `Next check-in: week ${d.plan[0].week} (${esc(d.plan[0].title)}).` : ""}</p>
  <div class="big">about ${fmt(r.per1000)} <span>in 1,000</span> <em class="band ${r.band.split(" ")[0]}">${r.band}</em></div>
  <p class="muted small">Likely range ${fmt(r.low)}–${fmt(r.high)} · roughly 1 in ${r.oneInN} · ${r.ratio.toFixed(1)}× the average for ${esc(r.baselineShort)}</p>
  <p>${esc(plainSummary(r))}</p>
  <p class="small"><b>Confidence: ${r.confidence.level} (${r.confidence.score}/100).</b> ${r.confidence.reasons.slice(0, -1).map(esc).join(" ")}</p>
  <div class="dots" title="Each dot = 5 pregnancies">${dots}</div>
  <p class="small muted">Each dot = 5 pregnancies. Light orange = average; dark orange = added by this person's answers.</p>
  <h3>What's shaping the estimate</h3>
  <table><tr><td>Starting point: average for ${esc(r.baselineShort)}${r.baselineApprox ? " <span class='muted'>(demo value)</span>" : ""}</td><td class="n">${fmt(r.baseline)}</td><td></td></tr>
  ${r.contributions.map((c: any) => `<tr><td><b>${esc(c.label)}</b> <span class="badge">${c.importance}</span> <span class="tag ${c.changeable ? "" : "fixed"}">${c.changeable ? "Can change" : "Can't change"}</span><br><span class="small">${esc(impactSentence(c))}</span></td>
    <td class="n ${c.direction}">${c.per1000 >= 0 ? "+" : "−"}${fmt(Math.abs(c.per1000))}</td><td class="barcell"><div class="bar ${c.direction}" style="width:${(Math.abs(c.per1000) / max) * 100}%"></div></td></tr>`).join("")}
  <tr><td><b>Estimate</b></td><td class="n"><b>${fmt(r.per1000)}</b></td><td></td></tr></table>
  ${notAdding.length ? `<h3>Not adding to risk</h3><p class="small">${notAdding.map(esc).join(" · ")}</p>` : ""}
  ${r.missing.length ? `<p class="small warn">Unanswered (treated as average): ${r.missing.join(", ")}</p>` : ""}
  <h3>What they can do</h3><ul class="small">${r.actions.map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul>
  <h3>Questions for their provider</h3><ol class="small">${r.questions.map((x: string) => `<li>${esc(x)}</li>`).join("")}</ol>
</section>`;
};
const check = cdcCheck();
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StillSafe — test persona report</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#faf7f2;color:#2b2a28;margin:0;line-height:1.5}
main{max-width:860px;margin:0 auto;padding:24px 16px 64px} h1{margin:0 0 4px} .muted{color:#6b6760}.small{font-size:13.5px}
.summary{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e8e2d8;border-radius:12px;font-size:14px;margin:16px 0}
.summary th,.summary td{padding:8px;border-bottom:1px solid #eee7dc;text-align:left}.summary td.n{text-align:right;font-variant-numeric:tabular-nums}
.card{background:#fff;border:1px solid #e8e2d8;border-radius:14px;padding:18px;margin:16px 0}
.hdr{display:flex;gap:10px;align-items:center}.hdr h2{margin:0;font-size:19px}.pid{background:#2f6f6a;color:#fff;border-radius:6px;padding:2px 8px;font-weight:700;font-size:13px}
.big{font-size:34px;font-weight:800;margin:8px 0 2px}.big span{font-size:16px;color:#6b6760;font-weight:600}
.band{font-style:normal;font-size:13px;font-weight:700;border-radius:999px;padding:3px 10px;vertical-align:middle;margin-left:6px}
.band.Around{background:#d9ebe8;color:#2f6f6a}.band.Above{background:#f8ecd2;color:#7a5410}.band.Well{background:#f6dcd3;color:#8a3517}
.dots{display:grid;grid-template-columns:repeat(40,1fr);gap:2px;max-width:420px;margin:8px 0}.dots i{aspect-ratio:1;border-radius:50%;background:#e7e1d7}.dots i.b{background:#e9b48f}.dots i.y{background:#c2643f}
table{width:100%;border-collapse:collapse}td{padding:7px 4px;border-top:1px solid #eee7dc;vertical-align:top}td.n{text-align:right;font-weight:700;white-space:nowrap;width:56px}
td.up{color:#c2643f}td.down{color:#2f6f6a}.barcell{width:28%}.bar{height:8px;border-radius:6px;margin-top:6px}.bar.up{background:#c2643f}.bar.down{background:#2f6f6a}
.badge{font-size:11px;background:#f8ecd2;color:#7a5410;border-radius:999px;padding:1px 7px;font-weight:700}.tag{font-size:11px;background:#d9ebe8;color:#2f6f6a;border-radius:999px;padding:1px 7px;font-weight:600}.tag.fixed{background:#eeeae4;color:#6b6760}
h3{font-size:15px;margin:14px 0 4px}.warn{color:#8a3517}.ok{color:#2f6f6a;font-weight:700}
</style></head><body><main>
<h1>StillSafe — test persona report</h1>
<p class="muted">${personas.length} test personas run through model ${model.version}. Country rates outside the US are approximate demo values. Generated ${new Date().toISOString().slice(0, 10)}.</p>
<table class="summary"><tr><th>ID</th><th>Persona</th><th>Decision</th><th>Estimate /1,000</th><th>Average /1,000</th><th>× avg</th><th>Band</th><th>Confidence</th><th>Biggest factor</th></tr>
${res.map(({ p, r, d }) => `<tr><td>${p.id}</td><td>${esc(p.name)}</td><td>${d.kind === "score" ? "Estimate" : d.kind === "checkin" ? (d.elevated ? "No number · see provider soon" : "Check in later") : "Planning"}</td><td class="n">${fmt(r.per1000)}</td><td class="n">${fmt(r.baseline)}</td><td class="n">${r.ratio.toFixed(1)}</td><td>${r.band}</td><td>${r.confidence.level} (${r.confidence.score})</td><td>${r.contributions[0] ? esc(r.contributions[0].label) : "—"}</td></tr>`).join("")}</table>
<p class="small">CDC proof-of-concept check: <span class="ok">${check.filter((c) => c.within25).length}/${check.length} groups within ±25%</span> of observed US rates.</p>
${res.map(card).join("\n")}
</main></body></html>`;
fs.writeFileSync(path.join(out, "persona_report.html"), html);
console.table(res.map(({ p, r, d }) => ({ id: p.id, decision: d.kind + (d.kind === "checkin" && d.elevated ? "+provider" : ""), estimate: fmt(r.per1000), avg: fmt(r.baseline), x: r.ratio.toFixed(1), band: r.band, conf: `${r.confidence.level} ${r.confidence.score}`, top: r.contributions[0]?.label ?? "—" })));
