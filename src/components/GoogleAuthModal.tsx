import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, ArrowRight, User, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ViewState } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: 'Create Game' | 'Homework' | 'Class Rewards' | 'My Games' | string;
  onSuccess?: () => void;
  onViewChange?: (view: ViewState, data?: any) => void;
  onJoinRoom?: (code: string, nickname: string, gameType: string) => void;
}

export function GoogleAuthModal({
  isOpen,
  onClose,
  onSuccess,
  onViewChange,
  onJoinRoom,
}: GoogleAuthModalProps) {
  const { 
    user, 
    signInWithGoogle, 
    isAuthenticating, 
    authError, 
    clearAuthError 
  } = useAuth();

  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !user.isAnonymous && isOpen) {
      if (onSuccess) onSuccess();
      onClose();
    }
  }, [user, isOpen, onClose, onSuccess]);

  useEffect(() => {
    if (!isOpen) {
      setLocalError(null);
      setRoomCode('');
      setNickname('');
      if (clearAuthError) clearAuthError();
    }
  }, [isOpen, clearAuthError]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    if (clearAuthError) clearAuthError();
    try {
      await signInWithGoogle();
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      // Handled in context
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = roomCode.trim().toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6);
    const cleanedName = nickname.trim() || 'Player';

    if (!cleanedCode) {
      setLocalError('Please enter a 6-digit room code.');
      return;
    }

    setIsJoining(true);
    setLocalError(null);

    const completeJoin = (gameType: ViewState) => {
      if (onJoinRoom) {
        onJoinRoom(cleanedCode, cleanedName, gameType);
      } else if (onViewChange) {
        onViewChange(gameType, { roomCode: cleanedCode, playerName: cleanedName, isStudentJoin: true });
      }
      onClose();
    };

    try {
      try {
        const apiRes = await fetch(`/api/paintball/room/${encodeURIComponent(cleanedCode)}`);
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData?.room && !apiData.room.isUninitialized) {
            completeJoin('hamster-paintball');
            return;
          }
        }
      } catch {}

      try {
        const pbTttRef = doc(db, 'ttt_rooms', `pb_room_${cleanedCode}`);
        const pbTttSnap = await getDoc(pbTttRef);
        if (pbTttSnap.exists()) {
          completeJoin('hamster-paintball');
          return;
        }
      } catch {}

      try {
        const tttRef = doc(db, 'ttt_rooms', cleanedCode);
        const snap = await getDoc(tttRef);
        if (snap.exists()) {
          completeJoin('tic-tac-toe');
          return;
        }
      } catch {}

      if (/^[0-9A-Z]{4,6}$/.test(cleanedCode)) {
        completeJoin('hamster-paintball');
        return;
      }

      setLocalError('Room not found. Please check your 6-digit room code.');
    } catch {
      if (/^[0-9A-Z]{4,6}$/.test(cleanedCode)) {
        completeJoin('hamster-paintball');
        return;
      }
      setLocalError('Error connecting to room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto font-sans"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[420px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-800 p-6 sm:p-7 text-left my-auto overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
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
              Hi, I'm <strong className="font-extrabold text-slate-900 dark:text-white">Teacher Jan</strong>! Sign in with Google to save your work and custom games.
            </p>
          </div>

          {/* Error Message */}
          {(authError || localError) && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold text-center">
              {localError || authError}
            </div>
          )}

          {/* 1. SIGN IN WITH GOOGLE */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isAuthenticating}
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
            <span>{isAuthenticating ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          {/* DIVIDER */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-slate-900 px-3 font-extrabold text-slate-400 dark:text-slate-500 text-xs">
                OR
              </span>
            </div>
          </div>

          {/* 2. ENTER 6-DIGIT ROOM CODE */}
          <form onSubmit={handleJoin} className="space-y-3">
            <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200 px-0.5">
              Enter 6-Digit Room Code
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6));
                    setLocalError(null);
                  }}
                  placeholder="6-Digit Code"
                  maxLength={6}
                  className="w-full pl-9 pr-3 py-3 text-sm rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-extrabold tabular-nums uppercase tracking-wider placeholder:font-sans placeholder:tracking-normal placeholder:font-semibold placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                />
              </div>

              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setLocalError(null);
                  }}
                  placeholder="Your Name"
                  maxLength={16}
                  className="w-full pl-9 pr-3 py-3 text-sm rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold placeholder:font-semibold placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isJoining}
              className="w-full h-11 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-sm font-extrabold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {isJoining ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
              <span>{isJoining ? 'Joining...' : 'Join Room'}</span>
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
