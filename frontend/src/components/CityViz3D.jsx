import React, { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Grid } from '@react-three/drei';
import { PLOTTABLE_FIELDS } from './ReadingsChart';

// ── ORIGINAL LOGIC PRESERVED ──────────────────────────────────────────
const REF_LAT = 39.4699;
const REF_LON = -0.3763;
const METERS_PER_DEG_LAT = 111_320;

function project(lat, lon) {
  const x = (lon - REF_LON) * METERS_PER_DEG_LAT * Math.cos((REF_LAT * Math.PI) / 180);
  const z = (lat - REF_LAT) * METERS_PER_DEG_LAT;
  const SCALE = 1 / 150;
  return [x * SCALE, 0, -z * SCALE];
}

const RANGES = { pm25: [0, 50], pm10: [0, 100], no2: [0, 100], o3: [0, 120] };

function getColor(field, value) {
  const [min, max] = RANGES[field] || [0, 100];
  const ratio = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const hue = (1 - ratio) * 120; // Green(120) to Red(0)
  return `hsl(${hue}, 65%, 55%)`; // Updated saturation/lightness
}

// ── ARCHITECTURAL BAR COMPONENT ──────────────────────────────────────
function Bar({ station, field }) {
  const [x, y, z] = project(station.lat, station.lon);
  const value = station.reading?.[field] ?? 0;
  const height = Math.max(value * 0.05, 0.1); 

  return (
    <group position={[x, 0, z]}>
      {/* BoxGeometry 0.9 width/depth per request */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[0.9, height, 0.9]} />
        <meshStandardMaterial color={getColor(field, value)} />
      </mesh>
      
      {/* Station Name Label */}
      <Text position={[0, height + 0.5, 0]} fontSize={0.24} color="#c8d8e8" anchorX="center">
        {station.name}
      </Text>
      
      {/* Value Label */}
      <Text position={[0, height + 0.2, 0]} fontSize={0.18} color="rgba(200,216,232,0.55)" anchorX="center">
        {value.toFixed(1)}
      </Text>
    </group>
  );
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────
export default function CityViz3D({ stations }) {
  const [metric, setMetric] = useState('pm10');

  return (
    <div style={{ background: '#03050a', borderRadius: '5px', overflow: 'hidden', height: 420, position: 'relative' }}>
      
      {/* Metric Switcher UI */}
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, display: 'flex', gap: '0.75rem' }}>
        {['pm10', 'no2', 'o3', 'pm25'].map((m) => (
          <button 
            key={m}
            onClick={() => setMetric(m)}
            style={{ 
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)',
              color: metric === m ? 'var(--green)' : 'var(--text)',
              fontSize: '0.65rem', textTransform: 'uppercase'
            }}
          >
            {m}
          </button>
        ))}
      </div>

      <Canvas gl={{ alpha: true }} camera={{ position: [6, 6, 8], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        
        {/* Dark Grid Colors */}
        <Grid 
          infiniteGrid 
          cellSize={1} 
          cellColor="#0a1828" 
          sectionSize={5} 
          sectionColor="#0d1f30" 
        />
        
        {stations.map((st) => (
          <Bar key={st.code} station={st} field={metric} />
        ))}
        
        <OrbitControls />
      </Canvas>
    </div>
  );
}
