import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  type User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { auth, firebaseConfigured } from './firebase';
import { ensureUserDoc } from './predictions';
import { DEFAULT_CONFIG } from '../app/data/worldcup';

interface AuthState {
  user: User | null;
  loading: boolean;
  configured: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

function notConfigured(): never {
  throw new Error('Firebase no está configurado. Agrega las variables VITE_FIREBASE_* en .env.local.');
}

// Email is in the allowlist → show admin UI as a convenience. The real security
// boundary is the `admin` custom claim (enforced by Firestore rules).
function computeAdmin(u: User | null, claimAdmin: boolean): boolean {
  if (!u) return false;
  const emailAllowed = !!u.email && DEFAULT_CONFIG.adminEmails.includes(u.email);
  return claimAdmin || emailAllowed;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [, forceTick] = useState(0); // bump to re-render after in-place profile mutation

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const token = await u.getIdTokenResult();
          setIsAdmin(computeAdmin(u, token.claims.admin === true));
          await ensureUserDoc(u);
        } catch {
          setIsAdmin(computeAdmin(u, false));
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signUp(email: string, password: string, displayName: string) {
    if (!firebaseConfigured) notConfigured();
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: displayName.trim() });
    await ensureUserDoc(cred.user, displayName.trim());
    forceTick(t => t + 1);
  }

  async function logIn(email: string, password: string) {
    if (!firebaseConfigured) notConfigured();
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }

  async function logOut() {
    if (!firebaseConfigured) return;
    await signOut(auth);
  }

  async function resetPassword(email: string) {
    if (!firebaseConfigured) notConfigured();
    await sendPasswordResetEmail(auth, email.trim());
  }

  const value: AuthState = {
    user,
    loading,
    configured: firebaseConfigured,
    isAdmin,
    signUp,
    logIn,
    logOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
