/**
 * WindSimulator.jsx
 * Strata — Atmospheric Wind & Dispersion Simulator
 *
 * ── LIVE DATA CONNECTION ──────────────────────────────────────────────────────
 * Wind values: /api/current → station.wind_speed / station.wind_direction
 * Coordinates: /api/stations → station.lat / station.lon
 * To swap fields: update normaliseStation() below
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchStations, fetchCurrent } from '../api';
import styles from './WindSimulator.module.css';

// ── Geographic projection ─────────────────────────────────────────────────────
const REF_LAT = 39.4699;
const REF_LON = -0.3763;
const M_PER_DEG_LAT = 111_320;
const ZOOM = 0.014;

function project(lat, lon, W, H) {
  const mx = (lon - REF_LON) * M_PER_DEG_LAT * Math.cos((REF_LAT * Math.PI) / 180);
  const my = (lat - REF_LAT) * M_PER_DEG_LAT;
  return {
    x: W / 2 + mx * ZOOM,
    y: H / 2 - my * ZOOM,
  };
}

// ── Normalise API station ─────────────────────────────────────────────────────
function normaliseStation(s) {
  return {
    code:      s.code           ?? s.station_code,
    name:      s.name           ?? s.station        ?? s.station_name,
    lat:       s.lat            ?? s.latitude,
    lon:       s.lon            ?? s.longitude,
    windSpeed: s.wind_speed     ?? s.windSpeed       ?? null,
    windDir:   s.wind_direction ?? s.windDir         ?? null,
  };
}

// ── Particle factory — receptor model ─────────────────────────────────────────
// Particles spawn on the upwind boundary and travel downwind toward the station.
// U/V are the wind vector components (east, north in geographic coords).
// In canvas coords: x increases east, y increases south — so V is inverted.
function makeReceptorParticle(W, H, U, V) {
  const absU = Math.abs(U);
  const absV = Math.abs(V);
  const total = absU + absV || 1;
  const r = Math.random() * total;
  let x, y;

  if (r < absU) {
    // Spawn on left edge if wind blows east (U>0), right edge if west (U<0)
    x = U > 0 ? -15 + Math.random() * 10 : W + 5 + Math.random() * 10;
    y = Math.random() * H;
  } else {
    // Spawn on top edge if wind blows south in canvas (V<0), bottom if north (V>0)
    x = Math.random() * W;
    y = V < 0 ? -15 + Math.random() * 10 : H + 5 + Math.random() * 10;
  }

  return {
    x,
    y,
    age:    Math.floor(Math.random() * 60), // small stagger to avoid wave effect
    maxAge: 400 + Math.random() * 200,
  };
}

// ── Speed → colour ────────────────────────────────────────────────────────────
function speedToColor(speed) {
  const t = Math.min(speed / 10, 1);
  if (t < 0.5) {
    const u = t / 0.5;
    return `rgba(${Math.round(u * 255)},${Math.round(212 - u * 62)},${Math.round(255 - u * 255)},`;
  }
  const u = (t - 0.5) / 0.5;
  return `rgba(255,${Math.round(154 - u * 154)},0,`;
}

// ── Stylised Valencia geography (canvas paths) ────────────────────────────────
// All points are [lat, lon] projected at runtime — no hardcoded pixels.
// Approximate outlines only; enough for geographic context.

// Mediterranean coastline (north→south along the Valencia coast)
const COAST_POINTS = [
  [39.620, -0.235], [39.580, -0.218], [39.520, -0.210],
  [39.480, -0.215], [39.450, -0.220], [39.410, -0.230],
  [39.370, -0.245], [39.330, -0.260],
];

// Turia river rough path (west→east to the sea)
const TURIA_POINTS = [
  [39.490, -0.520], [39.488, -0.480], [39.482, -0.440],
  [39.476, -0.400], [39.470, -0.370], [39.468, -0.330],
  [39.465, -0.290], [39.462, -0.260], [39.460, -0.230],
];

// Valencia city rough boundary (simplified polygon)
const CITY_POINTS = [
  [39.510, -0.420], [39.510, -0.340], [39.490, -0.310],
  [39.460, -0.320], [39.445, -0.360], [39.450, -0.430],
  [39.470, -0.450], [39.490, -0.445],
];

// L'Albufera lake (south of city)
const ALBUFERA_POINTS = [
  [39.380, -0.345], [39.360, -0.330], [39.340, -0.335],
  [39.330, -0.355], [39.345, -0.375], [39.370, -0.370],
];

function drawGeography(ctx, W, H) {
  function path(pts, close = false) {
    if (!pts.length) return;
    ctx.beginPath();
    const p0 = project(pts[0][0], pts[0][1], W, H);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < pts.length; i++) {
      const p = project(pts[i][0], pts[i][1], W, H);
      ctx.lineTo(p.x, p.y);
    }
    if (close) ctx.closePath();
  }

  // Sea fill — east of coastline
  ctx.save();
  path(COAST_POINTS);
  ctx.lineTo(project(COAST_POINTS[COAST_POINTS.length-1][0], 0.1, W, H).x, project(COAST_POINTS[COAST_POINTS.length-1][0], 0.1, W, H).y);
  ctx.lineTo(project(COAST_POINTS[0][0], 0.1, W, H).x, project(COAST_POINTS[0][0], 0.1, W, H).y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,40,80,0.28)';
  ctx.fill();

  // Coastline
  path(COAST_POINTS);
  ctx.strokeStyle = 'rgba(0,180,220,0.22)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // City boundary
  path(CITY_POINTS, true);
  ctx.fillStyle   = 'rgba(0,212,255,0.04)';
  ctx.strokeStyle = 'rgba(0,212,255,0.12)';
  ctx.lineWidth   = 0.8;
  ctx.fill();
  ctx.stroke();

  // Turia river
  path(TURIA_POINTS);
  ctx.strokeStyle = 'rgba(0,160,200,0.30)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Albufera
  path(ALBUFERA_POINTS, true);
  ctx.fillStyle   = 'rgba(0,120,180,0.18)';
  ctx.strokeStyle = 'rgba(0,150,200,0.20)';
  ctx.lineWidth   = 0.8;
  ctx.fill();
  ctx.stroke();

  // Grid lines (lat/lon)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth   = 0.5;
  for (let lat = 39.3; lat <= 39.7; lat += 0.05) {
    const a = project(lat, -0.6, W, H);
    const b = project(lat,  0.1, W, H);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let lon = -0.6; lon <= 0.1; lon += 0.05) {
    const a = project(39.3, lon, W, H);
    const b = project(39.7, lon, W, H);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  ctx.restore();
}

const N_PARTICLES = 320;

// ── Main component ────────────────────────────────────────────────────────────
export default function WindSimulator() {
  const [stations,    setStations]    = useState([]);
  const [currentData, setCurrentData] = useState([]);
  const [apiStatus,   setApiStatus]   = useState('loading');
  const [sourceCode,  setSourceCode]  = useState('');
  const [windSpeed,   setWindSpeed]   = useState(3);
  const [windAngle,   setWindAngle]   = useState(270);
  const [liveOverride,setLiveOverride]= useState(false);
  const [isRunning,   setIsRunning]   = useState(true);

  const canvasRef    = useRef(null);
  const stateRef     = useRef({ windSpeed: 3, windAngle: 270, sourceCode: '', isRunning: true });
  const stationsRef  = useRef([]);   // always-current stations for the draw loop
  const particleRef  = useRef([]);
  const rafRef       = useRef(null);
  const initialised  = useRef(false);

  // Keep stationsRef current without restarting loop
  useEffect(() => { stationsRef.current = stations; }, [stations]);

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

  // ── Fetch current (live wind)
  useEffect(() => {
    fetchCurrent()
      .then(d => {
        const s = (d.stations || d.current || []).map(normaliseStation);
        setCurrentData(s);
        setApiStatus('ok');
      })
      .catch(() => setApiStatus('error'));
  }, []);

  // ── Load live wind when station selected
  useEffect(() => {
    if (!sourceCode || !currentData.length) return;
    const live = currentData.find(s => s.code === sourceCode);
    if (live?.windSpeed != null && live?.windDir != null) {
      setWindSpeed(parseFloat(live.windSpeed.toFixed(1)));
      setWindAngle(Math.round(live.windDir));
      setLiveOverride(true);
    } else {
      setLiveOverride(false);
    }
  }, [sourceCode, currentData]);

  // ── Keep stateRef in sync (no loop restart needed)
  useEffect(() => {
    stateRef.current = { windSpeed, windAngle, sourceCode, isRunning };
  }, [windSpeed, windAngle, sourceCode, isRunning]);

  // ── Single persistent animation loop
  const startLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function getSource() {
      const W = canvas.width;
      const H = canvas.height;
      const src = stationsRef.current.find(s => s.code === stateRef.current.sourceCode);
      if (src?.lat && src?.lon) return project(src.lat, src.lon, W, H);
      return { x: W / 2, y: H / 2 };
    }

    // Initialise particles spread across the canvas so it looks populated immediately.
    // They'll be recycled to upwind edges as they age out.
    const W0 = canvas.width;
    const H0 = canvas.height;
    const initRad = (stateRef.current.windAngle * Math.PI) / 180;
    const initU = Math.sin(initRad);
    const initV = Math.cos(initRad);
    particleRef.current = Array.from({ length: N_PARTICLES }, (_, i) => {
      // Half spawn randomly across canvas (immediate visual), half on upwind edge
      if (i < N_PARTICLES / 2) {
        return { x: Math.random() * W0, y: Math.random() * H0, age: Math.random() * 300, maxAge: 400 + Math.random() * 200 };
      }
      return makeReceptorParticle(W0, H0, initU, initV);
    });

    function tick() {
      const W = canvas.width;
      const H = canvas.height;
      const { windSpeed: ws, windAngle: wa, isRunning: running } = stateRef.current;
      const { x: sx, y: sy } = getSource();

      // FIX 2 & 3: draw geographic background each frame before fade
      ctx.clearRect(0, 0, W, H);
      drawGeography(ctx, W, H);

      // Fade overlay for particle trails
      ctx.fillStyle = 'rgba(4,6,10,0.15)';
      ctx.fillRect(0, 0, W, H);

      // Wind vector
      const rad = (wa * Math.PI) / 180;
      const U = ws * Math.sin(rad);
      const V = ws * Math.cos(rad);

      // Station markers
      stationsRef.current.forEach(s => {
        const { x, y } = project(s.lat, s.lon, W, H);
        const isSource = s.code === stateRef.current.sourceCode;

        // Glow ring for active station
        if (isSource) {
          const grad = ctx.createRadialGradient(x, y, 0, x, y, 18);
          grad.addColorStop(0, 'rgba(0,212,255,0.18)');
          grad.addColorStop(1, 'rgba(0,212,255,0)');
          ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, isSource ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isSource ? 'rgba(0,212,255,0.95)' : 'rgba(58,80,96,0.85)';
        ctx.fill();
        ctx.strokeStyle = isSource ? 'rgba(0,212,255,0.5)' : 'rgba(80,110,130,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = isSource ? 'rgba(200,216,232,0.9)' : 'rgba(58,80,96,0.75)';
        ctx.font = `${isSource ? '500' : '400'} ${isSource ? 11 : 10}px "IBM Plex Mono", monospace`;
        ctx.fillText(s.name, x + 10, y + 4);
      });

      if (!running) { rafRef.current = requestAnimationFrame(tick); return; }

      // ── Receptor particle system ──────────────────────────────────────────
      // Particles travel FROM upwind boundary TOWARD the station (receptor).
      // They "die" (get recycled) when they reach the station's vicinity,
      // simulating capture by the sensor.
      const CAPTURE_RADIUS = 14;  // px — how close before "captured"
      const colBase = speedToColor(ws);

      particleRef.current.forEach(p => {
        p.x += U * 0.55;
        p.y -= V * 0.55;  // V inverted: canvas y increases downward
        p.age++;

        const dx = p.x - sx;
        const dy = p.y - sy;
        const distToStation = Math.sqrt(dx * dx + dy * dy);

        // Captured by receptor — recycle to upwind boundary
        if (distToStation < CAPTURE_RADIUS) {
          // Brief flash effect: draw a tiny burst at capture point
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,212,255,0.6)';
          ctx.fill();
          Object.assign(p, makeReceptorParticle(W, H, U, V));
          return;
        }

        // Drifted offscreen without reaching station — recycle
        if (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30 || p.age > p.maxAge) {
          Object.assign(p, makeReceptorParticle(W, H, U, V));
          return;
        }

        // Fade in near spawn, fade out near station for depth effect
        const normalDist = Math.min(distToStation / (Math.max(W, H) * 0.5), 1);
        const ageFade = Math.min(p.age / 40, 1); // fade in over first 40 frames
        const alpha = ageFade * (0.2 + normalDist * 0.55);

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `${colBase}${alpha.toFixed(2)})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []); // no deps — loop reads everything via refs

  // ── Canvas init (once stations load)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stations.length || initialised.current) return;
    initialised.current = true;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    cancelAnimationFrame(rafRef.current);
    startLoop();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [stations, startLoop]);

  // ── UI derived values
  const activeStation = stations.find(s => s.code === sourceCode);
  const compassDir = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const compass = compassDir[Math.round(windAngle / 22.5) % 16];
  const Uval = (windSpeed * Math.sin((windAngle * Math.PI) / 180)).toFixed(2);
  const Vval = (windSpeed * Math.cos((windAngle * Math.PI) / 180)).toFixed(2);

  return (
    <div className={styles.wrap}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Atmospheric Dispersion · Valencia · RVVCCA</span>
          <h2 className={styles.title}>Wind <em>Simulator</em></h2>
        </div>
        <div className={styles.statusBadge} data-status={apiStatus}>
          {apiStatus === 'loading' && '⏳ Fetching live wind data...'}
          {apiStatus === 'ok'      && '✓ Live wind data connected'}
          {apiStatus === 'error'   && '⚠ Using manual controls'}
        </div>
      </div>

      {/* Canvas — full width */}
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} />

        {/* Wind compass overlay */}
        <div className={styles.windOverlay}>
          <div className={styles.windArrow} style={{ transform: `rotate(${windAngle}deg)` }}>↑</div>
          <div className={styles.windLabel}>{windAngle}° {compass}</div>
          <div className={styles.windSpeed}>{windSpeed.toFixed(1)} m/s</div>
        </div>

        {/* Pause */}
        <button
          className={`${styles.pauseBtn} ${!isRunning ? styles.paused : ''}`}
          onClick={() => { setIsRunning(r => !r); stateRef.current.isRunning = !stateRef.current.isRunning; }}
        >
          {isRunning ? '⏸ Pause' : '▶ Resume'}
        </button>

        {/* Map legend */}
        <div className={styles.legend}>
          <div className={styles.legendRow}><span style={{background:'rgba(0,180,220,0.5)'}} className={styles.legendDot}/> Coastline</div>
          <div className={styles.legendRow}><span style={{background:'rgba(0,212,255,0.9)'}} className={styles.legendDot}/> Receptor station</div>
          <div className={styles.legendRow}><span style={{background:'rgba(58,80,96,0.85)'}} className={styles.legendDot}/> Station</div>
        </div>
      </div>

      {/* Controls — below canvas, horizontal */}
      <div className={styles.controls}>

        <div className={styles.controlGroup}>
          <label className={styles.label}>Receptor Station</label>
          <select className={styles.select} value={sourceCode} onChange={e => setSourceCode(e.target.value)}>
            {stations.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          {liveOverride && <span className={styles.liveTag}>↻ Live values loaded</span>}
        </div>

        <div className={styles.controlGroup}>
          <label className={styles.label}>
            Wind Direction <span className={styles.sliderVal}>{windAngle}° {compass}</span>
          </label>
          <input type="range" min="0" max="359" step="1" value={windAngle}
            className={styles.slider}
            onChange={e => { setWindAngle(+e.target.value); setLiveOverride(false); }} />
          <span className={styles.sliderHint}>0° = from North · clockwise</span>
        </div>

        <div className={styles.controlGroup}>
          <label className={styles.label}>
            Wind Speed <span className={styles.sliderVal}>{windSpeed.toFixed(1)} m/s</span>
          </label>
          <input type="range" min="0" max="10" step="0.1" value={windSpeed}
            className={styles.slider}
            onChange={e => { setWindSpeed(+e.target.value); setLiveOverride(false); }} />
        </div>

        <div className={styles.vectorBox}>
          <div className={styles.vectorLabel}>Vector</div>
          <div className={styles.vectorRow}>
            <span className={styles.vectorKey}>U (east)</span>
            <span className={styles.vectorVal} style={{ color: Uval >= 0 ? 'var(--cyan)' : 'var(--amber)' }}>
              {Uval > 0 ? '+' : ''}{Uval}
            </span>
          </div>
          <div className={styles.vectorRow}>
            <span className={styles.vectorKey}>V (north)</span>
            <span className={styles.vectorVal} style={{ color: Vval >= 0 ? 'var(--cyan)' : 'var(--amber)' }}>
              {Vval > 0 ? '+' : ''}{Vval}
            </span>
          </div>
        </div>

        {!liveOverride && apiStatus === 'ok' && activeStation && (
          <div className={styles.controlGroup}>
            <button className={styles.resetBtn} onClick={() => {
              const live = currentData.find(s => s.code === sourceCode);
              if (live?.windSpeed != null) {
                setWindSpeed(parseFloat(live.windSpeed.toFixed(1)));
                setWindAngle(Math.round(live.windDir));
                setLiveOverride(true);
              }
            }}>↻ Reset to live</button>
          </div>
        )}

      </div>

      <div className={styles.disclaimer}>
        Particles represent ambient air mass transport toward the receptor station — not concentration or AQI.
        The station captures pollutants arriving from the upwind direction. Wind data is provisional (RVVCCA / GVA).
      </div>

    </div>
  );
}
