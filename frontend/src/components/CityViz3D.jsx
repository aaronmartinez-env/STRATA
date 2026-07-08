import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Grid } from '@react-three/drei';
import { PLOTTABLE_FIELDS } from './ReadingsChart';

// Valencia city-center reference point, used to project lat/lon onto a
// local flat plane (good enough at this scale — a few km across).
const REF_LAT = 39.4699;
const REF_LON = -0.3763;
const METERS_PER_DEG_LAT = 111_320;

function project(lat, lon) {
  const x = (lon - REF_LON) * METERS_PER_DEG_LAT * Math.cos((REF_LAT * Math.PI) / 180);
  const z = (lat - REF_LAT) * METERS_PER_DEG_LAT;
  // Scale down from meters to scene units, and flip x so east is +x, north is -z (camera-friendly)
  const SCALE = 1 / 150;
  return [x * SCALE, 0, -z * SCALE];
}

// Color ramp: green (clean) -> yellow -> red (poor), based on a rough
// value range per pollutant. Not a regulatory AQI scale — purely visual.
const RANGES = {
  pm25: [0, 50],
  pm10: [0, 100],
  no2: [0, 100],
  o3: [0, 120],
};

function colorFor(field, value) {
  const [lo, hi] = RANGES[field] ?? [0, 100];
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  // interpolate green -> yellow -> red
  const hue = (1 - t) * 120; // 120 = green, 0 = red
  return `hsl(${hue}, 70%, 45%)`;
}

function StationBar({ station, field }) {
  const [x, , z] = project(station.lat, station.lon);
  const value = station.reading?.[field];
  const hasValue = value != null;

  const [lo, hi] = RANGES[field] ?? [0, 100];
  const normalized = hasValue ? Math.max(0.1, Math.min(1, (value - lo) / (hi - lo))) : 0.05;
  const height = 0.5 + normalized * 4;
  const color = hasValue ? colorFor(field, value) : '#999';

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.25, 0.25, height, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text position={[0, height + 0.4, 0]} fontSize={0.28} color="#333" anchorX="center">
        {station.name}
      </Text>
      <Text position={[0, height + 0.05, 0]} fontSize={0.22} color="#666" anchorX="center">
        {hasValue ? `${value.toFixed(1)}` : 'n/a'}
      </Text>
    </group>
  );
}

export default function CityViz3D({ stations, field }) {
  const meta = PLOTTABLE_FIELDS[field] ?? { label: field, unit: '' };

  const hasAnyData = useMemo(
    () => stations.some((s) => s.reading?.[field] != null),
    [stations, field]
  );

  return (
    <div style={{ height: 420, borderRadius: 8, overflow: 'hidden' }}>
      <Canvas camera={{ position: [6, 6, 8], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <Grid args={[20, 20]} cellColor="#ddd" sectionColor="#bbb" position={[0, 0, 0]} />
        {stations.map((s) => (
          <StationBar key={s.code} station={s} field={field} />
        ))}
        <OrbitControls enableDamping dampingFactor={0.1} />
      </Canvas>
      {!hasAnyData && (
        <p style={{ textAlign: 'center', opacity: 0.6, marginTop: '-2rem', position: 'relative' }}>
          No current {meta.label} data available.
        </p>
      )}
    </div>
  );
}
