# Risk factors and effect sizes used in StillSafe (model 0.2.0-demo)

Generated from `project/stillsafe/data/model.json`. **approx = yes** means the value is a placeholder chosen from the literature range and must be verified against the full paper before any real-world use.

| Factor | Answer → odds ratio | Importance | approx | Source |
| --- | --- | --- | --- | --- |
| Age | Under 20 → 1.3; 20–34 → 1.0; 35–39 → 1.4; 40+ → 1.9 | Medium | yes | [Flenady et al. 2011, Lancet; CDC NVSR 2024 age table](https://pubmed.ncbi.nlm.nih.gov/21496916/) |
| Height | (input to BMI) | Medium | no | [Flenady et al. 2011, Lancet](https://pubmed.ncbi.nlm.nih.gov/21496916/) |
| Pre-pregnancy weight | (input to BMI) | Medium | no | [CRIBSS IPD meta-analysis (aOR 1.03 per BMI unit)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6543252/table/t0010) |
| BMI (from height and weight) | Under 18.5 → 1.1; 18.5–24.9 → 1.0; 25–29.9 → 1.2; 30–34.9 → 1.5; 35+ → 1.9 | Medium | yes | [Flenady et al. 2011; CRIBSS IPD](https://pmc.ncbi.nlm.nih.gov/articles/PMC6543252/table/t0010) |
| Country | sets baseline | High | yes | [UN IGME stillbirth estimates (UNICEF, WHO, World Bank, UN)](https://pmnch.who.int/resources/publications/m/item/unigme-stillbirth-database-and-estimates) |
| City | PM2.5 OR 1.10 per 10 µg/m³ vs country mean, capped ±30 | Low | yes | [WHO Ambient Air Quality Database; Zhang et al. 2021](https://www.who.int/data/gho/data/themes/air-pollution/who-air-quality-database) |
| Race / ethnicity (US only, optional) | Black → –; White → –; Hispanic / Latina → –; Asian → –; Native Hawaiian / Pacific Islander → –; American Indian / Alaska Native → –; Prefer not to say → – | Medium | no | [CDC, Fetal Mortality: United States 2024 (NVSR 75-6)](https://www.cdc.gov/nchs/data/nvsr/nvsr75/nvsr75-06.pdf) |
| Twins or more | One baby → 1.0; Twins or more → 2.2 | High | no | [CDC NVSR 2024: twin 11.45 vs single 5.24 per 1,000](https://www.cdc.gov/nchs/data/nvsr/nvsr75/nvsr75-06.pdf) |
| Previous births | None — this is my first → 1.2; 1–2 → 1.0; 3 or more → 1.2 | Low | yes | [Flenady et al. 2011 (primiparity ~15% of stillbirths)](https://pubmed.ncbi.nlm.nih.gov/21496916/) |
| Previous stillbirth | No → 1.0; Yes — a cause was found → 3.38; Yes — no cause found / not sure → 1.83 | High | no | [Lamont et al. 2015, BMJ (pooled aOR 3.38)](https://www.pubmed.gov/26109551/) |
| Past pregnancy complications | No / not applicable → 1.0; Yes → 1.6 | Medium | yes | [Systematic review: risk after previous adverse birth outcomes](https://core.ac.uk/download/195684613.pdf) |
| Earlier pregnancy losses | None → 1.0; 1–2 → 1.1; 3 or more → 1.4 | Low | yes | [SCRN Writing Group 2011, JAMA (risk factors at the start of pregnancy)](https://www.eurekalert.org/news-releases/767241) |
| Stillbirth in the family | No → 1.0; Yes → 1.15; Not sure → 1.0 | Low | no | [Workalemahu et al. 2022, BJOG (Utah Population Database)](https://essopenarchive.org/doi/full/10.22541/au.164528537.77215283/v1) |
| Diabetes before pregnancy | No → 1.0; Yes → 2.5 | High | yes | [Flenady et al. 2011, Lancet](https://pubmed.ncbi.nlm.nih.gov/21496916/) |
| Gestational diabetes | No → 1.0; Yes → 1.1; Not tested yet → 1.0 | Low | yes | [Flenady et al. 2011, Lancet](https://pubmed.ncbi.nlm.nih.gov/21496916/) |
| High blood pressure / preeclampsia | No → 1.0; Yes → 1.8 | Medium | yes | [Flenady et al. 2011, Lancet](https://pubmed.ncbi.nlm.nih.gov/21496916/) |
| Baby measuring small | No → 1.0; Yes → 3.0; Don't know → 1.0 | High | yes | [Flenady et al. 2011 (SGA ~23% of stillbirths)](https://pubmed.ncbi.nlm.nih.gov/21496916/) |
| Prenatal care | Yes, on schedule → 1.0; Some missed → 1.3; Not yet / none → 2.0 | Medium | yes | [IPD secondary analysis (antenatal-care utilisation)](https://searchworks.jioinstitute.edu.in/articles/edb__164879588) |
| Smoking | Never / quit before pregnancy → 1.0; Quit in the first 3 months → 1.1; Still smoking → 1.62; Still smoking, 10+ a day → 2.0 | Medium | no | [CRIBSS IPD: aOR 1.62 for smoking beyond first trimester](https://pmc.ncbi.nlm.nih.gov/articles/PMC6543252/table/t0010) |
| Second-hand smoke | No → 1.0; Yes → 1.22 | Low | no | [Escañuela Sánchez et al. 2019 review (OR 1.22)](https://cora.ucc.ie/bitstream/10468/8796/1/11138.pdf) |
| Alcohol | None → 1.0; Less than 1 → 1.0; 1–4 → 1.4; 5 or more → 2.96 | High | yes | [Kesmodel et al. 2002 (RR 2.96 for 5+ drinks/week)](https://manuscript.isc.ac/Inventory/10/262.htm) |
| Drug use | No → 1.0; Yes → 2.0; Prefer not to say → 1.0 | High | yes | [SCRN Writing Group 2011, JAMA; Escañuela Sánchez et al. 2019](https://livescience.com/17458-stillbirth-mysteries-revealed-studies.html) |
| Major stress this year | None → 1.0; 1–2 areas → 1.2; 3 areas → 1.5; All 4 → 2.22; Prefer not to say → 1.0 | Medium | no | [Hogue et al. 2013, Am J Epidemiol (SCRN; aOR 2.22 for all 4)](https://researchexperts.utmb.edu/en/publications/a-population-based-case-control-study-of-stillbirth-the-relations/) |
| Physical activity | 0 days → –; 1–2 days → –; 3+ days → – | Context only | no | [No pooled stillbirth estimate found](https://ucc.ie/en/pregnancyloss/publications/20191201-modifiable-risk-factors.html) |

## Model mechanics

- Baseline p0: UN IGME country stillbirth rate (28+ wks, per 1,000 total births). US: CDC 2024 late fetal rate 2.57; race-specific when shared (Black 4.34, White 2.23, Hispanic 2.22, Asian 1.72, NHPI 4.82*, AIAN 3.67*; *estimated = total × 2.57/5.44).
- Re-centering: logit(p_ref) = logit(p0) − Σ β_k·π_k using country prevalence of smoking, BMI bands, (US only) age bands and twins.
- Personal: logit(p) = logit(p_ref) + Σ β_i; downstream factors shrunk ×0.7 when upstream present (BMI→diabetes/HTN; smoking→small baby); combined log-OR capped at ln(6), scaled proportionally when capped.
- Range (demo): betas ×0.6/×1.4 plus ±25% (approx baseline) or ±10% baseline uncertainty.
- Confidence 0–100: −15 approx baseline; −5 per skipped core question (max −40); −3 per don't-know; −(share of adjustment from approx ORs × magnitude × 20); −15 if capped; −10 if country rate > 8/1,000 (transportability); −10 if < 20 weeks; −5 if ≥4 optional questions unanswered. High ≥75, Moderate 50–74, Low <50.
- Decision (`decide()`): planning if not pregnant; check-in if >2 core skipped OR confidence <50 OR weeks unknown; else score. `elevated` = ratio ≥3 or ≥2 High-importance factors with OR ≥1.8 → "see provider soon" on check-in cards.

## Country values

Non-US country rates, prevalences and PM2.5 in model.json are APPROXIMATE demo placeholders (`approxRate: true`). `scripts/build_model.py` fetches real UN IGME (via Our World in Data CSV) and WHO GHO values; it could not be run from the build environment (network allowlist).