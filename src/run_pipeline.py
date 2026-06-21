"""
run_pipeline.py
---------------
Strata end-to-end pipeline — supports both 2021-2022 hourly and 2024 daily data.

Usage:
    python src/run_pipeline.py                  # auto-detect cached data
    python src/run_pipeline.py --fetch          # fetch fresh 2024 daily data
    python src/run_pipeline.py --synthetic      # force synthetic data
    python src/run_pipeline.py --from 2024-10-01 --to 2024-11-30  # DANA window
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(__file__))

import matplotlib
matplotlib.use("Agg")

from config import BASE_PATH, OUTPUT_PATH
from data_loader import load_air_quality
from preprocessing import standardize_datetime, remove_missing, standardize_columns
from aqi_model import compute_scientific_aqi, compute_public_aqi, compute_aqi_divergence
from events import detect_calima_events, detect_dana_events
from air_mass import classify_air_mass
from attribution import compute_attribution
from complexity import compute_aci
from spatial import create_station_map
from wind import plot_wind_vectors
from interpolation import interpolate_field
from reporting import generate_report, plot_aqi_comparison
from analysis import run_analysis, save_findings, print_research_summary
from inject_findings import inject as inject_portfolio


def run(use_synthetic: bool = False, fetch_fresh: bool = False,
        date_from: str = None, date_to: str = None):

    print("\n── Strata Pipeline ─────────────────────────────────")

    print("\n[1/9] Loading data...")

    is_2024_dataset = False

    if use_synthetic:
        from synthetic_data import generate_synthetic_data, save_synthetic_data
        print("  Generating synthetic Valencia data...")
        df = generate_synthetic_data(n_hours=720, n_calima_events=2, seed=42)
        raw_path = os.path.join(BASE_PATH, "raw", "air_quality.csv")
        os.makedirs(os.path.dirname(raw_path), exist_ok=True)
        save_synthetic_data(df, raw_path)

    elif fetch_fresh:
        from rvvcca_ingestion_2024 import load_or_fetch, data_quality_report
        print("  Fetching 2024 daily RVVCCA data from dadesobertes.gva.es...")
        df = load_or_fetch(date_from=date_from, date_to=date_to, force_fetch=True)
        is_2024_dataset = True
        if df.empty:
            print("  WARNING: Real data fetch returned empty. Falling back to synthetic.")
            from synthetic_data import generate_synthetic_data, save_synthetic_data
            df = generate_synthetic_data(n_hours=720, n_calima_events=2, seed=42)
            save_synthetic_data(df, os.path.join(BASE_PATH, "raw", "air_quality.csv"))
            is_2024_dataset = False
        else:
            data_quality_report(df)

    else:
        cached_2024 = os.path.join(BASE_PATH, "raw", "air_quality_2024_daily.csv")
        if os.path.exists(cached_2024):
            import pandas as pd
            print(f"  Loading cached 2024 daily data: {cached_2024}")
            df = pd.read_csv(cached_2024, parse_dates=["datetime"])
            is_2024_dataset = True
            print(f"  {len(df):,} rows loaded.")
        else:
            try:
                df = load_air_quality(prefer_real=True)
            except FileNotFoundError:
                print("  No data found — generating synthetic data...")
                from synthetic_data import generate_synthetic_data, save_synthetic_data
                df = generate_synthetic_data(n_hours=720, n_calima_events=2, seed=42)
                save_synthetic_data(df, os.path.join(BASE_PATH, "raw", "air_quality.csv"))

    if date_from or date_to:
        import pandas as pd
        if date_from:
            df = df[df["datetime"] >= pd.Timestamp(date_from)]
        if date_to:
            df = df[df["datetime"] <= pd.Timestamp(date_to) + pd.Timedelta(days=1)]
        print(f"  After date filter: {len(df):,} rows")

    print(f"  Shape after load: {df.shape}")

    print("\n[2/9] Preprocessing...")
    df = standardize_columns(df)
    df = standardize_datetime(df)
    before = len(df)
    df = remove_missing(df)
    print(f"  Rows: {before:,} → {len(df):,} after dropping nulls")

    required = {"pm25", "pm10", "no2", "o3"}
    missing_cols = required - set(df.columns)
    if missing_cols:
        raise ValueError(f"Missing required columns after load: {missing_cols}")

    print("\n[3/9] Computing AQI...")
    df = compute_scientific_aqi(df)
    df = compute_public_aqi(df)
    df = compute_aqi_divergence(df)
    print(f"  Scientific AQI : {df['aqi_scientific'].min():.1f} – {df['aqi_scientific'].max():.1f}")
    print(f"  Public AQI     : {df['aqi_public'].min():.1f} – {df['aqi_public'].max():.1f}")
    print(f"  Mean divergence: {df['aqi_divergence'].mean():.2f}")

    print("\n[4/9] Detecting calima and DANA events...")
    df = detect_calima_events(df)
    df = detect_dana_events(df)
    dana_n = df["dana_event"].sum() if "dana_event" in df.columns else 0
    print(f"  DANA event days detected: {dana_n}")

    print("\n[5/9] Classifying air masses...")
    df = classify_air_mass(df)
    dist = df["air_mass_type"].value_counts()
    for mass, count in dist.items():
        print(f"  {mass:<20}: {count:>6} obs ({count/len(df)*100:.1f}%)")

    print("\n[6/9] Computing source attribution...")
    df = compute_attribution(df)

    print("\n[7/9] Computing Atmospheric Complexity Index...")
    df = compute_aci(df)
    print(f"  Mean ACI (normalised): {df['ACI_normalized'].mean():.3f}")

    print("\n[8/9] Generating outputs...")
    create_station_map(df, save=True)
    plot_wind_vectors(df, save=True)
    interpolate_field(df, pollutant="pm10", save=True)
    plot_aqi_comparison(df, save=True)
    report = generate_report(df, save=True)

    processed_path = os.path.join(BASE_PATH, "processed", "strata_processed.csv")
    os.makedirs(os.path.dirname(processed_path), exist_ok=True)
    df.to_csv(processed_path, index=False)
    print(f"  Processed data → {processed_path}")

    print("\n[9/9] Running deep divergence analysis...")
    findings = run_analysis(df, verbose=False)

    fname = "strata_findings.json" if is_2024_dataset else "aeris_findings.json"
    save_findings(findings, filename=fname)
    print_research_summary(findings)

    portfolio_path = os.path.join(os.path.dirname(__file__), "..", "strata_portfolio.html")
    dataset_tag = "2024" if is_2024_dataset else "2122"
    inject_portfolio(html_path=portfolio_path, findings=findings, dataset=dataset_tag, verbose=True)

    print("\n── Pipeline Report ─────────────────────────────────")
    for k, v in report.items():
        print(f"  {k}: {v}")

    print(f"\n✓ Strata pipeline complete. [dataset: {dataset_tag}]\n")
    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Strata pipeline")
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--from", dest="date_from", default=None)
    parser.add_argument("--to", dest="date_to", default=None)
    args = parser.parse_args()

    run(
        use_synthetic=args.synthetic,
        fetch_fresh=args.fetch,
        date_from=args.date_from,
        date_to=args.date_to,
    )
