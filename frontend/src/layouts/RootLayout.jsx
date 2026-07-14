import { Outlet, NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import './RootLayout.css';

// ── Atmospheric canvas (ambient particle / stream system) ─────────────────────
function AtmosCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, particles = [], streams = [], raf;

    const wU = (x, y) => -0.28 + 0.14 * Math.sin(y / H * 3.14 + 0.5) + 0.07 * Math.cos(x / W * 6.28);
    const wV = (x, y) => -0.58 + 0.18 * Math.cos(x / W * 3.14) + 0.09 * Math.sin(y / H * 6.28);

    class P {
      reset() {
        this.x = Math.random() * W; this.y = Math.random() * H;
        this.age = 0; this.maxAge = 160 + Math.random() * 220;
        this.sp = 0.55 + Math.random() * 0.75;
        const r = Math.random();
        this.c = r < 0.55 ? [0,180,220] : r < 0.78 ? [0,140,200] : r < 0.91 ? [255,140,0] : [255,60,75];
        this.sz = 0.7 + Math.random() * 0.75;
      }
      constructor() { this.reset(); }
      update() {
        this.x += wU(this.x, this.y) * this.sp;
        this.y += wV(this.x, this.y) * this.sp;
        this.age++;
        if (this.age > this.maxAge || this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
      }
      draw() {
        const l = this.age / this.maxAge;
        const a = l < 0.1 ? l / 0.1 : l > 0.85 ? (1 - l) / 0.15 : 1;
        const [r, g, b] = this.c;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.sz, 0, 6.28);
        ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.28})`; ctx.fill();
      }
    }

    class S {
      reset() {
        this.pts = []; this.x = Math.random() * W; this.y = Math.random() * H;
        this.maxPts = 35 + Math.floor(Math.random() * 55);
        this.age = 0; this.maxAge = 280 + Math.random() * 380;
        this.sp = 0.9 + Math.random() * 1.1;
        const r = Math.random();
        this.c = r < 0.62 ? [0,200,240] : r < 0.84 ? [0,155,195] : [255,150,0];
      }
      constructor() { this.reset(); }
      update() {
        this.x += wU(this.x, this.y) * this.sp;
        this.y += wV(this.x, this.y) * this.sp;
        this.pts.push({ x: this.x, y: this.y });
        if (this.pts.length > this.maxPts) this.pts.shift();
        this.age++;
        if (this.age > this.maxAge || this.x < -50 || this.x > W + 50 || this.y < -50 || this.y > H + 50) this.reset();
      }
      draw() {
        if (this.pts.length < 2) return;
        const l = this.age / this.maxAge;
        const a = l < 0.08 ? l / 0.08 : l > 0.88 ? (1 - l) / 0.12 : 1;
        const [r, g, b] = this.c;
        ctx.beginPath(); ctx.moveTo(this.pts[0].x, this.pts[0].y);
        for (let i = 1; i < this.pts.length; i++) {
          const t = i / this.pts.length;
          ctx.strokeStyle = `rgba(${r},${g},${b},${a * t * 0.2})`;
          ctx.lineWidth = 0.5 + t * 0.4;
          ctx.lineTo(this.pts[i].x, this.pts[i].y);
        }
        ctx.stroke();
      }
    }

    function init() {
      particles = Array.from({ length: 160 }, () => new P());
      streams   = Array.from({ length: 40  }, () => { const s = new S(); s.age = Math.floor(Math.random() * s.maxAge); return s; });
    }

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      init();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      streams.forEach(s => { s.update(); s.draw(); });
      particles.forEach(p => { p.update(); p.draw(); });
      raf = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize(); draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}

// ── Theme toggle ──────────────────────────────────────────────────────────────
function useTheme() {
  const [light, setLight] = useState(() => localStorage.getItem('Strata-theme') === 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
    localStorage.setItem('Strata-theme', light ? 'light' : 'dark');
  }, [light]);
  return [light, setLight];
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [light, setLight] = useTheme();

  return (
    <div className="app-shell">
      <AtmosCanvas />

      <header className="app-header">
        <NavLink to="/" className="brand">
          Strata<span className="brand-sub"> · Atmospheric Atlas · Valencia</span>
        </NavLink>
        <nav className="main-nav">
          <NavLink
            to="/live"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Live
          </NavLink>
          <NavLink
            to="/wind"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Wind
          </NavLink>
          <NavLink
            to="/case-studies/valencia-2021-2022"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Case Studies
          </NavLink>
          <div className="nav-live">
            <div className="nav-dot" />
            RVVCCA
          </div>
        </nav>
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="footer-text">
          <strong style={{ color: 'rgba(200,216,232,0.35)' }}>Strata</strong>
          {' · '}Aaron Martinez · Environmental Sciences · UV
          {' · '}Data: <a href="https://mediambient.gva.es" target="_blank" rel="noreferrer">RVVCCA / GVA</a>
        </div>
        <div className="footer-text" style={{ textAlign: 'right' }}>
          strata-atmos.com
        </div>
      </footer>

      <button
        className="theme-toggle"
        onClick={() => setLight(l => !l)}
        aria-label="Toggle theme"
      >
        {light ? '◑ Dark' : '☀ Light'}
      </button>
    </div>
  );
}
