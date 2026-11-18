import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  linkWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signInWithCredential 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, facebookProvider, safeFirestoreWrite } from '../lib/firebase';
import { logUserActivity } from '../utils/activityTracker';
import { syncLocalComputerGamesForUser } from '../utils/platformCache';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  linkWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<any>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<any>;
  signInAsGuest: (guestName?: string) => Promise<any>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const GUEST_SESSION_STORAGE_KEY = 'hamster_guest_session_v1';

function getProviderLabel(u: User | null): string {
  if (!u) return 'unknown';
  if (u.isAnonymous) return 'guest';
  const pid = u.providerData?.[0]?.providerId || '';
  if (pid.includes('google')) return 'google';
  if (pid.includes('facebook')) return 'facebook';
  if (pid.includes('password')) return 'email';
  return 'google';
}

function getSignInMillis(u: User | null): number {
  try {
    const t = u?.metadata?.lastSignInTime;
    if (t) {
      const ms = new Date(t).getTime();
      if (!isNaN(ms) && ms > 0) return ms;
    }
  } catch {}
  return Date.now();
}

function readStoredLocalGuest(): User | null {
  try {
    const raw = sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid && parsed.isAnonymous) {
      return parsed as User;
    }
  } catch {}
  return null;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isAuthenticatingRef = useRef(false);

  const syncUserSessionRecord = async (currentUser: User, explicitMethod?: string) => {
    const isGuest = Boolean(currentUser.isAnonymous);
    const signInMs = getSignInMillis(currentUser);
    const sessionKey = `hamster_session_auth_synced_${currentUser.uid}_${signInMs}`;
    let alreadySynced = false;
    try {
      alreadySynced = sessionStorage.getItem(sessionKey) === '1';
    } catch {}
    if (alreadySynced) return;

    const authProvider = explicitMethod || getProviderLabel(currentUser);
    const resolvedEmail = isGuest ? 'Guest' : (currentUser.email || 'User');
    const resolvedName =
      currentUser.displayName ||
      (isGuest ? 'Guest Player' : currentUser.email ? currentUser.email.split('@')[0] : 'Teacher');

    try {
      sessionStorage.setItem(sessionKey, '1');
    } catch {}

    // Always push accurate login info to server platform cache so Admin Recent Users stays accurate even under quota limits
    fetch('/api/platform-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: [
          {
            id: currentUser.uid,
            uid: currentUser.uid,
            email: resolvedEmail,
            displayName: resolvedName,
            photoURL: currentUser.photoURL || null,
            isAnonymous: isGuest,
            authProvider,
            lastLoginAt: signInMs,
          },
        ],
      }),
    }).catch(() => {});

    // Log login activity event (works for both registered users and guests)
    logUserActivity({
      userId: currentUser.uid,
      userEmail: resolvedEmail,
      userName: resolvedName,
      userPhoto: currentUser.photoURL || null,
      isAnonymous: isGuest,
      action: 'login',
      title: isGuest ? 'Signed in as Guest' : 'Signed in to account',
      details: `Auth provider: ${authProvider}`,
      timestamp: signInMs,
    });

    // Sync to Firestore `users/{uid}` when backed by a real Firebase Auth session
    if (!(currentUser as any).isLocalGuestSession) {
      const userRef = doc(db, 'users', currentUser.uid);
      await safeFirestoreWrite(() =>
        setDoc(
          userRef,
          {
            uid: currentUser.uid,
            email: resolvedEmail,
            displayName: resolvedName,
            photoURL: currentUser.photoURL || null,
            isAnonymous: isGuest,
            authProvider,
            lastLoginAt: serverTimestamp(),
          },
          { merge: true }
        )
      );
    }
  };

  useEffect(() => {
    // Listen for auth state changes immediately from local cache / network
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        try {
          sessionStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
        } catch {}
        setUser(currentUser);
        setLoading(false);
        setAuthError(null);
        // Sync any privately saved local games on the user's computer to platform cache & cloud
        syncLocalComputerGamesForUser(currentUser, db).catch(() => {});
        // Record accurate login timestamp & provider once per Firebase sign-in session
        syncUserSessionRecord(currentUser).catch(() => {});
      } else {
        const localGuest = readStoredLocalGuest();
        setUser(localGuest);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => {
    setAuthError(null);
  };

  const linkWithGoogle = async () => {
    if (!user || !user.isAnonymous) return;
    if (isAuthenticatingRef.current) return;

    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);

    const safetyTimeout = setTimeout(() => {
      if (isAuthenticatingRef.current) {
        isAuthenticatingRef.current = false;
        setIsAuthenticating(false);
      }
    }, 30000);

    try {
      await linkWithPopup(user, googleProvider);
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        return;
      }

      if (error?.code === 'auth/credential-already-in-use' || error?.code === 'auth/account-exists-with-different-credential') {
        const credential = GoogleAuthProvider.credentialFromError(error);
        if (credential) {
          try {
            await signInWithCredential(auth, credential);
            return;
          } catch(e: any) {
             if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
               console.error("sign in with credential error", e);
             }
             return;
          }
        }
      }
      
      console.error('Error linking with Google', error);
      let errorMessage = `Link failed: ${error.message}`;
      setAuthError(errorMessage);
    } finally {
      clearTimeout(safetyTimeout);
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  };

  const signInWithFacebook = async () => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);

    const safetyTimeout = setTimeout(() => {
      if (isAuthenticatingRef.current) {
        isAuthenticatingRef.current = false;
        setIsAuthenticating(false);
      }
    }, 30000);

    try {
      await signInWithPopup(auth, facebookProvider);
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        return;
      }
      
      console.error('Error signing in with Facebook', error);
      let errorMessage = `Sign in failed: ${error.message}`;
      
      if (error?.code === 'auth/operation-not-supported-in-this-environment' || error?.message?.includes('auth/configuration-not-found') || error?.code === 'auth/invalid-credential') {
        errorMessage = "Facebook login is not configured in Firebase yet.\n\nPlease enable it in Firebase Console -> Authentication -> Sign-in method, and add your Facebook App ID & App Secret.";
      } else if (error?.code === 'auth/unauthorized-domain') {
        errorMessage = "Unauthorized domain for Facebook login. Please add this domain to Firebase Authentication Authorized Domains.";
      } else if (error?.code === 'auth/popup-blocked') {
        errorMessage = "Popup was blocked by your browser. Please allow popups for this site.";
      }
      
      setAuthError(errorMessage);
    } finally {
      clearTimeout(safetyTimeout);
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  };

  const signInWithGoogle = async () => {
    if (isAuthenticatingRef.current) {
      console.log('Authentication is already in progress.');
      return;
    }

    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);

    // 35-second safety timer so the state never hangs forever
    const safetyTimeout = setTimeout(() => {
      if (isAuthenticatingRef.current) {
        console.warn('Google sign-in timed out. Resetting state.');
        isAuthenticatingRef.current = false;
        setIsAuthenticating(false);
        setAuthError('Sign in timed out. If the popup was blocked by your browser, please enable popups and try again.');
      }
    }, 35000);

    try {
      googleProvider.setCustomParameters({ prompt: "select_account" });

      // If user is currently anonymous, attempt to link account or sign in with credential
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          await linkWithPopup(auth.currentUser, googleProvider);
          return;
        } catch (linkError: any) {
          if (
            linkError?.code === 'auth/credential-already-in-use' || 
            linkError?.code === 'auth/account-exists-with-different-credential' ||
            linkError?.code === 'auth/email-already-in-use'
          ) {
            const credential = GoogleAuthProvider.credentialFromError(linkError);
            if (credential) {
              await signInWithCredential(auth, credential);
              return;
            }
          }
          if (linkError?.code === 'auth/popup-closed-by-user' || linkError?.code === 'auth/cancelled-popup-request') {
            return;
          }
        }
      }

      // Standard direct popup sign-in
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (popupErr: any) {
        if (
          popupErr?.code === 'auth/credential-already-in-use' ||
          popupErr?.code === 'auth/account-exists-with-different-credential'
        ) {
          const cred = GoogleAuthProvider.credentialFromError(popupErr);
          if (cred) {
            await signInWithCredential(auth, cred);
            return;
          }
        }
        throw popupErr;
      }
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        return;
      }

      console.error('Error signing in with Google', error);
      let errorMessage = `Sign in failed: ${error.message || 'Unknown error'}`;
      
      if (error?.code === 'auth/popup-blocked') {
        errorMessage = 'Sign in popup was blocked by your browser. Please allow popups for this site, or open the app in a new tab.';
      } else if (error?.code === 'auth/unauthorized-domain') {
        errorMessage = 'Sign in failed: Unauthorized domain. Please add this domain to Firebase Authentication Authorized Domains.';
      }
      
      setAuthError(errorMessage);
      throw error;
    } finally {
      clearTimeout(safetyTimeout);
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      setUser(cred.user);
      return cred.user;
    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = 'Invalid email or password. Please check your credentials or create a new account.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (userCredential.user) {
        const displayName = name.trim() || email.split('@')[0];
        try {
          await updateProfile(userCredential.user, { displayName });
        } catch (pErr) {
          console.warn('Update profile notice:', pErr);
        }
        const userRef = doc(db, 'users', userCredential.user.uid);
        await safeFirestoreWrite(() =>
          setDoc(userRef, {
            uid: userCredential.user.uid,
            email: userCredential.user.email || email.trim(),
            displayName,
            photoURL: null,
            isAnonymous: false,
            lastLoginAt: serverTimestamp(),
          }, { merge: true })
        );
        setUser(userCredential.user);
      }
      return userCredential.user;
    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') {
        msg = 'This email is already in use. Please sign in instead.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signInAsGuest = async (guestName?: string) => {
    setIsAuthenticating(true);
    setAuthError(null);
    const displayName = guestName?.trim() || 'Guest Player';
    const nowMs = Date.now();
    try {
      let currentUser = auth.currentUser;
      if (!currentUser || !currentUser.isAnonymous) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }
      if (currentUser) {
        try {
          await updateProfile(currentUser, { displayName });
        } catch (pErr) {
          console.warn('Guest displayName update notice:', pErr);
        }
        try {
          // Clear previous session cache key so fresh guest sign-in always records updated name/timestamp
          sessionStorage.removeItem(
            `hamster_session_auth_synced_${currentUser.uid}_${getSignInMillis(currentUser)}`
          );
        } catch {}
        await syncUserSessionRecord(
          { ...currentUser, displayName, isAnonymous: true } as User,
          'guest'
        );
        setUser({ ...currentUser, displayName, isAnonymous: true } as User);
      }
      return currentUser;
    } catch (error: any) {
      console.warn('Firebase anonymous auth unavailable, activating guest session:', error?.code || error?.message);
      // Graceful fallback guest session when Anonymous provider is disabled in Firebase Console or offline
      const guestUid = `guest-${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const fallbackGuest = {
        uid: guestUid,
        displayName,
        email: 'Guest',
        photoURL: null,
        isAnonymous: true,
        isLocalGuestSession: true,
        providerData: [],
        metadata: {
          creationTime: new Date(nowMs).toUTCString(),
          lastSignInTime: new Date(nowMs).toUTCString(),
        },
      } as unknown as User;
      try {
        sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(fallbackGuest));
      } catch {}
      setUser(fallbackGuest);
      await syncUserSessionRecord(fallbackGuest, 'guest');
      setAuthError(null);
      return fallbackGuest;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    try {
      try {
        sessionStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
      } catch {}
      if (auth.currentUser) {
        await signOut(auth);
      }
      setUser(null);
    } catch (error) {
      console.error('Error signing out', error);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isAuthenticating, 
      authError, 
      signInWithGoogle, 
      signInWithFacebook, 
      linkWithGoogle, 
      signInWithEmail, 
      signUpWithEmail, 
      signInAsGuest,
      logout,
      clearAuthError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

