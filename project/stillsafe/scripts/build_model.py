"""Refresh country data in data/model.json from WHO / UN IGME sources.

Run on a machine with internet access:
    pip install pandas requests
    python scripts/build_model.py

What it does
- Stillbirth rate (28+ weeks, per 1,000 total births): UN IGME via Our World in Data (latest year per country).
- Women's prevalence of tobacco use and obesity: WHO Global Health Observatory (GHO) OData API.
- Country PM2.5 (population-weighted, SDG 11.6.2): WHO GHO.
City PM2.5 values come from the WHO Ambient Air Quality Database Excel file — download it from
https://www.who.int/data/gho/data/themes/air-pollution/who-air-quality-database and pass --aq path/to/file.xlsx.

Countries already in model.json are updated in place; values that can't be fetched are left as-is.
The US keeps CDC values (more precise than UN modelled estimates).
"""
import argparse, json, sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "data" / "model.json"
OWID = "https://ourworldindata.org/grapher/stillbirth-rate.csv?v=1&csvType=full&useColumnShortNames=true"
GHO = "https://ghoapi.azureedge.net/api/{code}?$filter=Dim1 eq 'SEX_FMLE'"
GHO_ALL = "https://ghoapi.azureedge.net/api/{code}"
# GHO indicator codes — verify at https://ghoapi.azureedge.net/api/Indicator if any return empty.
CODES = {
    "smoking": "M_Est_tob_curr_std",        # current tobacco use, age-standardized, % (filter female)
    "obesity": "NCD_BMI_30A",                # BMI >= 30, age-standardized, % (filter female)
    "overweight": "NCD_BMI_25A",             # BMI >= 25, age-standardized, % (filter female)
    "pm25": "SDGPM25",                       # annual mean PM2.5, population-weighted, total
}
HEADERS = {"User-Agent": "StillSafe data build/0.2"}


def latest_by_country(df, iso_col, val_col, year_col):
    df = df.dropna(subset=[val_col]).sort_values(year_col)
    return df.groupby(iso_col).tail(1).set_index(iso_col)[val_col].to_dict()


def gho(code, female=True):
    url = (GHO if female else GHO_ALL).format(code=code)
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    rows = r.json().get("value", [])
    df = pd.DataFrame(rows)
    if df.empty:
        return {}
    if not female and "Dim1" in df:
        df = df[df["Dim1"].isin(["RESIDENCEAREATYPE_TOTL", None]) | df["Dim1"].isna()]
    return latest_by_country(df, "SpatialDim", "NumericValue", "TimeDim")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aq", help="Path to WHO Ambient Air Quality Database .xlsx (optional)")
    args = ap.parse_args()
    model = json.loads(MODEL.read_text())

    print("Fetching UN IGME stillbirth rates…")
    sb = pd.read_csv(OWID, storage_options=HEADERS)
    val = [c for c in sb.columns if c not in ("entity", "code", "year", "Entity", "Code", "Year")][0]
    rates = latest_by_country(sb.rename(columns=str.lower), "code", val.lower(), "year")

    prev = {}
    for k, code in CODES.items():
        try:
            print(f"Fetching WHO GHO {code}…")
            prev[k] = gho(code, female=(k != "pm25"))
        except Exception as e:  # keep going; leave old values
            print(f"  could not fetch {code}: {e}", file=sys.stderr)
            prev[k] = {}

    for c in model["countries"]:
        iso = c["iso"]
        if iso != "USA" and iso in rates:
            c["sbr28"] = round(float(rates[iso]) * 10, 1)  # OWID gives per 100 → per 1,000
            c["approxRate"] = False
        if iso in prev.get("pm25", {}):
            c["pm25"] = round(float(prev["pm25"][iso]), 1)
        p = c.setdefault("prev", {})
        if iso != "USA":  # US uses pregnancy-specific CDC prevalences
            if iso in prev.get("smoking", {}):
                p["smoking"] = round(float(prev["smoking"][iso]) / 100, 3)
            ob = prev.get("obesity", {}).get(iso)
            ow = prev.get("overweight", {}).get(iso)
            if ob is not None:
                p["bmi_obese1"] = round(float(ob) / 100 * 0.6, 3)  # split obesity 60/40 into 30–34.9 / 35+
                p["bmi_obese2"] = round(float(ob) / 100 * 0.4, 3)
            if ow is not None and ob is not None:
                p["bmi_over"] = round((float(ow) - float(ob)) / 100, 3)

    if args.aq:
        print("Reading WHO Ambient Air Quality Database…")
        aq = pd.read_excel(args.aq, sheet_name=None)
        sheet = next(df for name, df in aq.items() if "pm25_concentration" in [str(x).lower() for x in df.columns])
        sheet.columns = [str(x).lower() for x in sheet.columns]
        sheet = sheet.dropna(subset=["pm25_concentration"]).sort_values("year")
        latest = sheet.groupby(["iso3", "city"]).tail(1)
        for c in model["countries"]:
            for city in c["cities"]:
                m = latest[(latest["iso3"] == c["iso"]) & latest["city"].str.contains(city["name"], case=False, na=False)]
                if len(m):
                    city["pm25"] = round(float(m.iloc[0]["pm25_concentration"]), 1)

    MODEL.write_text(json.dumps(model, indent=2, ensure_ascii=False))
    print(f"Updated {MODEL}")


if __name__ == "__main__":
    main()
