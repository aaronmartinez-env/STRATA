import { Link } from 'react-router-dom';
import { useState } from 'react';

// Placeholder fixture shape — replace with real fetch to the FastAPI proxy
// once /api/hourly is live. Keep this shape in sync with StrataWorkerA's
// response-shaping work so swapping in the real endpoint is a one-line change.
const MOCK_RESPONSE = {
  station: '46250047',
  start: '2025-01-01T00:00:00Z',
  end: '2025-01-01T23:00:00Z',
  pollutant: 'PM10',
  readings: [], // [{ timestamp, value }, ...]
};

export default function Live() {
  const [station, setStation] = useState(MOCK_RESPONSE.station);
  const [pollutant, setPollutant] = useState(MOCK_RESPONSE.pollutant);
  const [dateRange, setDateRange] = useState({ start: MOCK_RESPONSE.start, end: MOCK_RESPONSE.end });

  return (
    <section>
      <h1>Live Atmosphere</h1>
      <p>Clean exploration of RVVCCA hourly data — no interpretive framing.</p>

      <div className="control-panel" style={{ display: 'flex', gap: '1rem', margin: '1.5rem 0' }}>
        <label>
          Station
          <select value={station} onChange={(e) => setStation(e.target.value)}>
            <option value="46250047">46250047</option>
            {/* Full station list to be config'd by StrataWorkerA */}
          </select>
        </label>

        <label>
          Pollutant
          <select value={pollutant} onChange={(e) => setPollutant(e.target.value)}>
            <option value="PM10">PM10</option>
            <option value="NO2">NO2</option>
            <option value="O3">O3</option>
          </select>
        </label>

        <label>
          Start
          <input
            type="date"
            value={dateRange.start.slice(0, 10)}
            onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
          />
        </label>

        <label>
          End
          <input
            type="date"
            value={dateRange.end.slice(0, 10)}
            onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
          />
        </label>
      </div>

      <div className="graph-placeholder" style={{ border: '1px dashed #ccc', padding: '2rem', marginBottom: '1rem' }}>
        Graph component goes here (StrataWorkerA)
      </div>

      <div className="viz3d-placeholder" style={{ border: '1px dashed #ccc', padding: '2rem' }}>
        3D city visualization goes here (StrataWorkerA)
      </div>

      <p style={{ marginTop: '2rem' }}>
        Looking for the interpreted findings instead? See the{' '}
        <Link to="/case-studies/valencia-2021-2022">case studies</Link>.
      </p>
    </section>
  );
}
