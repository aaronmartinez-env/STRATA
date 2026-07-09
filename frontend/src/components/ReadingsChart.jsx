import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Fields we can plot, mapped to a friendly label + color for the legend/lines.
export const PLOTTABLE_FIELDS = {
  pm25: { label: 'PM2.5', unit: 'µg/m³', color: '#ff9a00' },
  pm10: { label: 'PM10', unit: 'µg/m³', color: '#ff4455' },
  no2: { label: 'NO2', unit: 'µg/m³', color: '#00d4ff' },
  no: { label: 'NO', unit: 'µg/m³', color: '#8b6fff' },
  nox: { label: 'NOx', unit: 'µg/m³', color: '#39d98a' },
  o3: { label: 'O3', unit: 'µg/m³', color: '#00d4ff' },
  so2: { label: 'SO2', unit: 'µg/m³', color: '#ff9a00' },
  co: { label: 'CO', unit: 'mg/m³', color: '#ff4455' },
  temperature: { label: 'Temp', unit: '°C', color: '#ff9a00' },
  wind_speed: { label: 'Wind', unit: 'm/s', color: '#39d98a' },
  precipitation: { label: 'Precip', unit: 'mm', color: '#00d4ff' },
  humidity: { label: 'Humidity', unit: '%', color: '#8b6fff' },
};

function formatTick(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Plots one or more fields from a shared `readings` array on a single
 * chart. Accepts either:
 *   - `data` + `fields` (array) — the grouped-chart usage (Live.jsx)
 *   - `readings` + `field` (single, legacy) — kept for callers that
 *     only need one line
 */
export default function ReadingsChart({ data, fields, readings, field }) {
  const rows = data ?? readings ?? [];
  const keys = fields ?? (field ? [field] : []);

  const chartData = rows
    .filter((r) => r.datetime)
    .map((r) => {
      const point = { datetime: r.datetime };
      keys.forEach((k) => { point[k] = r[k] ?? null; });
      return point;
    });

  const hasAnyValue = chartData.some((row) => keys.some((k) => row[k] != null));

  if (keys.length === 0 || chartData.length === 0 || !hasAnyValue) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
        No data in this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--rim)" />
        <XAxis dataKey="datetime" tickFormatter={formatTick} minTickGap={40} stroke="var(--muted)" style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)' }} />
        <YAxis stroke="var(--muted)" style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)' }} />
        <Tooltip
          labelFormatter={(v) => new Date(v).toLocaleString()}
          contentStyle={{ background: 'var(--deep)', border: '1px solid var(--rim)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }}
        />
        <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: '0.65rem' }} />
        {keys.map((k) => (
          <Line
            key={k}
            type="monotone"
            dataKey={k}
            name={PLOTTABLE_FIELDS[k]?.label ?? k}
            stroke={PLOTTABLE_FIELDS[k]?.color ?? '#00d4ff'}
            dot={false}
            strokeWidth={1.5}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
