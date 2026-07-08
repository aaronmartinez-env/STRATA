import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Fields we can plot, mapped to a friendly label + unit for the axis/tooltip.
export const PLOTTABLE_FIELDS = {
  pm25: { label: 'PM2.5', unit: 'µg/m³' },
  pm10: { label: 'PM10', unit: 'µg/m³' },
  no2: { label: 'NO2', unit: 'µg/m³' },
  o3: { label: 'O3', unit: 'µg/m³' },
};

function formatTick(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ReadingsChart({ readings, field }) {
  const meta = PLOTTABLE_FIELDS[field] ?? { label: field, unit: '' };

  const data = readings
    .filter((r) => r.datetime && r[field] != null)
    .map((r) => ({ datetime: r.datetime, value: r[field] }));

  if (data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
        No {meta.label} readings in this range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="datetime" tickFormatter={formatTick} minTickGap={40} />
        <YAxis label={{ value: meta.unit, angle: -90, position: 'insideLeft' }} />
        <Tooltip
          labelFormatter={(v) => new Date(v).toLocaleString()}
          formatter={(value) => [`${value} ${meta.unit}`, meta.label]}
        />
        <Line type="monotone" dataKey="value" stroke="#2f6f4f" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
