"""
rvvcca_client.py
-----------------
Server-side client for the RVVCCA hourly data portal, used by the FastAPI
proxy. Adapted from src/rvvcca_ingestion_hourly.py — same URL pattern and
column normalization, but returns JSON-friendly dicts for an API response
instead of writing DataFrames to CSV.

Why this lives server-side rather than being called from the browser:
RVVCCA does not appear to send CORS headers, so a direct browser fetch
from strata-atmos.com would be blocked. A server-to-server call from
here is not subject to CORS at all, since CORS is a browser-enforced
restriction, not a server-enforced one.
"""

import requests
from urllib.parse import quote
from datetime import datetime

from stations import VALENCIA_STATIONS

BASE_URL = "https://rvvcca.pica.gva.es/downloadformat/hourly/cda/json"
PENTAHO_URL = "https://bi.pica.gva.es/pentaho/plugin/cda/api/doQuery"

# Raw portal column name -> STRATA standard field name
COLUMN_MAP = {
    "date": "datetime",
    "PM2.5": "pm25",
    "PM10": "pm10",
    "NO2": "no2",
    "NO": "no",
    "NOx": "nox",
    "O3": "o3",
    "SO2": "so2",
    "CO": "co",
    "Temp.": "temperature",
    "Veloc.": "wind_speed",
    "Direc.": "wind_direction",
    "H.Rel.": "humidity",
    "Precip.": "precipitation",
}

NUMERIC_FIELDS = [
    "pm25", "pm10", "no2", "no", "nox", "o3", "so2", "co",
    "temperature", "wind_speed", "wind_direction", "humidity", "precipitation",
]


class RVVCCAError(Exception):
    """Raised when the RVVCCA portal can't be reached or returns bad data."""


def build_url(station_code: str, date_from: str, date_to: str) -> str:
    """
    Build the full RVVCCA download URL for a station and date range.
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


def _to_float(value):
    if value in (None, "", "NaN", "nan"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalise_row(raw_row: dict, station_code: str) -> dict:
    """Rename fields and coerce numerics for a single raw RVVCCA record."""
    row = {}
    for raw_key, value in raw_row.items():
        key = COLUMN_MAP.get(raw_key, raw_key)
        row[key] = value

    for field in NUMERIC_FIELDS:
        if field in row:
            row[field] = _to_float(row[field])

    station_info = VALENCIA_STATIONS.get(station_code, {})
    row["station_code"] = station_code
    row["station"] = station_info.get("name", station_code)
    row["latitude"] = station_info.get("lat")
    row["longitude"] = station_info.get("lon")
    row["provisional"] = True

    return row


def fetch_latest(station_code: str, timeout: int = 30) -> dict | None:
    """
    Fetch the most recent available reading for one station.
    Looks back 3 days to comfortably cover RVVCCA's ~2h provisional lag
    plus any gaps, and returns the single latest row found.
    Returns None if no data was found in that window.
    """
    from datetime import timedelta

    today = datetime.utcnow()
    from_date = (today - timedelta(days=3)).strftime("%Y-%m-%d")
    to_date = today.strftime("%Y-%m-%d")

    rows = fetch_hourly(station_code, from_date, to_date, timeout=timeout)
    rows_with_dt = [r for r in rows if r.get("datetime")]
    if not rows_with_dt:
        return None

    return max(rows_with_dt, key=lambda r: r["datetime"])


def fetch_hourly(station_code: str, date_from: str, date_to: str, timeout: int = 30) -> list[dict]:
    """
    Fetch and normalise hourly data for one station and date range.

    Raises RVVCCAError on network failure or an unexpected response shape.
    Returns an empty list if the portal responds successfully with no data
    for the given range (not an error case).
    """
    if station_code not in VALENCIA_STATIONS:
        raise RVVCCAError(f"Unknown station code: {station_code}")

    url = build_url(station_code, date_from, date_to)

    try:
        resp = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        raise RVVCCAError("RVVCCA portal timed out")
    except requests.exceptions.RequestException as e:
        raise RVVCCAError(f"RVVCCA portal request failed: {e}")

    try:
        data = resp.json()
    except ValueError:
        raise RVVCCAError("RVVCCA portal returned a non-JSON response")

    if not data:
        return []

    return [_normalise_row(row, station_code) for row in data]
