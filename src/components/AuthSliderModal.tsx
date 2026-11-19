import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, QrCode, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ViewState } from '../types';
import { verifyMultiplayerRoomCode } from '../utils/roomCodeValidator';

export function AuthSliderModal({
  isOpen,
  onClose,
  onSuccess,
  onJoinRoom,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onJoinRoom?: (view: ViewState, data?: any) => void;
}) {
  const {
    signInWithGoogle,
    isAuthenticating,
    user,
    authError,
    clearAuthError
  } = useAuth();
  const { t } = useLanguage();

  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (user && !user.isAnonymous && isOpen) {
      if (onSuccess) onSuccess();
      onClose();
    }
  }, [user, isOpen, onClose, onSuccess]);

  useEffect(() => {
    if (!isOpen) {
      setLocalError('');
      setIsCheckingRoom(false);
      setJoinRoomInput('');
      if (clearAuthError) clearAuthError();
    }
  }, [isOpen, clearAuthError]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLocalError('');
    if (clearAuthError) clearAuthError();
    try {
      await signInWithGoogle();
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      // Handled in context
    }
  };

  const handleRoomCodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocalError('');
    if (clearAuthError) clearAuthError();

    const cleaned = joinRoomInput.replace(/[^0-9A-Za-z]/g, '').toUpperCase().trim().slice(0, 6);
    if (cleaned.length < 6) {
      setLocalError('Please enter the complete 6-character code from your host.');
      return;
    }

    setIsCheckingRoom(true);
    try {
      const result = await verifyMultiplayerRoomCode(cleaned);
      if (result.valid && result.gameView) {
        onClose();
        if (onJoinRoom) {
          onJoinRoom(result.gameView, { roomCode: result.roomCode, isStudentJoin: true });
        }
      } else {
        setLocalError(
          result.error || `Incorrect room code "${cleaned}". No host is currently hosting a game with this code.`
        );
      }
    } finally {
      setIsCheckingRoom(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.14 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[420px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 border-2 border-slate-200 dark:border-slate-800 my-auto text-left"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-5 right-5 z-20 w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            {/* Centered Brand Header */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center border-2 border-indigo-200 dark:border-indigo-800 shadow-sm mb-3 overflow-hidden">
                <img
                  src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000"
                  alt="Hamster English Studio"
                  className="w-14 h-14 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/bubble-pop-card.jpg?v=3';
                  }}
                />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Hamster English Studio
              </h2>
            </div>

            {/* Concise Greeting from Teacher Jan */}
            <div className="mb-5 p-3.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 flex items-center gap-3">
              <img
                src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w200"
                alt="Teacher Jan"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/images/bubble-pop-card.jpg?v=3';
                }}
                className="w-10 h-10 rounded-xl object-cover border-2 border-white dark:border-slate-700 shadow-xs shrink-0"
              />
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-snug font-semibold">
                {t("auth.teacherJanPrefix")} <strong className="font-extrabold text-slate-900 dark:text-white">Teacher Jan</strong>{t("auth.teacherJanSuffix")}
              </p>
            </div>

            {/* Error Message */}
            {(authError || localError) && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold text-center">
                {localError || authError}
              </div>
            )}

            {/* 1. SIGN IN WITH GOOGLE BUTTON */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isAuthenticating || isCheckingRoom}
              className="w-full flex items-center justify-center gap-3 h-12 px-5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-extrabold text-sm sm:text-base transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-60 group"
            >
              {isAuthenticating ? (
                <Loader2 className="animate-spin text-indigo-400 dark:text-indigo-600" size={20} />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-4 h-4 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
              )}
              <span>{isAuthenticating ? t("header.signingIn") : t("auth.signInGoogle")}</span>
            </button>

            {/* 2. JOIN MULTIPLAYER LOBBY BY 6-DIGIT ROOM CODE */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-slate-900 px-3 font-extrabold text-slate-400 dark:text-slate-500 text-xs">
                  {t("auth.or")}
                </span>
              </div>
            </div>

            <form
              onSubmit={handleRoomCodeSubmit}
              className={`w-full flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 p-1.5 pl-3.5 rounded-2xl border-2 shadow-sm transition-colors ${
                localError ? 'border-rose-400' : 'border-lime-400/80'
              }`}
            >
              <QrCode size={18} className="text-lime-600 dark:text-lime-400 shrink-0" />
              <input
                type="text"
                maxLength={6}
                value={joinRoomInput}
                onChange={(e) => {
                  setJoinRoomInput(e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6));
                  if (localError) setLocalError('');
                }}
                placeholder={t("home.roomCodePlaceholder")}
                className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-black font-mono tracking-wider uppercase text-slate-800 dark:text-white placeholder:font-sans placeholder:font-semibold placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!joinRoomInput.trim() || isCheckingRoom || isAuthenticating}
                className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer whitespace-nowrap shrink-0"
              >
                {isCheckingRoom ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                <span>{isCheckingRoom ? '...' : t("home.joinLobby")}</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
