import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, ArrowRight, Loader2, Hash } from 'lucide-react';
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
      setLocalError('Please enter both code and name');
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
        setLocalError('Room not found. Please check your room code.');
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
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden p-6 sm:p-8 border border-slate-100 dark:border-slate-700 my-auto text-left"
          >
            {/* Close button */}
            <button 
              onClick={onClose} 
              aria-label="Close"
              className="absolute top-5 right-5 z-20 p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X size={18} strokeWidth={2.5} />
            </button>

            {/* Header Content */}
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="relative w-20 h-20 mb-3">
                <div className="absolute inset-0 bg-brand-purple/20 rounded-3xl animate-ping opacity-50" />
                <img 
                  src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000" 
                  alt="Hamster English Logo" 
                  className="relative w-full h-full rounded-3xl object-cover shadow-xl border-4 border-white dark:border-slate-800 z-10" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                HamsterEnglish
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-1">
                {activeTab === 'room'
                  ? 'Enter room code to join game'
                  : 'Choose how you want to play'}
              </p>
            </div>

            {/* Error Banner */}
            {(authError || localError) && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-600 dark:text-rose-300 text-xs font-semibold text-center leading-relaxed">
                {localError || authError}
              </div>
            )}

            {/* MAIN / QUICK VIEW */}
            {activeTab === 'quick' && (
              <div className="flex flex-col gap-4">
                
                {/* CHOICE 1: GOOGLE SIGN-IN */}
                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                    Option 1: Google Login
                  </div>
                  <button 
                    type="button"
                    onClick={handleGoogleSignIn} 
                    disabled={isAuthenticating}
                    className="w-full flex items-center justify-center gap-3 h-12 px-4 bg-white dark:bg-[#131314] hover:bg-[#f8fafd] dark:hover:bg-[#1f1f1f] border border-[#747775]/40 hover:border-[#747775] dark:border-[#8e918f]/40 dark:hover:border-[#8e918f] rounded-2xl transition-all shadow-xs hover:shadow-md group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      {isAuthenticating ? "Connecting to Google..." : "Sign in with Google"}
                    </span>
                  </button>
                </div>

                {/* CHOICE 2: PLAY AS GUEST (MANDATORY NAME INPUT) */}
                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                    Option 2: Play as Guest
                  </div>
                  <form onSubmit={handleGuestPlay} className="bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-500/20 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                          <User size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-white">
                            Play as Guest
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Enter your name to start playing
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                        Instant Free
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                        <input
                          type="text"
                          value={guestName}
                          onChange={(e) => {
                            setGuestName(e.target.value);
                            setLocalError('');
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
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        {isGuestLoading ? <Loader2 className="animate-spin" size={15} /> : <ArrowRight size={15} />}
                        <span>{isGuestLoading ? "Entering..." : "Play as Guest"}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* ROOM CODE COLLAPSIBLE BUTTON */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('room')}
                    className="w-full text-center text-xs font-bold text-slate-500 hover:text-brand-purple dark:text-slate-400 dark:hover:text-purple-300 py-1.5 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Hash size={14} />
                    <span>Have a multiplayer Room Code? Click here to join</span>
                  </button>
                </div>

              </div>
            )}

            {/* ROOM JOIN VIEW */}
            {activeTab === 'room' && (
              <form onSubmit={handleJoin} className="flex flex-col gap-3">
                <input 
                  type="text" 
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="ROOM CODE"
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-center text-slate-800 dark:text-white uppercase tracking-[0.2em] focus:ring-2 focus:ring-brand-purple focus:outline-none transition-all placeholder:text-slate-400 placeholder:tracking-normal text-sm"
                  maxLength={6}
                />
                <input 
                  type="text" 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your Player Name"
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-center text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-purple focus:outline-none transition-all text-sm"
                  maxLength={15}
                />
                
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('quick');
                      setLocalError('');
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    ← Back to choices
                  </button>

                  <button 
                    type="submit"
                    disabled={isJoining}
                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold transition-all hover:bg-slate-900 dark:hover:bg-white disabled:opacity-70 cursor-pointer text-xs"
                  >
                    {isJoining ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                    <span>Join Room</span>
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
