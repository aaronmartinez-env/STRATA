import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { fetchStations, fetchHourly, ApiError } from '../api';
import ReadingsChart, { PLOTTABLE_FIELDS } from '../components/ReadingsChart';

function defaultDateRange() {
  // Default to the last 7 days — enough to see a real pattern without
  // being a huge request on first load.
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default function Live() {
  const [stations, setStations] = useState([]);
  const [stationsError, setStationsError] = useState(null);

  const [station, setStation] = useState('');
  const [field, setField] = useState('pm10');
  const [dateRange, setDateRange] = useState(defaultDateRange);

  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load the station list once on mount.
  useEffect(() => {
    fetchStations()
      .then((data) => {
        setStations(data.stations);
        if (data.stations.length > 0) {
          setStation((current) => current || data.stations[0].code);
        }
      })
      .catch((err) => setStationsError(err.message));
  }, []);

  const loadReadings = useCallback(() => {
    if (!station) return;
    setLoading(true);
    setError(null);
    fetchHourly({ station, from: dateRange.from, to: dateRange.to })
      .then((data) => setReadings(data.readings))
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not reach the STRATA API. Is the backend running?'
        );
        setReadings([]);
      })
      .finally(() => setLoading(false));
  }, [station, dateRange]);

  // Fetch whenever station or date range changes, once we have a station.
  useEffect(() => {
    if (station) loadReadings();
  }, [station, dateRange, loadReadings]);

  return (
    <section>
      <h1>Live Atmosphere</h1>
      <p>Clean exploration of RVVCCA hourly data — no interpretive framing.</p>

      {stationsError && (
        <p style={{ color: '#b3261e' }}>
          Could not load station list: {stationsError}
        </p>
      )}

      <div className="control-panel" style={{ display: 'flex', gap: '1rem', margin: '1.5rem 0', flexWrap: 'wrap' }}>
        <label>
          Station
          <select value={station} onChange={(e) => setStation(e.target.value)}>
            {stations.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Pollutant
          <select value={field} onChange={(e) => setField(e.target.value)}>
            {Object.entries(PLOTTABLE_FIELDS).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Start
          <input
            type="date"
            value={dateRange.from}
            min="2009-01-01"
            max={dateRange.to}
            onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>

        <label>
          End
          <input
            type="date"
            value={dateRange.to}
            min={dateRange.from}
            onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
      </div>

      <div className="graph-container" style={{ border: '1px solid #e2e2e2', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        {loading && <p style={{ textAlign: 'center', opacity: 0.6 }}>Loading readings…</p>}
        {error && !loading && (
          <p style={{ textAlign: 'center', color: '#b3261e' }}>{error}</p>
        )}
        {!loading && !error && (
          <ReadingsChart readings={readings} field={field} />
        )}
      </div>

      <div className="viz3d-placeholder" style={{ border: '1px dashed #ccc', padding: '2rem', opacity: 0.6 }}>
        3D city visualization — next pass, once 2D data flow is confirmed solid.
      </div>

      <p style={{ marginTop: '2rem' }}>
        Looking for the interpreted findings instead? See the{' '}
        <Link to="/case-studies/valencia-2021-2022">case studies</Link>.
      </p>
    </section>
  );
}
