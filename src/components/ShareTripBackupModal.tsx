import { useCallback, useMemo } from 'react';
import Modal from './Modal';
import { useUI } from '../store/ui';

function tripBackupFilename(groupName: string): string {
  const slug =
    groupName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'trip';
  const date = new Date().toISOString().slice(0, 10);
  return `tripsplit-trip-${slug}-${date}.tripsplit.json`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function ShareTripBackupModal({
  open,
  onClose,
  groupName,
  backupJson,
  backupLoading,
  backupError,
}: {
  open: boolean;
  onClose: () => void;
  groupName: string;
  backupJson: string | null;
  backupLoading: boolean;
  backupError: string | null;
}) {
  const pushToast = useUI((s) => s.pushToast);

  const filename = useMemo(() => tripBackupFilename(groupName), [groupName]);

  const shareFilesSupported = useMemo(() => {
    if (!backupJson || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return false;
    }
    try {
      const file = new File([backupJson], filename, { type: 'application/json' });
      return navigator.canShare?.({ files: [file] }) ?? false;
    } catch {
      return false;
    }
  }, [backupJson, filename]);

  const handleDownload = useCallback(() => {
    if (!backupJson) return;
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushToast({ kind: 'success', message: 'Backup downloaded' });
  }, [backupJson, filename, pushToast]);

  const handleCopy = useCallback(async () => {
    if (!backupJson) return;
    const ok = await copyText(backupJson);
    pushToast({
      kind: ok ? 'success' : 'error',
      message: ok ? 'JSON copied to clipboard' : 'Could not copy — try Download instead',
    });
  }, [backupJson, pushToast]);

  const handleNativeShare = useCallback(async () => {
    if (!backupJson || !shareFilesSupported) return;
    const file = new File([backupJson], filename, { type: 'application/json' });
    const data: ShareData = {
      files: [file],
      title: `Tripsplit: ${groupName}`,
      text: 'Trip backup for Tripsplit',
    };
    try {
      await navigator.share(data);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      pushToast({ kind: 'error', message: 'Share failed' });
    }
  }, [backupJson, filename, groupName, pushToast, shareFilesSupported]);

  return (
    <Modal open={open} onClose={onClose} title="Share trip backup">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          Share this backup so friends can import the trip on their device. Tripsplit keeps data
          on each phone or browser — there is no live sync yet.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Recipients open <span className="font-medium text-slate-800">Tripsplit → Settings</span>,
          choose <span className="font-medium text-slate-800">Import backup</span>, and select this
          file. Importing replaces all trips stored on that device — they should export first if
          needed.
        </p>

        {backupLoading ? (
          <p className="text-sm text-slate-500">Preparing backup…</p>
        ) : null}
        {backupError ? (
          <p className="text-sm text-red-600" role="alert">
            {backupError}
          </p>
        ) : null}

        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            className="btn-secondary min-h-11 w-full justify-center"
            disabled={!backupJson || backupLoading}
            onClick={() => void handleCopy()}
          >
            Copy JSON
          </button>
          <button
            type="button"
            className="btn-primary min-h-11 w-full justify-center"
            disabled={!backupJson || backupLoading}
            onClick={handleDownload}
          >
            Download backup
          </button>
          {shareFilesSupported ? (
            <button
              type="button"
              className="btn-secondary min-h-11 w-full justify-center"
              disabled={!backupJson || backupLoading}
              onClick={() => void handleNativeShare()}
            >
              Share file…
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
