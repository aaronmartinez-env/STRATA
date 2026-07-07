import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <section>
      <h1>STRATA</h1>
      <p>Valencia atmospheric data — from live exploration to historical analysis.</p>

      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
        <Link to="/live">
          <h2>Live Data →</h2>
          <p>Explore hourly RVVCCA data for any Valencia station, any date range from 2009 to now.</p>
        </Link>

        <Link to="/case-studies/valencia-2021-2022">
          <h2>Case Studies →</h2>
          <p>Interpreted findings: Valencia's atmosphere 2021–2022, and the 2024 DANA event.</p>
        </Link>
      </div>
    </section>
  );
}
