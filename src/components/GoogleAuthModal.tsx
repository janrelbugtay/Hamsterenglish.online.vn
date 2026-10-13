import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Globe, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ViewState } from '../types';
import { auth, db } from '../lib/firebase';
import { signInAnonymously, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: 'Create Game' | 'Homework' | 'Class Rewards' | 'My Games' | string;
  onSuccess?: () => void;
  onViewChange?: (view: ViewState) => void;
}

export function GoogleAuthModal({
  isOpen,
  onClose,
  featureName = 'Account Area',
  onSuccess,
  onViewChange,
}: GoogleAuthModalProps) {
  const { 
    user, 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    isAuthenticating, 
    authError, 
    clearAuthError 
  } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [fullName, setFullName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  // Close when user logs in with Google
  useEffect(() => {
    if (user && !user.isAnonymous && isOpen) {
      if (onSuccess) onSuccess();
      onClose();
    }
  }, [user, isOpen, onClose, onSuccess]);

  useEffect(() => {
    if (!isOpen) {
      setIdentifier('');
      setPassword('');
      setShowPasswordInput(false);
      setShowPassword(false);
      setIsCreatingAccount(false);
      setFullName('');
      setLocalError(null);
      if (clearAuthError) clearAuthError();
    }
  }, [isOpen, clearAuthError]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    if (clearAuthError) clearAuthError();
    try {
      await signInWithGoogle();
    } catch {
      // Handled in context
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (clearAuthError) clearAuthError();

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setLocalError('Please enter an email or phone number');
      return;
    }

    if (!showPasswordInput) {
      // Advance to password screen
      setShowPasswordInput(true);
      return;
    }

    if (!password) {
      setLocalError('Please enter your password');
      return;
    }

    try {
      if (isCreatingAccount) {
        await signUpWithEmail(trimmedIdentifier, password, fullName.trim() || trimmedIdentifier.split('@')[0]);
      } else {
        await signInWithEmail(trimmedIdentifier, password);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed');
    }
  };

  const handleGuestSignIn = async () => {
    setIsGuestLoading(true);
    setLocalError(null);
    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }
      if (currentUser) {
        const guestDisplayName = 'Guest Player';
        await updateProfile(currentUser, { displayName: guestDisplayName });
        await setDoc(
          doc(db, 'users', currentUser.uid),
          {
            uid: currentUser.uid,
            displayName: guestDisplayName,
            isAnonymous: true,
            email: 'User',
            photoURL: null,
            lastLoginAt: new Date(),
          },
          { merge: true }
        );
      }
      onClose();
    } catch (err: any) {
      setLocalError('Guest sign in failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-[448px] bg-white dark:bg-[#1f1f1f] rounded-[28px] shadow-2xl border border-[#dadce0] dark:border-[#444746] p-7 sm:p-10 text-left my-auto"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 p-2 rounded-full text-[#444746] hover:text-[#1f1f1f] dark:text-[#c4c7c5] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          {/* Google Logo */}
          <div className="flex items-center justify-start mb-4">
            <img
              src="https://www.gstatic.com/images/branding/googleg_gradient/svg/googleg_gradient_standard_48px.svg"
              width={48}
              height={48}
              alt="Google"
              className="w-11 h-11 sm:w-12 sm:h-12 object-contain"
              onError={(e) => {
                // Fallback to inline SVG if network fails
                e.currentTarget.style.display = 'none';
                const nextElem = e.currentTarget.nextElementSibling;
                if (nextElem) nextElem.classList.remove('hidden');
              }}
            />
            <div className="hidden w-11 h-11 sm:w-12 sm:h-12 items-center justify-center">
              <svg className="w-10 h-10" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-[26px] font-normal text-[#1f1f1f] dark:text-[#e3e3e3] tracking-tight">
              {isCreatingAccount ? 'Create your Google Account' : 'Sign in'}
            </h1>
            <p className="text-sm sm:text-base text-[#444746] dark:text-[#c4c7c5] mt-1.5">
              to continue to <span className="font-semibold text-slate-800 dark:text-white">HamsterEnglish</span>
            </p>
            {featureName && featureName !== 'Account Area' && (
              <span className="inline-block mt-2 px-2.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-brand-purple dark:text-purple-300 text-xs font-semibold rounded-full">
                Required for {featureName}
              </span>
            )}
          </div>

          {/* Errors */}
          {(authError || localError) && (
            <div className="mb-4 p-3.5 bg-[#fce8e6] dark:bg-red-950/40 border border-[#f5c2c7] dark:border-red-900/60 rounded-xl text-left">
              <p className="text-xs text-[#c5221f] dark:text-red-300 font-medium whitespace-pre-line leading-relaxed">
                {localError || authError}
              </p>
            </div>
          )}

          {/* Primary Action: Official "Sign in with Google" button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isAuthenticating}
            className="w-full flex items-center justify-center gap-3 h-12 bg-white dark:bg-[#131314] hover:bg-[#f8fafd] dark:hover:bg-[#1f1f1f] border border-[#747775]/50 hover:border-[#747775] dark:border-[#8e918f]/50 dark:hover:border-[#8e918f] rounded-full transition-all shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-5"
          >
            {isAuthenticating ? (
              <Loader2 className="animate-spin text-[#0b57d0]" size={20} />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] tracking-normal">
              {isAuthenticating ? 'Connecting to Google...' : 'Sign in with Google'}
            </span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-5">
            <div className="border-t border-[#e0e2ec] dark:border-[#444746] w-full"></div>
            <span className="absolute bg-white dark:bg-[#1f1f1f] px-3 text-xs text-[#747775] dark:text-[#8e918f] font-medium uppercase">
              or use email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {isCreatingAccount && (
              <div>
                <label className="block text-xs font-medium text-[#444746] dark:text-[#c4c7c5] mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-4 py-3 rounded-lg border border-[#747775]/60 focus:border-[#0b57d0] dark:border-[#8e918f]/50 dark:focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#0b57d0] dark:focus:ring-[#8ab4f8] outline-none text-[#1f1f1f] dark:text-white bg-transparent transition-all text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#444746] dark:text-[#c4c7c5] mb-1">
                Email or phone
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email or phone"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-lg border border-[#747775]/60 focus:border-[#0b57d0] dark:border-[#8e918f]/50 dark:focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#0b57d0] dark:focus:ring-[#8ab4f8] outline-none text-[#1f1f1f] dark:text-white bg-transparent transition-all text-sm"
              />
              {!showPasswordInput && (
                <button
                  type="button"
                  onClick={() => {
                    if (!identifier.trim()) {
                      setLocalError('Enter your email above to recover your account');
                    } else {
                      setLocalError(`Recovery link will be sent to ${identifier}`);
                    }
                  }}
                  className="text-xs font-medium text-[#0b57d0] dark:text-[#8ab4f8] hover:underline mt-1.5 block cursor-pointer"
                >
                  Forgot email?
                </button>
              )}
            </div>

            {showPasswordInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5"
              >
                <label className="block text-xs font-medium text-[#444746] dark:text-[#c4c7c5]">
                  Enter your password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete={isCreatingAccount ? 'new-password' : 'current-password'}
                    className="w-full px-4 py-3 pr-11 rounded-lg border border-[#747775]/60 focus:border-[#0b57d0] dark:border-[#8e918f]/50 dark:focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#0b57d0] dark:focus:ring-[#8ab4f8] outline-none text-[#1f1f1f] dark:text-white bg-transparent transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#747775] dark:text-[#8e918f] hover:text-[#1f1f1f] dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Guest mode callout (from test.png) */}
            <div className="text-xs text-[#444746] dark:text-[#c4c7c5] pt-2 leading-relaxed">
              <span>Not your computer? Use Guest mode to sign in privately. </span>
              <button
                type="button"
                onClick={handleGuestSignIn}
                disabled={isGuestLoading}
                className="font-medium text-[#0b57d0] dark:text-[#8ab4f8] hover:underline inline-block cursor-pointer disabled:opacity-60"
              >
                {isGuestLoading ? 'Loading Guest...' : 'Play as Guest'}
              </button>
            </div>

            {/* Action Bar (from test.png) */}
            <div className="flex items-center justify-between pt-5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingAccount(!isCreatingAccount);
                  setShowPasswordInput(true);
                  setLocalError(null);
                }}
                className="text-xs sm:text-sm font-medium text-[#0b57d0] dark:text-[#8ab4f8] hover:bg-[#0b57d0]/10 dark:hover:bg-[#8ab4f8]/10 px-3 py-2 rounded-full transition-colors cursor-pointer"
              >
                {isCreatingAccount ? 'Sign in instead' : 'Create account'}
              </button>

              <button
                type="submit"
                disabled={isAuthenticating || isGuestLoading}
                className="bg-[#0b57d0] hover:bg-[#0842a0] dark:bg-[#8ab4f8] dark:hover:bg-[#a8c7fa] text-white dark:text-[#001d35] font-medium text-xs sm:text-sm px-6 py-2.5 rounded-full transition-colors shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isAuthenticating && <Loader2 className="animate-spin" size={16} />}
                <span>{showPasswordInput ? (isCreatingAccount ? 'Sign up' : 'Sign in') : 'Next'}</span>
              </button>
            </div>
          </form>

          {/* Footer bar */}
          <div className="pt-6 mt-6 border-t border-[#e0e2ec] dark:border-[#444746]/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#747775] dark:text-[#8e918f]">
            <div className="flex items-center gap-1">
              <Globe size={13} />
              <span>English (United States)</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  onClose();
                  if (onViewChange) onViewChange('public-dashboard');
                }}
                className="hover:text-[#1f1f1f] dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Play Free Games</span>
                <ArrowRight size={11} />
              </button>
              <a
                href="https://support.google.com/accounts"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#1f1f1f] dark:hover:text-white transition-colors"
              >
                Help
              </a>
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#1f1f1f] dark:hover:text-white transition-colors"
              >
                Privacy
              </a>
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#1f1f1f] dark:hover:text-white transition-colors"
              >
                Terms
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
