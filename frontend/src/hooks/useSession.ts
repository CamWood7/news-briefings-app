import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export function useSession() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser()
    ]).then(([sessionRes, userRes]) => {
      if (mounted) {
        setSession(sessionRes.data.session);
        setUser(userRes.data.user);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading };
} 