# StillSafe — hackathon demo

StillSafe is **one conversation with Claude**, from the first screen.

1. The person opens the app and lands in the chat. Consent happens in the chat.
2. Claude asks a **core set of about 12 questions**, adjusted to pregnancy stage: the baby's growth only after 20 weeks, gestational diabetes only after 24, movements from 28. Each question has a **"Why we ask"** card (importance, what it means, how the answer is used), and any core question can be skipped.
3. A **deterministic decision rule** (`decide()` in `lib/score.ts`) picks one outcome:
   - **Estimate:** "about 12 in 1,000" vs the country average, a confidence rating, the biggest factors, a full breakdown (1,000-dot picture, per-factor impact, what-ifs), and when to check in next.
   - **Check in later:** there isn't enough information for a reliable number (too many skips, or confidence below 50/100). The card shows a dated check-in plan (20-week scan, 24–28 week glucose test, 32–36 weeks), what to bring, and an "Add to calendar" (.ics) button. **Safety rule:** if strong risk factors are present, it also says "talk to your provider soon, don't wait".
   - **Planning:** not pregnant yet. Shows the changeable factors and suggests checking in once pregnant.
4. The conversation continues with Claude. It explains the decision, answers questions, takes in new information (calling `update_answers`, which re-runs the decision), or offers optional follow-up questions for more precision.
5. **Returning users** with "Remember me on this device" on are welcomed back. They're asked how far along they are now, and the newly relevant questions for their stage come up automatically.

Not medical advice. Prototype only.

## Run it

```bash
npm install
cp .env.example .env.local            # then paste your Anthropic API key
npm run dev                           # http://localhost:3000
```

Without an API key, the app still works. The intake runs in **guided mode** (scripted questions), and the result chat uses built-in answers.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app |
| `npm run personas` | Score the 14 test personas and write `test-output/` (input CSV, results CSV, readable HTML report) |
| `python scripts/build_model.py` | Replace approximate country values with live UN IGME + WHO data (needs internet) |

## Pages

- `/`: the conversation (consent, core questions, decision card, ongoing chat)
- `/cdc`: proof of concept. The calculator set to the US reproduces CDC 2024 observed rates for 13 of 13 groups within ±25%.

## How the estimate works

1. **Starting rate:** the country's stillbirth rate at 28+ weeks from WHO / UN IGME. US users who share race/ethnicity get CDC 2024 rates instead.
2. **Re-centering:** removes the average effect of smoking, BMI, age and twins in that country, using prevalence data. This avoids counting those factors twice.
3. **Personal adjustment:** published adjusted odds ratios for each answer. Factors on the same pathway (e.g., BMI and diabetes) are shrunk 0.7×. The combined adjustment is capped at 6×.
4. **Confidence (0–100):** lowered for an approximate starting rate, skipped or "don't know" answers, reliance on unverified effect sizes, hitting the cap, and effect sizes taken from very different countries.

Claude **never computes the number**. Scoring is a deterministic function in `lib/score.ts`. Claude runs the conversation, fills the answer schema via tool calls, and explains a result object it is given. Mentions of urgent symptoms (reduced movement, bleeding, etc.) are caught by a rule-based check before any model call.

## Privacy

- Scoring runs in the browser.
- Chat messages go to the Claude API to run the conversation; nothing is stored server-side.
- **"Remember me on this device"** is opt-in. It saves answers, past estimates and Claude's notes in the browser only (localStorage), so returning users can update their check and see changes over time.

## Data status

| Data | Status |
| --- | --- |
| US baseline, race baselines, CDC check | Exact CDC 2024 values (NVSR 75-6) |
| Non-US country rates, women's prevalences, PM2.5 | **Approximate demo values.** Run `build_model.py` to refresh |
| Odds ratios marked `approx: true` in `data/model.json` | To be verified against the source papers |

## Files

```
app/page.tsx            renders the conversation
app/cdc/page.tsx        CDC proof-of-concept chart
app/api/chat            Claude intake (tool use: record_answers, ask_next, finish_intake), round-aware
app/api/ask             Claude post-decision chat (tool use: update_answers, remember)
components/Conversation.tsx  the single chat: phases consent → intake (core/optional) → post-decision
components/DecisionCard.tsx  estimate / check-in / planning cards, calendar export, memory toggle
components/Breakdown.tsx     full breakdown of an estimate
components/Callout.tsx, Urgent.tsx
lib/score.ts            scoring, confidence, decide() + check-in plan, plain-language helpers, CDC check
lib/intake.ts           question order, chips, guided-mode parsing, urgent rule
lib/memory.ts           opt-in on-device memory
data/model.json         factors, callouts, odds ratios, countries, CDC tables
data/personas.json      14 test personas
```
