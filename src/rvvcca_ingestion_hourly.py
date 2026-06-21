"""
rvvcca_ingestion_hourly.py
--------------------------
Downloads hourly air quality data from the RVVCCA portal (rvvcca.pica.gva.es)
for any Valencia station and any date range, using the Pentaho CDA API.

Source:
  Portal   : https://rvvcca.pica.gva.es
  Endpoint : /downloadformat/hourly/cda/json
  Backend  : Pentaho CDA / bi.pica.gva.es
  Data type: Provisional (2h lag) — not yet quality-validated
  Licence  : Open data / Generalitat Valenciana

URL pattern discovered from portal download links:
  https://rvvcca.pica.gva.es/downloadformat/hourly/cda/json
    ?file=https://bi.pica.gva.es/pentaho/plugin/cda/api/doQuery
    ?_TRUST_USER_=opendata_gva
    &path=/public/gva/verticals/sql/hourlyAverage.cda
    &dataAccessId=HourlyAverage
    &paramstart=YYYY-MM-DD 00:00:00
    &paramfinish=YYYY-MM-DD 23:59:59
    &paramidStation=STATION_CODE

Usage:
  # Download full year 2025 for all Valencia stations
  python src/rvvcca_ingestion_hourly.py --year 2025

  # Download specific date range
  python src/rvvcca_ingestion_hourly.py --from 2025-01-01 --to 2025-06-10

  # Download single station
  python src/rvvcca_ingestion_hourly.py --year 2025 --station 46250047

  # Download multiple years (builds longitudinal dataset)
  python src/rvvcca_ingestion_hourly.py --year 2023 --year 2024 --year 2025

  # Force re-download even if cached
  python src/rvvcca_ingestion_hourly.py --year 2025 --force
"""

import requests
import pandas as pd
import os
import sys
import argparse
import time
from urllib.parse import quote
from datetime import datetime, date
from io import StringIO

sys.path.insert(0, os.path.dirname(__file__))
from config import BASE_PATH

# ── Valencia city stations ────────────────────────────────────────────────────
# Station code (paramidStation) → STRATA standard name + coordinates
# VERIFIED against rvvcca.pica.gva.es/es/estacion/ pages (station detail pages
# list exact lat/lon under "Ubicación"). Corrected 2026-06 — several codes in
# the original draft were wrong (inherited from a different dataset's station
# list rather than the portal's own internal codes).
#
# Verified sources (per station):
#   46250047 Avda. Francia    — rvvcca.pica.gva.es/es/estacion/46250047-valencia-av-franca
#   46250046 Politècnic       — .../46250046-valencia-politecnic (Camino de Vera, s/n)
#   46250030 Pista de Silla   — .../46250030-valencia-pista-de-silla (C/ Filipinas s/n)
#   46250043 Viveros          — .../estaciones listing (Jardines de Viveros)
#   46250048 Molí del Sol     — .../46250048-valencia-moli-del-sol (Av. Pio Baroja, s/n)
#   46250050 Bulevard Sud     — .../46250050-valencia-bulevard-sud (Bulevar Sur s/n)
#   46250301 Port/Moll Tr.Pon — .../46250301-valencia-port-moll-trans-ponent
#
# NOTE: "Centro" station from the daily (dadesobertes.gva.es) dataset does not
# have a confirmed matching code on this portal yet — may be named differently
# or may not be part of the hourly RVVCCA portal network. Flagged for manual
# verification; do not assume a code for it.
VALENCIA_STATIONS = {
    "46250047": {"name": "Avda. Francia",   "lat": 39.45750, "lon": -0.34270},
    "46250046": {"name": "Politecnico",     "lat": 39.47962, "lon": -0.33741},
    "46250030": {"name": "Pista Silla",     "lat": 39.45806, "lon": -0.37665},
    "46250043": {"name": "Viveros",         "lat": 39.47949, "lon": -0.36955},
    "46250048": {"name": "Molino del Sol",  "lat": 39.48114, "lon": -0.40856},
    "46250050": {"name": "Bulevar Sur",     "lat": 39.45038, "lon": -0.39631},
    "46250301": {"name": "Puerto Moll Trans. Ponent", "lat": 39.4510, "lon": -0.3190},
}

# ── API endpoint ──────────────────────────────────────────────────────────────
BASE_URL    = "https://rvvcca.pica.gva.es/downloadformat/hourly/cda/json"
PENTAHO_URL = "https://bi.pica.gva.es/pentaho/plugin/cda/api/doQuery"

# Column mapping: raw portal names → STRATA standard
COLUMN_MAP = {
    "date":    "datetime",
    "PM2.5":   "pm25",
    "PM10":    "pm10",
    "NO2":     "no2",
    "NO":      "no",
    "NOx":     "nox",
    "O3":      "o3",
    "SO2":     "so2",
    "CO":      "co",
    "Temp.":   "temperature",
    "Veloc.":  "wind_speed",
    "Direc.":  "wind_direction",
    "H.Rel.":  "humidity",
    "Precip.": "precipitation",
}


def build_url(station_code: str, date_from: str, date_to: str) -> str:
    """
    Build the full download URL for a station and date range.
    date_from / date_to: 'YYYY-MM-DD'
    """
    start = f"{date_from} 00:00:00"
    finish = f"{date_to} 23:59:59"

    inner = (
        f"{PENTAHO_URL}"
        f"?_TRUST_USER_=opendata_gva"
        f"&path=/public/gva/verticals/sql/hourlyAverage.cda"
        f"&dataAccessId=HourlyAverage"
        f"&paramstart={quote(start)}"
        f"&paramfinish={quote(finish)}"
        f"&paramidStation={station_code}"
    )
    return f"{BASE_URL}?file={inner}"


def download_station_year(
    station_code: str,
    year: int,
    verbose: bool = True,
    retries: int = 3,
) -> pd.DataFrame:
    """
    Download one full year of hourly data for one station.
    Returns a normalised DataFrame or empty DataFrame on failure.
    """
    date_from = f"{year}-01-01"
    date_to   = f"{year}-12-31"
    url = build_url(station_code, date_from, date_to)
    name = VALENCIA_STATIONS.get(station_code, {}).get("name", station_code)

    if verbose:
        print(f"  {name} ({station_code}) {year}...", end=" ", flush=True)

    for attempt in range(retries):
        try:
            resp = requests.get(url, timeout=90,
                                headers={"User-Agent": "Mozilla/5.0",
                                         "Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()

            if not data:
                if verbose: print("empty response")
                return pd.DataFrame()

            df = pd.DataFrame(data)
            df = normalise(df, station_code)

            if verbose:
                print(f"{len(df):,} rows ({df['datetime'].min().date()} → "
                      f"{df['datetime'].max().date()})")
            return df

        except requests.exceptions.Timeout:
            if attempt < retries - 1:
                if verbose: print(f"timeout, retrying...", end=" ", flush=True)
                time.sleep(5)
            else:
                if verbose: print("FAILED (timeout)")
                return pd.DataFrame()
        except Exception as e:
            if attempt < retries - 1:
                if verbose: print(f"error ({e}), retrying...", end=" ", flush=True)
                time.sleep(3)
            else:
                if verbose: print(f"FAILED ({e})")
                return pd.DataFrame()


def download_station_range(
    station_code: str,
    date_from: str,
    date_to: str,
    verbose: bool = True,
) -> pd.DataFrame:
    """Download an arbitrary date range for one station."""
    url = build_url(station_code, date_from, date_to)
    name = VALENCIA_STATIONS.get(station_code, {}).get("name", station_code)

    if verbose:
        print(f"  {name} ({station_code}) {date_from} → {date_to}...",
              end=" ", flush=True)
    try:
        resp = requests.get(url, timeout=90,
                            headers={"User-Agent": "Mozilla/5.0",
                                     "Accept": "application/json"})
        resp.raise_for_status()
        data = resp.json()
        if not data:
            if verbose: print("empty")
            return pd.DataFrame()
        df = pd.DataFrame(data)
        df = normalise(df, station_code)
        if verbose:
            print(f"{len(df):,} rows")
        return df
    except Exception as e:
        if verbose: print(f"FAILED ({e})")
        return pd.DataFrame()


def normalise(df: pd.DataFrame, station_code: str) -> pd.DataFrame:
    """Normalise a raw API response DataFrame to STRATA standard format."""
    # Replace empty strings with NaN
    df = df.replace("", pd.NA)

    # Rename columns
    df = df.rename(columns={k: v for k, v in COLUMN_MAP.items() if k in df.columns})

    # Parse datetime
    df["datetime"] = pd.to_datetime(df["datetime"], format="%Y-%m-%d %H:%M",
                                    errors="coerce")

    # Cast numerics
    numeric_cols = ["pm25", "pm10", "no2", "no", "nox", "o3", "so2", "co",
                    "temperature", "wind_speed", "wind_direction",
                    "humidity", "precipitation"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Add station metadata
    station_info = VALENCIA_STATIONS.get(station_code, {})
    df["station"]      = station_info.get("name", station_code)
    df["station_code"] = station_code
    df["latitude"]     = station_info.get("lat", None)
    df["longitude"]    = station_info.get("lon", None)
    df["source"]       = "rvvcca_portal_hourly"
    df["provisional"]  = True  # data is provisional until CEAM validation

    # Column order
    core = ["datetime", "station", "station_code", "latitude", "longitude",
            "pm25", "pm10", "no2", "o3"]
    extra = ["no", "nox", "so2", "co", "temperature", "wind_speed",
             "wind_direction", "humidity", "precipitation",
             "source", "provisional"]
    keep = [c for c in core if c in df.columns] + \
           [c for c in extra if c in df.columns]

    return df[keep].sort_values("datetime").reset_index(drop=True)


def data_quality_report(df: pd.DataFrame, label: str = "") -> None:
    if df.empty:
        print(f"  [{label}] Empty dataset.")
        return
    print(f"\n── Data Quality Report{' · '+label if label else ''} ──────────")
    print(f"  Shape      : {df.shape}")
    print(f"  Date range : {df['datetime'].min()} → {df['datetime'].max()}")
    print(f"  Stations   : {sorted(df['station'].dropna().unique().tolist())}")
    print(f"  CMPI pollutant coverage:")
    for col in ["pm25", "pm10", "no2", "o3"]:
        if col in df.columns:
            pct = df[col].notna().mean() * 100
            flag = "  ⚠ low" if pct < 70 else ""
            print(f"    {col:<8}: {pct:5.1f}% non-null{flag}")
    print(f"  Value ranges:")
    for col, (lo, hi) in [("pm25",(0,75)),("pm10",(0,250)),
                           ("no2",(0,200)),("o3",(0,200))]:
        if col in df.columns:
            vals = df[col].dropna()
            if len(vals):
                print(f"    {col:<8}: min={vals.min():.1f}  "
                      f"max={vals.max():.1f}  "
                      f"mean={vals.mean():.1f}")
    print()


def load_or_fetch(
    years: list = None,
    date_from: str = None,
    date_to: str = None,
    stations: list = None,
    force_fetch: bool = False,
    verbose: bool = True,
) -> pd.DataFrame:
    """
    Main entry point. Load from cache if available, otherwise fetch.

    Parameters
    ----------
    years      : list of ints, e.g. [2023, 2024, 2025]
    date_from  : 'YYYY-MM-DD' — alternative to years
    date_to    : 'YYYY-MM-DD' — alternative to years
    stations   : list of station codes; defaults to all VALENCIA_STATIONS
    force_fetch: re-download even if cached
    """
    if stations is None:
        stations = list(VALENCIA_STATIONS.keys())

    frames = []

    if years:
        for year in sorted(years):
            cache_path = os.path.join(
                BASE_PATH, "raw", f"air_quality_hourly_{year}.csv"
            )
            if not force_fetch and os.path.exists(cache_path):
                if verbose:
                    print(f"  Loading cached {year}: {cache_path}")
                df_cached = pd.read_csv(cache_path, parse_dates=["datetime"])
                frames.append(df_cached)
                if verbose:
                    print(f"    {len(df_cached):,} rows loaded.")
                continue

            if verbose:
                print(f"\nDownloading {year} hourly data "
                      f"({len(stations)} stations):")
            year_frames = []
            for code in stations:
                df_st = download_station_year(code, year, verbose=verbose)
                if not df_st.empty:
                    year_frames.append(df_st)

            if year_frames:
                df_year = pd.concat(year_frames, ignore_index=True)
                df_year = df_year.sort_values(
                    ["station", "datetime"]).reset_index(drop=True)
                os.makedirs(os.path.dirname(cache_path), exist_ok=True)
                df_year.to_csv(cache_path, index=False)
                if verbose:
                    print(f"  Cached → {cache_path} "
                          f"({len(df_year):,} rows, "
                          f"{df_year['station'].nunique()} stations)")
                frames.append(df_year)

    elif date_from and date_to:
        if verbose:
            print(f"\nDownloading {date_from} → {date_to} "
                  f"({len(stations)} stations):")
        for code in stations:
            df_st = download_station_range(
                code, date_from, date_to, verbose=verbose)
            if not df_st.empty:
                frames.append(df_st)

    if not frames:
        raise RuntimeError("No data downloaded. Check station codes and dates.")

    df = pd.concat(frames, ignore_index=True)
    df = df.sort_values(["station", "datetime"]).reset_index(drop=True)

    if verbose:
        print(f"\n  Combined: {len(df):,} rows · "
              f"{df['station'].nunique()} stations · "
              f"{df['datetime'].min().date()} → {df['datetime'].max().date()}")

    return df


def download_longitudinal(
    start_year: int,
    end_year: int,
    stations: list = None,
    delay_between_requests: float = 1.5,
    force_fetch: bool = False,
    verbose: bool = True,
) -> dict:
    """
    Build a full longitudinal hourly dataset across many years.

    Downloads one year at a time, one station at a time, caching each
    year independently so a failed or interrupted run can resume without
    re-downloading years that already succeeded.

    Designed for building the atlas's historical backbone, e.g.:
        download_longitudinal(2009, 2025)
    pulls 17 years × 7 stations = up to 119 individual requests.

    Rate limiting: a small delay between requests is applied to avoid
    hammering the portal — this is shared public infrastructure, not a
    dedicated API, so politeness matters for continued access.

    Returns
    -------
    dict mapping year -> DataFrame (only years with successful data)
    """
    if stations is None:
        stations = list(VALENCIA_STATIONS.keys())

    years = list(range(start_year, end_year + 1))
    results = {}
    failed_combinations = []

    if verbose:
        print(f"\n{'='*60}")
        print(f"  Longitudinal download: {start_year}–{end_year}")
        print(f"  {len(years)} years × {len(stations)} stations = "
              f"up to {len(years)*len(stations)} requests")
        print(f"{'='*60}\n")

    for year in years:
        cache_path = os.path.join(
            BASE_PATH, "raw", f"air_quality_hourly_{year}.csv"
        )

        if not force_fetch and os.path.exists(cache_path):
            if verbose:
                print(f"[{year}] cached — loading {cache_path}")
            df_year = pd.read_csv(cache_path, parse_dates=["datetime"])
            results[year] = df_year
            if verbose:
                print(f"        {len(df_year):,} rows · "
                      f"{df_year['station'].nunique()} stations\n")
            continue

        if verbose:
            print(f"[{year}] downloading {len(stations)} stations:")

        year_frames = []
        for code in stations:
            df_st = download_station_year(code, year, verbose=verbose)
            if not df_st.empty:
                year_frames.append(df_st)
            else:
                failed_combinations.append((year, code))
            # Be polite to the portal — small delay between requests
            time.sleep(delay_between_requests)

        if year_frames:
            df_year = pd.concat(year_frames, ignore_index=True)
            df_year = df_year.sort_values(
                ["station", "datetime"]).reset_index(drop=True)
            os.makedirs(os.path.dirname(cache_path), exist_ok=True)
            df_year.to_csv(cache_path, index=False)
            results[year] = df_year
            if verbose:
                print(f"  → Cached {year}: {len(df_year):,} rows, "
                      f"{df_year['station'].nunique()}/{len(stations)} "
                      f"stations succeeded\n")
        else:
            if verbose:
                print(f"  → {year}: no data for any station — "
                      f"station may not have existed yet, or portal "
                      f"has no data this far back for these codes\n")

    if verbose:
        print(f"{'='*60}")
        print(f"  Longitudinal download complete")
        print(f"  Years with data: {sorted(results.keys())}")
        if failed_combinations:
            print(f"  Failed station-years ({len(failed_combinations)}):")
            for yr, code in failed_combinations:
                name = VALENCIA_STATIONS.get(code, {}).get("name", code)
                print(f"    {yr} · {name} ({code})")
        print(f"{'='*60}\n")

    return results


def combine_longitudinal(results: dict, save_path: str = None) -> pd.DataFrame:
    """
    Combine per-year DataFrames from download_longitudinal() into a single
    longitudinal DataFrame spanning all years. Optionally saves to disk.
    """
    if not results:
        return pd.DataFrame()

    frames = [df for df in results.values() if not df.empty]
    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values(["station", "datetime"]).reset_index(drop=True)

    if save_path:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        combined.to_csv(save_path, index=False)
        print(f"  Longitudinal dataset saved → {save_path}")
        print(f"  {len(combined):,} total rows · "
              f"{combined['datetime'].dt.year.nunique()} years · "
              f"{combined['station'].nunique()} stations")

    return combined



if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download hourly RVVCCA data from rvvcca.pica.gva.es"
    )
    parser.add_argument("--year", type=int, action="append", dest="years",
                        help="Year to download (can repeat: --year 2023 --year 2024)")
    parser.add_argument("--from", dest="date_from", default=None,
                        help="Start date YYYY-MM-DD")
    parser.add_argument("--to", dest="date_to", default=None,
                        help="End date YYYY-MM-DD")
    parser.add_argument("--station", action="append", dest="stations",
                        help="Station code (can repeat); default: all Valencia")
    parser.add_argument("--force", action="store_true",
                        help="Re-download even if cached")
    parser.add_argument("--report", action="store_true",
                        help="Print quality report after download")
    parser.add_argument("--longitudinal", nargs=2, type=int,
                        metavar=("START_YEAR", "END_YEAR"),
                        help="Download a full year range, e.g. --longitudinal 2009 2025")
    parser.add_argument("--combine", action="store_true",
                        help="With --longitudinal: also save one combined CSV across all years")
    parser.add_argument("--delay", type=float, default=1.5,
                        help="Seconds between requests in longitudinal mode (default 1.5)")
    args = parser.parse_args()

    if args.longitudinal:
        start_year, end_year = args.longitudinal
        results = download_longitudinal(
            start_year, end_year,
            stations=args.stations,
            delay_between_requests=args.delay,
            force_fetch=args.force,
            verbose=True,
        )
        if args.combine and results:
            combined_path = os.path.join(
                BASE_PATH, "raw",
                f"air_quality_hourly_{start_year}_{end_year}_combined.csv"
            )
            df_combined = combine_longitudinal(results, save_path=combined_path)
            if args.report:
                data_quality_report(df_combined,
                                    label=f"longitudinal {start_year}-{end_year}")
        sys.exit(0)

    # Default to current year if nothing specified
    if not args.years and not args.date_from:
        args.years = [datetime.now().year]
        print(f"No year specified — defaulting to {args.years[0]}")

    df = load_or_fetch(
        years=args.years,
        date_from=args.date_from,
        date_to=args.date_to,
        stations=args.stations,
        force_fetch=args.force,
        verbose=True,
    )

    if args.report:
        data_quality_report(df, label="hourly portal data")

    print("\nFirst 3 rows:")
    print(df.head(3).to_string())
