import Anthropic from "@anthropic-ai/sdk";
import { factors } from "../../../lib/score";
import { isUrgent } from "../../../lib/intake";

export const runtime = "nodejs";
const MODEL = process.env.STILLSAFE_MODEL || "claude-sonnet-5-5";

type Turn = { role: "user" | "assistant"; content: string };

function updateSchema() {
  const props: Record<string, any> = {};
  for (const f of factors as any[]) {
    if (f.type === "derived") continue;
    if (f.options) props[f.id] = { type: "string", enum: f.options.map((o: any) => o.value), description: `${f.label}: ` + f.options.map((o: any) => `${o.value} = ${o.label}`).join("; ") };
    else if (f.type === "number") props[f.id] = { type: "number", description: f.label };
    else props[f.id] = { type: "string", description: `${f.label}, with units if any` };
  }
  return { type: "object" as const, properties: props };
}

const TOOLS: Anthropic.Tool[] = [
  { name: "update_answers", description: "Use when the user tells you something that changes one of their questionnaire answers (e.g. a new diagnosis, they quit smoking, they made a mistake). The app recalculates their estimate. Only include fields that changed.", input_schema: updateSchema() },
  { name: "remember", description: "Save a short note to remember next time — ONLY if the user has turned on 'remember on this device' (memory_enabled is true). Use for things they want followed up (e.g. 'asking provider about growth scans at 28-week visit'). Never save diagnoses beyond what's in their answers, and never save anything they ask you not to.", input_schema: { type: "object" as const, properties: { note: { type: "string" } }, required: ["note"] } },
];

export async function POST(req: Request) {
  const { history, context } = (await req.json()) as { history: Turn[]; context: any };
  const last = history[history.length - 1];
  if (last?.role === "user" && isUrgent(last.content)) return Response.json({ urgent: true });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_key" }, { status: 503 });

  const system = `You are StillSafe, a gentle, welcoming companion inside a stillbirth-risk education app. You're talking with someone who is pregnant (or hoping to be). This topic can feel frightening, so be kind and calm, like a caring friend who knows about pregnancy: never clinical, never alarming, never judging. You're in a single ongoing chat with the user. They've just answered a set of questions, and the app has made a DECISION (see context.decision):
- "score": the app is showing them an estimate card with all the details. Give just the gist: what their number means next to the average, and the one or two biggest factors. Then offer to explain more (e.g. how sure the estimate is, or when to check in again) instead of saying it all at once.
- If context.elevated_needs_provider_soon is true: lead with this. Several answers are strong risk factors, so they should talk to their provider soon (ideally this week), not wait for a check-in. Name the factors kindly and without alarmism.
- "checkin": the app judged there isn't enough information yet for a reliable estimate. Don't give or hint at a number. Explain why in plain words (context.decision_reasons), what will be known later and when (context.check_ins), and invite them to save their progress ("Remember me on this device") and come back. Also offer to answer a few optional questions now.
- "planning": they're not pregnant yet. Focus on the changeable factors and suggest checking in once pregnant.
On later turns, just continue the conversation: answer questions and take in new information.

WHAT YOU KNOW (from the app — the only numbers you may use):
${JSON.stringify(context, null, 1)}

HOW TO TALK
- Keep it short so it doesn't feel overwhelming: usually 2–3 short sentences, one idea at a time. If there's more to say, offer it ("Would you like to know more about…?") rather than adding it. No headings. Lists only if they ask for steps.
- Use simple, everyday words that anyone can follow, whatever their background or first language (about a 6th-grade reading level). Avoid medical terms; if you need one, explain it in a few words.
- Use "X in 1,000" framing. Never percentages, including for confidence: say "confidence 72 out of 100", not "72%". Never say "low risk" or "nothing to worry about".
- Explain what drives their estimate using the factor list; say which factors they can change.
- If they tell you something that changes an answer, call update_answers, then say in a sentence that you've updated it. The app recalculates and may show a new estimate card; don't state a new number yourself.
- If they ask for an estimate when the decision is "checkin", explain kindly that the app holds back a number until it can be reasonably confident, and say what would get them there.
- If memory_enabled is true and they share a plan or something to follow up, you may call remember with a short note. If memory_enabled is false, don't call remember; you can mention they can turn on "Remember on this device" if they'd like you to remember next time.
- If previous_visits exist, you may refer to how things have changed since then.

SAFETY
- You don't calculate risk, diagnose, or recommend treatments or tests. For medical decisions, suggest they ask their provider, and offer a question they could ask.
- If they mention reduced or changed movements, bleeding, leaking fluid, severe pain, severe headache or vision changes: tell them to contact their provider or labor & delivery now.
- If they mention a past loss, be gentle. If they seem very distressed or mention thoughts of self-harm, respond with care and encourage them to contact a crisis line or someone they trust.
- Never blame them. Stillbirth is usually not caused by anything the parent did.`;

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [];
  for (const t of history) {
    const prev = messages[messages.length - 1];
    if (prev && prev.role === t.role) prev.content = `${prev.content}\n${t.content}`;
    else messages.push({ role: t.role, content: t.content });
  }
  if (messages[0]?.role !== "user") messages.unshift({ role: "user", content: "(opened the chat)" });
  if (messages[messages.length - 1]?.role !== "user") messages.push({ role: "user", content: "(the app has just shown the decision card — please explain it)" });

  let text = "";
  const updates: Record<string, unknown> = {};
  const notes: string[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      const res = await client.messages.create({ model: MODEL, max_tokens: 500, system, tools: TOOLS, messages });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const b of res.content) {
        if (b.type === "text") text += (text ? "\n" : "") + b.text;
        if (b.type === "tool_use") {
          if (b.name === "update_answers") Object.assign(updates, b.input);
          if (b.name === "remember" && context?.memory_enabled) notes.push(String((b.input as any).note));
          results.push({ type: "tool_result", tool_use_id: b.id, content: b.name === "update_answers" ? "Updated. The app is recalculating and will show the new estimate." : "Saved." });
        }
      }
      if (res.stop_reason !== "tool_use") break;
      messages.push({ role: "assistant", content: res.content });
      messages.push({ role: "user", content: results });
    }
  } catch (e: any) {
    return Response.json({ error: "api_error", detail: String(e?.message ?? e) }, { status: 502 });
  }
  return Response.json({ text, updates, notes });
}
