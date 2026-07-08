# STRATA backend

A small FastAPI service that proxies RVVCCA hourly data requests
server-to-server, so the browser never needs (and never gets blocked by)
CORS from the portal directly.

## Run locally

```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then test:
```
curl http://localhost:8000/api/health
curl http://localhost:8000/api/stations
curl "http://localhost:8000/api/hourly?station=46250047&from=2025-01-01&to=2025-01-02"
```

**Important — this has not been tested against the real RVVCCA portal yet.**
My sandbox's network only allows a fixed set of package-registry domains,
so I couldn't reach `rvvcca.pica.gva.es` to confirm the request actually
works end-to-end. The request logic is a direct port of
`src/rvvcca_ingestion_hourly.py` (`build_url`, column mapping, normalisation),
so it should work, but please run the curl commands above on your own
machine before assuming it's solid — if the raw JSON shape differs even
slightly from what the pipeline script expects, `_normalise_row` may need
small adjustments.

## Deploy (Render)

1. Push this repo to GitHub (already done)
2. In Render: New → Web Service → connect the repo
3. Root Directory: `backend`
4. Render should pick up `render.yaml` automatically; if not, set manually:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Once deployed, note the `.onrender.com` URL
6. Add a CNAME at Nominalia: `api` → `<your-service>.onrender.com`
7. Add `api.strata-atmos.com` as a custom domain in Render's dashboard

## Endpoints

- `GET /api/health` — health check
- `GET /api/stations` — list of Valencia stations (code, name, lat/lon)
- `GET /api/hourly?station=<code>&from=YYYY-MM-DD&to=YYYY-MM-DD` — hourly readings
