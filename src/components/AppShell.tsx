import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ToastViewport from './ToastViewport';

/**
 * Mobile-first app chrome. Header is sticky at the top, bottom tab
 * bar is fixed with iOS safe-area padding. On wider screens the
 * bottom bar is replaced with inline header nav.
 */
export default function AppShell() {
  const { pathname } = useLocation();
  const onGroupRoute = pathname.startsWith('/group/');

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <header
        className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-accent grid place-items-center text-white font-bold">
              T
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold text-slate-900">Tripsplit</div>
              <div className="text-[11px] text-slate-500 -mt-0.5">
                Local-first trip expenses
              </div>
            </div>
          </NavLink>
          <nav className="hidden sm:flex items-center gap-1">
            <NavTab to="/" label="Trips" exact />
            <NavTab to="/settings" label="Settings" />
          </nav>
        </div>
      </header>

      <main
        className={`mx-auto w-full max-w-2xl px-4 ${
          onGroupRoute ? 'pb-32' : 'pb-28'
        } pt-4 flex-1`}
      >
        <Outlet />
      </main>

      <BottomNav />
      <ToastViewport />
    </div>
  );
}

function NavTab({
  to,
  label,
  exact,
}: {
  to: string;
  label: string;
  exact?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
          isActive
            ? 'bg-accent/10 text-accent-600'
            : 'text-slate-600 hover:bg-slate-100'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function BottomNav() {
  return (
    <nav
      className="sm:hidden fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto max-w-2xl grid grid-cols-2">
        <BottomTab to="/" label="Trips" icon={<TripsIcon />} exact />
        <BottomTab to="/settings" label="Settings" icon={<SettingsIcon />} />
      </div>
    </nav>
  );
}

function BottomTab({
  to,
  label,
  icon,
  exact,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium ${
          isActive ? 'text-accent-600' : 'text-slate-500'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function TripsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M6 7v10a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1.11-1.55 1.7 1.7 0 00-1.87.34l-.06.06A2 2 0 113.17 16.93l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H1.83a2 2 0 110-4h.09A1.7 1.7 0 003.57 9a1.7 1.7 0 00-.34-1.87l-.06-.06A2 2 0 116 4.24l.06.06a1.7 1.7 0 001.87.34H8a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
