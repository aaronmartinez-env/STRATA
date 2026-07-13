/**
 * WindSimulator.jsx
 * Strata — Atmospheric Wind & Dispersion Simulator
 *
 * A 2D canvas-based particle system that visualises pollutant dispersion
 * across Valencia based on real or manually-adjusted wind conditions.
 *
 * Props: none (fetches its own data via the Strata API)
 *
 * ── LIVE DATA CONNECTION ──────────────────────────────────────────────────────
 * Wind values come from /api/current → station.wind_speed / station.wind_direction
 * Station coordinates come from /api/stations → station.lat / station.lon
 * To swap data source: update API_BASE and the field names in normaliseStation()
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchStations, fetchCurrent } from '../api';
import styles from './WindSimulator.module.css';

// ── Geographic projection ─────────────────────────────────────────────────────
// Projects lat/lon onto a canvas plane centred on Valencia.
const REF_LAT = 39.4699;
const REF_LON = -0.3763;
const M_PER_DEG_LAT = 111_320;

function project(lat, lon, canvasW, canvasH, zoom = 0.012) {
  const mx = (lon - REF_LON) * M_PER_DEG_LAT * Math.cos((REF_LAT * Math.PI) / 180);
  const my = (lat - REF_LAT) * M_PER_DEG_LAT;
  return {
    x: canvasW / 2 + mx * zoom,
    y: canvasH / 2 - my * zoom,
  };
}

// ── Normalise API station object ──────────────────────────────────────────────
// ↓ LIVE DATA CONNECTION — update field names here if the API shape changes
function normaliseStation(s) {
  return {
    code:       s.code       ?? s.station_code,
    name:       s.name       ?? s.station      ?? s.station_name,
    lat:        s.lat        ?? s.latitude,
    lon:        s.lon        ?? s.longitude,
    windSpeed:  s.wind_speed ?? s.windSpeed     ?? null,   // m/s
    windDir:    s.wind_direction ?? s.windDir   ?? null,   // degrees (met convention)
  };
}

// ── Particle factory ──────────────────────────────────────────────────────────
function makeParticle(cx, cy, spread = 60) {
  return {
    x:   cx + (Math.random() - 0.5) * spread,
    y:   cy + (Math.random() - 0.5) * spread,
    age: Math.random() * 200,
    maxAge: 180 + Math.random() * 120,
  };
}

// ── Colour helpers ────────────────────────────────────────────────────────────
function speedToColor(speed) {
  // 0 m/s → cyan, 5 m/s → amber, 10+ m/s → red
  const t = Math.min(speed / 10, 1);
  if (t < 0.5) {
    const u = t / 0.5;
    return `rgba(${Math.round(u * 255)},${Math.round(212 - u * 62)},${Math.round(255 - u * 255)},`;
  } else {
    const u = (t - 0.5) / 0.5;
    return `rgba(255,${Math.round(154 - u * 154)},0,`;
  }
}

const N_PARTICLES = 300;

// ── Main component ────────────────────────────────────────────────────────────
export default function WindSimulator() {
  // ── API state
  const [stations,      setStations]      = useState([]);
  const [currentData,   setCurrentData]   = useState([]);
  const [apiStatus,     setApiStatus]     = useState('loading'); // 'loading'|'ok'|'error'

  // ── Simulation controls
  const [sourceCode,    setSourceCode]    = useState('');
  const [windSpeed,     setWindSpeed]     = useState(3);
  const [windAngle,     setWindAngle]     = useState(270); // meteorological degrees
  const [liveOverride,  setLiveOverride]  = useState(false);
  const [isRunning,     setIsRunning]     = useState(true);

  // ── Canvas refs
  const canvasRef   = useRef(null);
  const stateRef    = useRef({ windSpeed: 3, windAngle: 270, sourceX: 0, sourceY: 0, isRunning: true });
  const particleRef = useRef([]);
  const rafRef      = useRef(null);

  // ── Fetch stations
  useEffect(() => {
    fetchStations()
      .then(d => {
        const s = (d.stations || []).map(normaliseStation);
        setStations(s);
        if (s.length) setSourceCode(s[0].code);
      })
      .catch(() => setApiStatus('error'));
  }, []);

  // ── Fetch current snapshot for live wind data
  useEffect(() => {
    setApiStatus('loading');
    fetchCurrent()
      .then(d => {
        const s = (d.stations || d.current || []).map(normaliseStation);
        setCurrentData(s);
        setApiStatus('ok');
      })
      .catch(() => setApiStatus('error'));
  }, []);

  // ── When source station changes, pull its live wind values (if available)
  useEffect(() => {
    if (!sourceCode || !currentData.length) return;
    const live = currentData.find(s => s.code === sourceCode);
    if (live && live.windSpeed != null && live.windDir != null) {
      setWindSpeed(parseFloat(live.windSpeed.toFixed(1)));
      setWindAngle(Math.round(live.windDir));
      setLiveOverride(true);
    } else {
      setLiveOverride(false);
    }
  }, [sourceCode, currentData]);

  // ── Keep stateRef in sync so canvas loop reads latest without re-init
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceCode) return;
    const src = stations.find(s => s.code === sourceCode);
    if (!src) return;
    const { x, y } = project(src.lat, src.lon, canvas.width, canvas.height);
    stateRef.current = { windSpeed, windAngle, sourceX: x, sourceY: y, isRunning };
  }, [windSpeed, windAngle, sourceCode, stations, isRunning]);

  // ── Canvas animation loop
  const startLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Init particles around source
    const { sourceX, sourceY } = stateRef.current;
    particleRef.current = Array.from({ length: N_PARTICLES }, () =>
      makeParticle(sourceX || W / 2, sourceY || H / 2)
    );

    function tick() {
      const { windSpeed: ws, windAngle: wa, sourceX: sx, sourceY: sy, isRunning: running } = stateRef.current;

      if (!running) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Wind vector (meteorological convention: 0° = from north, clockwise)
      const rad = (wa * Math.PI) / 180;
      const U = ws * Math.sin(rad);   // east component
      const V = ws * Math.cos(rad);   // north component

      // Fade trail
      ctx.fillStyle = 'rgba(4,6,10,0.12)';
      ctx.fillRect(0, 0, W, H);

      // Draw station markers
      stations.forEach(s => {
        const { x, y } = project(s.lat, s.lon, W, H);
        ctx.beginPath();
        ctx.arc(x, y, s.code === sourceCode ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = s.code === sourceCode
          ? 'rgba(0,212,255,0.9)'
          : 'rgba(58,80,96,0.8)';
        ctx.fill();

        // Station name
        ctx.fillStyle = s.code === sourceCode
          ? 'rgba(200,216,232,0.85)'
          : 'rgba(58,80,96,0.7)';
        ctx.font = `${s.code === sourceCode ? 600 : 400} 10px "IBM Plex Mono", monospace`;
        ctx.fillText(s.name, x + 8, y + 4);
      });

      // Update & draw particles
      const colBase = speedToColor(ws);
      particleRef.current.forEach(p => {
        p.x += U * 0.6;
        p.y -= V * 0.6;
        p.age++;

        // Recycle off-screen or aged-out particles
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.age > p.maxAge) {
          Object.assign(p, makeParticle(sx || W / 2, sy || H / 2));
          return;
        }

        const life = 1 - p.age / p.maxAge;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `${colBase}${(life * 0.7).toFixed(2)})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [stations, sourceCode]);

  // ── Init / resize canvas and start loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stations.length) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();
    cancelAnimationFrame(rafRef.current);
    startLoop();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [stations, startLoop]);

  // ── Derived display values
  const activeStation = stations.find(s => s.code === sourceCode);
  const compassDir = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const compass = compassDir[Math.round(windAngle / 22.5) % 16];

  const U = (windSpeed * Math.sin((windAngle * Math.PI) / 180)).toFixed(2);
  const V = (windSpeed * Math.cos((windAngle * Math.PI) / 180)).toFixed(2);

  return (
    <div className={styles.wrap}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Atmospheric Dispersion · Valencia</span>
          <h2 className={styles.title}>Wind <em>Simulator</em></h2>
        </div>
        <div className={styles.statusBadge} data-status={apiStatus}>
          {apiStatus === 'loading' && '⏳ Fetching live wind data...'}
          {apiStatus === 'ok'      && '✓ Live wind data connected'}
          {apiStatus === 'error'   && '⚠ Using manual controls'}
        </div>
      </div>

      <div className={styles.layout}>

        {/* ── Canvas ── */}
        <div className={styles.canvasWrap}>
          <canvas ref={canvasRef} className={styles.canvas} />

          {/* Wind direction overlay */}
          <div className={styles.windOverlay}>
            <div className={styles.windArrow} style={{ transform: `rotate(${windAngle}deg)` }}>↑</div>
            <div className={styles.windLabel}>{windAngle}° {compass}</div>
          </div>

          <button
            className={`${styles.pauseBtn} ${!isRunning ? styles.paused : ''}`}
            onClick={() => {
              setIsRunning(r => !r);
              stateRef.current.isRunning = !stateRef.current.isRunning;
            }}
          >
            {isRunning ? '⏸ Pause' : '▶ Resume'}
          </button>
        </div>

        {/* ── Controls panel ── */}
        <div className={styles.panel}>

          {/* Source station */}
          <div className={styles.controlGroup}>
            <label className={styles.label}>Emission Source</label>
            <select
              className={styles.select}
              value={sourceCode}
              onChange={e => setSourceCode(e.target.value)}
            >
              {stations.map(s => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
            {liveOverride && (
              <span className={styles.liveTag}>↻ Live values loaded</span>
            )}
          </div>

          {/* Wind direction */}
          <div className={styles.controlGroup}>
            <label className={styles.label}>
              Wind Direction
              <span className={styles.sliderVal}>{windAngle}° {compass}</span>
            </label>
            <input
              type="range" min="0" max="359" step="1"
              value={windAngle}
              className={styles.slider}
              onChange={e => { setWindAngle(+e.target.value); setLiveOverride(false); }}
            />
            <div className={styles.sliderHint}>0° = from North · clockwise</div>
          </div>

          {/* Wind speed */}
          <div className={styles.controlGroup}>
            <label className={styles.label}>
              Wind Speed
              <span className={styles.sliderVal}>{windSpeed.toFixed(1)} m/s</span>
            </label>
            <input
              type="range" min="0" max="10" step="0.1"
              value={windSpeed}
              className={styles.slider}
              onChange={e => { setWindSpeed(+e.target.value); setLiveOverride(false); }}
            />
          </div>

          {/* Vector readout */}
          <div className={styles.vectorBox}>
            <div className={styles.vectorLabel}>Wind vector components</div>
            <div className={styles.vectorRow}>
              <span className={styles.vectorKey}>U (east)</span>
              <span className={styles.vectorVal} style={{ color: U >= 0 ? 'var(--cyan)' : 'var(--amber)' }}>
                {U > 0 ? '+' : ''}{U} m/s
              </span>
            </div>
            <div className={styles.vectorRow}>
              <span className={styles.vectorKey}>V (north)</span>
              <span className={styles.vectorVal} style={{ color: V >= 0 ? 'var(--cyan)' : 'var(--amber)' }}>
                {V > 0 ? '+' : ''}{V} m/s
              </span>
            </div>
          </div>

          {/* Reset to live */}
          {!liveOverride && apiStatus === 'ok' && activeStation && (
            <button
              className={styles.resetBtn}
              onClick={() => {
                const live = currentData.find(s => s.code === sourceCode);
                if (live?.windSpeed != null) {
                  setWindSpeed(parseFloat(live.windSpeed.toFixed(1)));
                  setWindAngle(Math.round(live.windDir));
                  setLiveOverride(true);
                }
              }}
            >
              ↻ Reset to live values
            </button>
          )}

          {/* Station info */}
          {activeStation && (
            <div className={styles.stationInfo}>
              <div className={styles.vectorLabel}>Selected station</div>
              <div className={styles.vectorRow}>
                <span className={styles.vectorKey}>Name</span>
                <span className={styles.vectorVal}>{activeStation.name}</span>
              </div>
              <div className={styles.vectorRow}>
                <span className={styles.vectorKey}>Lat</span>
                <span className={styles.vectorVal}>{activeStation.lat?.toFixed(4)}</span>
              </div>
              <div className={styles.vectorRow}>
                <span className={styles.vectorKey}>Lon</span>
                <span className={styles.vectorVal}>{activeStation.lon?.toFixed(4)}</span>
              </div>
            </div>
          )}

          <div className={styles.disclaimer}>
            Particles represent dispersion direction only — not concentration or AQI. 
            Wind data is provisional (RVVCCA / GVA).
          </div>

        </div>
      </div>
    </div>
  );
}
