import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, ArrowRight, Loader2, Hash, ShieldCheck, Sparkles, Globe, ExternalLink, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function AuthSliderModal({ 
  isOpen, 
  onClose, 
  onJoinRoom, 
  initialRoomCode,
  onSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onJoinRoom?: (code: string, nickname: string, gameType: string) => void; 
  initialRoomCode?: string; 
  onSuccess?: () => void;
}) {
  const { 
    signInWithGoogle, 
    isAuthenticating, 
    user, 
    authError, 
    clearAuthError 
  } = useAuth();

  // Room Join State (directly visible in modal instead of Play as Guest)
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [nickname, setNickname] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showDomainHelp, setShowDomainHelp] = useState(false);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode);
    }
  }, [initialRoomCode]);

  // Automatically close modal when user successfully signs in
  useEffect(() => {
    if (user && !user.isAnonymous && isOpen) {
      if (onSuccess) onSuccess();
      onClose();
    }
  }, [user, isOpen, onClose, onSuccess]);

  useEffect(() => {
    if (!isOpen) {
      setLocalError('');
      setShowDomainHelp(false);
      if (clearAuthError) clearAuthError();
    }
  }, [isOpen, clearAuthError]);

  if (!isOpen) return null;

  // 1. Google Sign-In
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

  // 2. 6-Digit Room Code Join
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = roomCode.trim().toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6);
    const cleanedName = nickname.trim() || 'Player';

    if (!cleanedCode) {
      setLocalError('Please enter a 6-digit room code.');
      return;
    }

    setIsJoining(true);
    setLocalError('');

    try {
      // 1. Fast Server Room Engine check for Hamster Paintball
      try {
        const apiRes = await fetch(`/api/paintball/room/${encodeURIComponent(cleanedCode)}`);
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData?.room && !apiData.room.isUninitialized && onJoinRoom) {
            onJoinRoom(cleanedCode, cleanedName, 'hamster-paintball');
            onClose();
            return;
          }
        }
      } catch {}

      // 2. Permitted Cloud Room Bridge check for Hamster Paintball (`ttt_rooms/pb_room_${code}`)
      try {
        const pbTttRef = doc(db, 'ttt_rooms', `pb_room_${cleanedCode}`);
        const pbTttSnap = await getDoc(pbTttRef);
        if (pbTttSnap.exists() && onJoinRoom) {
          onJoinRoom(cleanedCode, cleanedName, 'hamster-paintball');
          onClose();
          return;
        }
      } catch {}

      // 3. Permitted Cloud Room check for Tic-Tac-Toe (`ttt_rooms/${code}`)
      try {
        const tttRef = doc(db, 'ttt_rooms', cleanedCode);
        const snap = await getDoc(tttRef);
        if (snap.exists() && onJoinRoom) {
          onJoinRoom(cleanedCode, cleanedName, 'tic-tac-toe');
          onClose();
          return;
        }
      } catch {}

      // 4. Allow direct entry into Hamster Paintball for standard 4-6 character room codes
      if (/^[0-9A-Z]{4,6}$/.test(cleanedCode) && onJoinRoom) {
        onJoinRoom(cleanedCode, cleanedName, 'hamster-paintball');
        onClose();
        return;
      }

      setLocalError('Room not found. Please check your 6-digit room code.');
    } catch {
      if (/^[0-9A-Z]{4,6}$/.test(cleanedCode) && onJoinRoom) {
        onJoinRoom(cleanedCode, cleanedName, 'hamster-paintball');
        onClose();
        return;
      }
      setLocalError('Error connecting to room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-md overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-[460px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 my-auto text-left"
          >
            {/* Close button */}
            <button 
              onClick={onClose} 
              aria-label="Close"
              className="absolute top-5 right-5 z-20 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            {/* Brand Header */}
            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-500/30 shadow-2xs shrink-0">
                <img 
                  src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000" 
                  alt="Hamster English Logo" 
                  className="w-11 h-11 rounded-xl object-cover" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div className="min-w-0 pr-8">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <Globe size={13} className="shrink-0" />
                  <span>hamsterenglish.online</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                  Hamster English Studio
                </h2>
              </div>
            </div>

            {/* Greeting from Teacher Jan: Why Sign In is Needed */}
            <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/25 dark:to-slate-800/60 border border-indigo-200/80 dark:border-indigo-800/60">
              <div className="flex items-start gap-3">
                <img
                  src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w200"
                  alt="Teacher Jan"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-xl object-cover border-2 border-white dark:border-slate-700 shadow-xs shrink-0 mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Note from Teacher Jan
                    </span>
                    <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1">
                      <ShieldCheck size={12} className="shrink-0" />
                      Save Work Only
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed font-medium">
                    Hi! Signing in with Google is <strong className="font-bold text-slate-900 dark:text-white">strictly for saving your work</strong> — so your custom games, folders, slides, homework, and class rewards stay safely backed up in your account.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {(authError || localError) && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-600 dark:text-rose-300 text-xs font-semibold text-center leading-relaxed">
                {localError || authError}
              </div>
            )}

            {/* 1. GOOGLE SIGN-IN FOR SAVING WORK */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  Teachers & Creators
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Cloud Sync · hamsterenglish.online
                </span>
              </div>

              <button 
                type="button"
                onClick={handleGoogleSignIn} 
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-3 h-12 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                {isAuthenticating ? (
                  <Loader2 className="animate-spin text-indigo-400 dark:text-indigo-600" size={18} />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center shrink-0 shadow-2xs">
                    <svg className="w-4 h-4 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                )}
                <span className="font-bold text-xs sm:text-sm whitespace-nowrap">
                  {isAuthenticating ? "Connecting to hamsterenglish.online..." : "Continue to hamsterenglish.online"}
                </span>
              </button>

              <div className="flex items-center justify-between px-1 pt-0.5">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Verified Google Sign-In · No passwords stored
                </span>
                <button
                  type="button"
                  onClick={() => setShowDomainHelp(!showDomainHelp)}
                  className="text-[11px] font-semibold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Info size={11} />
                  <span>Why plucky-aegis?</span>
                </button>
              </div>

              {showDomainHelp && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
                  <p>
                    <strong className="font-bold text-slate-800 dark:text-white">hamsterenglish.online</strong> uses Firebase project <code className="font-mono text-[10px] bg-slate-200/70 dark:bg-slate-700 px-1 py-0.5 rounded">plucky-aegis-408915</code> for secure cloud storage.
                  </p>
                  <p>
                    <strong className="font-bold text-indigo-600 dark:text-indigo-400">Admin Tip:</strong> To make Google's popup window display <strong>"to continue to hamsterenglish.online"</strong>, set the <strong>App name</strong> to <code className="font-mono text-[10px] bg-slate-200/70 dark:bg-slate-700 px-1 py-0.5 rounded">hamsterenglish.online</code> in your{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials/consent?project=plucky-aegis-408915"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 font-bold underline inline-flex items-center gap-0.5"
                    >
                      Google OAuth Branding Console <ExternalLink size={10} />
                    </a>.
                  </p>
                </div>
              )}
            </div>

            {/* DIVIDER */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-slate-900 px-3 font-bold text-slate-400 dark:text-slate-500 text-[11px]">
                  Or join a live classroom game
                </span>
              </div>
            </div>

            {/* 2. ENTER 6-DIGIT ROOM CODE (REPLACES PLAY AS GUEST) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  Enter 6-Digit Room Code
                </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  No Sign-In Needed
                </span>
              </div>

              <form 
                onSubmit={handleJoin} 
                className="bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-4 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      6-Digit Room Code <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        type="text"
                        value={roomCode}
                        onChange={(e) => {
                          setRoomCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6));
                          setLocalError('');
                        }}
                        placeholder="e.g. 482910"
                        maxLength={6}
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold tabular-nums uppercase tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-400 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Player Nickname
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => {
                          setNickname(e.target.value);
                          setLocalError('');
                        }}
                        placeholder="e.g. Alex"
                        maxLength={16}
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold placeholder:font-medium placeholder:text-slate-400 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isJoining || !roomCode.trim()}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isJoining ? <Loader2 className="animate-spin" size={15} /> : <ArrowRight size={15} />}
                  <span>{isJoining ? "Joining Room..." : "Join Room with 6-Digit Code"}</span>
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

