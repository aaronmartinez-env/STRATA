import { useState, useEffect, useCallback } from 'react';
import { fetchStations, fetchHourly, fetchCurrent } from '../api';
import CityViz3D from '../components/CityViz3D';
import MultiFieldChart from '../components/MultiFieldChart';
import './Live.css';

const OVERVIEW_FIELDS = ['pm10', 'pm25', 'no2', 'o3'];

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default function Live() {
  const [stations, setStations] = useState([]);
  const [station, setStation] = useState('');
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSnapshot, setCurrentSnapshot] = useState([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // Fetch station list once
  useEffect(() => {
    fetchStations().then((data) => {
      setStations(data.stations);
      if (data.stations.length > 0) setStation(data.stations[0].code);
    });
  }, []);

  // Fetch current snapshot (all stations, latest reading) — for the
  // overview grid and the 3D view. Independent of the selected station.
  const loadSnapshot = useCallback(() => {
    setSnapshotLoading(true);
    fetchCurrent()
      .then((data) => setCurrentSnapshot(data.stations))
      .finally(() => setSnapshotLoading(false));
  }, []);

  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);

  // Fetch hourly time series for the selected station + date range
  const loadReadings = useCallback(() => {
    if (!station) return;
    setLoading(true);
    setError(null);
    fetchHourly({ station, from: dateRange.from, to: dateRange.to })
      .then((data) => setReadings(data.readings))
      .catch((err) => setError(err.message || 'Could not load readings.'))
      .finally(() => setLoading(false));
  }, [station, dateRange]);

  useEffect(() => { loadReadings(); }, [loadReadings]);

  const selectedStationName = stations.find((s) => s.code === station)?.name ?? station;

  return (
    <div className="live-wrap">

      {/* 01: Current Readings — a read-only snapshot of all stations.
          This does NOT control which station the time-series below
          shows; use the "Station" dropdown in section 03 for that. */}
      <section className="live-section">
        <div className="sec-head">
          <div className="sec-num">01</div>
          <h2 className="sec-title">Current <em>readings</em></h2>
          <button onClick={loadSnapshot} disabled={snapshotLoading} style={{ marginLeft: 'auto' }}>
            {snapshotLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <div className="current-grid">
          {snapshotLoading && currentSnapshot.length === 0 ? (
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="current-card">
                <div className="skeleton tall" style={{ width: '60%' }} />
                <div className="skeleton" />
                <div className="skeleton" />
              </div>
            ))
          ) : (
            currentSnapshot.map((st) => (
              <div key={st.code} className="current-card">
                <div className="cc-name">{st.name}</div>
                {OVERVIEW_FIELDS.map((f) => (
                  <div className="cc-row" key={f}>
                    <span className="cc-label">{f.toUpperCase()}</span>
                    <span className="cc-val">
                      {st.reading?.[f] != null ? st.reading[f].toFixed(1) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </section>

      {/* 02: 3D View */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">02</div><h2 className="sec-title">3D city <em>view</em></h2></div>
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <CityViz3D stations={currentSnapshot} />
        </div>
      </section>

      {/* 03: Controls & time series — the sole place to pick station,
          date range, and pollutants for the chart below. */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">03</div><h2 className="sec-title">Controls <em>& time series</em></h2></div>
        <div className="live-controls">
          <div className="control-group">
            <span className="live-label">Station</span>
            <select className="live-input" value={station} onChange={(e) => setStation(e.target.value)}>
              {stations.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div className="control-group">
            <span className="live-label">From</span>
            <input type="date" className="live-input" value={dateRange.from} max={dateRange.to} onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))} />
          </div>
          <div className="control-group">
            <span className="live-label">To</span>
            <input type="date" className="live-input" value={dateRange.to} min={dateRange.from} onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))} />
          </div>
        </div>

        {loading && <p className="status-loading">Loading readings…</p>}
        {error && !loading && <p className="status-error">{error}</p>}

        {!loading && !error && (
          <MultiFieldChart readings={readings} station={selectedStationName} dateRange={dateRange} />
        )}
      </section>
    </div>
  );
}
