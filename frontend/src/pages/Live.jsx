import React, { useState, useEffect, useCallback } from 'react';
import { fetchStations, fetchHourly, fetchCurrent, ApiError } from '../api';
import ReadingsChart from '../components/ReadingsChart';
import CityViz3D from '../components/CityViz3D';
import './Live.css';

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
  const [currentSnapshot, setCurrentSnapshot] = useState([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // Fetch Stations
  useEffect(() => {
    fetchStations().then(data => {
      setStations(data.stations);
      if (data.stations.length > 0) setStation(data.stations[0].code);
    });
  }, []);

  // Fetch Current (Snapshot)
  useEffect(() => {
    setSnapshotLoading(true);
    fetchCurrent().then(data => setCurrentSnapshot(data.stations)).finally(() => setSnapshotLoading(false));
  }, []);

  // Fetch Hourly Data
  const loadReadings = useCallback(() => {
    if (!station) return;
    setLoading(true);
    fetchHourly({ station, from: dateRange.from, to: dateRange.to })
      .then(data => setReadings(data.readings))
      .finally(() => setLoading(false));
  }, [station, dateRange]);

  useEffect(() => { loadReadings(); }, [loadReadings]);

  return (
    <div className="live-wrap">
      
      {/* 01: Current Readings */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">01</div><h2 className="sec-title">Current <em>readings</em></h2></div>
        <div className="current-grid">
          {snapshotLoading ? 
            Array.from({length:7}).map((_,i) => <div key={i} className="current-card"><div className="skeleton"></div></div>) :
            currentSnapshot.map(st => (
              <div key={st.code} className={`current-card ${station === st.code ? 'selected' : ''}`} onClick={() => setStation(st.code)}>
                <div className="cc-name">{st.name}</div>
                <div className="cc-row"><span className="cc-label">PM10</span><span className="cc-val" style={{color: st.pm10 > 40 ? 'var(--amber)' : 'var(--cyan)'}}>{st.pm10 || '—'}</span></div>
              </div>
            ))
          }
        </div>
      </section>

      {/* 02: 3D View */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">02</div><h2 className="sec-title">3D city <em>view</em></h2></div>
        <div className="glass-panel" style={{padding:0, overflow:'hidden'}}><CityViz3D stations={currentSnapshot} /></div>
      </section>

      {/* 03: Controls */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">03</div><h2 className="sec-title">Controls <em>& time series</em></h2></div>
        <div className="live-controls">
          <div className="control-group">
            <span className="live-label">Station</span>
            <select className="live-input" value={station} onChange={(e) => setStation(e.target.value)}>
              {stations.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div className="control-group">
            <span className="live-label">From</span>
            <input type="date" className="live-input" value={dateRange.from} onChange={(e) => setDateRange(prev => ({...prev, from: e.target.value}))} />
          </div>
          <div className="control-group">
            <span className="live-label">To</span>
            <input type="date" className="live-input" value={dateRange.to} onChange={(e) => setDateRange(prev => ({...prev, to: e.target.value}))} />
          </div>
        </div>

        {/* 04: Chart Groups */}
        <div className="chart-grid">
          <div className="glass-panel"><div className="gp-label">Nitrogen</div><ReadingsChart data={readings} fields={['no2', 'no', 'nox']} /></div>
          <div className="glass-panel"><div className="gp-label">Oxidants</div><ReadingsChart data={readings} fields={['o3', 'so2']} /></div>
          <div className="glass-panel"><div className="gp-label">Particles</div><ReadingsChart data={readings} fields={['pm10', 'pm25', 'co']} /></div>
          <div className="glass-panel"><div className="gp-label">Meteo</div><ReadingsChart data={readings} fields={['temperature', 'wind_speed', 'precipitation']} /></div>
        </div>
      </section>
    </div>
  );
}
