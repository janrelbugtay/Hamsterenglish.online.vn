import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, ArrowRight, Loader2, Hash, ArrowLeft, Gamepad2 } from 'lucide-react';
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
    signInAsGuest,
    isAuthenticating, 
    user, 
    authError, 
    clearAuthError 
  } = useAuth();
  
  // View tab: 'quick' | 'room'
  const [activeTab, setActiveTab] = useState<'quick' | 'room'>('quick');

  // Room Join State
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [nickname, setNickname] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Guest State - name is mandatory to play as guest
  const [guestName, setGuestName] = useState('');
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode);
      setActiveTab('room');
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
      setActiveTab('quick');
      setLocalError('');
      setGuestName('');
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
    setLocalError('');
    try {
      await signInAsGuest(trimmed);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Guest sign in notice:', err);
      if (onSuccess) onSuccess();
      onClose();
    } finally {
      setIsGuestLoading(false);
    }
  };

  // 3. Room Code Join
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !nickname.trim()) {
      setLocalError('Please enter both room code and your name.');
      return;
    }
    
    setIsJoining(true);
    setLocalError('');
    const code = roomCode.trim().toUpperCase();

    try {
      const tttRef = doc(db, 'ttt_rooms', code);
      const snap = await getDoc(tttRef);
      if (snap.exists() && onJoinRoom) {
        onJoinRoom(code, nickname.trim(), 'tic-tac-toe');
        onClose();
      } else {
        setLocalError('Room not found. Please verify your room code.');
      }
    } catch (err) {
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
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-[430px] bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl overflow-hidden p-6 sm:p-7 border border-slate-200 dark:border-slate-700/80 my-auto text-left"
          >
            {/* Close button */}
            <button 
              onClick={onClose} 
              aria-label="Close"
              className="absolute top-5 right-5 z-20 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            {/* Brand Header */}
            <div className="flex flex-col items-center mb-5 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 dark:bg-brand-purple/20 flex items-center justify-center border border-brand-purple/20 shadow-sm mb-3">
                <img 
                  src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000" 
                  alt="Hamster English Logo" 
                  className="w-11 h-11 rounded-xl object-cover" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {activeTab === 'room' ? 'Join Multiplayer Room' : 'Hamster English Studio'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1 max-w-[320px] leading-relaxed">
                {activeTab === 'room'
                  ? 'Enter your room code and nickname to jump into a live game match'
                  : 'Sign in to sync your progress, or enter your name to play as guest'}
              </p>
            </div>

            {/* Error Message */}
            {(authError || localError) && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-600 dark:text-rose-300 text-xs font-semibold text-center leading-relaxed">
                {localError || authError}
              </div>
            )}

            {/* MAIN AUTH FLOW */}
            {activeTab === 'quick' && (
              <div className="space-y-4">
                
                {/* 1. GOOGLE SIGN-IN */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Sign In with Google
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      Cloud Sync
                    </span>
                  </div>

                  <button 
                    type="button"
                    onClick={handleGoogleSignIn} 
                    disabled={isAuthenticating}
                    className="w-full flex items-center justify-center gap-3 h-12 px-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
                  >
                    {isAuthenticating ? (
                      <Loader2 className="animate-spin text-[#0b57d0]" size={18} />
                    ) : (
                      <svg className="w-4 h-4 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                      {isAuthenticating ? "Connecting to Google..." : "Continue with Google"}
                    </span>
                  </button>
                </div>

                {/* DIVIDER */}
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700/80" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white dark:bg-slate-800 px-3 font-semibold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider">
                      or play without account
                    </span>
                  </div>
                </div>

                {/* 2. PLAY AS GUEST (ORGANIZED CARD WITH NAME INPUT) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Play as Guest
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Instant Free
                    </span>
                  </div>

                  <form 
                    onSubmit={handleGuestPlay} 
                    className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-3"
                  >
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Player Name or Nickname <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text"
                          value={guestName}
                          onChange={(e) => {
                            setGuestName(e.target.value);
                            setLocalError('');
                          }}
                          placeholder="e.g. Alex Rivera"
                          maxLength={20}
                          className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-purple font-medium transition-all"
                          autoFocus
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isGuestLoading}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isGuestLoading ? <Loader2 className="animate-spin" size={15} /> : <ArrowRight size={15} />}
                      <span>{isGuestLoading ? "Entering..." : "Play as Guest"}</span>
                    </button>
                  </form>
                </div>

                {/* 3. MULTIPLAYER ROOM CODE LINK */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('room');
                      setLocalError('');
                    }}
                    className="w-full text-center text-xs font-semibold text-slate-500 hover:text-brand-purple dark:text-slate-400 dark:hover:text-purple-300 py-1.5 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Gamepad2 size={15} />
                    <span>Have a multiplayer Room Code? Enter code to join →</span>
                  </button>
                </div>

              </div>
            )}

            {/* ROOM CODE JOIN VIEW */}
            {activeTab === 'room' && (
              <form onSubmit={handleJoin} className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    6-Letter Room Code
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value)}
                      placeholder="e.g. ABCDEF"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-white uppercase tracking-[0.15em] focus:ring-2 focus:ring-brand-purple focus:outline-none transition-all placeholder:text-slate-400 placeholder:tracking-normal text-xs"
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Your Player Nickname
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="e.g. Player 1"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-purple focus:outline-none transition-all text-xs"
                      maxLength={15}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('quick');
                      setLocalError('');
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer px-2 py-1"
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>

                  <button 
                    type="submit"
                    disabled={isJoining}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-purple hover:bg-purple-700 text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-60 cursor-pointer text-xs"
                  >
                    {isJoining ? <Loader2 className="animate-spin" size={15} /> : <ArrowRight size={15} />}
                    <span>Join Match</span>
                  </button>
                </div>
              </form>
            )}

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
