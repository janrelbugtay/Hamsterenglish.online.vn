import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as fbSignOut, 
  signInAnonymously, 
  updateProfile
} from 'firebase/auth';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: (guestName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInAsGuest: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const guestName = localStorage.getItem('hamster_guest_name');
        const displayName = fbUser.displayName || (fbUser.isAnonymous ? (guestName || "Guest Player") : "Teacher");
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: displayName,
          photoURL: fbUser.photoURL,
          isAnonymous: fbUser.isAnonymous,
        });
      } else {
        const guestName = localStorage.getItem('hamster_guest_name');
        if (guestName) {
          setUser({
            uid: 'guest-' + guestName,
            email: null,
            displayName: guestName,
            photoURL: null,
            isAnonymous: true,
          });
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      if (res.user) {
        setUser({
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName,
          photoURL: res.user.photoURL,
          isAnonymous: false,
        });
        localStorage.removeItem('hamster_guest_name');
      }
    } catch (err: any) {
      console.warn("Google Sign-In note:", err.message);
    }
  };

  const signInAsGuest = async (guestName?: string) => {
    const finalName = guestName?.trim() || "Guest Player";
    localStorage.setItem('hamster_guest_name', finalName);
    try {
      const cred = await signInAnonymously(auth);
      await updateProfile(cred.user, { displayName: finalName });
      setUser({
        uid: cred.user.uid,
        email: null,
        displayName: finalName,
        photoURL: null,
        isAnonymous: true,
      });
    } catch (e) {
      setUser({
        uid: 'guest-' + Date.now(),
        email: null,
        displayName: finalName,
        photoURL: null,
        isAnonymous: true,
      });
    }
  };

  const signOut = async () => {
    localStorage.removeItem('hamster_guest_name');
    try {
      await fbSignOut(auth);
    } catch (e) {}
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
