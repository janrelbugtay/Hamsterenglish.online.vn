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
import { auth, db, googleProvider, facebookProvider } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  linkWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isAuthenticatingRef = useRef(false);

  useEffect(() => {
    // Listen for auth state changes immediately from local cache / network
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        setAuthError(null);
        // Sync user profile in background without blocking rendering
        if (!currentUser.isAnonymous) {
          const userRef = doc(db, 'users', currentUser.uid);
          setDoc(
            userRef,
            {
              uid: currentUser.uid,
              email: currentUser.email || 'User',
              displayName: currentUser.displayName || 'User',
              photoURL: currentUser.photoURL || null,
              isAnonymous: false,
              lastLoginAt: serverTimestamp(),
            },
            { merge: true }
          ).catch((err) => {
            console.warn('Background user profile sync notice:', err?.message);
          });
        }
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
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      setAuthError(`Sign in failed: ${error.message}`);
      console.error(error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name });
        const userRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: userCredential.user.email || email,
          displayName: name,
          photoURL: null,
          isAnonymous: false,
          lastLoginAt: serverTimestamp(),
        }, { merge: true });
      }
    } catch (error: any) {
      setAuthError(`Sign up failed: ${error.message}`);
      console.error(error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Error signing out', error);
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
      logout,
      clearAuthError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

