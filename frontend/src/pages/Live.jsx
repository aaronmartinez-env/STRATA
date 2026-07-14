import { useState, useEffect, useCallback } from 'react';
import { fetchStations, fetchHourly, fetchCurrent } from '../api';
import CityViz3D from '../components/CityViz3D';
import MultiFieldChart from '../components/MultiFieldChart';
import AirQualityHeatmap from '../components/AirQualityHeatmap';
import './Live.css';

const OVERVIEW_FIELDS = ['pm10', 'pm25', 'no2', 'o3'];

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function shiftYears(dateStr, years) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
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

  // Compare mode
  const [compareOn, setCompareOn] = useState(false);
  const [compareType, setCompareType] = useState('station'); // 'station' | 'lastyear'
  const [compareStation, setCompareStation] = useState('');
  const [compareReadings, setCompareReadings] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);

  const [heatmapField, setHeatmapField] = useState('pm10');

  useEffect(() => {
    fetchStations().then((data) => {
      setStations(data.stations);
      if (data.stations.length > 0) setStation(data.stations[0].code);
      if (data.stations.length > 1) setCompareStation(data.stations[1].code);
    });
  }, []);

  const loadSnapshot = useCallback(() => {
    setSnapshotLoading(true);
    fetchCurrent()
      .then((data) => setCurrentSnapshot(data.stations))
      .finally(() => setSnapshotLoading(false));
  }, []);

  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);

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

  // Compare data fetch — either another station over the same range,
  // or the same station shifted back exactly one year.
  useEffect(() => {
    if (!compareOn || !station) {
      setCompareReadings([]);
      return;
    }
    setCompareLoading(true);
    const params = compareType === 'station'
      ? { station: compareStation, from: dateRange.from, to: dateRange.to }
      : { station, from: shiftYears(dateRange.from, -1), to: shiftYears(dateRange.to, -1) };

    fetchHourly(params)
      .then((data) => setCompareReadings(data.readings))
      .catch(() => setCompareReadings([]))
      .finally(() => setCompareLoading(false));
  }, [compareOn, compareType, compareStation, station, dateRange]);

  const selectedStationName = stations.find((s) => s.code === station)?.name ?? station;
  const compareStationName = stations.find((s) => s.code === compareStation)?.name ?? compareStation;
  const compareLabel = compareType === 'station' ? compareStationName : 'Last year';

  return (
    <div className="live-wrap">

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

      <section className="live-section">
        <div className="sec-head"><div className="sec-num">02</div><h2 className="sec-title">3D city <em>view</em></h2></div>
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <CityViz3D stations={currentSnapshot} />
        </div>
      </section>

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

        <div className="compare-bar">
          <label className="compare-toggle">
            <input type="checkbox" checked={compareOn} onChange={(e) => setCompareOn(e.target.checked)} />
            <span className="live-label">Compare</span>
          </label>

          {compareOn && (
            <>
              <div className="control-group">
                <select className="live-input" value={compareType} onChange={(e) => setCompareType(e.target.value)}>
                  <option value="station">vs another station</option>
                  <option value="lastyear">vs same period last year</option>
                </select>
              </div>
              {compareType === 'station' && (
                <div className="control-group">
                  <select className="live-input" value={compareStation} onChange={(e) => setCompareStation(e.target.value)}>
                    {stations.filter((s) => s.code !== station).map((s) => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {compareLoading && <span className="live-label">Loading comparison…</span>}
            </>
          )}
        </div>

        {loading && <p className="status-loading">Loading readings…</p>}
        {error && !loading && <p className="status-error">{error}</p>}

        {!loading && !error && (
          <MultiFieldChart
            readings={readings}
            station={selectedStationName}
            dateRange={dateRange}
            compareReadings={compareOn ? compareReadings : null}
            compareLabel={compareLabel}
          />
        )}
      </section>

      <section className="live-section">
        <div className="sec-head"><div className="sec-num">04</div><h2 className="sec-title">Regional <em>surface</em></h2></div>
        <p style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '1rem' }}>
          An interpolated concentration surface across Valencia, built from the {currentSnapshot.length || 7}
          station readings above — same "ambient glow" style as smartphone weather apps.
        </p>
        <div className="live-controls" style={{ marginBottom: '1rem' }}>
          <div className="control-group">
            <span className="live-label">Pollutant</span>
            <select className="live-input" value={heatmapField} onChange={(e) => setHeatmapField(e.target.value)}>
              <option value="pm10">PM10</option>
              <option value="pm25">PM2.5</option>
              <option value="no2">NO2</option>
              <option value="o3">O3</option>
            </select>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '0.75rem' }}>
          <AirQualityHeatmap stations={currentSnapshot} field={heatmapField} />
        </div>
        <p style={{ fontSize: '0.7rem', opacity: 0.55, marginTop: '0.75rem', fontFamily: 'var(--mono)' }}>
          ⚠ Interpolated from only {currentSnapshot.length || 7} monitoring stations — a smoothed visual estimate,
          not a validated concentration map. Treat it as illustrative, not measurement-grade between sensors.
        </p>
      </section>

      <footer className="live-attribution">
        Data: RVVCCA hourly network via{' '}
        <a href="https://rvvcca.pica.gva.es" target="_blank" rel="noreferrer">rvvcca.pica.gva.es</a>
        {' '}(Generalitat Valenciana) · fetched live through STRATA's own proxy —{' '}
        <a href="https://opendata.vlci.valencia.es" target="_blank" rel="noreferrer">opendata.vlci.valencia.es</a>
        {' '}for historical bulk downloads. CC BY 4.0.
      </footer>
    </div>
  );
}
