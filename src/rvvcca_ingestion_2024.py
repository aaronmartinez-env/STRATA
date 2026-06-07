"""
rvvcca_ingestion_2024.py
------------------------
Downloads and processes daily air quality data from the Generalitat Valenciana
open data portal (dadesobertes.gva.es) for the full year 2024.

Source:
  Dataset: Mediciones diarias de contaminantes atmosféricos y ozono
           de la Comunitat Valenciana 2024
  Publisher: Generalitat Valenciana (Conselleria de Medi Ambient)
  Licence: CC BY 4.0
  Portal: https://dadesobertes.gva.es/dataset/med-cont-atmos-md-2024

Format differences vs 2021-2022 hourly dataset:
  - Daily averages (no hora column) — one row per station per day
  - Station ID split into COD_ESTACION + NOM_ESTACION
  - Missing values encoded as '-' strings
  - Decimal separator is comma, not period
  - Covers all Comunitat Valenciana stations — script filters to Valencia city

Usage (from project root, venv active):
  python src/rvvcca_ingestion_2024.py                   # download & cache full year
  python src/rvvcca_ingestion_2024.py --force           # re-download even if cached
  python src/rvvcca_ingestion_2024.py --all-stations    # keep all CV stations, not just Valencia
  python src/rvvcca_ingestion_2024.py --from 2024-10-01 --to 2024-11-30  # DANA window
"""

import requests
import pandas as pd
import os
import sys
import argparse
from io import StringIO

sys.path.insert(0, os.path.dirname(__file__))
from config import BASE_PATH

# ── Monthly CSV URLs (all 12 months, confirmed from dadesobertes.gva.es) ──────

MONTHLY_URLS = {
    "2024-01": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/648c7c36-f6c8-418b-98d0-edde59f73e42/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202401.csv",
    "2024-02": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/f8a6cf77-9b6b-4cd4-a298-d78e88bfeab7/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202402.csv",
    "2024-03": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/a5907598-4243-4cba-a233-4bca6116f4bf/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202403.csv",
    "2024-04": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/bdced53a-3c1d-4830-b9d6-067d3a64dba7/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202404.csv",
    "2024-05": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/af64bfa1-239c-4f4d-8416-a19e9ac115be/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202405.csv",
    "2024-06": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/40085e6c-988b-4e85-9ee4-c188ea9a3a57/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202406.csv",
    "2024-07": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/2127f94e-043a-4e39-8c48-033460af6797/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202407.csv",
    "2024-08": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/301dd85e-9ead-4aa7-a0d4-9ae3cfd1d408/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202408.csv",
    "2024-09": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/66e05bd0-4935-4a0b-88bb-ee06a043fa88/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202409.csv",
    "2024-10": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/e5928973-eaec-4564-bfa1-909675a686be/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202410.csv",
    "2024-11": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/86ad56bf-f04f-4e5a-aefc-29bcf8d0b5f8/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202411.csv",
    "2024-12": "https://dadesobertes.gva.es/dataset/aaf53b06-b0ed-4637-9900-4825c1af6af8/resource/c95d4177-5ec0-464d-bb21-16b8272aa644/download/contaminacion-atmosferica-y-ozono-promedios-diarios_202412.csv",
}

# ── Valencia city station codes (COD_ESTACION prefix 46250) ──────────────────
# Confirmed present in January 2024 data with CMPI-relevant pollutants.
# Conselleria Meteo (46250049) and Nazaret Met-2 (46250900) are met-only
# and are retained for wind/temperature but will have NaN CMPI values.

VALENCIA_STATION_PREFIX = "46250"

# Canonical names mapping: NOM_ESTACION (raw) → STRATA standard name
# Aligns with STATION_COORDS in the original rvvcca_ingestion.py
STATION_NAME_MAP = {
    "VALÈNCIA - PISTA DE SILLA":   "Pista Silla",
    "VALÈNCIA - VIVERS":           "Viveros",
    "VALÈNCIA - POLITÈCNIC":       "Politecnico",
    "VALÈNCIA - AVD. FRANCIA":     "Avda. Francia",
    "VALÈNCIA - MOLÍ DEL SOL":     "Molino del Sol",
    "VALÈNCIA-CONSELLERIA METEO.": "Conselleria Meteo",
    "VALÈNCIA - BULEVARD SUD":     "Bulevar Sur",
    "VALÈNCIA CENTRE":             "Centro",
    "VALÈNCIA - NAZARET MET-2":    "Nazaret Meteo",
}

# Station coordinates — same values as original rvvcca_ingestion.py
STATION_COORDS = {
    "Pista Silla":      {"latitude": 39.4298, "longitude": -0.4083},
    "Viveros":          {"latitude": 39.4793, "longitude": -0.3640},
    "Politecnico":      {"latitude": 39.4800, "longitude": -0.3463},
    "Avda. Francia":    {"latitude": 39.4632, "longitude": -0.3451},
    "Molino del Sol":   {"latitude": 39.4447, "longitude": -0.3802},
    "Conselleria Meteo":{"latitude": 39.4700, "longitude": -0.3700},
    "Bulevar Sur":      {"latitude": 39.4501, "longitude": -0.3928},
    "Centro":           {"latitude": 39.4698, "longitude": -0.3763},
    "Nazaret Meteo":    {"latitude": 39.4540, "longitude": -0.3370},
}

# ── Column mapping: raw GVA column names → STRATA standard ───────────────────

COLUMN_MAP = {
    "SO2":        "so2",
    "CO":         "co",
    "NO":         "no",
    "NO2":        "no2",
    "NOx":        "nox",
    "O3":         "o3",
    "PM10":       "pm10",
    "PM2.5":      "pm25",
    "PM1":        "pm1",
    "NH3":        "nh3",
    "C6H6":       "c6h6",
    "C7H8":       "c7h8",
    "C8H10":      "c8h10",
    "Direc.":     "wind_direction",
    "H.Rel.":     "humidity",
    "Precip.":    "precipitation",
    "Pres.":      "pressure",
    "R.Sol.":     "radiation",
    "Ruido":      "noise",
    "Temp.":      "temperature",
    "UV-B":       "uvb",
    "Veloc.":     "wind_speed",
    "Veloc.max.": "wind_speed_max",
    "As":         "as",
    "BaP":        "bap",
    "Cd":         "cd",
    "Ni":         "ni",
    "Pb":         "pb",
    "PST":        "pst",
}


# ── Download one monthly CSV ──────────────────────────────────────────────────

def download_month(month_key: str, url: str, verbose: bool = True) -> pd.DataFrame:
    if verbose:
        print(f"  Downloading {month_key}...", end=" ", flush=True)
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"FAILED — {e}")
        return pd.DataFrame()

    content = response.content
    for encoding in ["utf-8-sig", "utf-8", "latin-1", "iso-8859-1"]:
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = content.decode("utf-8", errors="replace")

    df = pd.read_csv(StringIO(text), sep=";", low_memory=False)
    if verbose:
        print(f"{len(df):,} rows")
    return df


# ── Parse and normalise one month's raw DataFrame ────────────────────────────

def parse_month(df: pd.DataFrame, valencia_only: bool = True) -> pd.DataFrame:
    if df.empty:
        return df

    # 1. Filter to Valencia city stations
    if valencia_only:
        df = df[df["COD_ESTACION"].astype(str).str.startswith(VALENCIA_STATION_PREFIX)].copy()
        if df.empty:
            return df

    # 2. Map station names to STRATA standard
    df["station"] = df["NOM_ESTACION"].map(STATION_NAME_MAP)
    # Fallback: keep raw name if not in map (for --all-stations mode)
    df["station"] = df["station"].fillna(df["NOM_ESTACION"])
    df["station_code"] = df["COD_ESTACION"].astype(str)

    # 3. Parse date (FECHA is YYYY-MM-DD)
    df["datetime"] = pd.to_datetime(df["FECHA"], format="%Y-%m-%d", errors="coerce")

    # 4. Replace '-' missing value encoding with NaN
    df = df.replace("-", pd.NA)

    # 5. Rename columns
    df = df.rename(columns={k: v for k, v in COLUMN_MAP.items() if k in df.columns})

    # 6. Fix decimal comma → period and cast to numeric
    numeric_cols = [
        "pm1", "pm25", "pm10", "no", "no2", "nox", "o3", "so2", "co", "nh3",
        "wind_speed", "wind_direction", "wind_speed_max",
        "temperature", "humidity", "pressure", "precipitation",
        "radiation", "noise", "uvb", "as", "bap", "cd", "ni", "pb", "pst",
    ]
    for col in numeric_cols:
        if col in df.columns:
            if df[col].dtype == object:
                df[col] = (
                    df[col].astype(str)
                    .str.replace(",", ".", regex=False)
                    .str.strip()
                    .replace("nan", pd.NA)
                    .replace("<NA>", pd.NA)
                )
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # 7. Add coordinates
    df["latitude"]  = df["station"].map(lambda s: STATION_COORDS.get(s, {}).get("latitude"))
    df["longitude"] = df["station"].map(lambda s: STATION_COORDS.get(s, {}).get("longitude"))

    # 8. Select output columns
    core = ["datetime", "station", "station_code", "latitude", "longitude",
            "pm25", "pm10", "no2", "o3"]
    bonus = ["no", "nox", "so2", "co", "nh3", "pm1",
             "wind_speed", "wind_direction", "wind_speed_max",
             "temperature", "humidity", "pressure", "precipitation",
             "radiation", "noise"]
    keep = [c for c in core if c in df.columns] + \
           [c for c in bonus if c in df.columns]
    return df[keep]


# ── Download and concatenate all 12 months ───────────────────────────────────

def download_all_months(
    months: dict = None,
    valencia_only: bool = True,
    verbose: bool = True,
) -> pd.DataFrame:
    if months is None:
        months = MONTHLY_URLS

    if verbose:
        scope = "Valencia city stations" if valencia_only else "all Comunitat Valenciana stations"
        print(f"\nDownloading 2024 daily air quality data ({scope}):")

    frames = []
    for month_key, url in sorted(months.items()):
        raw = download_month(month_key, url, verbose=verbose)
        parsed = parse_month(raw, valencia_only=valencia_only)
        if not parsed.empty:
            frames.append(parsed)

    if not frames:
        raise RuntimeError("No data downloaded. Check your internet connection and the source URLs.")

    df = pd.concat(frames, ignore_index=True)
    df = df.sort_values(["station", "datetime"]).reset_index(drop=True)

    if verbose:
        print(f"\n  Combined: {len(df):,} rows across {df['station'].nunique()} stations")
        print(f"  Date range: {df['datetime'].min().date()} → {df['datetime'].max().date()}")

    return df


# ── Date filter ───────────────────────────────────────────────────────────────

def filter_dates(df, date_from=None, date_to=None):
    if date_from:
        df = df[df["datetime"] >= pd.Timestamp(date_from)]
    if date_to:
        df = df[df["datetime"] <= pd.Timestamp(date_to) + pd.Timedelta(days=1)]
    return df.reset_index(drop=True)


# ── Quality report ────────────────────────────────────────────────────────────

def data_quality_report(df: pd.DataFrame) -> None:
    print("\n── Data Quality Report (2024 Daily) ────────────────────")
    print(f"  Shape      : {df.shape}")
    print(f"  Date range : {df['datetime'].min().date()} → {df['datetime'].max().date()}")
    print(f"  Stations   : {sorted(df['station'].dropna().unique().tolist())}")

    print(f"\n  CMPI pollutant coverage (% non-null):")
    for col in ["pm25", "pm10", "no2", "o3"]:
        if col in df.columns:
            pct_ok = df[col].notna().mean() * 100
            flag = " ⚠  low coverage" if pct_ok < 50 else ""
            print(f"    {col:<10}: {pct_ok:5.1f}% non-null{flag}")

    print(f"\n  Per-station CMPI coverage:")
    for station in sorted(df["station"].dropna().unique()):
        s = df[df["station"] == station]
        coverage = {col: f"{s[col].notna().mean()*100:.0f}%" for col in ["pm25","pm10","no2","o3"] if col in s.columns}
        print(f"    {station:<30}: {coverage}")

    print(f"\n  Value ranges (daily averages):")
    for col, (lo, hi) in [("pm25", (0, 80)), ("pm10", (0, 300)),
                           ("no2", (0, 200)), ("o3", (0, 200))]:
        if col in df.columns:
            vals = df[col].dropna()
            if len(vals):
                out = ((vals < lo) | (vals > hi)).mean() * 100
                print(f"    {col:<10}: min={vals.min():.1f}  max={vals.max():.1f}  out-of-range={out:.1f}%")
    print()


# ── Load-or-fetch (called by run_pipeline.py) ─────────────────────────────────

def load_or_fetch(
    filename:      str  = "air_quality_2024_daily.csv",
    date_from:     str  = None,
    date_to:       str  = None,
    force_fetch:   bool = False,
    valencia_only: bool = True,
    verbose:       bool = True,
) -> pd.DataFrame:
    """
    Load cached 2024 daily data if it exists, otherwise download and cache it.
    Drop-in complement to the original load_or_fetch in rvvcca_ingestion.py.
    """
    cache_path = os.path.join(BASE_PATH, "raw", filename)

    if not force_fetch and os.path.exists(cache_path):
        if verbose:
            print(f"Loading cached 2024 daily data: {cache_path}")
        df = pd.read_csv(cache_path, parse_dates=["datetime"])
        if verbose:
            print(f"  {len(df):,} rows loaded.")
    else:
        df = download_all_months(valencia_only=valencia_only, verbose=verbose)
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        df.to_csv(cache_path, index=False)
        if verbose:
            print(f"  Cached → {cache_path}")

    if date_from or date_to:
        df = filter_dates(df, date_from, date_to)
        if verbose:
            print(f"  After date filter: {len(df):,} rows")

    return df


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download 2024 daily RVVCCA data from dadesobertes.gva.es"
    )
    parser.add_argument("--from",         dest="date_from",     default=None,
                        help="Filter start date YYYY-MM-DD")
    parser.add_argument("--to",           dest="date_to",       default=None,
                        help="Filter end date YYYY-MM-DD")
    parser.add_argument("--force",        action="store_true",
                        help="Re-download even if cache exists")
    parser.add_argument("--all-stations", action="store_true",
                        help="Keep all Comunitat Valenciana stations (not just Valencia city)")
    args = parser.parse_args()

    df = load_or_fetch(
        date_from=args.date_from,
        date_to=args.date_to,
        force_fetch=args.force,
        valencia_only=not args.all_stations,
    )

    if not df.empty:
        data_quality_report(df)
        print("First 5 rows:")
        print(df.head().to_string())
