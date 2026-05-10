import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-3">🧭</div>
      <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-500 mt-1">
        That URL doesn’t match any trip we know about.
      </p>
      <Link to="/" className="btn-primary mt-5 inline-flex">
        Back to trips
      </Link>
    </div>
  );
}
