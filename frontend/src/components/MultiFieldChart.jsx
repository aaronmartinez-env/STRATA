import { useState, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { PLOTTABLE_FIELDS } from './ReadingsChart';

const PRESETS = {
  Nitrogen: ['no2', 'no', 'nox'],
  Oxidants: ['o3', 'so2'],
  Particles: ['pm10', 'pm25', 'co'],
  Meteo: ['temperature', 'wind_speed', 'precipitation'],
};

function formatTick(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function downloadChartPNG(containerEl, filename) {
  const svg = containerEl?.querySelector('svg');
  if (!svg) return;

  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svgData = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = svg.clientWidth * scale;
    canvas.height = svg.clientHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, svg.clientWidth, svg.clientHeight);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };
  img.src = url;
}

function downloadCSV(readings, fields, filename) {
  const header = ['datetime', ...fields].join(',');
  const rows = readings.map((r) => [r.datetime, ...fields.map((f) => r[f] ?? '')].join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Chart({ readings, fields, height }) {
  const chartData = readings
    .filter((r) => r.datetime)
    .map((r) => {
      const point = { datetime: r.datetime };
      fields.forEach((f) => { point[f] = r[f] ?? null; });
      return point;
    });

  const hasAnyValue = chartData.some((row) => fields.some((f) => row[f] != null));

  if (fields.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5, fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
        Select at least one pollutant above to plot.
      </div>
    );
  }

  if (!hasAnyValue) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5, fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
        No data for the selected pollutant(s) in this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--rim)" />
        <XAxis dataKey="datetime" tickFormatter={formatTick} minTickGap={50} stroke="var(--muted)" style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)' }} />
        <YAxis stroke="var(--muted)" style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)' }} />
        <Tooltip
          labelFormatter={(v) => new Date(v).toLocaleString()}
          contentStyle={{ background: 'var(--deep)', border: '1px solid var(--rim)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }}
        />
        <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: '0.65rem' }} />
        {fields.map((f) => (
          <Line
            key={f}
            type="monotone"
            dataKey={f}
            name={`${PLOTTABLE_FIELDS[f]?.label ?? f} (${PLOTTABLE_FIELDS[f]?.unit ?? ''})`}
            stroke={PLOTTABLE_FIELDS[f]?.color ?? '#00d4ff'}
            dot={false}
            strokeWidth={1.5}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function MultiFieldChart({ readings, station, dateRange }) {
  const [fields, setFields] = useState(['pm10', 'no2', 'o3']);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);
  const expandedRef = useRef(null);

  const toggleField = (f) => {
    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const applyPreset = (keys) => setFields(keys);

  const filename = `strata_${station}_${dateRange.from}_to_${dateRange.to}`;

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div className="mfc-toolbar">
        <div className="mfc-presets">
          {Object.entries(PRESETS).map(([label, keys]) => (
            <button key={label} onClick={() => applyPreset(keys)} className={JSON.stringify([...fields].sort()) === JSON.stringify([...keys].sort()) ? 'active' : ''}>
              {label}
            </button>
          ))}
          <button onClick={() => applyPreset(Object.keys(PLOTTABLE_FIELDS))}>All</button>
          <button onClick={() => applyPreset([])}>Clear</button>
        </div>
        <div className="mfc-actions">
          <button onClick={() => downloadChartPNG(containerRef.current, `${filename}.png`)} disabled={fields.length === 0}>
            PNG
          </button>
          <button onClick={() => downloadCSV(readings, fields, `${filename}.csv`)} disabled={fields.length === 0}>
            CSV
          </button>
          <button onClick={() => setExpanded(true)} disabled={fields.length === 0}>
            Expand
          </button>
        </div>
      </div>

      <div className="mfc-chips">
        {Object.entries(PLOTTABLE_FIELDS).map(([key, meta]) => (
          <button
            key={key}
            className={fields.includes(key) ? 'chip active' : 'chip'}
            style={fields.includes(key) ? { borderColor: meta.color, color: meta.color } : {}}
            onClick={() => toggleField(key)}
          >
            {meta.label}
          </button>
        ))}
      </div>

      <div ref={containerRef}>
        <Chart readings={readings} fields={fields} height={320} />
      </div>

      {expanded && (
        <div className="mfc-overlay" onClick={() => setExpanded(false)}>
          <div className="mfc-overlay-panel glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mfc-overlay-head">
              <span className="gp-label">{station} · {dateRange.from} → {dateRange.to}</span>
              <button onClick={() => setExpanded(false)}>Close ✕</button>
            </div>
            <div ref={expandedRef}>
              <Chart readings={readings} fields={fields} height={520} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
