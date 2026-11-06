import Anthropic from "@anthropic-ai/sdk";
import { factors, model } from "../../../lib/score";
import { nextStep, isUrgent, ORDER, Scope, roundIds, recheckExtra, previousLabel } from "../../../lib/intake";

export const runtime = "nodejs";

const MODEL = process.env.STILLSAFE_MODEL || "claude-sonnet-5-5";

type Turn = { role: "user" | "assistant"; content: string };

function answerSchema() {
  const props: Record<string, any> = {
    weeks: { type: "string", description: "Weeks pregnant as the user said it, e.g. '30' or '28 or more'" },
    movement: { type: "string", enum: ["normal", "changed", "unsure"] },
  };
  for (const f of factors as any[]) {
    if (f.type === "derived") continue;
    if (f.options) props[f.id] = { type: "string", enum: f.options.map((o: any) => o.value), description: f.options.map((o: any) => `${o.value} = ${o.label}`).join("; ") };
    else if (f.type === "number") props[f.id] = { type: "number", description: f.label };
    else if (f.id === "country") props[f.id] = { type: "string", enum: model.countries.map((c) => c.name), description: "Country name. If the user's country is not in the list, pick the closest match in the same region and say so." };
    else props[f.id] = { type: "string", description: `${f.label} as the user gave it, with units (e.g. "5'4\\"", "162 cm", "150 lb", "68 kg"). For city, use 'skip' if they decline.` };
  }
  return { type: "object" as const, properties: props };
}

const TOOLS: Anthropic.Tool[] = [
  { name: "record_answers", description: "Save any answers the user has given so far. Call every time the user answers. Map their words onto the allowed values.", input_schema: answerSchema() },
  { name: "ask_next", description: "Declare which question you are asking in this message, so the app can show the 'why we ask' card and answer buttons under it.", input_schema: { type: "object" as const, properties: { field: { type: "string", enum: ORDER } }, required: ["field"] } },
  { name: "finish_intake", description: "Call when every required question has an answer (or 'don't know').", input_schema: { type: "object" as const, properties: {} } },
];

// What kind of round this is. `previous` holds saved answers being re-confirmed at a check-in.
type Round = { scope: Scope; returning: boolean; resumed: boolean; previous: Record<string, unknown>; expectedWeeks?: number };

function returningText(r: Round) {
  if (r.resumed) return " The user is RESUMING an unfinished questionnaire after a break; the app has already welcomed them back. Don't greet them again, just ask the next question.";
  if (!r.returning) return "";
  const prev = Object.entries(r.previous).filter(([k]) => k !== "weeks").map(([k, v]) => `${k}: ${previousLabel(k, v)}`).join("; ");
  return ` The user is RETURNING for a check-in. The app has already said "Welcome back. How are you feeling today?", so don't greet them again. Their other earlier answers are kept. Some answers can change during pregnancy, so this round re-asks them.
  - Your first message responds to how they're feeling, in one short, kind sentence that fits what they said (glad if they're well; if they're anxious or not great, acknowledge it gently without brushing it off or over-reassuring). If they mention any warning sign, follow the safety rule below instead. Then ask the first check-in question.
  - For weeks: ${r.expectedWeeks !== undefined ? `based on last time, they're probably about ${r.expectedWeeks} weeks now. Ask them to confirm, e.g. "Are you about ${r.expectedWeeks} weeks along now?"` : "ask how many weeks pregnant they are now."}
  - For each re-asked question, mention what they said last time in plain words and ask if it's still the same, e.g. "Last time you said you don't smoke. Is that still right?" If they say it's the same, record the previous value. Previous answers: ${prev || "none"}.
  - Also invite them, once and briefly, to mention anything new (a scan, a test result, a new diagnosis).`;
}

function systemPrompt(answers: Record<string, unknown>, r: Round) {
  const { scope } = r;
  const ids = roundIds(answers as any, scope, recheckExtra(r.previous as any));
  const qList = ids.map((id) => {
    const f: any = factors.find((x) => x.id === id);
    return `- ${id}: ${f?.question ?? (id === "weeks" ? "How many weeks pregnant are you?" : "Has your baby been moving less than usual, or has the pattern changed? (only if 28+ weeks)")}`;
  }).join("\n");
  return `You are StillSafe's intake guide. You're helping someone who is pregnant (or hoping to be) answer a short set of questions about stillbirth risk factors, in a mobile chat.

YOUR VOICE
- Gentle, warm and welcoming, like a kind friend who happens to know about pregnancy. Pregnancy can feel overwhelming, and this topic can be scary, so help them feel safe, unhurried and never judged.
- Use simple, everyday words that anyone can follow, whatever their background or first language. Avoid medical terms; if you must use one, explain it in a few words (e.g. "preeclampsia, a blood pressure problem in pregnancy").
- Short and calm beats long and thorough. Don't pile on reassurance or exclamation marks.
- Be warm through plain kindness, not announcements about tone. Never narrate how the conversation will feel or go ("Let's start gently", "We'll go at your pace", "No pressure", "Thank you for being here"). For the very first message, a simple short hello and the first question is enough.
- Vary acknowledgements naturally, and skip them when they'd just be filler. Don't open every message with "Thank you."

YOUR JOB
- This is the ${scope === "core" ? "CORE round: the short set needed for a first estimate" : "OPTIONAL follow-up round: extra questions for a more precise estimate"}.${returningText(r)}
- Ask ONE question at a time, in this order, skipping questions that are already answered or don't apply:
${qList}
- Keep each message very short: a brief, kind acknowledgement (2–5 words), then the question in plain words. Aim for under 25 words in total.
- Do NOT explain why you're asking or how the answer is used. The app shows a tappable "Why we ask" button under every question for anyone who wants to know more. Don't repeat it.
- Every time the user answers, call record_answers with what you learned (they may answer several things at once). Convert units only by passing their words; don't compute BMI.
- In every message that asks a question, also call ask_next with that question's field.
- "Don't know" and "prefer not to say" are always fine. Record the closest value (e.g. small_baby=unknown, race=skip) and move on.
- When nothing is left in this round, call finish_intake and say one short line like "Thanks, let me pull that together." The app then decides whether there's enough to give an estimate, or whether to suggest checking in again later, and you'll explain it next.

STRICT RULES
- Never give a risk number, a percentage, or say anyone is "low risk". The app calculates and explains the result.
- Never give medical advice, diagnoses or treatment suggestions. If asked, say their provider is the right person, and offer to add it to their list of questions.
- If the user mentions reduced or changed baby movements, bleeding, leaking fluid, severe pain, severe headache or vision changes, tell them to contact their provider or labor & delivery NOW, and stop the questionnaire.
- Be kind and never judgmental, especially about smoking, alcohol, weight or past losses. If they mention a past loss, acknowledge it gently in a few words.

STATE (as of the start of this turn; after record_answers, the tool result gives the updated state)
${stateText(answers, r)}`;
}

function stateText(answers: Record<string, unknown>, r: Round) {
  const next = nextStep(answers as any, r.scope, recheckExtra(r.previous as any));
  const prev = next && next.id in r.previous ? ` (last time: ${previousLabel(next.id, r.previous[next.id])})` : "";
  return `Answers recorded so far: ${JSON.stringify(answers)}
Next question to ask: ${next ? `${next.id} — "${next.question}"${prev}` : "none — call finish_intake"}`;
}

export async function POST(req: Request) {
  const body = (await req.json()) as { history: Turn[]; answers: Record<string, unknown>; scope?: Scope; returning?: boolean; resumed?: boolean; previous?: Record<string, unknown>; expectedWeeks?: number };
  const { history, answers } = body;
  const round: Round = { scope: body.scope ?? "core", returning: !!body.returning, resumed: !!body.resumed, previous: body.previous ?? {}, expectedWeeks: body.expectedWeeks };
  const { scope } = round;
  const extra = recheckExtra(round.previous as any);
  const last = history[history.length - 1];
  if (last?.role === "user" && isUrgent(last.content)) return Response.json({ urgent: true });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_key" }, { status: 503 });

  const client = new Anthropic();
  const merged: Record<string, unknown> = { ...answers };
  let askNext: string | undefined;
  let finished = false;
  let text = "";

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: "Hi, I'd like to check my risk." }];
  for (const t of history) {
    const prev = messages[messages.length - 1];
    if (prev.role === t.role) prev.content = `${prev.content}\n${t.content}`; // keep strict user/assistant alternation
    else messages.push({ role: t.role, content: t.content });
  }

  try {
    // The system prompt must stay identical across tool-use rounds: the model's thinking blocks are
    // bound to it, and the API rejects replayed blocks if it changes. Updated state goes in tool results.
    const system = systemPrompt(merged, round);
    for (let i = 0; i < 4; i++) {
      const res = await client.messages.create({ model: MODEL, max_tokens: 600, system, tools: TOOLS, messages });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === "text") text += (text ? "\n" : "") + block.text;
        if (block.type === "tool_use") {
          const input = block.input as Record<string, unknown>;
          if (block.name === "record_answers") for (const [k, v] of Object.entries(input)) if (v !== null && v !== "") merged[k] = v;
          if (block.name === "ask_next") askNext = String(input.field);
          if (block.name === "finish_intake") finished = true;
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: block.name === "record_answers" ? `Saved.\n${stateText(merged, round)}` : "ok" });
        }
      }
      if (res.stop_reason !== "tool_use" || text) break;
      messages.push({ role: "assistant", content: res.content });
      messages.push({ role: "user", content: toolResults });
    }
  } catch (e: any) {
    return Response.json({ error: "api_error", detail: String(e?.message ?? e) }, { status: 502 });
  }

  if (merged.movement === "changed") return Response.json({ urgent: true, answers: merged });
  const next = nextStep(merged as any, scope, extra);
  if (!next) finished = true;
  // The app's own question order decides which buttons/"Why we ask" to show; Claude's ask_next is only a
  // fallback. (Claude sometimes labels ask_next with a different field than the question it actually wrote.)
  return Response.json({ text, answers: merged, askNext: finished ? undefined : next?.id ?? askNext, finished });
}
