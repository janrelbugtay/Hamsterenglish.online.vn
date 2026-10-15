import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, ArrowRight, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ViewState } from '../types';

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
  onViewChange
}: GoogleAuthModalProps) {
  const { 
    user, 
    signInWithGoogle, 
    signInAsGuest,
    isAuthenticating, 
    authError, 
    clearAuthError 
  } = useAuth();

  // Guest state - name is required
  const [guestName, setGuestName] = useState('');
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Close when user successfully logs in
  useEffect(() => {
    if (user && !user.isAnonymous && isOpen) {
      if (onSuccess) onSuccess();
      onClose();
    }
  }, [user, isOpen, onClose, onSuccess]);

  useEffect(() => {
    if (!isOpen) {
      setLocalError(null);
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

  // 2. Play as Guest - Requires Name Input
  const handleGuestPlay = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = guestName.trim();
    if (!trimmed) {
      setLocalError('Please enter your name to play as a guest.');
      return;
    }
    if (trimmed.length < 2) {
      setLocalError('Name must be at least 2 characters.');
      return;
    }

    setIsGuestLoading(true);
    setLocalError(null);
    try {
      await signInAsGuest(trimmed);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Guest mode notice:', err);
      if (onSuccess) onSuccess();
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
              <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
                Sign In or Play as Guest
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Access <span className="font-semibold text-brand-purple dark:text-purple-300">{featureName}</span>
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60">
            Sign in with your Google account to sync your games, or enter your name to play immediately as a guest.
          </p>

          {/* Errors */}
          {(authError || localError) && (
            <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-left">
              <p className="text-xs text-rose-600 dark:text-rose-300 font-medium leading-relaxed">
                {localError || authError}
              </p>
            </div>
          )}

          {/* MAIN CHOICES VIEW */}
          <div className="space-y-4">
            
            {/* CHOICE 1: LOG IN WITH GOOGLE */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Option 1: Google Login
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
                  {isAuthenticating ? 'Connecting to Google...' : 'Sign in with Google'}
                </span>
              </button>
            </div>

            {/* CHOICE 2: PLAY AS GUEST (MANDATORY NAME INPUT) */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Option 2: Play as Guest
              </div>
              <form onSubmit={handleGuestPlay} className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <User size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-white">
                        Play as Guest
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Enter your name to start playing immediately
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Instant Free
                  </span>
                </div>

                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      setLocalError(null);
                    }}
                    placeholder="Enter your name or nickname *"
                    maxLength={20}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isGuestLoading}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isGuestLoading ? <Loader2 className="animate-spin" size={14} /> : <ArrowRight size={14} />}
                  <span>{isGuestLoading ? 'Entering...' : 'Play as Guest'}</span>
                </button>
              </form>
            </div>

          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
