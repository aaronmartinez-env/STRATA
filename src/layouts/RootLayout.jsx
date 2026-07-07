import { Outlet, NavLink } from 'react-router-dom';
import './RootLayout.css';

export default function RootLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="brand">STRATA</NavLink>
        <nav className="main-nav">
          <NavLink to="/live" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Live
          </NavLink>
          <NavLink to="/case-studies/valencia-2021-2022" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Case Studies
          </NavLink>
        </nav>
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <footer className="app-footer">
        <span>STRATA — Valencia atmospheric data</span>
      </footer>
    </div>
  );
}
