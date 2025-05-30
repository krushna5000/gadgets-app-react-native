import { Session } from '@supabase/supabase-js';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

type AuthData = {
  session: Session | null;
  mounting: boolean;
  user: any;
};

const AuthContext = createContext<AuthData>({
  session: null,
  mounting: true,
  user: null,
});

export default function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<{
    avatar_url: string;
    created_at: string | null;
    email: string;
    id: string;
    stripe_customer_id: string | null;
    type: string | null;
  } | null>(null);
  const [mounting, setMounting] = useState(true);

  const createOrUpdateUser = async (sessionUser: { id: string; email: string }) => {
    // First try to get the user
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', sessionUser.id)
      .single();

    if (fetchError) {
      // If user doesn't exist, create one
      if (fetchError.code === 'PGRST116') {
        const newUserData = {
          id: sessionUser.id,
          email: sessionUser.email,
          created_at: new Date().toISOString(),
          avatar_url: '',
          stripe_customer_id: null,
          type: 'customer'
        };

        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert(newUserData)
          .select()
          .single();

        if (createError) {
          console.error('Error creating user:', createError);
          setUser(null);
          return;
        }

        setUser(newUser);
        return;
      }

      console.error('Error fetching user data:', fetchError);
      setUser(null);
      return;
    }

    setUser(existingUser);
  };

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setSession(session);

        if (session?.user?.email) {
          await createOrUpdateUser({
            id: session.user.id,
            email: session.user.email
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching session:', error);
        setSession(null);
        setUser(null);
      } finally {
        setMounting(false);
      }
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user?.email) {
          await createOrUpdateUser({
            id: session.user.id,
            email: session.user.email
          });
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, mounting, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
