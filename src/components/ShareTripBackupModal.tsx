import { useCallback, useMemo } from 'react';
import Modal from './Modal';
import type { ExportPayload } from '../lib/repo';
import { encodeTripExport, MAX_TRIP_LINK_URL_LENGTH } from '../lib/tripLinkCodec';
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

function truncateMiddle(s: string, max = 76): string {
  if (s.length <= max) return s;
  const inner = max - 1;
  const head = Math.ceil(inner / 2);
  const tail = Math.floor(inner / 2);
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function canShareUrl(url: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare({ url });
    } catch {
      return false;
    }
  }
  return true;
}

export default function ShareTripBackupModal({
  open,
  onClose,
  groupName,
  backupPayload,
  backupLoading,
  backupError,
}: {
  open: boolean;
  onClose: () => void;
  groupName: string;
  backupPayload: ExportPayload | null;
  backupLoading: boolean;
  backupError: string | null;
}) {
  const pushToast = useUI((s) => s.pushToast);

  const backupJson = useMemo(
    () => (backupPayload ? JSON.stringify(backupPayload, null, 2) : null),
    [backupPayload],
  );

  const filename = useMemo(() => tripBackupFilename(groupName), [groupName]);

  const linkPack = useMemo(() => {
    if (!backupPayload) return null;
    return encodeTripExport(backupPayload);
  }, [backupPayload]);

  const shareUrlSupported = useMemo(() => {
    if (!linkPack || linkPack.tooLarge) return false;
    return canShareUrl(linkPack.url);
  }, [linkPack]);

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

  const handleCopyJson = useCallback(async () => {
    if (!backupJson) return;
    const ok = await copyText(backupJson);
    pushToast({
      kind: ok ? 'success' : 'error',
      message: ok ? 'JSON copied to clipboard' : 'Could not copy — try Download instead',
    });
  }, [backupJson, pushToast]);

  const handleCopyLink = useCallback(async () => {
    if (!linkPack || linkPack.tooLarge) return;
    const ok = await copyText(linkPack.url);
    pushToast({
      kind: ok ? 'success' : 'error',
      message: ok ? 'Link copied' : 'Could not copy link',
    });
  }, [linkPack, pushToast]);

  const handleShareLink = useCallback(async () => {
    if (!linkPack || linkPack.tooLarge || !shareUrlSupported) return;
    try {
      await navigator.share({
        url: linkPack.url,
        title: `Tripsplit: ${groupName}`,
        text: 'Open this link in Tripsplit to import the trip (replaces local data).',
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      pushToast({ kind: 'error', message: 'Share failed' });
    }
  }, [linkPack, groupName, pushToast, shareUrlSupported]);

  const linkTooLarge = Boolean(linkPack?.tooLarge);

  return (
    <Modal open={open} onClose={onClose} title="Share this trip online">
      <div className="space-y-4">
        <p className="text-sm text-slate-700 font-medium leading-relaxed">
          Anyone with the link can open Tripsplit and import this trip on their phone.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          The link packs a compressed backup in the URL (after{' '}
          <span className="font-medium text-slate-800">#</span>
          ). Opening it here prompts to import — nothing is uploaded to a server. Each person keeps a
          local copy; there is no live sync between devices.
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
            className="btn-primary min-h-11 w-full justify-center"
            disabled={!linkPack || backupLoading || linkTooLarge}
            onClick={() => void handleCopyLink()}
          >
            Copy link
          </button>
          {shareUrlSupported ? (
            <button
              type="button"
              className="btn-primary min-h-11 w-full justify-center ring-1 ring-accent/25 shadow-none"
              disabled={!linkPack || backupLoading || linkTooLarge}
              onClick={() => void handleShareLink()}
            >
              Share link…
            </button>
          ) : null}

          {linkPack && !backupLoading && !backupError ? (
            <div className="space-y-2">
              {linkTooLarge ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                  This trip is too large for a shareable link (over ~{MAX_TRIP_LINK_URL_LENGTH.toLocaleString()}{' '}
                  characters for the full URL). Use <span className="font-medium">Copy JSON</span> or{' '}
                  <span className="font-medium">Download</span> instead.
                </p>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">
                    Link preview
                  </div>
                  <p className="text-xs text-slate-700 break-all font-mono leading-snug">
                    {truncateMiddle(linkPack.url)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Compressed payload: {linkPack.bytes.toLocaleString()} bytes (gzip)
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <div className="border-t border-slate-100 pt-3 mt-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-2">
              Advanced
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                className="btn-secondary min-h-11 w-full justify-center"
                disabled={!backupJson || backupLoading}
                onClick={() => void handleCopyJson()}
              >
                Copy JSON
              </button>
              <button
                type="button"
                className="btn-secondary min-h-11 w-full justify-center"
                disabled={!backupJson || backupLoading}
                onClick={handleDownload}
              >
                Download backup
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
