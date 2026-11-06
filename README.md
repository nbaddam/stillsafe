# StillSafe

StillSafe is a conversational stillbirth-risk **education** tool with Claude built into the product, made for the Code with Claude – Women in AI Hackathon (SF, Nov 6, 2026).

**It is not a diagnostic and not medical advice. Prototype only.**

Claude runs the conversation (consent, a stage-aware set of about 12 questions with "Why we ask" cards, and follow-up chat). A deterministic rule (`decide()` in `project/stillsafe/lib/score.ts`) picks the result: an "about X in 1,000" estimate vs the country average, a dated check-in plan, or a planning view. Claude never computes the number, and urgent symptoms are caught by a rule-based check before any model call. Without an API key the app runs in guided mode.

## Repository layout

```
project/stillsafe/   Next.js 15 + TypeScript app (see its README for details)
spec/                full product and model spec
research/            research notes, factors and effect sizes, CDC 2024 data
test-output/         persona test inputs, results and HTML report
demo/                single-file guided demo, screenshots, Playwright recorder
color-palette.md     colour palette
```

## Run it

```bash
cd project/stillsafe
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000  (/cdc = validation page)
```

`.env.local` is git-ignored; never commit your key.

## More

- [project/stillsafe/README.md](project/stillsafe/README.md): how the estimate works, privacy, data status
- [spec/StillSafe_Spec.md](spec/StillSafe_Spec.md)
- [research/](research/)
