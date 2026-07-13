import { useState, useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { PLOTTABLE_FIELDS, CHART_COLORS } from './ReadingsChart';

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

function elapsedHours(datetimeStr, startMs) {
  return Math.round((new Date(datetimeStr).getTime() - startMs) / 3600000);
}

function downloadChartPNG(containerEl, filename) {
  if (!containerEl) return;
  const svg = containerEl.querySelector('svg.recharts-surface');
  if (!svg) return;

  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svgData = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const width = svg.clientWidth || svg.viewBox?.baseVal?.width || 800;
    const height = svg.clientHeight || svg.viewBox?.baseVal?.height || 400;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };
  img.onerror = () => URL.revokeObjectURL(url);
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

function Chart({ readings, fields, height, compareReadings, compareLabel, showThresholds }) {
  const isComparing = compareReadings && compareReadings.length > 0;

  let chartData;
  let xKey = 'datetime';

  if (isComparing) {
    xKey = 'elapsed';
    const startA = new Date(readings.find((r) => r.datetime)?.datetime ?? Date.now()).getTime();
    const startB = new Date(compareReadings.find((r) => r.datetime)?.datetime ?? Date.now()).getTime();

    const byElapsed = new Map();
    readings.filter((r) => r.datetime).forEach((r) => {
      const e = elapsedHours(r.datetime, startA);
      const point = byElapsed.get(e) ?? { elapsed: e };
      fields.forEach((f) => { point[f] = r[f] ?? null; });
      byElapsed.set(e, point);
    });
    compareReadings.filter((r) => r.datetime).forEach((r) => {
      const e = elapsedHours(r.datetime, startB);
      const point = byElapsed.get(e) ?? { elapsed: e };
      fields.forEach((f) => { point[`${f}__cmp`] = r[f] ?? null; });
      byElapsed.set(e, point);
    });
    chartData = Array.from(byElapsed.values()).sort((a, b) => a.elapsed - b.elapsed);
  } else {
    chartData = readings
      .filter((r) => r.datetime)
      .map((r) => {
        const point = { datetime: r.datetime };
        fields.forEach((f) => { point[f] = r[f] ?? null; });
        return point;
      });
  }

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
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis
          dataKey={xKey}
          tickFormatter={isComparing ? (h) => `+${h}h` : formatTick}
          minTickGap={50}
          stroke={CHART_COLORS.axis}
          style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)' }}
        />
        <YAxis stroke={CHART_COLORS.axis} style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)' }} />
        <Tooltip
          labelFormatter={(v) => (isComparing ? `+${v}h from range start` : new Date(v).toLocaleString())}
          contentStyle={{ background: CHART_COLORS.tooltipBg, border: `1px solid ${CHART_COLORS.tooltipBorder}`, fontFamily: 'var(--mono)', fontSize: '0.7rem' }}
        />
        <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: '0.6rem' }} />

        {fields.map((f) => (
          <Line
            key={f}
            type="monotone"
            dataKey={f}
            name={isComparing ? `${PLOTTABLE_FIELDS[f]?.label ?? f} (A)` : `${PLOTTABLE_FIELDS[f]?.label ?? f} (${PLOTTABLE_FIELDS[f]?.unit ?? ''})`}
            stroke={PLOTTABLE_FIELDS[f]?.color ?? '#00d4ff'}
            dot={false}
            strokeWidth={1.5}
            connectNulls
          />
        ))}

        {isComparing && fields.map((f) => (
          <Line
            key={`${f}__cmp`}
            type="monotone"
            dataKey={`${f}__cmp`}
            name={`${PLOTTABLE_FIELDS[f]?.label ?? f} (${compareLabel})`}
            stroke={PLOTTABLE_FIELDS[f]?.color ?? '#00d4ff'}
            strokeDasharray="5 4"
            strokeOpacity={0.7}
            dot={false}
            strokeWidth={1.5}
            connectNulls
          />
        ))}

        {showThresholds && !isComparing && fields
          .filter((f) => PLOTTABLE_FIELDS[f]?.who24h != null)
          .map((f) => (
            <ReferenceLine
              key={`who-${f}`}
              y={PLOTTABLE_FIELDS[f].who24h}
              stroke={PLOTTABLE_FIELDS[f].color}
              strokeDasharray="2 3"
              strokeOpacity={0.5}
              label={{ value: `WHO 24h · ${PLOTTABLE_FIELDS[f].label}`, fontSize: 10, fill: PLOTTABLE_FIELDS[f].color, position: 'insideTopRight' }}
            />
          ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function MultiFieldChart({
  readings, station, dateRange,
  compareReadings, compareLabel,
}) {
  const [fields, setFields] = useState(['pm10', 'no2', 'o3']);
  const [showThresholds, setShowThresholds] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);
  const expandedContainerRef = useRef(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const toggleField = (f) => {
    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const applyPreset = (keys) => setFields(keys);
  const filename = `strata_${station}_${dateRange.from}_to_${dateRange.to}`;

  const Toolbar = ({ targetRef }) => (
    <>
      <div className="mfc-toolbar">
        <div className="mfc-presets">
          {Object.entries(PRESETS).map(([label, keys]) => (
            <button key={label} onClick={() => applyPreset(keys)} className={JSON.stringify([...fields].sort()) === JSON.stringify([...keys].sort()) ? 'active' : ''}>
              {label}
            </button>
          ))}
          <button onClick={() => applyPreset(Object.keys(PLOTTABLE_FIELDS))}>All</button>
          <button onClick={() => applyPreset([])}>Clear</button>
          <button
            onClick={() => setShowThresholds((v) => !v)}
            className={showThresholds ? 'active' : ''}
            disabled={!!compareReadings?.length}
            title={compareReadings?.length ? 'Not available while comparing' : 'Show WHO 24h guideline lines'}
          >
            WHO lines
          </button>
        </div>
        <div className="mfc-actions">
          <button onClick={() => downloadChartPNG(targetRef.current, filename + '.png')} disabled={fields.length === 0}>PNG</button>
          <button onClick={() => downloadCSV(readings, fields, filename + '.csv')} disabled={fields.length === 0}>CSV</button>
          {!expanded && <button onClick={() => setExpanded(true)} disabled={fields.length === 0}>Expand</button>}
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
    </>
  );

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <Toolbar targetRef={containerRef} />
      <div ref={containerRef}>
        <Chart readings={readings} fields={fields} height={320} compareReadings={compareReadings} compareLabel={compareLabel} showThresholds={showThresholds} />
      </div>

      {expanded && (
        <div className="mfc-overlay" onClick={() => setExpanded(false)}>
          <div className="mfc-overlay-panel glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mfc-overlay-head">
              <span className="gp-label">{station} · {dateRange.from} to {dateRange.to}</span>
              <button className="mfc-close" onClick={() => setExpanded(false)}>Close (Esc)</button>
            </div>
            <Toolbar targetRef={expandedContainerRef} />
            <div ref={expandedContainerRef}>
              <Chart readings={readings} fields={fields} height={560} compareReadings={compareReadings} compareLabel={compareLabel} showThresholds={showThresholds} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
