import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';

export default function CorrelationChart({ data }) {
  const sorted = [...data].sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--rim)" />
        <XAxis type="number" domain={[-0.6, 0.6]} stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
        <YAxis type="category" dataKey="var" width={80} stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
        <Tooltip
          formatter={(v) => v.toFixed(4)}
          contentStyle={{ background: 'var(--deep)', border: '1px solid var(--rim)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }}
        />
        <Bar dataKey="r">
          {sorted.map((entry, i) => (
            <Cell key={i} fill={entry.r >= 0 ? '#39d98a' : '#ff4455'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
