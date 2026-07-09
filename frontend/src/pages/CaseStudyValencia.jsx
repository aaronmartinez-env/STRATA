import CorrelationChart from '../components/CorrelationChart';
import AirMassChart from '../components/AirMassChart';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  HEADLINE_2122, STATIONS_2122, HOURLY_PROFILE_2122, CORR_DATA_2122, AM_DATA_2122, CALIMA_2122,
} from '../data/valencia2122';

const H = HEADLINE_2122;

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="glass-panel" style={{ padding: '1rem', flex: '1 1 160px' }}>
      <div className="gp-label" style={{ marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '1.6rem', color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );
}

export default function CaseStudyValencia() {
  return (
    <div className="live-wrap">
      <h1>Understanding Valencia's <em>atmosphere</em> — from observation to interpretation</h1>
      <p className="mono muted" style={{ fontSize: '0.7rem', marginBottom: '2rem' }}>
        RVVCCA · {H.n_stations} stations · {H.date_range} · Hourly · {H.n_obs.toLocaleString()} valid station-hours
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
        <MetricCard label="Valid station-hours" value={H.n_obs.toLocaleString()} />
        <MetricCard label="Mean CMPI gap" value={H.mean_divergence.toFixed(2)} sub="index pts" color="var(--amber)" />
        <MetricCard label="Max single-hour gap" value={H.max_divergence.toFixed(1)} sub="index pts" color="var(--red)" />
        <MetricCard label="Calima hours" value={H.calima_hours.toLocaleString()} color="var(--amber)" />
        <MetricCard label="Mean ACI" value={H.mean_aci.toFixed(3)} color="var(--green)" />
      </div>

      {/* 01 — Network */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">01</div><h2 className="sec-title">The Valencia monitoring <em>network</em></h2></div>
        <p>Valencia's RVVCCA network maintains twelve active monitoring stations across the metropolitan area. The 2021–2022 hourly dataset — downloaded directly from Open Data Valencia — provides the foundational baseline for STRATA's divergence analysis. Stations span traffic-exposed urban canyons, residential periphery, coastal and port positions, and dedicated meteorological posts. Each records hourly PM2.5, PM10, NO2, and O3 alongside meteorological parameters.</p>
        <p>This is STRATA's reference dataset: two full years of hourly observations capturing diurnal cycles, calima episodes, seasonal transitions, and long-term atmospheric patterns across Valencia's monitoring network.</p>
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
                <th style={{ padding: '0.5rem' }}>Calima hrs</th>
              </tr>
            </thead>
            <tbody>
              {STATIONS_2122.map((s) => (
                <tr key={s.station} style={{ borderBottom: '1px solid var(--rim)' }}>
                  <td style={{ padding: '0.5rem' }}>{s.station}</td>
                  <td style={{ padding: '0.5rem' }}>{s.pm10.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.pm25.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.no2.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.o3.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.aqi_sci.toFixed(2)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.aqi_public.toFixed(2)}</td>
                  <td style={{ padding: '0.5rem' }}>{s.calima}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mono muted" style={{ fontSize: '0.65rem', marginTop: '1rem', lineHeight: 1.6 }}>
          Source: RVVCCA · Open Data Valencia · rvvcca_d_horarios_2021-2022 · CC BY 4.0 · Each row represents one station-hour. Valid observations retained after quality filtering. All values from real observational data — no synthetic imputation applied.
        </div>
      </section>

      {/* 02 — 3D visualization note */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">02</div><h2 className="sec-title">The network in <em>three dimensions</em></h2></div>
        <p>A spatial alternative to the table above: each station rises as a bar from its real geographic position, height and colour driven by the selected metric.</p>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
          The full barrio-footprint 3D visualization for this historical dataset hasn't been ported here yet.
          See the <a href="/live">Live tab</a> for the interactive real-time equivalent using the same
          station-position approach.
        </div>
      </section>

      {/* 03 — Divergence gap */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">03</div><h2 className="sec-title">The representation <em>gap</em></h2></div>
        <p>Many public-facing AQI representations simplify atmospheric conditions into a single dominant pollutant proxy, often emphasising PM10. This carries a structural cost: any episode where gas-phase pollutants elevate multi-pollutant burden while particulate matter stays moderate will be systematically underrepresented.</p>
        <p>STRATA quantifies this as the <strong>CMPI divergence</strong>: the absolute difference between a custom multi-pollutant composite index — weighting normalised PM2.5 (40%), PM10 (30%), NO2 (20%), and O3 (10%) on a 0–100 scale — and the public PM10-only index on the same scale. <em>The CMPI is not a regulatory index; it is an exploratory comparative framework.</em></p>
        <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1.5rem', borderLeft: '3px solid var(--amber)' }}>
          <div className="gp-label cyan">Finding 01 · The gap is real but episodic</div>
          <p>Mean divergence of <strong>{H.mean_divergence.toFixed(3)} index points</strong> reflects Valencia's generally well-ventilated Mediterranean coastal climate. The critical observation is the maximum of <strong>{H.max_divergence.toFixed(2)} points</strong>: during extreme episodes the single-pollutant representation diverges substantially from the CMPI — a gap large enough to shift categorical index bands.</p>
        </div>
      </section>

      {/* 04 — Diurnal pattern */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">04</div><h2 className="sec-title">When the gap peaks — <em>nocturnal NO2 accumulation</em></h2></div>
        <p className="mono muted" style={{ fontSize: '0.65rem' }}>Real RVVCCA 2021–2022 · Peak {H.peak_hour}:00 · Min {H.min_hour}:00</p>
        <p>The CMPI divergence follows a pronounced diurnal cycle. The gap peaks at <strong>{H.peak_hour}:00 (mean {H.peak_divergence.toFixed(3)} index points)</strong> and reaches its minimum at <strong>{H.min_hour}:00 ({H.min_divergence.toFixed(3)} points)</strong> — driven almost entirely by NO2.</p>
        <p>During the night, the planetary boundary layer collapses under radiative cooling, trapping combustion-sourced NO2 at ground level. The public PM10-only index is entirely blind to this accumulation. By afternoon, photochemical activity converts NO2 to secondary products, mixing height increases, and ventilation disperses both pollutants. This pattern is consistent with nocturnal boundary layer dynamics documented for Mediterranean urban environments (Millán et al., 2000).</p>
        <div className="chart-grid" style={{ marginTop: '1.5rem' }}>
          <div className="glass-panel">
            <div className="gp-label">Mean CMPI divergence &amp; NO2 by hour</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={HOURLY_PROFILE_2122}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rim)" />
                <XAxis dataKey="hour" stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
                <YAxis yAxisId="left" stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
                <Tooltip contentStyle={{ background: 'var(--deep)', border: '1px solid var(--rim)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }} />
                <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: '0.6rem' }} />
                <Line yAxisId="left" type="monotone" dataKey="divergence" stroke="#ff4455" name="Divergence" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="no2" stroke="#ff9a00" name="NO2 (µg/m³)" dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-panel">
            <div className="gp-label">O3 vs CMPI divergence by hour</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={HOURLY_PROFILE_2122}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rim)" />
                <XAxis dataKey="hour" stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
                <YAxis yAxisId="left" stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--muted)" style={{ fontSize: '0.6rem', fontFamily: 'var(--mono)' }} />
                <Tooltip contentStyle={{ background: 'var(--deep)', border: '1px solid var(--rim)', fontFamily: 'var(--mono)', fontSize: '0.7rem' }} />
                <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: '0.6rem' }} />
                <Line yAxisId="left" type="monotone" dataKey="o3" stroke="#00d4ff" name="O3 (µg/m³)" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="divergence" stroke="#ff4455" name="Divergence" dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1.5rem', borderLeft: '3px solid var(--rim2)' }}>
          <div className="gp-label">Finding 02 · Nocturnal NO2 accumulation is the dominant divergence mechanism</div>
          <p>The divergence peak at <strong>{H.peak_hour}:00</strong> is strongly associated with NO2 accumulation under nocturnal boundary layer conditions. The public PM10-only index is structurally unable to represent this gas-phase signal across the range of conditions observed in this dataset.</p>
        </div>
      </section>

      {/* 05 — Correlation drivers */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">05</div><h2 className="sec-title">What is most strongly associated with the <em>gap</em></h2></div>
        <p>Pearson correlation analysis identifies the variable most strongly associated with CMPI divergence. Wind speed shows near-zero association, consistent with the interpretation that the gap reflects a measurement scope issue rather than a ventilation phenomenon.</p>
        <div className="chart-grid" style={{ marginTop: '1.5rem' }}>
          <div className="glass-panel">
            <div className="gp-label">Pearson r with CMPI divergence</div>
            <CorrelationChart data={CORR_DATA_2122} />
          </div>
          <div className="glass-panel">
            <div className="gp-label">Air mass distribution</div>
            <AirMassChart data={AM_DATA_2122} />
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1.5rem', borderLeft: '3px solid var(--amber)' }}>
          <div className="gp-label">Finding 03 · Top correlate: {H.top_correlate} (r = {H.top_correlate_r})</div>
          <p>Wind speed shows near-zero association — the gap reflects a measurement scope limitation, not a ventilation phenomenon. PM10-only public indices are structurally unable to represent the gas-phase signal across the range of atmospheric conditions in this dataset.</p>
        </div>
      </section>

      {/* 06 — Calima */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">06</div><h2 className="sec-title"><em>Calima</em> — the inversion of the problem</h2></div>
        <p>STRATA detected <strong>{CALIMA_2122.hours.toLocaleString()} calima hours</strong> using a dual per-station criterion: PM10 must exceed 1.5 standard deviations above the 72-hour rolling station baseline, and the PM10/PM2.5 ratio must exceed 3.0, characteristic of coarse mineral aerosol transport (Rodríguez et al., 2001; Escudero et al., 2005).</p>
        <p>During dust intrusions, PM10 spikes sharply while gas-phase pollutants are not necessarily co-elevated. The public PM10-only index therefore exceeded the CMPI composite in <strong>{CALIMA_2122.pct_public_over}% of detected calima hours</strong>. Maximum observed hourly PM10 reached <strong>{CALIMA_2122.max_pm10} µg/m³</strong>.</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '1.5rem 0' }}>
          <MetricCard label="Calima hours" value={CALIMA_2122.hours.toLocaleString()} sub={`${CALIMA_2122.pct_of_obs}% of observations`} color="var(--amber)" />
          <MetricCard label="Public over-reads" value={`${CALIMA_2122.pct_public_over}%`} sub="of calima hours" color="var(--amber)" />
          <MetricCard label="Max hourly PM10" value={CALIMA_2122.max_pm10} sub="µg/m³" color="var(--red)" />
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid var(--red)' }}>
          <div className="gp-label">Finding 04 · Two failure modes · Opposite directions</div>
          <p><strong>Photochemical episodes:</strong> public index under-represents — gas-phase pollutants absent from PM10-only index. <strong>Calima events:</strong> public index over-reads in {CALIMA_2122.pct_public_over}% of cases — PM10 spikes amplified without mineral/combustion aerosol distinction.</p>
        </div>
      </section>

      {/* 07 — Complexity */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">07</div><h2 className="sec-title">Atmospheric <em>complexity</em></h2></div>
        <p>The Atmospheric Complexity Index (ACI) is a custom entropy-based metric applied to four rule-based source attribution scores. ACI = 0 indicates single-source dominance; ACI = 1 indicates maximum source ambiguity. <strong>Methodological note:</strong> the ACI is a heuristic research construct, not calibrated against receptor modelling or back-trajectory analysis.</p>
        <p>The mean ACI across the 2021–2022 dataset is <strong>{H.mean_aci.toFixed(4)}</strong>, consistent with Valencia's position at the intersection of Saharan transport corridors, Mediterranean marine circulation, and dense urban emission sources.</p>
        <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1.5rem', borderLeft: '3px solid var(--green)' }}>
          <div className="gp-label">Finding 05 · Multi-source atmospheric complexity</div>
          <p>Mean ACI of <strong>{H.mean_aci.toFixed(4)}</strong> is consistent with multi-source atmospheric influence rather than single-source dominance.</p>
        </div>
      </section>

      {/* 08 — Conclusions */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">08</div><h2 className="sec-title"><em>Conclusions</em></h2></div>
        <p>STRATA set out to ask: <em>how accurately do public AQI representations reflect actual atmospheric conditions in Valencia?</em> Based on {H.n_obs.toLocaleString()} hourly observations, the findings are consistent with <strong>imperfect, episodic representation, concentrated in two structurally distinct failure modes.</strong></p>
        <div className="chart-grid" style={{ marginTop: '1.5rem' }}>
          <div className="glass-panel"><div className="gp-label">The gap is real and episodically large</div><p>Mean divergence of <strong>{H.mean_divergence.toFixed(3)} pts</strong>. Maximum of <strong>{H.max_divergence.toFixed(2)} pts</strong>.</p></div>
          <div className="glass-panel"><div className="gp-label">Morning peak — nocturnal NO2 accumulation</div><p>Divergence peaks at <strong>{H.peak_hour}:00</strong>, lowest at <strong>{H.min_hour}:00</strong>.</p></div>
          <div className="glass-panel"><div className="gp-label">Calima — the opposite failure mode</div><p><strong>{CALIMA_2122.hours.toLocaleString()} hours</strong> detected. Public index over-reads {CALIMA_2122.pct_public_over}% of these.</p></div>
          <div className="glass-panel"><div className="gp-label">Implications</div><p>The 2024 dataset extends this into the DANA flood period — a new event type not captured here.</p></div>
        </div>
        <p className="muted" style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}><strong>Methodological note.</strong> CMPI weights are redistributed proportionally when a pollutant is unavailable. All correlations are Pearson r; they describe statistical associations and do not establish causation.</p>
      </section>

      <footer style={{ borderTop: '1px solid var(--rim)', paddingTop: '1.5rem', marginTop: '2rem', fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--muted)' }}>
        STRATA · Atmospheric Atlas · Valencia · Dataset: RVVCCA 2021–2022 · CC BY 4.0<br />
        All scientific values pipeline-derived · No hardcoding · No synthetic data
      </footer>
    </div>
  );
}
