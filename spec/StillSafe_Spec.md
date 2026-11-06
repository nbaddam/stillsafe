# StillSafe — Stillbirth Risk Tool Spec

Nov 6, 2026 · @nikita chauhan

## Overview

StillSafe gives a pregnant person an evidence-based estimate of their stillbirth risk relative to the population baseline, shows which factors drive it, and points to the actions and conversations with their provider that can lower it.

**Problem.** About 1.9 million babies are stillborn at 28+ weeks each year worldwide (13.9 per 1,000 total births), with national rates from 1.5 to 32 per 1,000. Even in the US, 20,005 fetal deaths at 20+ weeks were recorded in 2023. About one-third of stillbirths have no recorded cause, and several of the largest contributors — overweight/obesity, maternal age, smoking — are known before or early in pregnancy. Most people never see their own risk profile until something goes wrong.

**Product goal.** A free, private, mobile-first questionnaire (under 5 minutes) that returns:

1. An absolute risk estimate (per 1,000 pregnancies) next to the baseline for someone like them.
2. The top contributing factors, split into modifiable and non-modifiable.
3. Concrete next steps and questions to bring to their next prenatal visit.
4. Always-on warning signs that mean "call your provider now" (e.g., reduced fetal movement), regardless of score.

**Success criteria (v1).**

| Metric | Target |
| --- | --- |
| Discrimination (AUC) on held-out data | ≥ 0.70 for the self-report model |
| Calibration (observed:expected) | 0.8–1.2 overall and in each major subgroup |
| Completion rate | ≥ 80% of users who start finish |
| Comprehension | ≥ 85% correctly restate their result in a usability test |
| Action | ≥ 50% of elevated-risk users save or share the provider questions |

## Users and use cases

The primary user is a pregnant person (or someone planning pregnancy) using the tool on their own; clinicians are a secondary audience in a later release.

| User | When | Need |
| --- | --- | --- |
| Pregnant person, any trimester | After a positive test or at any prenatal milestone | "Am I higher risk, and what can I do?" |
| Person planning pregnancy | Pre-conception | Which modifiable factors (weight, smoking, alcohol) to address first |
| Person with a prior stillbirth or loss | Early in a subsequent pregnancy | A grounded view of recurrence risk and what extra monitoring to ask for |
| Partner / family member | Alongside the pregnant person | Understand the result and the warning signs |
| Clinician (v2) | At booking visit | Quick structured risk summary the patient brings in |

Core jobs: complete the questionnaire, understand the result, see what moves it, save/share a provider summary, and re-check as pregnancy progresses (e.g., new diagnosis of gestational diabetes or hypertension).

## Guiding principles and non-goals

StillSafe is a risk-awareness and conversation tool, not a diagnostic or a substitute for prenatal care.

**Principles**

- **Never reassure away symptoms.** Warning signs (reduced or changed fetal movement, bleeding, severe abdominal pain, fluid leakage, severe headache/vision changes) appear on every result screen with "contact your provider or go to labor & delivery now," whatever the score.
- **Absolute over relative.** Show "8 in 1,000" next to "5 in 1,000 baseline," not "60% higher risk." Relative framing alone frightens without informing.
- **Lead with what's actionable.** Modifiable factors first, with specific evidence-backed actions; non-modifiable factors framed as "reasons to ask about extra monitoring."
- **No blame.** Language reviewed so a person who later has a loss is not left believing they caused it.
- **Privacy by default.** Scoring can run entirely on-device; nothing is stored unless the user opts in (see Architecture).
- **Transparent.** Every factor links to its source and effect size; model version and limitations are one tap away.

**Non-goals (v1)**

- Diagnosing fetal conditions or interpreting ultrasound, labs, or fetal heart monitoring.
- Telling anyone their risk is "low" in a way that implies they can skip care or ignore symptoms.
- Recommending specific medical interventions (e.g., induction timing, aspirin) — the tool suggests *questions to ask*, the clinician decides.
- Ingesting EHR data or wearables.

## Input factors

v1 collects about 25 inputs in four groups; the strongest single predictor is a prior stillbirth (adjusted OR ≈ 3.4), followed by placental/medical conditions, smoking + alcohol, BMI and age. Effect sizes below are the starting priors for the v1 calculator; marked "approx." values must be verified against the full paper before launch.

**A. Demographics and body**

| Factor | How collected | Encoding | Evidence (effect size) | Tier |
| --- | --- | --- | --- | --- |
| Maternal age | Date of birth or age | <20, 20–34 (ref), 35–39, 40+ | Age >35 accounts for 7–11% of stillbirths in high-income countries ([Flenady 2011](https://pubmed.ncbi.nlm.nih.gov/21496916/)); perinatal mortality highest at 40+ (12.42/1,000) ([CDC 2025](https://cdc.gov/nchs/products/databriefs/db530.htm)). OR ≈ 1.6 (35–39), ≈ 2.0 (40+) approx. | Core |
| Height + pre-pregnancy weight | ft/in or cm; lb or kg | BMI computed; <18.5, 18.5–24.9 (ref), 25–29.9, 30–34.9, 35+ | BMI >25 is the top modifiable factor, 8–18% of stillbirths ([Flenady 2011](https://pubmed.ncbi.nlm.nih.gov/21496916/)); aOR 1.03 per BMI unit ([CRIBSS IPD](https://pmc.ncbi.nlm.nih.gov/articles/PMC6543252/table/t0010)) | Core |
| Race / ethnicity | Optional, self-identified | CDC categories | Non-Hispanic Black and NHPI rates ≈ 10/1,000, about double White, Hispanic, Asian ([CDC via HealthDay](https://www.powershealth.org/about-us/newsroom/health-library/2025/12/05/us-stillbirth-rate-falls-2-but-nearly-20000-losses-still-reported)) | Optional; US baseline only |

**B. Obstetric history**

| Factor | How collected | Encoding | Evidence (effect size) | Tier |
| --- | --- | --- | --- | --- |
| Prior stillbirth (20+ wks) | Yes/No; if yes, count + was a cause found | Binary + explained/unexplained | Pooled aOR 3.38 (2.61–4.38); 2.5% vs 0.4% recurrence ([Lamont 2015, BMJ](https://www.pubmed.gov/26109551/)); unexplained prior aOR 1.83 ([Lamont, unexplained](https://abdn.elsevierpure.com/en/publications/recurrence-risk-of-unexplained-stillbirth-a-systematic-review-and/)) | Core |
| Parity (previous births) | Number of prior births ≥20 wks | 0 / 1–2 (ref) / 3+ | First pregnancy accounts for \~15% of stillbirths ([Flenady 2011](https://pubmed.ncbi.nlm.nih.gov/21496916/)) | Core |
| Prior preterm birth / small baby / abruption / preeclampsia | Checklist | Binary each | Prior PTB or SGA raises next-pregnancy adverse outcomes ([core.ac.uk review](https://core.ac.uk/download/195684613.pdf)) | Core |
| Prior miscarriages | Count | 0 / 1–2 / 3+ | Weaker evidence; collect, low weight | Collect |
| Conception via IVF/ART | Yes/No | Binary | Associated in Flenady review keywords; verify effect | Collect |
| Multiple pregnancy (twins+) | Yes/No | Binary | Strong; consider routing twins to a separate baseline | Core |

**C. Health conditions (current pregnancy)**

| Factor | How collected | Encoding | Evidence (effect size) | Tier |
| --- | --- | --- | --- | --- |
| Pre-existing diabetes (type 1/2) | Yes/No | Binary | "Important contributor" in high-income countries ([Flenady 2011](https://pubmed.ncbi.nlm.nih.gov/21496916/)) | Core |
| Gestational diabetes | Yes/No/Not tested yet | Tri-state | Smaller than pre-existing; verify | Core |
| Chronic or pregnancy hypertension / preeclampsia | Yes/No | Binary | Important contributor ([Flenady 2011](https://pubmed.ncbi.nlm.nih.gov/21496916/)) | Core |
| Told baby is small (FGR/SGA) | Yes/No/Don't know | Tri-state | Highest attributable share: SGA 23%, abruption 15% ([Flenady 2011](https://pubmed.ncbi.nlm.nih.gov/21496916/)) | Core (provider-reported) |
| Prenatal care so far | Visits on schedule? | Adequate / some missed / none | Poor utilisation raises risk; more-than-adequate care protective ([IPD secondary analysis](https://searchworks.jioinstitute.edu.in/articles/edb__164879588)) | Core |

**D. Behaviours and environment**

| Factor | How collected | Encoding | Evidence (effect size) | Tier |
| --- | --- | --- | --- | --- |
| Smoking | Never / quit before pregnancy / quit in 1st trimester / currently (cigs/day) | Ordinal | aOR 1.62 for smoking beyond 1st trimester ([CRIBSS IPD](https://pmc.ncbi.nlm.nih.gov/articles/PMC6543252/table/t0010)); meta-analyses: +36% to +47% odds ([Midwifery review](https://cora.ucc.ie/bitstream/10468/8796/1/11138.pdf)) | Core |
| Second-hand smoke | Daily exposure Yes/No | Binary | OR 1.22 for never-smokers exposed ([Midwifery review](https://cora.ucc.ie/bitstream/10468/8796/1/11138.pdf)) | Core |
| Alcohol | Drinks per week since pregnancy began | 0 / <1 / 1–4 / 5+ | RR 2.96 for 5+ drinks/week vs <1 ([Kesmodel 2002](https://manuscript.isc.ac/Inventory/10/262.htm)); drinking + smoking past 1st trimester 2.78× late stillbirth ([Safe Passage](https://www.2minutemedicine.com/?p=25185)) | Core |
| Other substances | Cannabis, opioids, stimulants (optional, private) | Binary each | Illicit drug use among the highest-impact behaviours ([Escañuela Sánchez 2019](https://ucc.ie/en/pregnancyloss/publications/20191201-modifiable-risk-factors.html)) | Optional |
| Location (air quality) | Country + city (optional), or "use my location" (rounded) | Annual mean PM2.5 (µg/m³) for city, else country | OR 1.10 per 10 µg/m³ over the whole pregnancy ([Zhang 2021](https://www.aminer.org/pub/604b4252ec47cda532dcec0c/ambient-air-pollution-and-stillbirth-an-updated-systematic-review-and-meta-analysis)); +11% per 10 µg/m³, stronger at older ages ([Xue 2022](https://www.nature.com/articles/s41467-022-34250-4.pdf)) | Core |
| Physical activity | Days/week of ≥30 min moderate activity | 0 / 1–2 / 3+ | No pooled stillbirth estimate found yet; acts mainly through BMI and gestational diabetes | Collect, not scored in v1 |
| Sleep position (3rd trimester) | Usual going-to-sleep position | Side / back / varies | Back-sleeping in late pregnancy studied in CRIBSS; verify aOR | Education + collect |
| Fetal movement change (≥28 wks) | Reduced / normal / increased | Ordinal | Decreased frequency raises risk; model with it reached AUC 0.84 ([IPD secondary analysis](https://searchworks.jioinstitute.edu.in/articles/edb__164879588)) | **Triage, not scored**: reduced movement → immediate "call now" |

**Always asked:** current gestational week (from due date or last period), used to pick the baseline and to unlock late-pregnancy questions.

**Deliberately not asked in v1:** income, insurance, immigration status, exact address. Socioeconomic signal comes indirectly via ZIP-level indices only if validated (see Open questions).

### "Why we ask" callout on every question

Every question carries a callout with three parts, shown before the user answers (in chat, as a small card under Claude's question). Users always know how much a factor matters and exactly what happens to their answer.

1. **Importance badge**, set from the factor's effect size: **High** (aOR ≥ 2), **Medium** (1.3–2), **Low** (< 1.3), **Context only** (collected but not scored, e.g., physical activity).
2. **What it means:** one or two plain sentences on why this factor relates to stillbirth, with the source one tap away.
3. **How we use your answer:** exactly what the scoring does with it, whether it is optional, and where it goes (stays on your device / sent to Claude for the conversation).

The same badge and text reappear next to the factor on the result screen.

| Question | Badge | What it means | How we use your answer |
| --- | --- | --- | --- |
| Race / ethnicity (optional) | Medium (US baseline only) | In the US, Black and Pacific Islander mothers have about twice the stillbirth rate of others. Researchers link this mainly to differences in access to care, stress and living conditions, not biology. | Only used to pick a more accurate US starting baseline. Not used outside the US. Skipping it uses the national average, so your estimate may be less precise. Never stored or shared. |
| Prior stillbirth | High | A previous stillbirth raises the chance in a later pregnancy about 3–5 times, partly because some causes recur. | Strongest single adjustment. If the cause was found, tell us, since unexplained losses carry a smaller increase. |
| Smoking | Medium | Smoking reduces oxygen and blood flow to the baby. Quitting at any point helps. | Adjusts risk by how much and when you smoked. Shown as something you can change. |
| Country and city | Medium | Stillbirth rates differ about 20-fold between countries; local air pollution adds a smaller effect. | Sets your starting baseline (WHO/UN data) and looks up your city's average air quality. Only the city name is used, never your exact location. |
| Physical activity | Context only | Activity helps with weight and blood sugar, which are linked to stillbirth, but there's no direct estimate yet. | Not scored. Used to tailor suggestions. |

**Content rules:** callouts are written once per factor in `model.json` (`importance`, `why`, `how_used`, `optional`), reviewed by a clinician, and Claude shows them verbatim rather than paraphrasing.

## Risk model

For the demo, start from the user's country stillbirth rate (WHO / UN IGME), re-center it to a "reference" person using WHO prevalence data, then adjust by published adjusted odds ratios for each answer. No model is trained today. WHO publishes population-level estimates, not individual records, so a trained model needs registry data later.

### Step 1 — Country baseline (WHO / UN IGME)

- p₀ = the country's latest stillbirth rate per 1,000 total births (UN IGME, 195 countries, 2000–2023). Global average 13.9; national rates range from 1.5 to 32.
- **Definition:** UN IGME counts stillbirths at **28+ weeks** (WHO international definition). The whole tool uses 28+ weeks so countries are comparable. US CDC figures (20+ weeks) appear only as context.
- US users who share race/ethnicity get a CDC race-specific baseline instead of the national one; the app explains why ("stillbirth rates differ a lot between groups in the US, mostly because of differences in care and living conditions").

### Step 2 — Re-center to a reference person

A country rate is an *average* over everyone, including smokers and people with obesity. Applying odds ratios on top of it would double-count. Re-center using WHO Global Health Observatory prevalence for the country:

```latex
\text{logit}(p_{\text{ref}}) = \text{logit}(p_0) - \sum_k \beta_k \, \pi_{k,\text{country}}
```

- π = WHO GHO prevalence among women: tobacco use, obesity (BMI ≥ 30), overweight (25–29.9), and heavy episodic drinking.
- Rarer factors (prior stillbirth, diabetes) are skipped in centering; the bias is small and noted in "How this works."

### Step 3 — Personal adjustment

```latex
\text{logit}(p) = \text{logit}(p_{\text{ref}}) + \sum_i \beta_i x_i, \qquad \beta_i = \ln(\text{aOR}_i)
```

- β values come from the Input factors table (adjusted ORs only, with CI and citation stored in `model.json`).
- **Double-counting guard:** factors on the same causal path (BMI → diabetes or hypertension; smoking → small baby) get 0.7× shrinkage on the downstream factor. Total combined OR is capped at 10.
- **Air quality:** β = ln(1.10) per 10 µg/m³ PM2.5 above the country's population-weighted mean (so the baseline already reflects average local air).
- **Uncertainty:** sample each log-OR from its CI (1,000 draws, on-device) and show a range.
- **Caveat shown to users:** most odds ratios come from high-income-country studies. In low- and middle-income countries, many stillbirths happen during labor and relate to access to care. v2 adds those factors.

### Claude's role (conversational intake)

- Claude runs the conversation and fills a strict schema through a `record_answer` tool (one field per factor, with enums and units). It asks follow-ups, converts units, and allows "don't know."
- **Claude never computes the risk number.** A deterministic TypeScript function scores the completed schema; Claude only receives the result object to explain it in plain words, under a system prompt with fixed guardrails (warning signs always, no "low risk" reassurance, no treatment advice).
- If the user mentions reduced fetal movement, bleeding or pain at any point, Claude stops the intake and shows the urgent-care screen. This check runs as a rule on each message, not only via the model.

### Later — a trained model

Train on individual-level data where it exists: US NVSS fetal-death + natality files, UK/Nordic registries, and LMIC cohorts (e.g., Global Network for Women's and Children's Health Research). Use penalized logistic regression first, then compare gradient boosting. Calibrate per country to UN IGME rates, and use literature ORs as offsets for factors the data lacks.

## Data sources

WHO-family datasets supply the country baselines, re-centering prevalences and air quality; published meta-analyses supply the per-factor odds ratios. All of it is small enough to bundle into one static `model.json` (< 500 KB).

| Source | What it gives | Use in StillSafe | Access |
| --- | --- | --- | --- |
| [UN IGME stillbirth estimates](https://pmnch.who.int/resources/publications/m/item/unigme-stillbirth-database-and-estimates) (UNICEF, WHO, World Bank, UN) | Stillbirth rate per 1,000 total births (28+ wks), 195 countries, 2000–2023 | Step 1 country baseline | Free; easiest via [Our World in Data CSV](https://ourworldindata.org/grapher/stillbirth-rate) |
| WHO Global Health Observatory (GHO) | Country prevalence among women: tobacco use, obesity, overweight, alcohol | Step 2 re-centering | Free API / CSV |
| [WHO Ambient Air Quality Database](https://www.who.int/data/gho/data/themes/air-pollution/who-air-quality-database) (update Jun 2026) | Annual mean PM2.5 for 6,000+ cities in 117 countries | City air-quality lookup | Free Excel download |
| WHO GHO modelled PM2.5 (SDG 11.6.2) | Country population-weighted PM2.5 | Fallback when city is missing; centering point for air quality | Free |
| CDC fetal mortality reports / WONDER | US rates by race/ethnicity and age | US race-specific baseline (optional) and the proof-of-concept check of calculator outputs | Free |
| Meta-analyses in the Input factors table | Adjusted ORs + CIs | Step 3 coefficients | Published |
| Later: US NVSS, UK MBRRACE, Nordic registries, Global Network cohorts | Individual-level records | Training a real model; country calibration | Applications needed |

**Prep for the demo:** one Python script pulls the three WHO-family tables, joins them on ISO-3 country code, and writes `model.json`. Countries missing a value fall back to their regional average, and the app labels it as such.

## Output and risk communication

The result screen shows one absolute number against a baseline, a 1,000-dot icon array, and the factors driving it — never a red/green "you're fine" verdict.

**Result screen, top to bottom**

1. **Warning-signs banner** (pinned, every screen): "If your baby is moving less than usual, or you have bleeding, fluid leaking or severe pain, contact your provider or labor & delivery now. Don't wait for your next appointment."
2. **Your estimate:** "About 9 in 1,000 (range 7–12)" beside "Average in your country: about 5 in 1,000."
3. **Icon array:** 1,000 dots, baseline dots in one tone, additional dots in another.
4. **Risk band** for orientation only: *Around average* (≤ 1.5× baseline), *Above average* (1.5–3×), *Well above average* (> 3×). Each band maps to a recommended action, not a feeling.
5. **What's contributing:** ranked bars of each factor's contribution, tagged *Can change* or *Can't change*.
6. **What you can do:** one card per modifiable factor (e.g., quitting smoking resources, alcohol guidance, side-sleeping from 28 weeks, keeping prenatal visits) with source links.
7. **Questions for your provider:** auto-generated list (e.g., "Given my prior stillbirth, should I have extra growth scans?"), exportable as PDF/share sheet.
8. **"What if" sliders** for modifiable factors (show how risk would change if they quit smoking).
9. **How this works:** model version, data sources, limitations.

**Tone rules:** plain language at a 6th–8th grade reading level; no "low risk" language; no percentages under 1% shown as "0%"; every elevated result pairs with a next step. Copy reviewed by an OB/MFM clinician and by bereaved-parent advocates before launch.

## User flow

Seven steps, run as a Claude-led chat with tap-to-answer chips and a why-we-ask card under each question, with fetal-movement triage interrupting the flow the moment it applies.

1. **Welcome + consent:** what the tool does and doesn't do, privacy promise, "not medical advice," 18+ confirmation.
2. **Pregnancy basics:** due date or weeks pregnant, singleton vs multiple, first pregnancy?
3. **Triage gate (≥ 28 weeks):** "Has your baby's movement changed or slowed?" → if yes, full-screen urgent guidance with call buttons; the user can continue afterward.
4. **About you:** age, height, weight, country and city, optional race/ethnicity.
5. **History + health:** prior stillbirths/losses/complications, diagnosed conditions, prenatal visits.
6. **Habits:** smoking, second-hand smoke, alcohol, optional substances (with a reminder that answers stay on the device), activity, sleep position (3rd trimester).
7. **Result** (see previous section) → save PDF / share with provider / set a reminder to re-check at the next trimester.

**Edge cases:** "Don't know" allowed on every clinical question (treated as missing and imputed at the population rate, with a note); unrealistic values (BMI < 13 or > 80, age < 12 or > 60) prompt confirmation; under-18 users get a short version that routes them to care and trusted adults; twins+ show a separate, clearly labelled baseline.

## Architecture, data model and privacy

Score on the device by default and store nothing server-side; pregnancy, loss and location data are among the most sensitive data a person can share.

**Components**

| Layer | Choice (suggested) | Notes |
| --- | --- | --- |
| Front end | Next.js / React PWA, mobile-first | Works offline once loaded; i18n from day one (English, Spanish, Hindi first) |
| Scoring engine | TypeScript module + `model.json` (coefficients, CIs, version, citations) | Runs in browser; same file used by a Python reference implementation for tests |
| Exposure lookup | Static city/country → PM2.5 table bundled in model.json (WHO city + country PM2.5) | No raw coordinates leave the device; GPS rounded to city locally |
| Model training | Python (pandas, scikit-learn, LightGBM, SHAP) in a separate repo | Exports `model.json`; training data never touches the app |
| Optional accounts (v2) | Encrypted, user-held export or end-to-end encrypted sync | Off by default |
| Analytics | Privacy-preserving, aggregate event counts only | No answers, no locations in analytics |

**Core data model (in memory / local storage only)**

- `Assessment { id, created_at, gestational_week, answers: Map<FactorId, Value>, model_version }`
- `Factor { id, label, type, options, group, scored: bool, beta, ci_low, ci_high, source_url, upstream_of[], importance, why, how_used, optional }`
- `Result { p, p_low, p_high, baseline, band, contributions: [{factor_id, delta_log_odds}], actions[], questions[] }`

**Privacy and security requirements**

- No account required; no answers sent to a server for scoring. Chat messages do go to the Claude API to run the conversation; the consent screen says so, and production should use zero data retention.
- If the user saves results, they are stored locally (encrypted) with a one-tap "delete everything."
- No third-party ad or tracking SDKs; no selling or sharing data, ever (state this in the policy).
- Legal review for the FTC Health Breach Notification Rule and state consumer health-data laws (e.g., Washington's My Health My Data Act, California CMIA) before any server-side storage. Reproductive-health data also carries legal-exposure risk for users in some states, which reinforces the no-storage default.
- Threat model covers shared devices (screen lock / discreet mode) and subpoena of server data (nothing to hand over).

## Validation and evaluation

Today's bar is "the math is right and the safety rules never fail"; predictive accuracy can only be measured once a trained model exists.

**Demo (today)**

- [ ] Scoring unit tests: 10 hand-computed personas match the function to 3 decimals.
- [ ] Centering check: average predicted risk over a synthetic population with the country's WHO prevalences lands within 10% of the UN IGME rate, for 5 countries.
- [ ] Safety red-team: 20 scripted messages mentioning reduced movement, bleeding, pain or leaking fluid trigger the urgent screen 20/20, including mid-sentence and misspelled.
- [ ] Claude never states a risk number it wasn't given and never says "low risk" (spot-check 10 conversations).
- [ ] Every factor shows its why-we-ask callout, verbatim from `model.json`.

**Proof of concept: check against CDC data**

WHO data sets each country's starting rate; CDC's US records show the method works. CDC publishes actual US stillbirth rates broken out by the same factors StillSafe asks about. If the calculator, set to the US, reproduces those observed rates, the WHO-based approach is credible everywhere else.

1. **Pull CDC subgroup rates** (CDC WONDER fetal deaths + natality, 2018–2023): rate per 1,000 by maternal age band, tobacco use, pre-pregnancy BMI band, race/Hispanic origin, and plurality. Fastest path: take rates by age, race and tobacco straight from CDC's annual "Fetal Mortality: United States" report (already computed, including 28+ week rates that match WHO). Only BMI needs WONDER: Fetal Deaths (Expanded, 2014–2024) gives counts, so divide by fetal deaths + live births from the WONDER Natality database.
2. **Run the calculator in "US check" mode:** US baseline at 20+ weeks (5.5 per 1,000, matching CDC's definition), re-centered with US prevalences from the same CDC tables.
3. **Score one persona per subgroup** (e.g., age 35–39 + smoker; BMI 35+; age 40+), holding other answers at the reference level.
4. **Compare predicted vs observed:** a scatter of calculator rate (y) vs CDC rate (x) with a 45° line. Target: every subgroup within ±25%, and the ranking of subgroups preserved. Anchor example: CDC reports about 12 per 1,000 for smokers aged 35–39 vs about 5 overall (2023).
5. **Demo slide:** the scatter plus one line: "Built on WHO data for 195 countries; validated against US CDC records."

Ratios between subgroups are compared as well as absolute rates. Ratios don't depend on the 20- vs 28-week definition, which keeps the check fair when the global tool uses 28+ weeks.

**v1 and later**

| Check | Method | Target |
| --- | --- | --- |
| Discrimination | AUC on a held-out year | ≥ 0.70 |
| Calibration | Observed:expected and calibration slope, overall and by country/region | O:E 0.8–1.2, slope 0.8–1.2 |
| Fairness | Calibration by age group, race/ethnicity (US), country income group | No subgroup O:E outside 0.7–1.3 |
| Usefulness | Decision-curve analysis vs. "refer everyone" | Positive net benefit |
| Comprehension | Usability test, 15+ pregnant participants across 3 countries | ≥ 85% restate result correctly |
| Reporting | TRIPOD+AI checklist | Complete before any publication |

## Clinical, regulatory and ethical considerations

The demo is safe to show as a prototype; anything released to real users needs a clinical advisor and a regulatory review first. This is not legal advice.

- **Medical device status:** patient-facing software that estimates an individual's disease risk can count as a medical device (US FDA, EU MDR, India CDSCO, UK MHRA). A "general wellness / education" framing narrows but may not remove that. Get a regulatory opinion before launch in each market.
- **Clinical governance:** recruit an OB/maternal-fetal medicine advisor to sign off on factor weights, callout text, warning signs and the provider-questions list.
- **Bereavement sensitivity:** have bereaved parents and a stillbirth charity review the copy. Results must never imply blame.
- **Equity:** UN IGME baselines are modelled estimates with wide uncertainty in data-poor countries; show that uncertainty. Don't let the race question read as biology: the callout says it reflects care and conditions.
- **Minors:** users under 18 get a short path to care and trusted adults, with no detailed scoring.
- **Data and legal exposure:** pregnancy and loss data can carry legal risk in some jurisdictions, which is why the default is no storage (see Architecture).
- **LLM safety:** fixed system prompt, rule-based urgent-symptom detection outside the model, deterministic scoring, and logs of nothing beyond aggregate counts.

## Roadmap

Today ships a 2-hour, solo-buildable demo: Claude-led chat intake, 14 scored factors with why-we-ask callouts, WHO country baselines, and one result screen.

### Hackathon demo — 2-hour build plan

| Time | Build | Done when |
| --- | --- | --- |
| 0:00–0:20 | Python script → `model.json`: UN IGME rates (OWID CSV), WHO GHO prevalences, WHO city PM2.5, plus a small CDC table of US subgroup rates for the proof-of-concept check. If an API is slow, hardcode 8 demo countries. | JSON loads with baselines + PM2.5 for demo countries |
| 0:20–0:45 | `score(answers, model)` in TypeScript + factor content (badge, why, how-used) for 14 factors | Unit tests pass for 3 personas |
| 0:45–1:25 | Next.js chat page: Claude with a `record_answer` tool over the factor schema; answer chips; callout card under each question; urgent-symptom rule check on every message | A full intake completes and returns a filled schema |
| 1:25–1:50 | Result screen: estimate vs country baseline, 1,000-dot icon array, ranked contributions with badges, "what you can do," warning-signs banner; Claude explains the result object | Both demo personas render correctly |
| 1:50–2:00 | Add the CDC predicted-vs-observed scatter to the pitch; rehearse demo with 2 personas: first pregnancy in Delhi (high PM2.5, high baseline); US user with a prior stillbirth who shares race and sees the callout | 2-minute run-through works twice |

**Demo factor set (14 scored):** age, BMI (height + weight), parity, prior stillbirth, multiple pregnancy, pre-existing diabetes, gestational diabetes, hypertension/preeclampsia, told baby is small, smoking, second-hand smoke, alcohol, country + city (baseline + PM2.5), prenatal care. Plus race/ethnicity (optional, US baseline only) and physical activity (context only).

**Cut if behind:** Monte-Carlo ranges (show a fixed ±20% band instead), what-if sliders, PDF export, the centering step (use raw country rate and label it).

### Later

| Phase | Scope |
| --- | --- |
| v1 (1–2 months) | Clinician advisor sign-off; verified ORs; Monte-Carlo ranges; what-if sliders; PDF/share for provider; Spanish + Hindi; gestational-week baselines |
| v2 (3–6 months) | Trained model on NVSS + one LMIC cohort, calibrated per country to UN IGME; LMIC factors (facility birth, anemia, malaria, syphilis/HIV screening); WhatsApp channel; clinician view |
| v3 | Partnerships with health ministries / NGOs for community health worker use; prospective validation study |

## Built in the demo (Nov 6)

The demo build added three things beyond the original plan: Claude inside the result screen, on-device memory across visits, and a confidence rating for every estimate.

**Product flow (v0.3): one conversation.** The app opens straight into a chat with Claude. Claude asks a stage-aware core set of about 12 questions, then a deterministic rule decides:

| Decision | When | What the user sees |
| --- | --- | --- |
| Estimate | Core answered and confidence ≥ 50/100 | Number vs country average, confidence, biggest factors, full breakdown, next check-in date |
| Check in later | 3+ core questions skipped, confidence < 50, or stage unknown | No number; why not; dated check-ins (20-wk scan, 24–28 wk glucose test, 32–36 wk) with what to bring; calendar export; option to answer more now |
| Check in later + see provider soon | As above, but strong risk factors present (≥ 2 high-importance factors or ≥ 3× average) | Same, plus a prominent "talk to your provider this week, don't wait" with the factors named |
| Planning | Not pregnant yet | Changeable factors; check in once pregnant |

Claude explains whichever decision was made, keeps the conversation going, and re-runs the decision when the user shares new information. Returning users are re-asked their stage, so the questions for their new milestone come up automatically.

| Feature | What it does | Where |
| --- | --- | --- |
| Conversational intake | Claude asks each question, records answers through tool calls, and a why-we-ask card sits under every question. Guided mode runs without an API key. | `/api/chat`, `components/Chat.tsx` |
| Talk it through | Claude chat on the result screen. It explains the result, answers questions, and calls `update_answers` when something changes (e.g., a new diagnosis), so the estimate recalculates live. | `/api/ask`, `components/AskChat.tsx` |
| Learns over time (opt-in) | "Remember me on this device" saves answers, past estimates and Claude's notes in the browser only. Returning users get a welcome back, update rather than restart, and see how their estimate changed. | `lib/memory.ts` |
| Confidence in the estimate | 0–100 score with High / Moderate / Low, reasons, and what would make it more precise. It drops for an approximate starting rate, skipped or don't-know answers, unverified effect sizes, hitting the cap, and effect sizes from very different countries. | `lib/score.ts` |
| Test dataset | 14 personas across 9 countries; the runner writes input CSV, results CSV and a readable HTML report. | `data/personas.json`, `npm run personas` |

**Learning across users is deliberately not built.** Improving the model from everyone's answers needs explicit consent, a server-side store, and a privacy and legal review (see Architecture). It is a v2 item.

## University of Utah research: what we added and what's next

The University of Utah runs the [Stillbirth Research Program](https://medicine.utah.edu/obgyn/research/stillbirth) and the US's only Stillbirth Center of Excellence, with up to 20 active studies at a time. It led the NICHD Stillbirth Collaborative Research Network (SCRN). Its work shows four factors StillSafe had missed, all now added as questions with why-we-ask cards.

| Factor added | Utah / SCRN evidence | How StillSafe uses it |
| --- | --- | --- |
| Major stress in the past year | Women with stress in all four areas (financial, emotional, traumatic, partner) had aOR 2.22; 3+ areas carried at least a 50% increase ([Hogue 2013, SCRN](https://researchexperts.utmb.edu/en/publications/a-population-based-case-control-study-of-stillbirth-the-relations/)) | Optional; 0 / 1–2 / 3 / 4 areas; triggers support resources |
| Stillbirth in the family | Relatives of affected parents had 1.14–1.22× odds, with risk passed through both the mother's and the father's side ([Workalemahu 2022, BJOG](https://essopenarchive.org/doi/full/10.22541/au.164528537.77215283/v1)) | Optional; small adjustment; suggests asking about genetic counselling |
| Earlier pregnancy losses (< 20 weeks) | Prior loss was among the start-of-pregnancy factors linked to stillbirth ([SCRN, JAMA 2011](https://www.eurekalert.org/news-releases/767241)) | 0 / 1–2 / 3+; 3+ suggests recurrent-loss testing |
| Drug use | History of drug use with addiction was associated with stillbirth ([SCRN](https://livescience.com/17458-stillbirth-mysteries-revealed-studies.html)) | Optional and private; links to confidential support |

**A key caution from SCRN, now built into the confidence rating:** factors known at the start of pregnancy explain only a small part of stillbirth risk. The tool therefore keeps pointing users to later-pregnancy checks: growth, blood pressure and fetal movements.

**Next from Utah's work (not in the demo):**

- **Referral pathways:** for users with a prior stillbirth or 2+ losses, link to specialist pregnancy-after-loss care and research studies (e.g., Utah's TRIO genetic study, stillbirth database and tissue bank).
- **AIAN and NHPI communities:** Utah's NICHD "Road to Prevention of Stillbirth" center partners with the University of Hawai'i and Navajo Nation; StillSafe's AIAN/NHPI baselines are estimated, so partner data would improve them.
- **Preventable stillbirth:** SCRN estimated about a quarter of US stillbirths are potentially preventable, often linked to hypertension and medical complications. Add stronger prompts for blood-pressure monitoring.
- **Genetics and placenta:** inherited risk loci, maternal long QT syndrome, and placental findings visible on ultrasound are research-stage. Track them for future clinician-facing features rather than self-report.

## Open questions

- [ ] Verify the "approx." odds ratios (age bands, diabetes, hypertension, ART, sleep position) against full papers before anything beyond the demo.
- [ ] Race/ethnicity outside the US: are there usable group-specific baselines (e.g., UK MBRRACE), or is the question US-only?
- [ ] Which LMIC-specific factors matter most for v2, and is there individual-level data to estimate them?
- [ ] Whole-pregnancy risk vs. "risk from this week onward": which is more useful at 30+ weeks?
- [ ] Twins and higher multiples: separate baseline or out of scope?
- [ ] Who is the clinical advisor, and which stillbirth charity reviews the copy?
- [ ] Claude API data handling for production (zero data retention, regional processing).
- [ ] Which first market for a real launch, given device regulation?

## Sources

- [Flenady et al. 2011, Lancet — Major risk factors for stillbirth in high-income countries](https://pubmed.ncbi.nlm.nih.gov/21496916/)
- [Lamont et al. 2015, BMJ — Risk of recurrent stillbirth](https://www.pubmed.gov/26109551/)
- [Lamont et al. — Recurrence risk of unexplained stillbirth](https://abdn.elsevierpure.com/en/publications/recurrence-risk-of-unexplained-stillbirth-a-systematic-review-and/)
- [CRIBSS individual-participant meta-analysis, risk-factor table](https://pmc.ncbi.nlm.nih.gov/articles/PMC6543252/table/t0010)
- [Risk factors for late preterm and term stillbirth: IPD secondary analysis](https://searchworks.jioinstitute.edu.in/articles/edb__164879588)
- [Escañuela Sánchez et al. 2019 — Modifiable risk factors for stillbirth](https://ucc.ie/en/pregnancyloss/publications/20191201-modifiable-risk-factors.html) and [full review](https://cora.ucc.ie/bitstream/10468/8796/1/11138.pdf)
- [Kesmodel et al. 2002 — Moderate alcohol intake and stillbirth](https://manuscript.isc.ac/Inventory/10/262.htm)
- [Safe Passage Study — drinking and smoking and stillbirth](https://www.2minutemedicine.com/?p=25185)
- [Zhang et al. 2021 — Ambient air pollution and stillbirth meta-analysis](https://www.aminer.org/pub/604b4252ec47cda532dcec0c/ambient-air-pollution-and-stillbirth-an-updated-systematic-review-and-meta-analysis)
- [Xue et al. 2022, Nature Communications — PM2.5 and global stillbirth burden](https://www.nature.com/articles/s41467-022-34250-4.pdf)
- [CDC — Fetal Mortality in the United States, final 2022–2023 and provisional 2024](https://www.cdc.gov/nchs/data/vsrr/vsrr041.pdf)
- [CDC — Perinatal Mortality in the United States, 2022 and 2023](https://cdc.gov/nchs/products/databriefs/db530.htm)
- [UN IGME stillbirth database and estimates](https://pmnch.who.int/resources/publications/m/item/unigme-stillbirth-database-and-estimates)
- [Our World in Data — Stillbirth rate (UN IGME 2025)](https://ourworldindata.org/grapher/stillbirth-rate)
- [World Bank — First UN report on global stillbirths](https://blogs.worldbank.org/opendata/first-ever-un-report-global-stillbirths-reveals-enormous-and-neglected-toll)
- [WHO Ambient Air Quality Database](https://www.who.int/data/gho/data/themes/air-pollution/who-air-quality-database)
