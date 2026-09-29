import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { type Session, type User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type UserRole = 'superadmin' | 'admin' | 'end_user';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: UserRole;
  isLoading: boolean;
  roleLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function roleFromMetadata(user: User | null): UserRole {
  const raw = user?.app_metadata?.role;
  if (raw === 'superadmin' || raw === 'admin' || raw === 'end_user') return raw;
  return 'end_user';
}

async function fetchRoleFromDB(uid: string, fallbackUser: User | null): Promise<UserRole> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', uid)
    .maybeSingle();
  if (error || !data) return roleFromMetadata(fallbackUser);
  return data.role as UserRole;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>('end_user');
  const [isLoading, setIsLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        setRoleLoading(true);
        const r = await fetchRoleFromDB(data.session.user.id, data.session.user);
        if (!mounted) return;
        setRole(r);
        setRoleLoading(false);
      } else {
        setRole('end_user');
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      // Skip INITIAL_SESSION — getSession already handles the initial load.
      if (event === 'INITIAL_SESSION') return;
      setSession(s);
      if (s?.user) {
        setRoleLoading(true);
        (async () => {
          const r = await fetchRoleFromDB(s.user.id, s.user);
          if (!mounted) return;
          setRole(r);
          setRoleLoading(false);
        })();
      } else {
        setRole('end_user');
        setRoleLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshRole = useCallback(async () => {
    if (!session?.user) return;
    setRoleLoading(true);
    const r = await fetchRoleFromDB(session.user.id, session.user);
    setRole(r);
    setRoleLoading(false);
  }, [session]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // If the user has no role claim yet, try to set it via the edge function.
    // Superadmin (configured via ADMIN_EMAIL) gets their claim this way.
    if (!data.user?.app_metadata?.role) {
      try {
        await supabase.functions.invoke('set-admin-claim', {
          headers: { Authorization: `Bearer ${data.session?.access_token}` },
        });
      } catch {
        // Non-fatal: role will be fetched from user_roles table instead.
      }
    }

    // Fetch the role directly from the database so the route guard has
    // the correct value before it decides whether to redirect.
    if (data.user) {
      setRoleLoading(true);
      const r = await fetchRoleFromDB(data.user.id, data.user);
      setRole(r);
      setRoleLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // New users get 'end_user' role automatically via the database trigger.
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole('end_user');
    setRoleLoading(false);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, isLoading, roleLoading, signIn, signUp, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// Backward-compatible alias for existing imports.
export function useAdminAuth() {
  return useAuth();
}
