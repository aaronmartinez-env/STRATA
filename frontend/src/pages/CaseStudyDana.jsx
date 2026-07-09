import React from 'react';
import ThreeScene from '../components/ThreeScene';

export default function CaseStudyDana() {
  const initDanaViz = (container) => {
    // Port your original Three.js setup code here from strata_portfolio.html
    // const scene = new THREE.Scene(); ...
    // return () => { scene.dispose(); };
  };

  return (
    <div className="live-wrap">
      {/* 01: Event Overview */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">01</div><h2 className="sec-title">2024 DANA <em>Impact</em></h2></div>
        <div className="glass-panel">
          <div className="gp-label">Event Timeline</div>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>Oct 29 – Dec 15, 2024</p>
          <div className="gp-label" style={{ marginTop: '1rem' }}>Key Data</div>
          <p>Mean CMPI divergence: 9.89 index pts (daily resolution). Primary correlate: PM2.5 (r = 0.56).</p>
        </div>
      </section>

      {/* 02: Visuals */}
      <section className="live-section">
        <div className="sec-head"><div className="sec-num">02</div><h2 className="sec-title">Spatial <em>attribution</em></h2></div>
        <ThreeScene initFunction={initDanaViz} />
      </section>
    </div>
  );
}
