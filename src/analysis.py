"""
analysis.py
-----------
Deep statistical analysis of CMPI divergence patterns — adapted for 2024 daily data.

Key changes from 2021-2022 hourly version:
  - Diurnal (hour-of-day) analysis removed: daily averages have no time-of-day signal
  - Seasonal pattern replaces diurnal as temporal structure
  - DANA event analysis added as a new findings category
  - Calima vs DANA comparison is the new headline scientific contribution
  - 'station-days' replaces 'station-hours' in provenance

Data flow:
  strata_processed.csv → run_analysis() → findings.json → inject_findings.py → HTML

Usage:
  python src/analysis.py
  (also called automatically by run_pipeline.py)
"""

import pandas as pd
import numpy as np
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from config import OUTPUT_PATH

PIPELINE_VERSION = "2.0.0"  # major bump: new dataset, new resolution, new DANA analysis


def run_analysis(df: pd.DataFrame, verbose: bool = True) -> dict:
    """
    Run full divergence analysis on 2024 daily data.
    Returns findings dict — the single source of truth for portfolio values.
    """
    findings = {}

    if verbose:
        print("\n── Strata Deep Analysis (2024 Daily) ───────────────")

    df = df.copy()
    df["datetime"] = pd.to_datetime(df["datetime"])
    df["month"]    = df["datetime"].dt.month
    df["month_name"] = df["datetime"].dt.strftime("%b")
    df["date"]     = df["datetime"].dt.date
    df["season"]   = df["month"].map({
        12: "Winter", 1: "Winter", 2: "Winter",
        3: "Spring",  4: "Spring", 5: "Spring",
        6: "Summer",  7: "Summer", 8: "Summer",
        9: "Autumn", 10: "Autumn", 11: "Autumn",
    })

    aqi_pub_col = "aqi_public" if "aqi_public" in df.columns else "aqi_pub"

    # ── Provenance metadata ───────────────────────────────────────────────────
    findings["provenance"] = {
        "generated_at":     datetime.now().strftime("%Y-%m-%d %H:%M UTC"),
        "pipeline_version": PIPELINE_VERSION,
        "dataset":          "Mediciones diarias de contaminantes atmosféricos y ozono · Comunitat Valenciana 2024",
        "source":           "Generalitat Valenciana · dadesobertes.gva.es · CC BY 4.0",
        "licence":          "CC BY 4.0",
        "resolution":       "Daily averages (one row per station per day)",
        "valid_rows":       int(len(df)),
        "n_stations":       int(df["station"].nunique()),
        "date_range_start": str(df["datetime"].min().date()),
        "date_range_end":   str(df["datetime"].max().date()),
        "note": (
            "All scientific values in the portfolio frontend are derived "
            "from this findings export. No values are manually hardcoded. "
            "Data are daily averages — diurnal (hour-of-day) analysis is "
            "not applicable at this resolution."
        ),
    }

    # ── Overall summary ───────────────────────────────────────────────────────
    div = df["aqi_divergence"].dropna()
    calima_n = int(df["calima_event"].sum()) if "calima_event" in df.columns else 0
    dana_n   = int(df["dana_event"].sum())   if "dana_event"   in df.columns else 0

    findings["summary"] = {
        "n_obs":             int(len(df)),
        "n_stations":        int(df["station"].nunique()),
        "mean_divergence":   round(float(div.mean()), 4),
        "std_divergence":    round(float(div.std()), 4),
        "median_divergence": round(float(div.median()), 4),
        "max_divergence":    round(float(div.max()), 4),
        "min_divergence":    round(float(div.min()), 4),
        "p25_divergence":    round(float(div.quantile(0.25)), 4),
        "p75_divergence":    round(float(div.quantile(0.75)), 4),
        "pct_over_20":       round(float((div > 20).mean() * 100), 4),
        "pct_over_10":       round(float((div > 10).mean() * 100), 4),
        "calima_days":       calima_n,
        "dana_days":         dana_n,
        "mean_aci":          round(float(df["ACI_normalized"].mean()), 4),
        "std_aci":           round(float(df["ACI_normalized"].std()), 4),
        "mean_cmpi":         round(float(df["aqi_scientific"].mean()), 4),
        "mean_public":       round(float(df[aqi_pub_col].mean()), 4),
    }

    if verbose:
        s = findings["summary"]
        print(f"\n[Summary]")
        print(f"  Observations    : {s['n_obs']:,} station-days")
        print(f"  Mean divergence : {s['mean_divergence']:.4f} ± {s['std_divergence']:.4f}")
        print(f"  Max divergence  : {s['max_divergence']:.4f}")
        print(f"  Calima days     : {s['calima_days']:,}")
        print(f"  DANA days       : {s['dana_days']:,}")
        print(f"  Mean ACI        : {s['mean_aci']:.4f}")

    # ── Seasonal pattern (replaces diurnal for daily data) ────────────────────
    season_order = ["Winter", "Spring", "Summer", "Autumn"]
    seasonal = df.groupby("season").agg(
        aqi_divergence     =("aqi_divergence", "mean"),
        aqi_divergence_std =("aqi_divergence", "std"),
        pm10               =("pm10",           "mean"),
        pm25               =("pm25",           "mean"),
        no2                =("no2",            "mean"),
        o3                 =("o3",             "mean"),
        n                  =("aqi_divergence", "count"),
    ).round(4).reset_index()

    # Reorder to calendar season order
    seasonal["_order"] = seasonal["season"].map({s: i for i, s in enumerate(season_order)})
    seasonal = seasonal.sort_values("_order").drop(columns="_order")

    peak_season = seasonal.loc[seasonal["aqi_divergence"].idxmax(), "season"]
    min_season  = seasonal.loc[seasonal["aqi_divergence"].idxmin(), "season"]

    findings["seasonal"] = {
        "seasons":          seasonal.to_dict("records"),
        "peak_season":      peak_season,
        "min_season":       min_season,
        "peak_divergence":  round(float(seasonal["aqi_divergence"].max()), 4),
        "min_divergence":   round(float(seasonal["aqi_divergence"].min()), 4),
        "seasonal_swing":   round(float(seasonal["aqi_divergence"].max() - seasonal["aqi_divergence"].min()), 4),
        "divergence_by_season": {
            row["season"]: round(float(row["aqi_divergence"]), 4)
            for _, row in seasonal.iterrows()
        },
        "note": "Daily resolution — diurnal hour-of-day analysis not applicable.",
    }

    if verbose:
        print(f"\n[Seasonal divergence]")
        for _, row in seasonal.iterrows():
            print(f"  {row['season']:<8}: {row['aqi_divergence']:.4f} ± {row['aqi_divergence_std']:.4f}  (n={row['n']:,})")
        print(f"  Peak season: {peak_season} | Min season: {min_season}")

    # ── Monthly time series ───────────────────────────────────────────────────
    monthly = df.groupby("month").agg(
        aqi_divergence =("aqi_divergence", "mean"),
        pm10           =("pm10",           "mean"),
        pm25           =("pm25",           "mean"),
        no2            =("no2",            "mean"),
        o3             =("o3",             "mean"),
        calima         =("calima_event",   "sum") if "calima_event" in df.columns else ("aqi_divergence", "count"),
        n              =("aqi_divergence", "count"),
    ).round(4).reset_index()
    monthly["month_name"] = pd.to_datetime(monthly["month"], format="%m").dt.strftime("%b")

    findings["monthly"] = monthly.to_dict("records")

    # ── Per-station aggregates ────────────────────────────────────────────────
    st_agg = df.groupby("station").agg(
        latitude        =("latitude",        "first"),
        longitude       =("longitude",       "first"),
        pm10_mean       =("pm10",            "mean"),
        pm10_max        =("pm10",            "max"),
        pm25_mean       =("pm25",            "mean"),
        pm25_max        =("pm25",            "max"),
        no2_mean        =("no2",             "mean"),
        no2_max         =("no2",             "max"),
        o3_mean         =("o3",              "mean"),
        o3_max          =("o3",              "max"),
        cmpi_mean       =("aqi_scientific",  "mean"),
        cmpi_max        =("aqi_scientific",  "max"),
        public_mean     =(aqi_pub_col,       "mean"),
        aqi_div_mean    =("aqi_divergence",  "mean"),
        aqi_div_max     =("aqi_divergence",  "max"),
        aqi_div_std     =("aqi_divergence",  "std"),
        calima_days     =("calima_event",    "sum") if "calima_event" in df.columns else ("aqi_divergence", "count"),
        dana_days       =("dana_event",      "sum") if "dana_event"   in df.columns else ("aqi_divergence", "count"),
        aci_mean        =("ACI_normalized",  "mean"),
        n_obs           =("aqi_divergence",  "count"),
    ).reset_index().round(4)

    for col in ["calima_days", "dana_days", "n_obs"]:
        if col in st_agg.columns:
            st_agg[col] = st_agg[col].astype(int)

    findings["stations"] = (
        st_agg.sort_values("aqi_div_mean", ascending=False)
        .to_dict("records")
    )

    if verbose:
        print(f"\n[Stations — ranked by mean divergence]")
        for r in findings["stations"]:
            print(f"  {r['station']:<26} "
                  f"div={r['aqi_div_mean']:.3f}  "
                  f"PM10={r['pm10_mean']:.1f}  "
                  f"NO2={r['no2_mean']:.1f}  "
                  f"calima={r.get('calima_days',0)}d  "
                  f"DANA={r.get('dana_days',0)}d")

    # ── Correlations ──────────────────────────────────────────────────────────
    pred_cols = ["no2", "temperature", "pm25", "ACI_normalized",
                 "pm10", "o3", "wind_speed", "humidity"]
    available = [c for c in pred_cols if c in df.columns]
    corr = (df[available + ["aqi_divergence"]]
            .corr()["aqi_divergence"]
            .drop("aqi_divergence")
            .sort_values(key=abs, ascending=False))

    findings["correlations"] = {
        col: round(float(val), 4) for col, val in corr.items()
    }

    if verbose:
        print(f"\n[Correlations with CMPI divergence]")
        for col, val in findings["correlations"].items():
            bar = "█" * int(abs(val) * 20)
            print(f"  {col:<22} {'+' if val >= 0 else ''}{val:.4f}  {bar}")

    # ── Air mass regime ───────────────────────────────────────────────────────
    am = df.groupby("air_mass_type").agg(
        mean_div  =("aqi_divergence", "mean"),
        std_div   =("aqi_divergence", "std"),
        mean_no2  =("no2",            "mean"),
        mean_wind =("wind_speed",     "mean") if "wind_speed" in df.columns else ("no2", "mean"),
        count     =("aqi_divergence", "count"),
        pct       =("aqi_divergence", "count"),
    ).reset_index()
    am["pct"] = (am["pct"] / len(df) * 100).round(2)
    am = am.round(4)

    findings["air_mass"] = am.to_dict("records")

    # ── Calima episode analysis ───────────────────────────────────────────────
    if "calima_event" in df.columns:
        cal  = df[df["calima_event"] == True]
        norm = df[df["calima_event"] == False]

        if len(cal) > 0:
            cal_over = (cal[aqi_pub_col] > cal["aqi_scientific"]).sum()
            cal_pct  = float(cal_over) / len(cal) * 100

            findings["calima"] = {
                "n_days":               int(len(cal)),
                "pct_of_valid_obs":     round(float(len(cal)) / len(df) * 100, 4),
                "pct_public_over":      round(cal_pct, 2),
                "over_read_definition": (
                    "Cases where public PM10-only index score exceeded "
                    "the CMPI score for the same station-day during a "
                    "confirmed calima event (dual-criterion: PM10 > 3-day "
                    "rolling mean + 1.5σ AND PM10/PM2.5 ratio > 3.0)"
                ),
                "mean_public_aqi":      round(float(cal[aqi_pub_col].mean()), 4),
                "mean_cmpi":            round(float(cal["aqi_scientific"].mean()), 4),
                "mean_divergence":      round(float(cal["aqi_divergence"].mean()), 4),
                "max_pm10_daily":       round(float(cal["pm10"].max()), 2),
                "mean_dust_ratio":      round(float((cal["pm10"] / (cal["pm25"] + 1e-6)).mean()), 4),
                "normal_divergence":    round(float(norm["aqi_divergence"].mean()), 4),
                "max_pm10_station":     df.loc[df["pm10"].idxmax(), "station"],
                "max_pm10_date":        str(df.loc[df["pm10"].idxmax(), "datetime"].date()),
            }
        else:
            findings["calima"] = {"n_days": 0}
    else:
        findings["calima"] = {"n_days": 0}

    # ── DANA episode analysis ─────────────────────────────────────────────────
    if "dana_event" in df.columns:
        dana     = df[df["dana_event"] == True]
        non_dana = df[df["dana_event"] == False]

        if len(dana) > 0:
            dana_over = (dana[aqi_pub_col] > dana["aqi_scientific"]).sum()
            dana_pct  = float(dana_over) / len(dana) * 100

            calima_div = findings["calima"].get("mean_divergence") if findings["calima"].get("n_days", 0) > 0 else None

            findings["dana"] = {
                "n_days":                int(len(dana)),
                "pct_of_valid_obs":      round(float(len(dana)) / len(df) * 100, 4),
                "pct_public_over":       round(dana_pct, 2),
                "mean_public_aqi":       round(float(dana[aqi_pub_col].mean()), 4),
                "mean_cmpi":             round(float(dana["aqi_scientific"].mean()), 4),
                "mean_divergence":       round(float(dana["aqi_divergence"].mean()), 4),
                "normal_divergence":     round(float(non_dana["aqi_divergence"].mean()), 4),
                "calima_divergence":     calima_div,
                "max_pm10_daily":        round(float(dana["pm10"].max()), 2),
                "mean_dust_ratio":       round(float((dana["pm10"] / (dana["pm25"] + 1e-6)).mean()), 4),
                "max_pm10_station":      dana.loc[dana["pm10"].idxmax(), "station"],
                "max_pm10_date":         str(dana.loc[dana["pm10"].idxmax(), "datetime"].date()),
                "event_window":          "2024-10-29 → 2024-12-15",
                "detection_note": (
                    "DANA events are flood-derived terrestrial dust resuspension "
                    "episodes. Detection criterion: PM10 spike + PM10/PM2.5 > 2.5 "
                    "within the Oct 29 – Dec 15 2024 window, not already classified "
                    "as calima (Saharan dust takes precedence)."
                ),
            }

            if verbose:
                d = findings["dana"]
                print(f"\n[DANA]")
                print(f"  Station-days    : {d['n_days']:,} ({d['pct_of_valid_obs']:.2f}%)")
                print(f"  Public > CMPI   : {d['pct_public_over']:.1f}% of DANA days")
                print(f"  Mean divergence : {d['mean_divergence']:.4f} (vs non-event: {d['normal_divergence']:.4f})")
                if calima_div:
                    print(f"  vs Calima div   : {calima_div:.4f}")
                print(f"  Max daily PM10  : {d['max_pm10_daily']:.1f} µg/m³ at {d['max_pm10_station']}")
        else:
            findings["dana"] = {
                "n_days": 0,
                "note": "No DANA events detected — check Oct-Dec 2024 data coverage"
            }
    else:
        findings["dana"] = {"n_days": 0}

    # ── Daily aggregates (for time-series charts) ─────────────────────────────
    daily_cols = {
        "pm10":    ("pm10",            "mean"),
        "pm25":    ("pm25",            "mean"),
        "no2":     ("no2",             "mean"),
        "o3":      ("o3",              "mean"),
        "aqi_sci": ("aqi_scientific",  "mean"),
        "aqi_pub": (aqi_pub_col,       "mean"),
        "aqi_div": ("aqi_divergence",  "mean"),
        "n":       ("aqi_divergence",  "count"),
    }
    if "calima_event" in df.columns:
        daily_cols["calima"] = ("calima_event", "sum")
    if "dana_event" in df.columns:
        daily_cols["dana"] = ("dana_event", "sum")
    if "ACI_normalized" in df.columns:
        daily_cols["aci"] = ("ACI_normalized", "mean")

    daily = df.groupby("date").agg(**daily_cols).reset_index().round(4)
    daily["date"] = daily["date"].astype(str)

    findings["daily"] = daily.to_dict("records")

    # ── PM10 overall stats ────────────────────────────────────────────────────
    pm10_all = df["pm10"].dropna()
    findings["pm10_stats"] = {
        "mean":         round(float(pm10_all.mean()), 4),
        "max_daily":    round(float(pm10_all.max()), 2),
        "p95":          round(float(pm10_all.quantile(0.95)), 2),
        "p99":          round(float(pm10_all.quantile(0.99)), 2),
        "max_station":  df.loc[df["pm10"].idxmax(), "station"],
        "max_date":     str(df.loc[df["pm10"].idxmax(), "datetime"].date()),
        "who_limit_24h": 45,
        "days_exceeding_who": int((pm10_all > 45).sum()),
    }

    if verbose:
        pm = findings["pm10_stats"]
        print(f"\n[PM10]")
        print(f"  Max daily avg: {pm['max_daily']:.1f} µg/m³ "
              f"at {pm['max_station']} ({pm['max_date']})")
        print(f"  Days > WHO 45 µg/m³ guideline: {pm['days_exceeding_who']}")

    if verbose:
        print(f"\n✓ Analysis complete — {len(findings)} finding categories.")

    return findings


def save_findings(findings: dict, filename: str = "strata_findings.json") -> str:
    os.makedirs(os.path.join(OUTPUT_PATH, "reports"), exist_ok=True)
    path = os.path.join(OUTPUT_PATH, "reports", filename)
    with open(path, "w") as f:
        json.dump(findings, f, indent=2, default=str)
    print(f"  Findings saved → {path}")
    return path


def print_research_summary(findings: dict) -> None:
    print("\n" + "=" * 52)
    print("  Strata — Research Question Summary (2024)")
    print("=" * 52)
    s   = findings["summary"]
    sea = findings.get("seasonal", {})
    c   = findings.get("calima", {})
    dan = findings.get("dana", {})
    cr  = findings.get("correlations", {})
    pm  = findings.get("pm10_stats", {})
    prov = findings["provenance"]

    print(f"\n  Q: How accurately do public AQI representations")
    print(f"     reflect atmospheric conditions in Valencia?\n")
    print(f"  Dataset         : {prov.get('dataset','')}")
    print(f"  Observations    : {s['n_obs']:,} station-days")
    print(f"  Stations        : {s['n_stations']}")
    print(f"  Date range      : {prov['date_range_start']} → {prov['date_range_end']}")
    print(f"\n  Mean CMPI gap   : {s['mean_divergence']:.4f} index pts")
    print(f"  Max CMPI gap    : {s['max_divergence']:.4f} index pts")
    print(f"  Peak season     : {sea.get('peak_season','?')} (gap = {sea.get('peak_divergence','?')} pts)")
    print(f"  Min season      : {sea.get('min_season','?')} (gap = {sea.get('min_divergence','?')} pts)")
    top_corr = list(cr.items())[0] if cr else ("?", 0)
    print(f"  Primary correlate: {top_corr[0]} (r = {top_corr[1]})")
    print(f"  Calima days     : {c.get('n_days',0):,} ({c.get('pct_of_valid_obs',0):.2f}%)")
    if c.get("n_days", 0) > 0:
        print(f"  Calima div      : {c.get('mean_divergence','?'):.4f} pts mean")
        print(f"  Public > CMPI   : {c.get('pct_public_over','?'):.1f}% of calima days")
    print(f"  DANA days       : {dan.get('n_days',0):,}")
    if dan.get("n_days", 0) > 0:
        print(f"  DANA div        : {dan.get('mean_divergence','?'):.4f} pts mean")
        print(f"  DANA public>CMPI: {dan.get('pct_public_over','?'):.1f}% of DANA days")
    print(f"  Max daily PM10  : {pm.get('max_daily','?')} µg/m³ at {pm.get('max_station','?')}")
    print(f"  Mean ACI        : {s['mean_aci']:.4f}")
    print(f"\n  Generated: {prov['generated_at']}")
    print("=" * 52 + "\n")


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(__file__))
    processed_path = os.path.join(
        os.path.dirname(__file__), "../data/processed/strata_processed.csv"
    )
    if not os.path.exists(processed_path):
        print(f"No processed data at {processed_path}")
        print("Run: python src/run_pipeline.py --fetch")
        sys.exit(1)
    df = pd.read_csv(processed_path, parse_dates=["datetime"])
    findings = run_analysis(df, verbose=True)
    print_research_summary(findings)
    save_findings(findings)
