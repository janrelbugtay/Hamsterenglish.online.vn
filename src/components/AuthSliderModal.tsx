import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

export function AuthSliderModal({ isOpen, onClose, onJoinRoom, initialRoomCode }: { isOpen: boolean; onClose: () => void; onJoinRoom?: (code: string, nickname: string, gameType: string) => void; initialRoomCode?: string }) {
  const { signInWithGoogle, isAuthenticating, user, authError, clearAuthError } = useAuth();
  
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [nickname, setNickname] = useState('');
  const [guestName, setGuestName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);

  React.useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode);
    }
  }, [initialRoomCode]);

  // Automatically close modal when user successfully signs in
  React.useEffect(() => {
    if (user && !user.isAnonymous && isOpen) {
      onClose();
    }
  }, [user, isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError('');
    if (clearAuthError) clearAuthError();
    try {
      await signInWithGoogle();
      onClose();
    } catch {
      // Error message is stored in authError and displayed in the modal
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !nickname.trim()) {
      setError('Please enter both code and name');
      return;
    }
    
    setIsJoining(true);
    setError('');
    const code = roomCode.trim().toUpperCase();

    try {
      // For now we check Tic Tac Toe rooms
      const tttRef = doc(db, 'ttt_rooms', code);
      const snap = await getDoc(tttRef);
      if (snap.exists() && onJoinRoom) {
        onJoinRoom(code, nickname.trim(), 'tic-tac-toe');
        onClose();
      } else {
        setError('Room not found. Please check your code.');
      }
    } catch (err) {
      setError('Error connecting to room.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleGuestPlay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showGuestInput) {
      setShowGuestInput(true);
      return;
    }
    if (!guestName.trim()) {
      setError('Please enter a display name to play as guest');
      return;
    }
    
    setIsGuestLoading(true);
    setError('');
    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const { signInAnonymously } = await import('firebase/auth');
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }
      if (currentUser) {
        await updateProfile(currentUser, { displayName: guestName.trim() });
        await setDoc(doc(db, 'users', currentUser.uid), {
          uid: currentUser.uid,
          displayName: guestName.trim(),
          isAnonymous: true,
          email: 'User',
          photoURL: null,
          lastLoginAt: new Date()
        }, { merge: true });
      }
      onClose();
    } catch (err: any) {
      console.error('Error setting guest name', err);
      setError('Error starting guest session: ' + (err?.message || 'Failed'));
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 md:p-10 border border-slate-100 dark:border-slate-700"
          >
            {/* Close button */}
            <button 
              onClick={onClose} 
              className="absolute top-6 right-6 z-50 p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200 rounded-full transition-colors cursor-pointer"
            >
               <X size={20} strokeWidth={2.5} />
            </button>

            {/* Header Content */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative w-24 h-24 mb-5">
                <div className="absolute inset-0 bg-brand-purple/20 rounded-3xl animate-ping opacity-60" />
                <img 
                  src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000" 
                  alt="Hamster English Logo" 
                  className="relative w-full h-full rounded-3xl object-cover shadow-xl border-4 border-white dark:border-slate-800 z-10" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight text-center">
                HamsterEnglish
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-center mt-2">
                Choose how you want to play
              </p>
            </div>

            <div className="flex flex-col gap-6">
              
              {/* Top Section: Play as Guest */}
              <form onSubmit={handleGuestPlay} className="flex flex-col gap-3">
                <AnimatePresence mode="wait">
                  {showGuestInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="overflow-hidden"
                    >
                      <input 
                        type="text" 
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Enter your display name"
                        className="w-full p-4 rounded-2xl border-2 border-brand-purple/20 bg-brand-purple/5 font-bold text-center text-slate-800 dark:text-white focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/10 focus:outline-none transition-all placeholder:text-brand-purple/40"
                        maxLength={15}
                        autoFocus
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  type="submit"
                  disabled={isGuestLoading}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-br from-brand-purple to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-2xl transition-all shadow-xl shadow-brand-purple/20 hover:shadow-brand-purple/40 hover:-translate-y-1 group cursor-pointer border border-brand-purple/50"
                >
                  {isGuestLoading ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <User size={24} className="group-hover:scale-110 transition-transform" />
                  )}
                  <span className="font-bold text-lg tracking-wide">
                    {isGuestLoading ? "Entering Studio..." : (showGuestInput ? "Start Playing" : "Play as Guest")}
                  </span>
                </button>
              </form>

              {/* Divider */}
              <div className="relative flex items-center justify-center -my-2">
                <div className="border-t-2 border-slate-100 dark:border-slate-700/60 w-full"></div>
                <span className="absolute bg-white dark:bg-slate-800 px-4 text-[11px] text-slate-400 font-bold uppercase tracking-widest rounded-full">
                  OR
                </span>
              </div>

              {/* Middle Section: Google Sign In */}
              <button 
                type="button"
                onClick={handleGoogleSignIn} 
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-3 p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAuthenticating ? (
                  <Loader2 className="animate-spin text-brand-purple" size={24} />
                ) : (
                  <svg className="w-6 h-6 shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                <span className="font-bold text-slate-700 dark:text-slate-200 text-lg">
                  {isAuthenticating ? "Connecting to Google..." : "Sign in with Google"}
                </span>
              </button>

              {authError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-600 dark:text-rose-300 text-xs font-semibold text-center leading-relaxed">
                  {authError}
                </div>
              )}

              {/* Divider */}
              <div className="relative flex items-center justify-center py-2">
                <div className="border-t-2 border-slate-100 dark:border-slate-700/60 w-full"></div>
                <span className="absolute bg-white dark:bg-slate-800 px-4 text-[11px] text-slate-400 font-bold uppercase tracking-widest rounded-full">
                  Got a Code?
                </span>
              </div>

              {/* Bottom Section: Join Room */}
              <form onSubmit={handleJoin} className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border-2 border-slate-100 dark:border-slate-700/60 shadow-inner">
                <input 
                  type="text" 
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="ROOM CODE"
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-center text-slate-800 dark:text-white uppercase tracking-[0.2em] focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 focus:outline-none transition-all placeholder:text-slate-400 placeholder:tracking-normal"
                  maxLength={6}
                />
                <input 
                  type="text" 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your Name"
                  className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-center text-slate-800 dark:text-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 focus:outline-none transition-all"
                  maxLength={15}
                />
                
                {error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 font-bold text-sm text-center bg-red-50 dark:bg-red-900/20 py-2 rounded-lg mt-1"
                  >
                    {error}
                  </motion.p>
                )}

                <button 
                  type="submit"
                  disabled={isJoining}
                  className="w-full flex items-center justify-center gap-2 p-3.5 mt-2 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold transition-all hover:bg-slate-900 dark:hover:bg-white hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70 disabled:hover:translate-y-0 cursor-pointer"
                >
                  {isJoining ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                  <span className="tracking-wide">Join Room</span>
                </button>
              </form>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
