import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const SESSION_REFRESH_BUFFER_SECONDS = 60;

function isSessionExpired(expiresAt?: number | null) {
  if (!expiresAt) {
    return true;
  }

  return expiresAt <= Math.floor(Date.now() / 1000) + SESSION_REFRESH_BUFFER_SECONDS;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isLoading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const clearSession = async () => {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    };

    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setSession(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      let nextSession = session;

      if (isSessionExpired(session.expires_at)) {
        const { data: refreshed, error } = await supabase.auth.refreshSession();
        nextSession = error ? null : refreshed.session;
      }

      if (!nextSession) {
        await clearSession();
        setIsLoading(false);
        return;
      }

      const { data: validatedUser, error: validateError } = await supabase.auth.getUser(nextSession.access_token);
      if (validateError || !validatedUser.user) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        nextSession = refreshError ? null : refreshed.session;

        if (!nextSession) {
          await clearSession();
          setIsLoading(false);
          return;
        }

        const { data: revalidatedUser, error: revalidateError } = await supabase.auth.getUser(nextSession.access_token);
        if (revalidateError || !revalidatedUser.user) {
          await clearSession();
          setIsLoading(false);
          return;
        }

        setSession(nextSession);
        setUser(revalidatedUser.user);
        setIsLoading(false);
        return;
      }

      setSession(nextSession);
      setUser(validatedUser.user);
      setIsLoading(false);
    };

    void loadSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
