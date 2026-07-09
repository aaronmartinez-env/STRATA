import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#00d4ff', '#ff9a00', '#3a5060', '#ff4455'];

export default function AirMassChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="pct"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={75}
          label={(entry) => `${entry.pct.toFixed(1)}%`}
          style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem' }}
        >
          {data.map((entry, i) => (
            <Cell key={entry.key} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v, n, props) => [`${v.toFixed(2)}% (n=${props.payload.n})`, props.payload.label]}
          contentStyle={{ background: 'var(--deep)', border: '1px solid var(--rim)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }}
        />
        <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: '0.65rem' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
