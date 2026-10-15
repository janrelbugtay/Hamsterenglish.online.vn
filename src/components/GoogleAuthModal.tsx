import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Globe, Eye, EyeOff, ArrowRight, User, Mail, Sparkles, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ViewState } from '../types';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: 'Create Game' | 'Homework' | 'Class Rewards' | 'My Games' | string;
  onSuccess?: () => void;
  onViewChange?: (view: ViewState) => void;
  defaultTab?: 'choices' | 'email-signup' | 'email-signin' | 'guest';
}

export function GoogleAuthModal({
  isOpen,
  onClose,
  featureName = 'Account Area',
  onSuccess,
  onViewChange,
  defaultTab = 'choices'
}: GoogleAuthModalProps) {
  const { 
    user, 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    signInAsGuest,
    isAuthenticating, 
    authError, 
    clearAuthError 
  } = useAuth();

  // Active view: 'choices' | 'email-signup' | 'email-signin'
  const [authMode, setAuthMode] = useState<'choices' | 'email-signup' | 'email-signin'>('choices');
  
  // Email form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Guest state
  const [guestName, setGuestName] = useState('');
  const [showGuestNameInput, setShowGuestNameInput] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  // Close when user successfully logs in
  useEffect(() => {
    if (user && !user.isAnonymous && isOpen) {
      if (onSuccess) onSuccess();
      onClose();
    }
  }, [user, isOpen, onClose, onSuccess]);

  useEffect(() => {
    if (!isOpen) {
      setAuthMode('choices');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setShowPassword(false);
      setLocalError(null);
      setShowGuestNameInput(false);
      setGuestName('');
      if (clearAuthError) clearAuthError();
    }
  }, [isOpen, clearAuthError]);

  if (!isOpen) return null;

  // 1. Google Sign-In
  const handleGoogleSignIn = async () => {
    setLocalError(null);
    if (clearAuthError) clearAuthError();
    try {
      await signInWithGoogle();
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      // Handled in context / authError
    }
  };

  // 2. Email Auth (Create Account or Sign In without Google)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (clearAuthError) clearAuthError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError('Please enter your email address.');
      return;
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setLocalError('Please enter a password.');
      return;
    }

    if (authMode === 'email-signup') {
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters.');
        return;
      }
      if (confirmPassword && password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'email-signup') {
        await signUpWithEmail(trimmedEmail, password, fullName.trim() || trimmedEmail.split('@')[0]);
      } else {
        await signInWithEmail(trimmedEmail, password);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. No need to sign in (Play as Guest)
  const handleGuestPlay = async () => {
    setIsGuestLoading(true);
    setLocalError(null);
    try {
      await signInAsGuest(guestName.trim() || 'Guest Player');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Guest mode notice:', err);
      onClose();
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-[460px] bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 text-left my-auto overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-brand-purple/10 dark:bg-brand-purple/20 flex items-center justify-center shrink-0 border border-brand-purple/20">
              <img 
                src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000" 
                alt="Hamster English Logo" 
                className="w-10 h-10 rounded-xl object-cover" 
                referrerPolicy="no-referrer" 
              />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tracking-tight leading-tight">
                {authMode === 'email-signup' 
                  ? 'Create New Account' 
                  : authMode === 'email-signin' 
                  ? 'Sign In with Email' 
                  : 'Sign In or Play Free'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {authMode !== 'choices' ? 'No Google account needed' : 'Choose how you want to continue'}
              </p>
            </div>
          </div>

          {featureName && featureName !== 'Account Area' && (
            <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-brand-purple dark:text-purple-300 text-xs font-semibold rounded-full border border-purple-200 dark:border-purple-800">
              <Sparkles size={13} />
              <span>Recommended for saving {featureName}</span>
            </div>
          )}

          {/* Errors */}
          {(authError || localError) && (
            <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-left">
              <p className="text-xs text-rose-600 dark:text-rose-300 font-medium leading-relaxed">
                {localError || authError}
              </p>
            </div>
          )}

          {/* MAIN CHOICES VIEW */}
          {authMode === 'choices' && (
            <div className="space-y-4">
              
              {/* CHOICE 1: LOG IN WITH GOOGLE */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                  Choice 1: Instant Sign In
                </div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isAuthenticating}
                  className="w-full flex items-center justify-center gap-3 h-13 px-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-2xl transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isAuthenticating ? (
                    <Loader2 className="animate-spin text-[#0b57d0]" size={20} />
                  ) : (
                    <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {isAuthenticating ? 'Connecting to Google...' : 'Log in with Google'}
                  </span>
                </button>
              </div>

              {/* CHOICE 2: MAKE ACCOUNT BUT NOT USING GOOGLE */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                  Choice 2: Not Using Google
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('email-signup');
                      setLocalError(null);
                    }}
                    className="flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 border-brand-purple/20 bg-brand-purple/5 hover:bg-brand-purple/10 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 text-brand-purple dark:text-purple-300 transition-all cursor-pointer group text-center"
                  >
                    <Mail size={20} className="mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold">Make Account</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Without Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('email-signin');
                      setLocalError(null);
                    }}
                    className="flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 transition-all cursor-pointer group text-center"
                  >
                    <KeyRound size={20} className="mb-1 group-hover:scale-110 transition-transform text-slate-500" />
                    <span className="text-xs font-bold">Sign In</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">With Email / Pass</span>
                  </button>
                </div>
              </div>

              {/* CHOICE 3: NO NEED TO SIGN IN (PLAY AS GUEST) */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                  Choice 3: No Need to Sign In
                </div>
                <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <User size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-white">
                          Play Free Immediately
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          No sign-in, account, or password needed
                        </div>
                      </div>
                    </div>
                  </div>

                  {showGuestNameInput && (
                    <div className="mb-2.5">
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Nickname (e.g. Player 1)"
                        maxLength={15}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGuestPlay}
                      disabled={isGuestLoading}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {isGuestLoading ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <ArrowRight size={14} />
                      )}
                      <span>{isGuestLoading ? 'Entering...' : 'Continue as Guest'}</span>
                    </button>
                    {!showGuestNameInput && (
                      <button
                        type="button"
                        onClick={() => setShowGuestNameInput(true)}
                        className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline px-2 py-1 font-semibold cursor-pointer"
                      >
                        Set Name
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* EMAIL SIGN-UP & SIGN-IN FORMS (NOT USING GOOGLE) */}
          {(authMode === 'email-signup' || authMode === 'email-signin') && (
            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              
              {/* Tab selector */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('email-signup');
                    setLocalError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authMode === 'email-signup'
                      ? 'bg-white dark:bg-slate-800 text-brand-purple dark:text-purple-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('email-signin');
                    setLocalError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    authMode === 'email-signin'
                      ? 'bg-white dark:bg-slate-800 text-brand-purple dark:text-purple-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  Sign In
                </button>
              </div>

              {authMode === 'email-signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Name or Nickname
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Teacher Sarah"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 text-xs sm:text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password {authMode === 'email-signup' && <span className="text-slate-400 font-normal">(min 6 characters)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={authMode === 'email-signup' ? 'new-password' : 'current-password'}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {authMode === 'email-signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 text-xs sm:text-sm"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('choices');
                    setLocalError(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  ← Back to choices
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || isAuthenticating}
                  className="px-5 py-2.5 bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {(isSubmitting || isAuthenticating) && <Loader2 className="animate-spin" size={16} />}
                  <span>{authMode === 'email-signup' ? 'Create Account' : 'Sign In'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Footer info */}
          <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <button
              onClick={() => {
                onClose();
                if (onViewChange) onViewChange('public-dashboard');
              }}
              className="hover:text-brand-purple transition-colors cursor-pointer flex items-center gap-1 font-semibold"
            >
              <span>Explore Free Games</span>
              <ArrowRight size={11} />
            </button>
            <div className="flex items-center gap-3">
              <span>Privacy Safe</span>
              <span>•</span>
              <span>ESL Studio</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
