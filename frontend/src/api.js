// api.js — thin client for the STRATA backend.
//
// The base URL switches automatically: in local dev it points at the
// FastAPI dev server, in production it points at the deployed API
// subdomain. Override with VITE_API_BASE_URL if needed.

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:8000' : 'https://api.strata-atmos.com');

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function get(path) {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response wasn't JSON, fall back to statusText
    }
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

export function fetchStations() {
  return get('/api/stations');
}

export function fetchHourly({ station, from, to }) {
  const params = new URLSearchParams({ station, from, to });
  return get(`/api/hourly?${params.toString()}`);
}

export function fetchCurrent() {
  return get('/api/current');
}

export { ApiError };
