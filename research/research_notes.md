# StillSafe research notes (session of Nov 6, 2026)

Findings gathered while building StillSafe, with sources. Effect sizes used in the model are in `factors_and_effect_sizes.md`. CDC numbers are in `cdc_2024_fetal_mortality.csv`.

## 1. Burden and baselines

- **Global:** UN IGME (UNICEF, WHO, World Bank, UN Population Division) estimates about 1.9–2.0M stillbirths per year at 28+ weeks, a global rate of 13.9 per 1,000 total births. National rates range from 1.5 to 32, and the highest burden is in sub-Saharan Africa and South Asia. [World Bank blog](https://blogs.worldbank.org/opendata/first-ever-un-report-global-stillbirths-reveals-enormous-and-neglected-toll) · [UN IGME database](https://pmnch.who.int/resources/publications/m/item/unigme-stillbirth-database-and-estimates) · [OWID CSV](https://ourworldindata.org/grapher/stillbirth-rate)
- **Definition matters:** WHO / UN IGME counts stillbirths at **28+ weeks**; the US CDC counts **20+ weeks**. One IHME study put the 2021 global rate at 23 per 1,000 at 20+ weeks vs 16 at 28+. StillSafe uses 28+ weeks throughout, except in the CDC check. [IHME](https://www.healthdata.org/node/12183)
- **India:** an India state-level study gives 25.9 per 1,000 (22+ wks) and 16.1 (28+ wks) for 2023, varying from 9.3 (Mizoram) to 38.2 (Uttar Pradesh). NFHS survey data suggests about 11.7 at 28+ weeks for 2019–21. The UN IGME value still needs pulling. [Omnicuris summary](https://www.omnicuris.com/medshots/daily_updates/stillbirth-rates-in-india-lancet-analysis-2023_29-Jul-26_19-09) · [DownToEarth](https://www.downtoearth.org.in/health/new-study-reveals-undercounting-of-stillbirths-in-india)
- **US:** 20,005 fetal deaths in 2023 (5.53 per 1,000) and 19,756 provisional in 2024 (5.44). The 2024 late (28+ wk) rate was 2.57. Black and NHPI rates are about 10 per 1,000, roughly double White, Hispanic or Asian. [CDC NVSR 75-6](https://www.cdc.gov/nchs/data/nvsr/nvsr75/nvsr75-06.pdf) · [CDC VSRR 41](https://www.cdc.gov/nchs/data/vsrr/vsrr041.pdf)

## 2. Core risk-factor evidence

- [Flenady et al. 2011, Lancet](https://pubmed.ncbi.nlm.nih.gov/21496916/) (96 population studies, high-income countries): BMI > 25 is the top modifiable factor (attributable share 8–18%); age > 35 accounts for 7–11% and smoking for 4–7% (up to 20% in disadvantaged groups). First pregnancy accounts for about 15%. Small for gestational age (23%) and placental abruption (15%) have the highest attributable shares. Pre-existing diabetes and hypertension are important.
- [Lamont et al. 2015, BMJ](https://www.pubmed.gov/26109551/): prior stillbirth gives a pooled adjusted OR of 3.38 (2.61–4.38); 2.5% vs 0.4% recurrence. For a prior *unexplained* stillbirth, the adjusted OR is 1.83 ([abstract](https://abdn.elsevierpure.com/en/publications/recurrence-risk-of-unexplained-stillbirth-a-systematic-review-and/)).
- [CRIBSS IPD meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC6543252/table/t0010): smoking beyond the first trimester, adjusted OR 1.62; BMI, adjusted OR 1.03 per unit.
- [IPD secondary analysis, late stillbirth](https://searchworks.jioinstitute.edu.in/articles/edb__164879588): decreased fetal movement raises risk; poor antenatal care raises risk and more-than-adequate care protects. Model AUC 0.84.
- [Escañuela Sánchez 2019 review](https://cora.ucc.ie/bitstream/10468/8796/1/11138.pdf): second-hand smoke OR 1.22; smoking +36% to +47% odds; illicit drug use has a high impact.
- [Kesmodel 2002](https://manuscript.isc.ac/Inventory/10/262.htm): 5+ drinks/week gives RR 2.96. [Safe Passage](https://www.2minutemedicine.com/?p=25185): drinking plus smoking after the first trimester gives 2.78× late stillbirth.
- **Air pollution:** PM2.5 over the whole pregnancy gives OR 1.10 per 10 µg/m³ ([Zhang 2021](https://www.aminer.org/pub/604b4252ec47cda532dcec0c/ambient-air-pollution-and-stillbirth-an-updated-systematic-review-and-meta-analysis)), or +11% per 10 µg/m³, modified by maternal age ([Xue 2022, Nat Commun](https://www.nature.com/articles/s41467-022-34250-4.pdf)).
- **Physical activity:** no pooled stillbirth estimate was found, so the tool collects it as context only.

## 3. University of Utah Stillbirth Research Program (and the NICHD SCRN network)

- The program runs the US's only Stillbirth Center of Excellence, with up to 20 active studies at a time, including the TRIO genetic study (2+ losses), a stillbirth database and tissue bank, and a Pregnancy After Loss Program. [Program](https://medicine.utah.edu/obgyn/research/stillbirth) · [Studies](https://medicine.utah.edu/obgyn/research/stillbirth/research-studies) · [Center](https://healthcare.utah.edu/womens-health/pregnancy-birth/stillbirth)
- **SCRN (JAMA 2011):** factors known at the start of pregnancy (Black race, prior stillbirth, nulliparity, prior loss, diabetes, age, marital status, BMI, drug addiction) explain only a small share of risk. "It is extremely difficult to predict stillbirth risk based on risk factors that can be identified at the start of a pregnancy" (Silver). This is built into the confidence reasons. [EurekAlert](https://www.eurekalert.org/news-releases/767241)
- **Stress (Hogue 2013, Am J Epidemiol):** major life events in all four areas (financial, emotional, traumatic, partner) give an adjusted OR of 2.22 (1.43–3.46); 3+ areas give at least a 50% increase. 21% of women, and 32% of non-Hispanic Black women, report 3+ areas. **Added** as an optional question. [Abstract](https://researchexperts.utmb.edu/en/publications/a-population-based-case-control-study-of-stillbirth-the-relations/)
- **Family history (Workalemahu 2022, BJOG; Utah Population Database):** relatives of affected parents have 1.14–1.22× odds, through both the mother's and the father's side. **Added** (OR 1.15). [Preprint](https://essopenarchive.org/doi/full/10.22541/au.164528537.77215283/v1)
- **Earlier pregnancy loss and drug addiction:** SCRN risk factors. **Added** (ORs approximate).
- **Next steps from this research:**
  - referral pathways (pregnancy-after-loss care, TRIO study)
  - AIAN and NHPI data via Utah's NICHD "Road to Prevention" center (partners: University of Hawai'i, Navajo Nation)
  - potentially preventable stillbirths: about 25% in SCRN, often linked to hypertension
  - genetics and placental findings for future clinician-facing features

## 4. Data-source decision: WHO vs CDC

| | WHO / UN IGME | CDC NVSS |
| --- | --- | --- |
| Coverage | 195 countries | US only |
| Definition | 28+ wks | 20+ wks (late 28+ also reported) |
| Individual records | No (country estimates) | Yes (fetal death + natality files) |
| Geography in public files | n/a | Removed since 2005 (restricted access) |
| Gaps | Modelled uncertainty | Alcohol and second-hand smoke not recorded; under-reporting |

**Decision (user-approved):** WHO / UN IGME supplies country starting rates. CDC data is the **proof of concept**: in US mode, predicted vs observed rates for 13 groups are all within ±25% (see `/cdc` page). The **v2** plan is to train on NVSS individual records, then recalibrate to each country's UN IGME rate. Quick sources: CDC WONDER "Fetal Deaths (Expanded) 2014–2024" (counts, including pre-pregnancy BMI) plus WONDER Natality for denominators; the annual NVSR "Fetal Mortality" report gives ready-made rates by age, race, tobacco and plurality.

## 5. Regulatory and privacy notes (not legal advice)

- Patient-facing individual risk software may be a medical device (FDA, EU MDR, India CDSCO, UK MHRA), so it needs a regulatory opinion before real launch.
- Health and reproductive data are sensitive: consider the FTC Health Breach Notification Rule and state laws (e.g., WA My Health My Data, CA CMIA). The design defaults to no server storage.
- Claude API: chat messages leave the device (disclosed at consent). For production, consider zero data retention.
