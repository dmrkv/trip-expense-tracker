import { Briefcase, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import ToastViewport from './ToastViewport';
import TripLinkImportPrompt from './TripLinkImportPrompt';

/**
 * Mobile-first app chrome. Header is sticky at the top, bottom tab
 * bar is fixed with iOS safe-area padding. On wider screens the
 * bottom bar is replaced with inline header nav.
 */
export default function AppShell() {
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
        className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 flex-1"
      >
        <Outlet />
      </main>

      <BottomNav />
      <TripLinkImportPrompt />
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
  return <Briefcase className="h-[22px] w-[22px]" strokeWidth={1.7} aria-hidden />;
}

function SettingsIcon() {
  return <Settings className="h-[22px] w-[22px]" strokeWidth={1.7} aria-hidden />;
}
