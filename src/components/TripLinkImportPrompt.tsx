import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import { importAllReplace, type ExportPayload } from '../lib/repo';
import {
  TripLinkDecodeError,
  decodeTripHash,
  isTripLinkHash,
  tripLinkDecodeUserMessage,
} from '../lib/tripLinkCodec';
import { useUI } from '../store/ui';

function stripHashFromLocation() {
  const path = window.location.pathname + window.location.search;
  window.history.replaceState(null, '', path);
}

export default function TripLinkImportPrompt() {
  const pushToast = useUI((s) => s.pushToast);
  const [offer, setOffer] = useState<ExportPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const dismiss = useCallback(() => {
    setOffer(null);
    stripHashFromLocation();
  }, []);

  useEffect(() => {
    function tryConsume() {
      const raw = window.location.hash;
      if (!raw || !isTripLinkHash(raw)) return;
      try {
        const payload = decodeTripHash(raw);
        setOffer(payload);
      } catch (e) {
        if (import.meta.env.DEV) {
          const detail =
            e instanceof TripLinkDecodeError ? { step: e.step, cause: e.cause } : e;
          console.warn('[trip link decode]', detail);
        }
        pushToast({ kind: 'error', message: tripLinkDecodeUserMessage(e) });
        stripHashFromLocation();
      }
    }
    tryConsume();
    window.addEventListener('hashchange', tryConsume);
    return () => window.removeEventListener('hashchange', tryConsume);
  }, [pushToast]);

  const confirmImport = useCallback(async () => {
    if (!offer || busy) return;
    setBusy(true);
    try {
      const counts = await importAllReplace(offer);
      pushToast({
        kind: 'success',
        message: `Imported ${counts.groups} trips · ${counts.expenses} expenses`,
      });
      setOffer(null);
      stripHashFromLocation();
    } catch (err) {
      console.error(err);
      pushToast({ kind: 'error', message: 'Import failed.' });
    } finally {
      setBusy(false);
    }
  }, [offer, busy, pushToast]);

  return (
    <Modal
      open={offer !== null}
      onClose={dismiss}
      title="Import shared trip?"
      variant="centered"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-secondary min-h-10"
            disabled={busy}
            onClick={dismiss}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary min-h-10"
            disabled={busy}
            onClick={() => void confirmImport()}
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 leading-relaxed">
        This replaces <span className="font-medium text-slate-800">all trips and expenses</span>{' '}
        stored in this browser with the trip from the link — same as{' '}
        <span className="font-medium text-slate-800">Settings → Import backup</span>. Export first
        if you need to keep what you have here.
      </p>
    </Modal>
  );
}
