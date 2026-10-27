import Link from 'next/link';
import Navbar from '../components/layout/Navbar.jsx';

export default function NotFound() {
  return (
    <div className="app-shell">
      <Navbar />
      <main id="app-main" className="app-main" tabIndex={-1}>
        <div className="card auth-card">
          <h1>Page not found</h1>
          <p className="muted">The page you requested does not exist. Use the navigation above to get back on track.</p>
          <Link href="/databases" className="btn btn-primary">Back to overview</Link>
        </div>
      </main>
    </div>
  );
}
