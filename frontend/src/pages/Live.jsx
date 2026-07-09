import React, { useState, useEffect, useCallback } from 'react';
import { fetchStations, fetchHourly, fetchCurrent, ApiError } from '../api';
import ReadingsChart, { PLOTTABLE_FIELDS } from '../components/ReadingsChart';
import CityViz3D from '../components/CityViz3D';
import './Live.css'; // Import the new CSS

export default function Live() {
  // --- EXISTING LOGIC (Preserved Exactly) ---
  const [stations, setStations] = useState([]);
  const [stationsError, setStationsError] = useState(null);
  const [station, setStation] = useState('');
  const [field, setField] = useState('pm10');
  const [dateRange, setDateRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const iso = (d) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to) };
  });
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSnapshot, setCurrentSnapshot] = useState([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState(null);

  const loadSnapshot = useCallback(() => {
    setSnapshotLoading(true);
    setSnapshotError(null);
    fetchCurrent()
      .then((data) => setCurrentSnapshot(data.stations))
      .catch((err) => setSnapshotError(err instanceof ApiError ? err.message : 'Could not reach the STRATA API.'))
      .finally(() => setSnapshotLoading(false));
  }, []);

  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);

  useEffect(() => {
    fetchStations()
      .then((data) => {
        setStations(data.stations);
        if (data.stations.length > 0) setStation((current) => current || data.stations[0].code);
      })
      .catch((err) => setStationsError(err.message));
  }, []);

  const loadReadings = useCallback(() => {
    if (!station) return;
    setLoading(true);
    setError(null);
    fetchHourly({ station, from: dateRange.from, to: dateRange.to })
      .then((data) => setReadings(data.readings))
      .catch((err) => { setError(err instanceof ApiError ? err.message : 'Backend error.'); setReadings([]); })
      .finally(() => setLoading(false));
  }, [station, dateRange]);

  useEffect(() => { if (station) loadReadings(); }, [station, dateRange, loadReadings]);

  // Helper for conditional coloring
  const getPm10Color = (val) => {
    if (val < 20) return 'var(--cyan)';
    if (val <= 40) return 'var(--amber)';
    return '#ff4455'; // Red
  };

  return (
    <div className="live-container">
      
      {/* 01: Current Readings */}
      <section>
        <div className="section-header">
          <div className="section-num">01</div>
          <h2 className="section-title">Current <em>readings</em></h2>
        </div>
        <div className="card-grid">
          {snapshotLoading ? 
            Array.from({length: 7}).map((_, i) => <div key={i} className="skeleton-card" />) :
            currentSnapshot.map(st => (
              <div key={st.code} className="station-card" onClick={() => setStation(st.code)}>
                <div style={{fontSize: '0.6rem', color: 'var(--cyan)', fontFamily: 'var(--mono)'}}>{st.name}</div>
                <div style={{color: getPm10Color(st.pm10)}}>PM10: {st.pm10}</div>
              </div>
            ))
          }
        </div>
      </section>

      {/* 02: 3D View */}
      <section style={{marginTop: '4rem'}}>
        <div className="section-header">
          <div className="section-num">02</div>
          <h2 className="section-title">3D city <em>view</em></h2>
        </div>
        <div className="glass-panel" style={{padding: 0, overflow: 'hidden'}}>
          <CityViz3D stations={currentSnapshot} field={field} />
        </div>
      </section>

      {/* 03: Controls */}
      <section style={{marginTop: '4rem'}}>
        <div className="section-header">
          <div className="section-num">03</div>
          <h2 className="section-title">Controls</h2>
        </div>
        <div className="controls-container">
           <div className="control-group">
             <label className="control-label">Station</label>
             <select className="glass-input" value={station} onChange={(e) => setStation(e.target.value)}>
                {stations.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
             </select>
           </div>
           {/* Add date inputs similarly */}
        </div>
      </section>

      {/* 04: Charts */}
      <section style={{marginTop: '4rem'}}>
        <div className="section-header">
          <div className="section-num">04</div>
          <h2 className="section-title">Time <em>series</em></h2>
        </div>
        <div className="charts-grid">
          <div className="glass-panel">
            <div className="control-label">Nitrogen (NO2, NO, NOx)</div>
            <ReadingsChart readings={readings} field="no2" />
          </div>
          <div className="glass-panel">
            <div className="control-label">Oxidants (O3, SO2)</div>
            <ReadingsChart readings={readings} field="o3" />
          </div>
          <div className="glass-panel">
            <div className="control-label">Particles (PM10, PM2.5, CO)</div>
            <ReadingsChart readings={readings} field="pm10" />
          </div>
          <div className="glass-panel">
            <div className="control-label">Meteo (Temp, Wind, Precip)</div>
            <ReadingsChart readings={readings} field="temperature" />
          </div>
        </div>
      </section>
    </div>
  );
}
