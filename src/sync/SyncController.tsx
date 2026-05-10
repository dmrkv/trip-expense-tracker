import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { onLocalDataMutation } from './notify';
import { syncWithSupabase } from './supabaseSync';

const DEBOUNCE_MS = 2500;
const INTERVAL_MS = 90_000;

/** Runs cloud sync when Supabase auth is ready; debounces after Dexie mutations. */
export default function SyncController() {
  const { configured, client, session, authReady } = useAuth();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!configured || !client || !authReady || !session?.user?.id) return;

    const sb = client;
    const uid = session.user.id;
    let cancelled = false;

    function flushDebounced() {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    }

    function scheduleDebouncedSync() {
      flushDebounced();
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        if (!cancelled) void syncWithSupabase(sb, uid);
      }, DEBOUNCE_MS);
    }

    void syncWithSupabase(sb, uid);

    const unsubMut = onLocalDataMutation(scheduleDebouncedSync);

    const onFocus = () => {
      void syncWithSupabase(sb, uid);
    };
    window.addEventListener('focus', onFocus);

    const onVis = () => {
      if (document.visibilityState === 'visible') void syncWithSupabase(sb, uid);
    };
    document.addEventListener('visibilitychange', onVis);

    const intervalId = window.setInterval(() => void syncWithSupabase(sb, uid), INTERVAL_MS);

    return () => {
      cancelled = true;
      unsubMut();
      flushDebounced();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(intervalId);
    };
  }, [configured, client, authReady, session?.user?.id]);

  return null;
}
