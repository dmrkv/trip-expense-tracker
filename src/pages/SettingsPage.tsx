import { useRef, useState } from 'react';
import { exportAll, importAllReplace, type ExportPayload } from '../lib/repo';
import { useUI } from '../store/ui';

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const pushToast = useUI((s) => s.pushToast);

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Local-first storage. Cross-device sync is on the roadmap.
        </p>
      </div>

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
          Tripsplit is a local-first trip expense tracker. All data lives in your
          browser&rsquo;s IndexedDB; nothing is uploaded.
        </p>
        <p className="text-xs text-slate-500">
          Roadmap: encrypted remote sync, multi-currency conversion, exact / percent /
          shares splits, transfers UI, recurring expenses.
        </p>
      </section>
    </div>
  );
}
