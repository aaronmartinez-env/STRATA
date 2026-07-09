import CorrelationChart from '../components/CorrelationChart';
import AirMassChart from '../components/AirMassChart';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  HEADLINE_2024, STATIONS_2024, SEASONAL_DIV_2024, MONTHLY_DATA_2024,
  CORR_DATA_2024, AM_DATA_2024, DANA_DATA,
} from '../data/dana2024';

const H = HEADLINE_2024;

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="glass-panel" style={{ padding: '1rem', flex: '1 1 160px' }}>
      <div className="gp-label" style={{ marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '1.6rem', color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );
}

export default function CaseStudyDana() {
  return (
    <div className="live-wrap">
      <h1>The 2024 <em>DANA</em> Event</h1>
      <p className="mono muted" style={{ fontSize: '0.7rem', marginBottom: '2rem' }}>
        RVVCCA · {H.n_stations} stations · {H.date_range} · Daily averages · {H.n_obs.toLocaleString()} valid station-days
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
        <MetricCard label="Valid station-days" value={H.n_obs.toLocaleString()} />
        <MetricCard label="Mean CMPI gap" value={H.mean_divergence.toFixed(2)} sub="index pts" color="var(--amber)" />
        <MetricCard label="Max single-day gap" value={H.max_divergence.toFixed(1)} sub="index pts" color="var(--red)" />
        <MetricCard label="DANA station-days" value={H.dana_days} sub={DANA_DATA.event_window} color="var(--red)" />
        <MetricCard label="Mean ACI" value={H.mean_aci.toFixed(3)} color="var(--green)" />
      </div>

      {/* 01 — Network */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">01</div><h2 className="sec-title">The Valencia monitoring <em>network</em></h2></div>
        <p>The 2024 dataset — downloaded directly from the Generalitat Valenciana open data portal — extends STRATA's coverage into a year that includes both summer calima episodes and the October 29 DANA flood event. Nine Valencia city stations are active in this dataset, providing daily average concentrations of PM2.5, PM10, NO2, and O3 for all twelve months of 2024.</p>
        <p>At daily resolution, intra-day dynamics are averaged out. The analysis focuses on episode-level and seasonal divergence patterns: the contrast between Saharan calima and DANA-derived terrestrial dust resuspension is the primary scientific contribution of this dataset extension.</p>
        <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1.5rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--rim2)', textAlign: 'left', color: 'var(--muted)' }}>
                <th style={{ padding: '0.5rem' }}>Station</th>
                <th style={{ padding: '0.5rem' }}>PM10</th>
                <th style={{ padding: '0.5rem' }}>PM2.5</th>
                <th style={{ padding: '0.5rem' }}>NO2</th>
                <th style={{ padding: '0.5rem' }}>O3</th>
                <th style={{ padding: '0.5rem' }}>CMPI</th>
                <th style={{ padding: '0.5rem' }}>Public idx</th>
                <th style={{ padding: '0.5rem' }}>DANA days</th>
              </tr>
            </thead>
            <tbody>
              {STATIONS_2024.map((s) => (
                <tr key={s.station} style={{ borderBottom: '1px solid var(--rim)' }}>
                  <td style={{ padding: '0.5rem' }}>{s.station}</td>
                  <td style={{ padding: '0.5rem' }}>{s.pm10.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.pm25.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.no2.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.o3.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.aqi_sci.toFixed(2)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.aqi_public.toFixed(2)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.dana_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 02 — 3D visualization note */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">02</div><h2 className="sec-title">The network in <em>three dimensions</em></h2></div>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
          The DANA-period 3D visualization (station bars with distinct outlines for flood-window stations) hasn't
          been ported here yet. See the <a href="/live">Live tab</a> for the interactive real-time 3D view.
        </div>
      </section>

      {/* 03 — Divergence gap */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">03</div><h2 className="sec-title">The representation <em>gap</em></h2></div>
        <p>The same CMPI framework applied to the 2024 daily dataset reveals the representational gap at episode and seasonal scale. At daily resolution, the nocturnal NO2 signal identified in the 2021–2022 analysis averages out — what emerges instead is the structure of <strong>episode-driven divergence</strong>: calima intrusions and the DANA flood aftermath as the primary drivers of elevated gaps.</p>
        <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1.5rem', borderLeft: '3px solid var(--amber)' }}>
          <div className="gp-label">Finding · Episode-driven divergence dominates at daily resolution</div>
          <p>Mean divergence of <strong>{H.mean_divergence.toFixed(3)} index points</strong> across the full 2024 year. Maximum single-day gap of <strong>{H.max_divergence.toFixed(2)} points</strong>.</p>
        </div>
      </section>

      {/* 04 — Seasonal structure */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">04</div><h2 className="sec-title">Seasonal structure — <em>episode-driven divergence</em></h2></div>
        <p>The calima signal remains detectable at daily resolution. The DANA period (October 29 – mid-December 2024) introduces a structurally different signal: flood-derived resuspension of terrestrial sediment produced coarse aerosol with a local wind signature rather than the southerly Saharan transport pattern.</p>
        <div className="chart-grid" style={{ marginTop: '1.5rem' }}>
          <div className="glass-panel">
            <div className="gp-label">Monthly CMPI divergence · 2024</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={MONTHLY_DATA_2024}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rim)" />
                <XAxis dataKey="name" stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
                <YAxis stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
                <Tooltip contentStyle={{ background: 'var(--deep)', border: '1px solid var(--rim)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }} />
                <Line type="monotone" dataKey="div" stroke="#ff4455" name="Divergence" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-panel">
            <div className="gp-label">Seasonal divergence · 2024</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={SEASONAL_DIV_2024}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rim)" />
                <XAxis dataKey="label" stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
                <YAxis stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
                <Tooltip contentStyle={{ background: 'var(--deep)', border: '1px solid var(--rim)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }} />
                <Bar dataKey="div" fill="#ff9a00" name="Mean divergence" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="chart-grid" style={{ marginTop: '1.5rem' }}>
          <div className="glass-panel">
            <div className="gp-label">Pearson r with CMPI divergence</div>
            <CorrelationChart data={CORR_DATA_2024} />
          </div>
          <div className="glass-panel">
            <div className="gp-label">Air mass distribution</div>
            <AirMassChart data={AM_DATA_2024} />
          </div>
        </div>
      </section>

      {/* 05 — Calima vs DANA */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">05</div><h2 className="sec-title"><em>Calima</em> vs <em>DANA</em> — two dust types, one framework</h2></div>
        <p>The October 29, 2024 DANA flood created an atmospheric anomaly in Valencia's monitoring record: flood-derived resuspension of terrestrial sediment — road dust, river sediment, agricultural soil — introduced coarse particulate matter with a fundamentally different origin than Saharan mineral transport.</p>
        <p>STRATA detects DANA events using the same dual criterion as calima (PM10 spike + high dust ratio), restricted to the October 29 – December 15 2024 window, with a slightly relaxed ratio threshold (2.5 vs 3.0).</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '1.5rem 0' }}>
          <MetricCard label="DANA station-days" value={DANA_DATA.n_days} sub={DANA_DATA.event_window} color="var(--red)" />
          <MetricCard label="Divergence during DANA" value={DANA_DATA.mean_divergence.toFixed(2)} sub="vs normal mean" color="var(--amber)" />
          <MetricCard label="Normal-period mean" value={DANA_DATA.normal_divergence.toFixed(2)} />
          <MetricCard label="Max daily PM10 (DANA)" value={DANA_DATA.max_pm10_daily} sub={`${DANA_DATA.max_pm10_station}, ${DANA_DATA.max_pm10_date}`} color="var(--red)" />
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid var(--red)' }}>
          <div className="gp-label">A genuine public health emergency, same structural limitation</div>
          <p>The public PM10-only index detects elevated particulate matter during both calima and DANA — but cannot distinguish Saharan mineral aerosol from flood-derived terrestrial sediment, two types with different compositional profiles in the epidemiological literature.</p>
        </div>
      </section>

      {/* 06 — Complexity */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">06</div><h2 className="sec-title">Atmospheric <em>complexity</em> in 2024</h2></div>
        <p>The DANA period introduces a new source type not present in the 2021–2022 baseline — flood-derived terrestrial resuspension — which the ACI's source attribution heuristics were not originally designed to capture. Mean ACI of <strong>{H.mean_aci.toFixed(4)}</strong> across the 2024 dataset.</p>
      </section>

      {/* 07 — Conclusions */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">07</div><h2 className="sec-title"><em>Conclusions</em> — 2024 dataset</h2></div>
        <p>Based on {H.n_obs.toLocaleString()} valid station-days, the findings are consistent with <strong>the same representational gap structure identified in the 2021–2022 baseline, now visible at daily resolution and extended to include DANA flood-derived dust.</strong></p>
        <div className="chart-grid" style={{ marginTop: '1.5rem' }}>
          <div className="glass-panel"><div className="gp-label">The gap persists at daily resolution</div><p>Mean divergence <strong>{H.mean_divergence.toFixed(3)} pts</strong>, max <strong>{H.max_divergence.toFixed(2)} pts</strong>.</p></div>
          <div className="glass-panel"><div className="gp-label">Seasonal structure replaces diurnal</div><p>Peak season divergence <strong>{H.peak_season_divergence.toFixed(3)} pts</strong> in {H.peak_season}.</p></div>
          <div className="glass-panel"><div className="gp-label">DANA — new event type</div><p><strong>{H.dana_days} station-days</strong>. Mean divergence during DANA: <strong>{H.dana_mean_divergence.toFixed(3)} pts</strong>.</p></div>
          <div className="glass-panel"><div className="gp-label">Next steps</div><p>Hourly 2024 data (pending CEAM access) would restore the diurnal signal for direct comparison.</p></div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--rim)', paddingTop: '1.5rem', marginTop: '2rem', fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--muted)' }}>
        STRATA · Atmospheric Atlas · Valencia · Dataset: 2024 daily · Generalitat Valenciana<br />
        All scientific values pipeline-derived · No hardcoding · No synthetic data
      </footer>
    </div>
  );
}
