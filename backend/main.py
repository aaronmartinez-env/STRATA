"""
main.py
-------
STRATA backend — a small FastAPI service whose only job is to proxy
requests to the RVVCCA portal server-to-server (bypassing the CORS
restriction the browser would otherwise hit) and return clean JSON
for the frontend's Live module.

Run locally:
    uvicorn main:app --reload --port 8000

Deployed target: api.strata-atmos.com (Render or Fly.io)
"""

from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from rvvcca_client import fetch_hourly, fetch_latest, RVVCCAError
from stations import VALENCIA_STATIONS, station_list

app = FastAPI(title="STRATA API", version="0.1.0")

# Frontend origins allowed to call this API. Includes the production
# domain, the bare Vercel preview URL pattern, and localhost for dev.
ALLOWED_ORIGINS = [
    "https://strata-atmos.com",
    "https://www.strata-atmos.com",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Vercel preview deploys
    allow_methods=["GET"],
    allow_headers=["*"],
)

MIN_DATE = "2009-01-01"
MAX_LOOKAHEAD_HOURS = 2  # RVVCCA data lags ~2h behind real time


def _validate_date_range(date_from: str, date_to: str) -> None:
    try:
        d_from = datetime.strptime(date_from, "%Y-%m-%d")
        d_to = datetime.strptime(date_to, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, detail="Dates must be in YYYY-MM-DD format")

    if d_from > d_to:
        raise HTTPException(400, detail="'from' date must not be after 'to' date")

    min_date = datetime.strptime(MIN_DATE, "%Y-%m-%d")
    if d_from < min_date:
        raise HTTPException(400, detail=f"'from' date cannot be before {MIN_DATE}")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    latest_allowed = now + timedelta(hours=MAX_LOOKAHEAD_HOURS)
    if d_to > latest_allowed:
        raise HTTPException(400, detail="'to' date cannot be in the future")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/stations")
def get_stations():
    """List all Valencia RVVCCA stations with codes, names, and coordinates."""
    return {"stations": station_list()}


@app.get("/api/hourly")
def get_hourly(
    station: str = Query(..., description="RVVCCA station code, e.g. 46250047"),
    date_from: str = Query(..., alias="from", description="Start date, YYYY-MM-DD"),
    date_to: str = Query(..., alias="to", description="End date, YYYY-MM-DD"),
):
    """
    Fetch hourly atmospheric readings for one station and date range,
    proxied server-side from the RVVCCA portal.
    """
    if station not in VALENCIA_STATIONS:
        raise HTTPException(
            400,
            detail=f"Unknown station code '{station}'. See /api/stations for valid codes.",
        )

    _validate_date_range(date_from, date_to)

    try:
        readings = fetch_hourly(station, date_from, date_to)
    except RVVCCAError as e:
        raise HTTPException(502, detail=f"RVVCCA portal error: {e}")

    return {
        "station": station,
        "station_name": VALENCIA_STATIONS[station]["name"],
        "from": date_from,
        "to": date_to,
        "count": len(readings),
        "readings": readings,
    }


@app.get("/api/current")
def get_current():
    """
    Latest available reading for every Valencia station at once — the
    data source for the Live tab's 3D "current atmosphere" snapshot.

    Note: this makes one RVVCCA request per station (7 total), run
    sequentially, so it's slower than /api/hourly for a single station.
    Fine for a manual refresh; if this becomes a polling endpoint later,
    add caching (e.g. 5-minute TTL) rather than hitting RVVCCA on every
    page load.
    """
    stations_out = []
    for code, info in VALENCIA_STATIONS.items():
        try:
            latest = fetch_latest(code)
        except RVVCCAError:
            latest = None

        stations_out.append({
            "code": code,
            "name": info["name"],
            "lat": info["lat"],
            "lon": info["lon"],
            "reading": latest,  # None if unavailable
        })

    return {"stations": stations_out}
