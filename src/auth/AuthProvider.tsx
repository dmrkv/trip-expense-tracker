import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

export interface AuthContextValue {
  configured: boolean;
  client: ReturnType<typeof getSupabaseClient>;
  session: Session | null;
  authReady: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOutOfEmailSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const client = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!configured);

  useEffect(() => {
    if (!client) {
      queueMicrotask(() => {
        setSession(null);
        setAuthReady(true);
      });
      return;
    }

    let cancelled = false;

    void client.auth.getSession().then(({ data: { session: initial } }) => {
      if (cancelled) return;
      setSession(initial);
      if (!initial) {
        void client.auth.signInAnonymously().then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.warn('[auth] Anonymous sign-in failed.', error.message);
            setAuthReady(true);
            return;
          }
          if (data.session) setSession(data.session);
          setAuthReady(true);
        });
      } else {
        setAuthReady(true);
      }
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  const signInWithMagicLink = useCallback(
    async (email: string) => {
      if (!client) return { error: new Error('Supabase is not configured') };
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/settings`,
        },
      });
      return { error: error ? new Error(error.message) : null };
    },
    [client],
  );

  /**
   * Ends the current Supabase session (including linked email) and starts a fresh
   * anonymous session so optional backup keeps working on this device.
   */
  const signOutOfEmailSession = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    const { data, error } = await client.auth.signInAnonymously();
    if (error) console.warn('[auth] Could not start anonymous session after sign-out.', error.message);
    else if (data.session) setSession(data.session);
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      client,
      session,
      authReady,
      signInWithMagicLink,
      signOutOfEmailSession,
    }),
    [configured, client, session, authReady, signInWithMagicLink, signOutOfEmailSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Auth consumer hook (exported alongside provider for ergonomics). */
// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
