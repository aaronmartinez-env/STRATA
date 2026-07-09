import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import './Home.css';

function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.06, rootMargin: '0px 0px -30px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

export default function Home() {
  useReveal();

  return (
    <div className="home">
      <div className="home-stage">

        <div className="home-eyebrow reveal">
          Environmental Data Science · Valencia · RVVCCA
        </div>

        <h1 className="home-title reveal">
          The atmosphere,<br />made <em>readable</em>
        </h1>

        <p className="home-sub reveal">
          Strata is a research platform for exploring air quality, pollutant transport,
          and atmospheric events across the Valencia monitoring network —
          from historical case studies to live station readings.
        </p>

        <div className="home-modules reveal">

          <Link to="/live" className="mod-card mod-live">
            <div className="mod-tag live">Module B — Live Data</div>
            <div className="mod-label">Live<br />Observatory</div>
            <div className="mod-desc">
              Real-time station readings from the RVVCCA network.<br />
              Current pollutant levels, hourly time series,<br />
              and interactive 3D city visualization.
            </div>
            <div className="mod-arrow">Open Observatory →</div>
          </Link>

          <Link to="/case-studies/valencia-2021-2022" className="mod-card mod-atlas">
            <div className="mod-tag atlas">Module A — Case Studies</div>
            <div className="mod-label">Atmospheric<br />Atlas</div>
            <div className="mod-desc">
              2021–22 hourly dataset &amp; 2024 DANA period.<br />
              CMPI divergence, calima events, ACI index,<br />
              3D city visualizations &amp; correlation analysis.
            </div>
            <div className="mod-arrow">Open Atlas →</div>
          </Link>

        </div>

      </div>
    </div>
  );
}
