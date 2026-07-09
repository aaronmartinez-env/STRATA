import React from 'react';

export default function CaseStudyValencia() {
  return (
    <div className="live-wrap">
      {/* 01: Overview */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">01</div><h2 className="sec-title">2021–2022 <em>Analysis</em></h2></div>
        <p>STRATA quantifies the divergence between public AQI systems and a multi-pollutant composite index (CMPI) during Saharan calima events.</p>
        
        <div className="glass-panel" style={{ marginTop: '2rem' }}>
          <div className="gp-label">Key Findings</div>
          <table className="analysis-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <tbody>
              <tr><td>Mean CMPI divergence</td><td>4.22 index pts</td></tr>
              <tr><td>Peak divergence hour</td><td>06:00 (nocturnal NO₂)</td></tr>
              <tr><td>Calima hours detected</td><td>2,591 (1.62% of obs.)</td></tr>
              <tr><td>Public over-reads during calima</td><td>35.8% of calima hours</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 02: Methodology */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">02</div><h2 className="sec-title">Methodology <em>& Weights</em></h2></div>
        <div className="glass-panel">
          <div className="gp-label">CMPI Weights</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>
            <li>PM2.5: 40% (WHO 2021 emphasis)</li>
            <li>PM10: 30% (Spanish regulatory)</li>
            <li>NO₂: 20% (Urban combustion)</li>
            <li>O₃: 10% (Photochemical)</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
