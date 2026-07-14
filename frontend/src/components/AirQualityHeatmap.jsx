import { useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { point, featureCollection } from '@turf/helpers';
import interpolate from '@turf/interpolate';
import isobands from '@turf/isobands';
import bbox from '@turf/bbox';
import 'leaflet/dist/leaflet.css';

// Valencia city-center reference, same as CityViz3D, for the map's initial view.
const VALENCIA_CENTER = [39.4699, -0.3763];

// Break points and colors per pollutant. Roughly WHO-guideline-informed bands
// (good / moderate / poor / very poor), NOT a regulatory classification —
// chosen to produce a readable 4-band gradient, same spirit as the ACI's
// visual bands elsewhere in STRATA.
const BREAKS_BY_FIELD = {
  pm10: { breaks: [0, 20, 40, 60, 120], colors: ['#39d98a', '#f2d94e', '#ff9a3c', '#ff4d5e'] },
  pm25: { breaks: [0, 10, 20, 35, 80], colors: ['#39d98a', '#f2d94e', '#ff9a3c', '#ff4d5e'] },
  no2: { breaks: [0, 20, 40, 60, 120], colors: ['#39d98a', '#f2d94e', '#ff9a3c', '#ff4d5e'] },
  o3: { breaks: [0, 60, 100, 140, 200], colors: ['#39d98a', '#f2d94e', '#ff9a3c', '#ff4d5e'] },
};

function padBbox([west, south, east, north], factor = 0.35) {
  const dx = (east - west) * factor;
  const dy = (north - south) * factor;
  return [west - dx, south - dy, east + dx, north + dy];
}

export default function AirQualityHeatmap({ stations, field }) {
  const config = BREAKS_BY_FIELD[field];

  // Gated on stations + field only — never recomputed on map pan/zoom,
  // since those don't change either dependency.
  const bands = useMemo(() => {
    if (!config) return null;

    const validPoints = stations
      .filter((s) => s.reading?.[field] != null)
      .map((s) => point([s.lon, s.lat], { [field]: s.reading[field] }));

    if (validPoints.length < 3) return null;

    const points = featureCollection(validPoints);
    const paddedBbox = padBbox(bbox(points));

    const grid = interpolate(points, 0.5, {
      gridType: 'point',
      property: field,
      units: 'kilometers',
      weight: 2,
      bbox: paddedBbox,
    });

    const { breaks, colors } = config;
    return isobands(grid, breaks, {
      zProperty: field,
      breaksProperties: colors.map((c) => ({ fillColor: c })),
    });
  }, [stations, field, config]);

  const featureStyle = (feature) => ({
    fillColor: feature.properties.fillColor,
    fillOpacity: 0.48,
    stroke: false,
    weight: 0,
  });

  const dataKey = `${field}-${stations.map((s) => `${s.code}:${s.reading?.[field] ?? ''}`).join('|')}`;

  if (!config) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Unsupported field.</div>;
  }

  if (!bands) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
        Not enough current station data to interpolate a surface right now.
      </div>
    );
  }

  return (
    <div style={{ height: 420, borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer center={VALENCIA_CENTER} zoom={12} style={{ height: '100%', width: '100%', background: '#04060a' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        />
        <GeoJSON key={dataKey} data={bands} style={featureStyle} />
      </MapContainer>
    </div>
  );
}
