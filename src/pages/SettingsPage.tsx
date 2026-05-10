import { useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { exportAll, importAllReplace, type ExportPayload } from '../lib/repo';
import { useUI } from '../store/ui';

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const pushToast = useUI((s) => s.pushToast);
  const {
    configured: supabaseConfigured,
    session,
    authReady,
    signInWithMagicLink,
    signOutOfEmailSession,
  } = useAuth();

  async function handleExport() {
    setBusy(true);
    try {
      const payload = await exportAll();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `tripsplit-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      pushToast({ kind: 'success', message: 'Backup downloaded' });
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    if (!file) return;
    if (
      !window.confirm(
        'Importing will REPLACE all existing trips and expenses on this device. Continue?',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as ExportPayload;
      if (payload.schemaVersion !== 1) {
        pushToast({
          kind: 'error',
          message: `Unsupported backup format (v${payload.schemaVersion}).`,
        });
        return;
      }
      const counts = await importAllReplace(payload);
      pushToast({
        kind: 'success',
        message: `Imported ${counts.groups} trips · ${counts.expenses} expenses`,
      });
    } catch (err) {
      console.error(err);
      pushToast({ kind: 'error', message: 'Import failed — invalid file?' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const user = session?.user;
  const emailLinked = Boolean(user?.email);
  const anonymousCloud =
    Boolean(user) && !emailLinked && user?.is_anonymous !== false;

  async function handleMagicLink() {
    const trimmed = email.trim();
    if (!trimmed) {
      pushToast({ kind: 'error', message: 'Enter an email address.' });
      return;
    }
    setOtpSending(true);
    try {
      const { error } = await signInWithMagicLink(trimmed);
      if (error) {
        pushToast({ kind: 'error', message: error.message });
        return;
      }
      pushToast({
        kind: 'success',
        message: 'Check your inbox for a login link.',
      });
      setEmail('');
    } finally {
      setOtpSending(false);
    }
  }

  async function handleCloudSignOut() {
    const sure = window.confirm(
      'Sign out of your cloud account on this device? Your trips stay in this browser. A new anonymous backup session starts; previous cloud rows stay tied to the account you used.',
    );
    if (!sure) return;
    setBusy(true);
    try {
      await signOutOfEmailSession();
      pushToast({ kind: 'info', message: 'Signed out of cloud account.' });
    } catch (e) {
      console.error(e);
      pushToast({ kind: 'error', message: 'Sign-out failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Local-first storage; optional encrypted-at-rest cloud mirror when you configure Supabase.
        </p>
      </div>

      {!supabaseConfigured ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          <strong className="font-medium">Cloud backup disabled.</strong> Add{' '}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code>{' '}
          and{' '}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">
            VITE_SUPABASE_ANON_KEY
          </code>{' '}
          (see README and <code className="text-xs">.env.example</code>) to enable anonymous backup
          and magic-link sign-in.
        </div>
      ) : null}

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold text-slate-900">Cloud backup (optional)</h2>
        <p className="text-sm text-slate-600">
          No password: the app uses an anonymous Supabase session by default so rows can be secured
          with RLS. You can optionally link an email via a one-time magic link to restore on another
          device when signed in with that email.{' '}
          <span className="text-slate-500">
            Linking merges your anonymous profile into the email account per Supabase (complete the
            link in this browser profile when possible).
          </span>
        </p>
        <div className="text-sm text-slate-800">
          <span className="font-medium">Status: </span>
          {!supabaseConfigured ? (
            <span>Not configured</span>
          ) : !authReady ? (
            <span>Connecting…</span>
          ) : !user ? (
            <span>Offline / not signed in</span>
          ) : emailLinked ? (
            <span>Signed in as {user.email}</span>
          ) : anonymousCloud ? (
            <span>Anonymous backup (this device)</span>
          ) : (
            <span>Signed in</span>
          )}
        </div>
        {supabaseConfigured && authReady && user ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <label htmlFor="magic-email" className="block text-xs font-medium text-slate-600">
                Email for login link
              </label>
              <input
                id="magic-email"
                type="email"
                autoComplete="email"
                className="input w-full"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={otpSending || busy}
              />
            </div>
            <button
              type="button"
              className="btn-primary shrink-0"
              disabled={otpSending || busy || !email.trim()}
              onClick={() => void handleMagicLink()}
            >
              {otpSending ? 'Sending…' : 'Email me a login link'}
            </button>
          </div>
        ) : null}
        {supabaseConfigured && authReady && emailLinked ? (
          <button
            type="button"
            className="btn-secondary text-red-700 hover:bg-red-50"
            disabled={busy}
            onClick={() => void handleCloudSignOut()}
          >
            Sign out of cloud account
          </button>
        ) : null}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold text-slate-900">Backup</h2>
        <p className="text-sm text-slate-600">
          Download a JSON snapshot of every trip on this device, or restore from a
          previously exported file. Backups are unencrypted — store them somewhere safe.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={handleExport}
            disabled={busy}
          >
            Export JSON backup
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            Import backup…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,.tripsplit.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
            }}
          />
        </div>
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="font-semibold text-slate-900">About</h2>
        <p className="text-sm text-slate-600">
          Tripsplit is a local-first trip expense tracker. Data lives in IndexedDB; optional
          Supabase sync uploads an encrypted-at-rest mirror when enabled.
        </p>
        <p className="text-xs text-slate-500">
          Roadmap: encrypted remote sync, multi-currency conversion, exact / percent /
          shares splits, transfers UI, recurring expenses.
        </p>
      </section>
    </div>
  );
}
