import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, RotateCcw, AlertOctagon, CheckCircle2, 
  Timer, Trophy, ChevronRight, User, Zap, Sparkles, XCircle,
  Crosshair, Settings, Users, Clock, ShieldAlert, ArrowLeft, Sun, Moon
} from 'lucide-react';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";

const STARTING_WORDS = ['neon', 'cyber', 'pixel', 'matrix', 'laser', 'plasma', 'quantum', 'vector', 'holo', 'nexus'];
const CUSTOM_ALLOWED_WORDS = ['x-ray', 'xray', 'x-rays', 'xrays'];
const API_TIMEOUT_MS = 2500; 

// Audio Helper for synthetic sounds
const playSound = (type: string) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'start') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.4);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'type') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.02, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'tick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'gameover') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.6);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else if (type === 'victory') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    }
  } catch (e) {
    console.warn("Audio blocked or not supported", e);
  }
};

export function NeonChain({ onViewChange }: { onViewChange: (view: ViewState) => void }) {
  const [gameState, setGameState] = useState('lobby'); // 'lobby', 'playing', 'gameover'
  const [theme, setTheme] = useState<'neon' | 'light'>('neon');
  
  // Lobby Config State
  const [config, setConfig] = useState({
    teamCount: 2,
    teamNames: ['Team 1', 'Team 2'],
    globalTime: 120,
    turnTime: 20,
    targetWins: 3
  });

  const [wordChain, setWordChain] = useState<any[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [targetLetter, setTargetLetter] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({ t1: 0, t2: 0, t3: 0, t4: 0 });
  const [teamWins, setTeamWins] = useState<Record<string, number>>({ t1: 0, t2: 0, t3: 0, t4: 0 });
  const [currentTeam, setCurrentTeam] = useState(1);
  const [timeLeft, setTimeLeft] = useState(120);
  const [turnTimeLeft, setTurnTimeLeft] = useState(20);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [lastScorePopup, setLastScorePopup] = useState<any>(null);
  const [longestWord, setLongestWord] = useState('');

  const getNextTargetLetter = (word: string) => {
    if (word.length < 2) return word.slice(-1);
    const lastChar = word.slice(-1);
    return lastChar === 'x' ? word[word.length - 2] : lastChar;
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Global Game Timer
  useEffect(() => {
    let timer: any;
    if (gameState === 'playing' && timeLeft > 0) {
      if (timeLeft <= 10) playSound('tick');
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      endGame("Global Time Limit Reached!");
    }
    return () => clearInterval(timer);
  }, [timeLeft, gameState]);

  // Turn Timer with Penalty Engine
  useEffect(() => {
    let turnTimer: any;
    if (gameState === 'playing' && turnTimeLeft > 0) {
      if (turnTimeLeft <= 5) playSound('tick');
      turnTimer = setInterval(() => setTurnTimeLeft((prev) => prev - 1), 1000);
    } else if (turnTimeLeft === 0 && gameState === 'playing') {
      // PENALTY ENGINE: Trigger failure if they run out of time
      handleFailedTurn("Time's up!");
    }
    return () => clearInterval(turnTimer);
  }, [turnTimeLeft, gameState, currentTeam, config.teamNames, wordChain, config.turnTime]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Keep the most recent word perfectly visible above the timer
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [wordChain, isLoading, error]);

  useEffect(() => {
    if (gameState === 'playing' && inputRef.current && !isLoading) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [gameState, isLoading, currentTeam]);

  const startGame = () => {
    playSound('start');
    const randomStart = STARTING_WORDS[Math.floor(Math.random() * STARTING_WORDS.length)];
    setWordChain([{ text: randomStart, team: 0, points: 0 }]); // 0 = system starting word
    setTargetLetter(getNextTargetLetter(randomStart));
    
    // Reset based on lobby config
    let initialScores: Record<string, number> = {};
    let initialWins: Record<string, number> = {};
    for(let i=1; i<=config.teamCount; i++) {
      initialScores[`t${i}`] = 0;
      initialWins[`t${i}`] = 0;
    }
    
    setScores(initialScores);
    setTeamWins(initialWins);
    setCurrentTeam(1);
    setTimeLeft(config.globalTime);
    setTurnTimeLeft(config.turnTime);
    setLongestWord('');
    setGameState('playing');
    setError('');
    setCurrentInput('');
    setLastScorePopup(null);
  };

  const continueGame = () => {
    playSound('start');
    const randomStart = STARTING_WORDS[Math.floor(Math.random() * STARTING_WORDS.length)];
    setWordChain([{ text: randomStart, team: 0, points: 0 }]);
    setTargetLetter(getNextTargetLetter(randomStart));

    let initialScores: Record<string, number> = {};
    for(let i=1; i<=config.teamCount; i++) {
      initialScores[`t${i}`] = 0;
    }
    
    setScores(initialScores);
    setCurrentTeam(1);
    setTimeLeft(config.globalTime);
    setTurnTimeLeft(config.turnTime);
    setLongestWord('');
    setGameState('playing');
    setError('');
    setCurrentInput('');
    setLastScorePopup(null);
  };

  const endGame = (reason = '') => {
    playSound('victory');
    setGameState('gameover');
    if (reason) triggerError(reason, true);

    setTeamWins(prev => {
      let maxScore = -Infinity;
      let winnerIds: number[] = [];
      for(let i=1; i<=config.teamCount; i++) {
        if (scores[`t${i}`] > maxScore) {
          maxScore = scores[`t${i}`];
          winnerIds = [i];
        } else if (scores[`t${i}`] === maxScore) {
          winnerIds.push(i);
        }
      }
      const newWins = { ...prev };
      if (winnerIds.length === 1) {
        // Only increment if not a tie, or could increment for all? Let's increment for all that tied just to be safe
        winnerIds.forEach(id => {
          newWins[`t${id}`] = (newWins[`t${id}`] || 0) + 1;
        });
      }
      return newWins;
    });
  };

  const triggerError = (msg: string, keep = false) => {
    playSound('error');
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    if (!keep) {
      setTimeout(() => setError(''), 3000);
    }
  };

  // PENALTY ENGINE: Deducts points, generates new word, skips turn
  const handleFailedTurn = (reasonMsg: string) => {
    // Find the length of the previous word to determine the penalty
    const lastWordObj = wordChain[wordChain.length - 1];
    const penalty = lastWordObj && lastWordObj.text ? lastWordObj.text.length : 0;
    
    // Deduct points
    setScores(prev => ({
      ...prev,
      [`t${currentTeam}`]: (prev[`t${currentTeam}`] || 0) - penalty
    }));

    // Trigger visual error and negative score popup
    triggerError(`${reasonMsg} (-${penalty} pts)`);
    setLastScorePopup({ team: currentTeam, points: -penalty, bonus: false });

    // Generate a fresh word and assign it to System (team: 0)
    const randomStart = STARTING_WORDS[Math.floor(Math.random() * STARTING_WORDS.length)];
    setWordChain(prev => [...prev, { text: randomStart, team: 0, points: 0 }]);
    setTargetLetter(getNextTargetLetter(randomStart));
    
    // Move to the next player
    setCurrentTeam(prev => prev === config.teamCount ? 1 : prev + 1);
    setTurnTimeLeft(config.turnTime);
    setCurrentInput('');
  };

  const fetchWithTimeout = async (url: string, ms: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; 
    }
  };

  const validateAndSubmitWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || isLoading) return;

    const word = currentInput.trim().toLowerCase().replace(/[^a-z-]/g, '');

    // PENALTY ENGINE triggers on validation failure
    if (word[0] !== targetLetter) {
      handleFailedTurn(`Must start with "${targetLetter.toUpperCase()}"`);
      return;
    }
    if (wordChain.some(item => item.text === word)) {
      handleFailedTurn(`"${word.toUpperCase()}" was already used!`);
      return;
    }
    if (word.length < 2) {
      handleFailedTurn('Too short!');
      return;
    }

    setIsLoading(true);
    setError('');

    const handleSuccess = (validWord: string) => {
      playSound('success');
      // Exact letter count scoring
      const totalPoints = validWord.length;

      setScores(prev => ({
        ...prev,
        [`t${currentTeam}`]: (prev[`t${currentTeam}`] || 0) + totalPoints
      }));
      
      setWordChain(prev => [...prev, { 
        text: validWord, 
        team: currentTeam,
        points: totalPoints,
        isSpeedBonus: false
      }]);
      
      setTargetLetter(getNextTargetLetter(validWord));
      setLastScorePopup({ team: currentTeam, points: totalPoints, bonus: false });
      setTimeout(() => setLastScorePopup(null), 1500);

      if (validWord.length > longestWord.length) setLongestWord(validWord);

      setCurrentTeam(prev => prev === config.teamCount ? 1 : prev + 1);
      setTurnTimeLeft(config.turnTime);
      setCurrentInput('');
    };

    if (CUSTOM_ALLOWED_WORDS.includes(word)) {
      handleSuccess(word);
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 10);
      return;
    }

    try {
      const response = await fetchWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, API_TIMEOUT_MS);
      
      if (!response.ok) {
        // Wiktionary fallback
        try {
          const wikiResponse = await fetchWithTimeout(`https://en.wiktionary.org/api/rest_v1/page/definition/${word}`, API_TIMEOUT_MS);
          if (!wikiResponse.ok) {
            handleFailedTurn(`"${word}" is not recognized.`);
            setIsLoading(false);
            return;
          }
        } catch (wikiErr) {
          handleFailedTurn(`"${word}" is not recognized.`);
          setIsLoading(false);
          return;
        }
      }
      handleSuccess(word);
    } catch (err) {
      console.warn("Dictionary API failed or timed out, accepting locally.");
      handleSuccess(word);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleTeamNameChange = (index: number, newName: string) => {
    const newNames = [...config.teamNames];
    newNames[index] = newName;
    setConfig(prev => ({ ...prev, teamNames: newNames }));
  };

  const updateTeamCount = (count: number) => {
    const newNames = [...config.teamNames];
    while(newNames.length < count) newNames.push(`Team ${newNames.length + 1}`);
    setConfig(prev => ({ ...prev, teamCount: count, teamNames: newNames.slice(0, count) }));
  };

  const tColors: Record<number, any> = {
    1: { colorHex: '#22D3EE', text: 'text-cyan-400', targetText: 'text-cyan-500', glow: 'from-cyan-400 to-blue-500', btn: 'bg-cyan-600 hover:bg-cyan-500 border-cyan-400/30 shadow-cyan-500/25', badge: 'bg-cyan-400', shadow: 'shadow-[0_0_20px_-5px_rgba(34,211,238,0.4)] shadow-cyan-500/20', border: 'border-cyan-500/50', activeBg: 'bg-cyan-950/50' },
    2: { colorHex: '#EC4899', text: 'text-pink-400', targetText: 'text-pink-500', glow: 'from-pink-400 to-rose-500', btn: 'bg-pink-600 hover:bg-pink-500 border-pink-400/30 shadow-pink-500/25', badge: 'bg-pink-400', shadow: 'shadow-[0_0_20px_-5px_rgba(236,72,153,0.4)] shadow-pink-500/20', border: 'border-pink-500/50', activeBg: 'bg-pink-950/50' },
    3: { colorHex: '#8B5CF6', text: 'text-purple-400', targetText: 'text-purple-500', glow: 'from-purple-400 to-indigo-500', btn: 'bg-purple-600 hover:bg-purple-500 border-purple-400/30 shadow-purple-500/25', badge: 'bg-purple-400', shadow: 'shadow-[0_0_20px_-5px_rgba(139,92,246,0.4)] shadow-purple-500/20', border: 'border-purple-500/50', activeBg: 'bg-purple-950/50' },
    4: { colorHex: '#34D399', text: 'text-emerald-400', targetText: 'text-emerald-500', glow: 'from-emerald-400 to-green-500', btn: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/30 shadow-emerald-500/25', badge: 'bg-emerald-400', shadow: 'shadow-[0_0_20px_-5px_rgba(52,211,153,0.4)] shadow-emerald-500/20', border: 'border-emerald-500/50', activeBg: 'bg-emerald-950/50' }
  };
  const activeStyle = tColors[currentTeam] || tColors[1];

  const isLight = theme === 'light';
  
  // Theme Variables
  const bgMain = isLight ? 'bg-slate-50' : 'bg-[#050816]';
  const textMain = isLight ? 'text-slate-900' : 'text-slate-100';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';
  const bgPanel = isLight ? 'bg-white shadow-lg border-slate-200' : 'bg-[#0f1430]/60 border-slate-800 backdrop-blur-md shadow-2xl';
  const inputBg = isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-900/80 border-slate-800';
  const borderLight = isLight ? 'border-slate-200' : 'border-white/5';
  
  return (
    <div id="game-container" className={`h-[calc(100vh-2rem)] w-full -m-4 md:-m-8 ${bgMain} flex flex-col font-sans ${textMain} overflow-hidden relative selection:bg-cyan-500/30 rounded-xl transition-colors duration-500`} style={{ margin: '-1rem', height: 'calc(100% + 2rem)' }}>
      
      {/* Immersive Background Effects */}
      {!isLight && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Cyberpunk Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
          {/* Glowing Orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
      )}

      {/* Back button */}
      <button 
        onClick={() => onViewChange("home")}
        className={`absolute top-4 left-4 z-50 flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border ${
          isLight ? 'text-slate-500 hover:text-slate-800 bg-white/80 hover:bg-white border-slate-200' : 'text-white/50 hover:text-white bg-black/20 hover:bg-black/50 border-white/10'
        }`}
      >
        <ArrowLeft size={24} />
      </button>

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 items-end">
        {/* Theme Toggle Button */}
        <button 
          onClick={() => setTheme(prev => prev === 'neon' ? 'light' : 'neon')}
          className={`flex items-center gap-2 p-2 px-4 rounded-full transition-colors backdrop-blur-md border ${
            isLight ? 'bg-white/80 text-slate-800 hover:bg-white border-slate-200 shadow-sm' : 'bg-white/10 text-white hover:bg-white/20 border-white/20'
          }`}
        >
          {isLight ? <Moon size={18} /> : <Sun size={18} />}
          <span className="text-sm font-bold hidden sm:inline">{isLight ? 'Neon Mode' : 'Light Mode'}</span>        </button>
        <FullscreenButton targetId="game-container" className={`p-2 rounded-full transition-colors backdrop-blur-md border ${isLight ? "bg-white/80 text-slate-800 hover:bg-white border-slate-200 shadow-sm" : "bg-white/10 text-white hover:bg-white/20 border-white/20"}`} />

        {/* End Game / Return to Lobby Button */}
        {gameState !== 'lobby' && (
          <button 
            onClick={() => setGameState('lobby')}
            className={`flex items-center gap-2 p-2 px-4 rounded-full transition-colors backdrop-blur-md border ${
              isLight ? 'bg-white/80 text-red-600 hover:bg-red-50 border-red-200 shadow-sm' : 'bg-red-950/50 text-red-400 hover:bg-red-900/50 border-red-900/50'
            }`}
          >
            <RotateCcw size={18} />
            <span className="text-sm font-bold hidden sm:inline">End Game</span>
          </button>
        )}
      </div>

      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
         <div className={`absolute top-[-20%] left-[-10%] w-[60%] h-[60%] ${isLight ? 'bg-cyan-300/20' : 'bg-cyan-600/10'} rounded-full blur-[150px] transition-colors`} />
         <div className={`absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] ${isLight ? 'bg-pink-300/20' : 'bg-pink-600/10'} rounded-full blur-[150px] transition-colors`} />
         <div className={`absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDMwIEwgNjAgMzAgTSAzMCAwIEwgMzAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] ${isLight ? 'opacity-10 invert' : 'opacity-50'} transition-opacity`}></div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800;900&family=Inter:wght@400;500;700&display=swap');
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-8px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
        
        @keyframes floatUp {
          0% { opacity: 0; transform: translateY(10px) scale(0.9); }
          20% { opacity: 1; transform: translateY(-5px) scale(1.1); }
          100% { opacity: 0; transform: translateY(-30px) scale(1); }
        }
        .animate-float-up { animation: floatUp 1.5s ease-out forwards; }

        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.8); }
          70% { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-pop-in { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}} />

      <div ref={containerRef} className="w-full h-full flex flex-col relative z-10 overflow-hidden pt-12">
        
        {/* === LOBBY SCREEN === */}
        {gameState === 'lobby' && (
          <div className={`absolute inset-0 z-50 ${isLight ? 'bg-slate-50/90' : 'bg-[#050816]/90'} backdrop-blur-xl overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-500`}>
            <div className="w-full min-h-full flex flex-col items-center p-4 sm:p-8 pt-16">
            <div className="w-full max-w-5xl flex flex-col items-center mt-2 sm:mt-8 mb-12">
               <Sparkles size={48} className="text-cyan-400 mb-4 animate-pulse" />
               <h1 className="text-4xl sm:text-6xl font-space font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 uppercase drop-shadow-lg text-center">
                 Neon <br className="sm:hidden" />Chain
               </h1>
               <div className="h-1 w-32 bg-gradient-to-r from-cyan-400 to-transparent mt-4 rounded-full"></div>
            </div>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 mb-20">
               {/* Left Column: Settings */}
               <div className="lg:col-span-7 flex flex-col gap-6">
                  
                  {/* Teams Configuration */}
                  <div className={`${bgPanel} border rounded-3xl p-6 sm:p-8 relative overflow-hidden group transition-colors`}>
                     <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                     <h2 className={`text-xl font-space font-bold ${textMain} mb-6 flex items-center`}><Users className="mr-3 text-cyan-400"/> Team Configuration</h2>
                     
                     <div className="flex flex-wrap gap-3 mb-8">
                       {[2, 3, 4].map(num => (
                         <button 
                           key={num}
                           onClick={() => updateTeamCount(num)}
                           className={`px-6 py-3 rounded-xl font-bold transition-all border ${config.teamCount === num ? 'bg-cyan-500/20 border-cyan-400 text-cyan-600 dark:text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : (isLight ? 'bg-white border-slate-300 text-slate-600 hover:border-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500')}`}
                         >
                           {num} Teams
                         </button>
                       ))}
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {Array.from({length: config.teamCount}).map((_, idx) => (
                         <div key={idx} className={`flex items-center ${inputBg} border rounded-xl p-2 focus-within:border-cyan-500 transition-colors`}>
                           <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0" style={{backgroundColor: tColors[idx+1].colorHex + '40', border: `1px solid ${tColors[idx+1].colorHex}`}}>
                              <User size={16} color={tColors[idx+1].colorHex} />
                           </div>
                           <input 
                             type="text" 
                             value={config.teamNames[idx]}
                             onChange={(e) => handleTeamNameChange(idx, e.target.value)}
                             className={`bg-transparent border-none ${textMain} font-bold w-full focus:outline-none focus:ring-0 ${isLight ? 'placeholder-slate-400' : 'placeholder-slate-600'}`}
                             maxLength={15}
                           />
                         </div>
                       ))}
                     </div>
                  </div>

                  {/* Timer Configuration */}
                  <div className={`${bgPanel} border rounded-3xl p-6 sm:p-8 relative overflow-hidden group transition-colors`}>
                     <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
                     <h2 className={`text-xl font-space font-bold ${textMain} mb-6 flex items-center`}><Clock className="mr-3 text-pink-400"/> Chrono Parameters</h2>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                       <div>
                         <label className={`block text-sm font-bold ${textMuted} uppercase tracking-wider mb-3`}>Global Match Time</label>
                         <div className="flex flex-wrap gap-2">
                           {[60, 120, 180, 300].map(time => (
                             <button key={time} onClick={() => setConfig(prev => ({...prev, globalTime: time}))}
                               className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border ${config.globalTime === time ? 'bg-pink-500/20 border-pink-400 text-pink-600 dark:text-pink-300' : (isLight ? 'bg-white border-slate-300 text-slate-600 hover:border-pink-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500')}`}
                             >{time / 60} Min</button>
                           ))}
                         </div>
                       </div>
                       
                       <div>
                         <label className={`block text-sm font-bold ${textMuted} uppercase tracking-wider mb-3`}>Response Window</label>
                         <div className="flex flex-wrap gap-2">
                           {[10, 15, 20, 30].map(time => (
                             <button key={time} onClick={() => setConfig(prev => ({...prev, turnTime: time}))}
                               className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border ${config.turnTime === time ? 'bg-pink-500/20 border-pink-400 text-pink-600 dark:text-pink-300' : (isLight ? 'bg-white border-slate-300 text-slate-600 hover:border-pink-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500')}`}
                             >{time} Sec</button>
                           ))}
                         </div>
                       </div>

                       <div>
                         <label className={`block text-sm font-bold ${textMuted} uppercase tracking-wider mb-3`}>Target Wins</label>
                         <div className="flex flex-wrap gap-2">
                           {[1, 3, 5, 10].map(wins => (
                             <button key={wins} onClick={() => setConfig(prev => ({...prev, targetWins: wins}))}
                               className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border flex items-center gap-2 ${config.targetWins === wins ? 'bg-purple-500/20 border-purple-400 text-purple-600 dark:text-purple-300' : (isLight ? 'bg-white border-slate-300 text-slate-600 hover:border-purple-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500')}`}
                             >
                               <Trophy size={14} className={config.targetWins === wins ? 'text-purple-500' : 'opacity-50'} />
                               {wins}
                             </button>
                           ))}
                         </div>
                       </div>
                     </div>
                  </div>

               </div>

               {/* Right Column: Preview & Launch */}
               <div className="lg:col-span-5 flex flex-col gap-6">
                 
                 {/* Live Preview Card */}
                 <div className={`${isLight ? 'bg-white border-slate-200 shadow-xl' : 'bg-gradient-to-br from-[#101530] to-[#0a0d20] border-slate-700/50 shadow-2xl'} border rounded-3xl p-8 relative overflow-hidden flex-1 flex flex-col transition-colors`}>
                    <h3 className={`text-sm font-bold ${textMuted} uppercase tracking-widest mb-6 flex justify-between items-center`}>
                      <span>Live Blueprint</span>
                      <ShieldAlert size={16} />
                    </h3>
                    
                    <div className={`flex justify-between items-center mb-10 pb-6 border-b ${borderLight}`}>
                      <div className="text-center">
                        <p className={`text-3xl font-space font-black ${textMain}`}>{formatTime(config.globalTime)}</p>
                        <p className={`text-[10px] ${textMuted} uppercase tracking-widest`}>Global Time</p>
                      </div>
                      <div className={`w-px h-12 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`}></div>
                      <div className="text-center">
                        <p className="text-3xl font-space font-black text-pink-500 dark:text-pink-400">{config.turnTime}s</p>
                        <p className={`text-[10px] ${textMuted} uppercase tracking-widest`}>Per Turn</p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                       {Array.from({length: config.teamCount}).map((_, idx) => (
                         <div key={idx} className={`flex justify-between items-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'} px-4 py-3 rounded-xl border`}>
                           <span className="font-bold flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{backgroundColor: tColors[idx+1].colorHex, color: tColors[idx+1].colorHex}}></div>
                             <span className={isLight ? 'text-slate-700' : 'text-slate-200'}>{config.teamNames[idx]}</span>
                           </span>
                           <span className={`font-space ${isLight ? 'text-slate-400' : 'text-slate-600'} font-bold`}>0</span>
                         </div>
                       ))}
                    </div>
                    
                    <div className={`mt-auto ${isLight ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'} border text-xs p-4 rounded-xl flex items-start gap-3`}>
                      <Settings size={16} className="shrink-0 mt-0.5" />
                      <p>Standard dictionary enforced. Missing a word penalizes the team by the length of the previous word.</p>
                    </div>
                 </div>

                 {/* Launch Button */}
                 <button 
                   onClick={startGame}
                   className="group relative w-full px-8 py-6 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-space font-black rounded-3xl shadow-[0_0_40px_-10px_rgba(34,211,238,0.5)] transition-all hover:scale-[1.02] active:scale-95 text-2xl flex items-center justify-center overflow-hidden border border-white/20"
                 >
                   <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                   <div className="absolute -left-full top-0 w-1/2 h-full bg-white/20 skew-x-12 group-hover:left-[200%] transition-all duration-1000 ease-in-out"></div>
                   <Play size={28} className="mr-4 fill-current drop-shadow-md" /> INITIALIZE SYSTEM
                 </button>
               </div>
            </div>
          </div>
          </div>
        )}

        {/* === GAME HUD === */}
        {gameState !== 'lobby' && (
          <>
            {/* TOP HEADER: Dynamic Scoreboard */}
            <div className={`${isLight ? 'bg-white/90 border-slate-200 shadow-sm' : 'bg-slate-950/80 border-white/5 shadow-2xl'} border-b flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 z-20 relative shrink-0 backdrop-blur-xl transition-colors`}>
              
              {/* Dynamic Grid Layout based on Team Count */}
              <div className="flex w-full max-w-7xl justify-center items-center gap-4 sm:gap-6 lg:gap-8">
                
                {/* Team 1 Score (Always present) */}
                <div className={`flex flex-col items-center p-4 sm:p-6 lg:p-8 rounded-[2rem] transition-all duration-300 flex-1 max-w-[280px] lg:max-w-[340px] border-2 
                  ${currentTeam === 1 && gameState === 'playing' ? `${isLight ? 'bg-cyan-50 border-cyan-300 shadow-[0_0_20px_-5px_rgba(34,211,238,0.3)]' : `${tColors[1].activeBg} ${tColors[1].shadow} ${tColors[1].border}`} scale-105` : `${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'} opacity-60 hover:opacity-80`}`}>
                   <div className="flex flex-col items-center w-full relative">
                     <span className={`text-xs sm:text-sm lg:text-lg ${isLight && currentTeam === 1 && gameState === 'playing' ? 'text-cyan-600' : tColors[1].text} font-black uppercase tracking-widest mb-1 sm:mb-2 flex items-center truncate max-w-full`}>
                       <User size={16} className="mr-2 shrink-0"/> 
                       <span className="truncate">{config.teamNames[0]}</span>
                     </span>
                     <span className={`text-4xl sm:text-6xl lg:text-[5rem] font-space font-black ${textMain} drop-shadow-2xl leading-none`}>{scores.t1}</span>
                     <div className="flex gap-1 mt-3">
                       {Array.from({length: config.targetWins}).map((_, i) => (
                         <Trophy key={i} size={14} className={i < teamWins.t1 ? tColors[1].text : 'text-slate-500 opacity-30'} />
                       ))}
                     </div>
                     {lastScorePopup?.team === 1 && (
                       <div className={`absolute -right-2 top-0 ${lastScorePopup.points < 0 ? 'text-red-500' : tColors[1].text} font-bold text-xl sm:text-2xl animate-float-up pointer-events-none drop-shadow-md whitespace-nowrap`}>
                         {lastScorePopup.points > 0 ? '+' : ''}{lastScorePopup.points}
                       </div>
                     )}
                   </div>
                </div>

                {/* Team 3 (If playing) */}
                {config.teamCount >= 3 && (
                  <div className={`flex flex-col items-center p-4 sm:p-6 lg:p-8 rounded-[2rem] transition-all duration-300 flex-1 max-w-[280px] lg:max-w-[340px] border-2 hidden md:flex
                    ${currentTeam === 3 && gameState === 'playing' ? `${isLight ? 'bg-purple-50 border-purple-300 shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)]' : `${tColors[3].activeBg} ${tColors[3].shadow} ${tColors[3].border}`} scale-105` : `${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'} opacity-60 hover:opacity-80`}`}>
                     <div className="flex flex-col items-center w-full relative">
                       <span className={`text-xs sm:text-sm lg:text-lg ${isLight && currentTeam === 3 && gameState === 'playing' ? 'text-purple-600' : tColors[3].text} font-black uppercase tracking-widest mb-1 sm:mb-2 flex items-center truncate max-w-full`}>
                         <User size={16} className="mr-2 shrink-0"/> 
                         <span className="truncate">{config.teamNames[2]}</span>
                       </span>
                       <span className={`text-4xl sm:text-6xl lg:text-[5rem] font-space font-black ${textMain} drop-shadow-2xl leading-none`}>{scores.t3}</span>
                       <div className="flex gap-1 mt-3">
                         {Array.from({length: config.targetWins}).map((_, i) => (
                           <Trophy key={i} size={14} className={i < teamWins.t3 ? tColors[3].text : 'text-slate-500 opacity-30'} />
                         ))}
                       </div>
                       {lastScorePopup?.team === 3 && (
                         <div className={`absolute -right-2 top-0 ${lastScorePopup.points < 0 ? 'text-red-500' : tColors[3].text} font-bold text-xl sm:text-2xl animate-float-up pointer-events-none drop-shadow-md whitespace-nowrap`}>
                           {lastScorePopup.points > 0 ? '+' : ''}{lastScorePopup.points}
                         </div>
                       )}
                     </div>
                  </div>
                )}

                {/* Desktop Global Timer (Center) */}
                <div className="hidden sm:flex flex-col items-center justify-center shrink-0 w-48 lg:w-56 mx-auto order-first sm:order-none absolute sm:relative top-0 left-0 right-0 sm:top-auto mb-4 sm:mb-0">
                   <h1 className={`text-lg lg:text-xl font-space font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r ${isLight ? 'from-slate-600 to-slate-800' : 'from-slate-300 to-slate-500'} drop-shadow-sm uppercase mb-2 lg:mb-3 flex items-center gap-2`}>
                     <Timer size={18} /> GLOBAL
                   </h1>
                   <div className={`px-6 lg:px-8 py-2 lg:py-3 rounded-2xl flex items-center space-x-3 transition-colors border shadow-inner backdrop-blur-md w-full justify-center
                     ${timeLeft <= 10 && gameState === 'playing' ? 'bg-red-500/10 border-red-500/50 animate-pulse text-red-500 dark:text-red-400' : `${isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-900/50 border-white/10 text-slate-300'}`}`}>
                      <span className="text-2xl lg:text-4xl font-bold font-space tracking-widest">{formatTime(timeLeft)}</span>
                   </div>
                </div>

                {/* Team 4 (If playing) */}
                {config.teamCount >= 4 && (
                  <div className={`flex flex-col items-center p-4 sm:p-6 lg:p-8 rounded-[2rem] transition-all duration-300 flex-1 max-w-[280px] lg:max-w-[340px] border-2 hidden md:flex
                    ${currentTeam === 4 && gameState === 'playing' ? `${isLight ? 'bg-emerald-50 border-emerald-300 shadow-[0_0_20px_-5px_rgba(52,211,153,0.3)]' : `${tColors[4].activeBg} ${tColors[4].shadow} ${tColors[4].border}`} scale-105` : `${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'} opacity-60 hover:opacity-80`}`}>
                     <div className="flex flex-col items-center w-full relative">
                       <span className={`text-xs sm:text-sm lg:text-lg ${isLight && currentTeam === 4 && gameState === 'playing' ? 'text-emerald-600' : tColors[4].text} font-black uppercase tracking-widest mb-1 sm:mb-2 flex items-center truncate max-w-full`}>
                         <User size={16} className="mr-2 shrink-0"/> 
                         <span className="truncate">{config.teamNames[3]}</span>
                       </span>
                       <span className={`text-4xl sm:text-6xl lg:text-[5rem] font-space font-black ${textMain} drop-shadow-2xl leading-none`}>{scores.t4}</span>
                       <div className="flex gap-1 mt-3">
                         {Array.from({length: config.targetWins}).map((_, i) => (
                           <Trophy key={i} size={14} className={i < teamWins.t4 ? tColors[4].text : 'text-slate-500 opacity-30'} />
                         ))}
                       </div>
                       {lastScorePopup?.team === 4 && (
                         <div className={`absolute -left-2 top-0 ${lastScorePopup.points < 0 ? 'text-red-500' : tColors[4].text} font-bold text-xl sm:text-2xl animate-float-up pointer-events-none drop-shadow-md whitespace-nowrap`}>
                           {lastScorePopup.points > 0 ? '+' : ''}{lastScorePopup.points}
                         </div>
                       )}
                     </div>
                  </div>
                )}

                {/* Team 2 Score (Always present) */}
                <div className={`flex flex-col items-center p-4 sm:p-6 lg:p-8 rounded-[2rem] transition-all duration-300 flex-1 max-w-[280px] lg:max-w-[340px] border-2 
                  ${currentTeam === 2 && gameState === 'playing' ? `${isLight ? 'bg-pink-50 border-pink-300 shadow-[0_0_20px_-5px_rgba(236,72,153,0.3)]' : `${tColors[2].activeBg} ${tColors[2].shadow} ${tColors[2].border}`} scale-105` : `${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'} opacity-60 hover:opacity-80`}`}>
                   <div className="flex flex-col items-center w-full relative">
                     <span className={`text-xs sm:text-sm lg:text-lg ${isLight && currentTeam === 2 && gameState === 'playing' ? 'text-pink-600' : tColors[2].text} font-black uppercase tracking-widest mb-1 sm:mb-2 flex items-center truncate max-w-full`}>
                       <span className="truncate">{config.teamNames[1]}</span>
                       <User size={16} className="ml-2 shrink-0"/>
                     </span>
                     <span className={`text-4xl sm:text-6xl lg:text-[5rem] font-space font-black ${textMain} drop-shadow-2xl leading-none`}>{scores.t2}</span>
                     <div className="flex gap-1 mt-3">
                       {Array.from({length: config.targetWins}).map((_, i) => (
                         <Trophy key={i} size={14} className={i < teamWins.t2 ? tColors[2].text : 'text-slate-500 opacity-30'} />
                       ))}
                     </div>
                     {lastScorePopup?.team === 2 && (
                       <div className={`absolute -left-2 top-0 ${lastScorePopup.points < 0 ? 'text-red-500' : tColors[2].text} font-bold text-xl sm:text-2xl animate-float-up pointer-events-none drop-shadow-md whitespace-nowrap`}>
                         {lastScorePopup.points > 0 ? '+' : ''}{lastScorePopup.points}
                       </div>
                     )}
                   </div>
                </div>

              </div>
              
              {/* Mobile Global Timer Row (Fallback) */}
              <div className="sm:hidden mt-4 w-full flex justify-center">
                 <div className={`px-6 py-2 rounded-xl flex items-center space-x-2 transition-colors border shadow-inner backdrop-blur-md
                   ${timeLeft <= 10 && gameState === 'playing' ? 'bg-red-500/10 border-red-500/50 animate-pulse text-red-500 dark:text-red-400' : `${isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-900/50 border-white/10 text-slate-300'}`}`}>
                    <Timer size={16} />
                    <span className="text-xl font-bold font-space tracking-widest">{formatTime(timeLeft)}</span>
                 </div>
              </div>

              {/* Mobile overflow teams (3 and 4) if playing */}
              {config.teamCount >= 3 && (
                <div className="flex md:hidden w-full justify-center items-center gap-4 mt-4">
                  <div className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-300 flex-1 border-2 
                    ${currentTeam === 3 && gameState === 'playing' ? (isLight ? 'bg-purple-50 border-purple-300' : `${tColors[3].activeBg} ${tColors[3].shadow} ${tColors[3].border}`) : (isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800 opacity-60')}`}>
                     <span className={`text-[10px] ${tColors[3].text} font-black uppercase truncate max-w-[80px]`}>{config.teamNames[2]}</span>
                     <span className={`text-2xl font-space font-black ${textMain}`}>{scores.t3}</span>
                  </div>
                  {config.teamCount >= 4 && (
                    <div className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-300 flex-1 border-2 
                      ${currentTeam === 4 && gameState === 'playing' ? (isLight ? 'bg-emerald-50 border-emerald-300' : `${tColors[4].activeBg} ${tColors[4].shadow} ${tColors[4].border}`) : (isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800 opacity-60')}`}>
                       <span className={`text-[10px] ${tColors[4].text} font-black uppercase truncate max-w-[80px]`}>{config.teamNames[3]}</span>
                       <span className={`text-2xl font-space font-black ${textMain}`}>{scores.t4}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* GAME AREA */}
            <div className={`flex-1 w-full max-w-5xl mx-auto flex flex-col relative mt-6 sm:mt-8 rounded-t-3xl border-t border-x ${borderLight} ${isLight ? 'bg-slate-50/80' : 'bg-[#050816]/40'} backdrop-blur-sm overflow-hidden`}>
              
              {/* Scrollable Word Area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-8 pt-10 pb-[40vh] custom-scrollbar flex flex-col relative">
                
                {wordChain.length === 0 && gameState === 'playing' ? (
                  <div className={`m-auto flex flex-col items-center justify-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Crosshair size={48} className="mb-4 animate-spin-slow opacity-20" />
                    <p className="font-space text-lg tracking-widest uppercase">Awaiting Terminal Input</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
                    {wordChain.map((item, index) => {
                      const isSystem = item.team === 0;
                      const isLast = index === wordChain.length - 1;
                      const teamData = tColors[item.team] || tColors[1];
                      
                      return (
                        <div key={index} className={`flex flex-col items-center animate-pop-in relative group
                          ${index !== 0 ? 'mt-8 sm:mt-12' : ''}
                        `}>
                          
                          {/* Vertical Connector Line */}
                          {index !== 0 && (
                            <div className={`absolute -top-12 sm:-top-16 left-1/2 -translate-x-1/2 w-0.5 h-12 sm:h-16
                              ${isLast ? teamData.glow.replace('from-', 'bg-') : (isLight ? 'bg-slate-200' : 'bg-slate-800')}
                            `}></div>
                          )}

                          {/* Word Box */}
                          <div className={`relative px-6 sm:px-10 py-6 sm:py-8 rounded-xl border-2 shadow-2xl flex flex-col items-center transition-all duration-500
                            ${isSystem ? (isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700') : (isLight ? 'bg-white' : 'bg-[#0a0d20]')}
                            ${!isSystem ? (isLight && !isLast ? 'border-slate-200' : teamData.border) : ''}
                            ${isLast ? `scale-110 shadow-[0_0_40px_-5px_rgba(255,255,255,0.15)] ${!isSystem && !isLight ? teamData.shadow + ' animate-pulse ring-2 ring-white/20' : ''} ${!isSystem && isLight ? `shadow-[0_0_20px_-5px_${teamData.colorHex}40] ring-4 ring-cyan-400/20` : ''}` : 'opacity-70 hover:opacity-100 hover:scale-100'}
                          `}>
                            {/* Team Header inside Box */}
                            {!isSystem && (
                              <div className={`absolute -top-3 left-4 ${isLight ? 'bg-slate-100' : 'bg-slate-900'} px-3 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest border ${isLight ? 'border-slate-300' : teamData.border} ${isLight ? 'text-slate-600' : teamData.text} shadow-md`}>
                                {config.teamNames[item.team - 1]}
                              </div>
                            )}

                            {/* Points Indicator */}
                            {!isSystem && item.points > 0 && (
                              <div className={`absolute -top-3 right-4 ${isLight ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-800 border-slate-600 text-white'} px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center`}>
                                +{item.points}
                              </div>
                            )}

                            <span className={`font-space text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-widest mt-1
                              ${isLast && !isSystem && !isLight ? 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]' : textMain}
                              ${isLast && !isSystem && isLight ? 'text-slate-900 drop-shadow-sm' : ''}
                            `}>
                              {(() => {
                                if (item.text.length < 2) return item.text;
                                const isX = item.text.slice(-1) === 'x';
                                if (!isX) {
                                  return (
                                    <>
                                      {item.text.slice(0, -1)}
                                      <span className={`${isLast ? (isLight ? 'text-orange-500 font-black' : 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,1)]') + ' relative' : 'opacity-80'}`}>
                                        {item.text.slice(-1)}
                                        {isLast && <span className={`absolute -bottom-3 left-0 w-full h-[4px] rounded-full ${isLight ? 'bg-orange-500 shadow-sm' : 'bg-yellow-400 shadow-[0_0_10px_#facc15]'} animate-pulse`}></span>}
                                      </span>
                                    </>
                                  );
                                } else {
                                  return (
                                    <>
                                      {item.text.slice(0, -2)}
                                      <span className={`${isLast ? (isLight ? 'text-orange-500 font-black' : 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,1)]') + ' relative' : 'opacity-80'}`}>
                                        {item.text.slice(-2, -1)}
                                        {isLast && <span className={`absolute -bottom-3 left-0 w-full h-[4px] rounded-full ${isLight ? 'bg-orange-500 shadow-sm' : 'bg-yellow-400 shadow-[0_0_10px_#facc15]'} animate-pulse`}></span>}
                                      </span>
                                      <span>x</span>
                                    </>
                                  );
                                }
                              })()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {/* Spacer block to push the newest word up above the timer */}
                    <div ref={bottomRef} className="h-[35vh] sm:h-[40vh] w-full opacity-0 pointer-events-none shrink-0"></div>
                  </div>
                )}
              </div>

              {/* INPUT TERMINAL */}
              <div className={`absolute bottom-0 left-0 w-full p-4 sm:p-6 bg-gradient-to-t ${isLight ? 'from-slate-100 via-slate-50/95 to-transparent' : 'from-[#050816] via-[#050816]/95 to-transparent'} z-30`}>
                <div className="max-w-4xl mx-auto relative">
                  
                  {gameState === 'playing' && (
                     <div className="absolute -top-24 sm:-top-32 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-40">
                       
                       {/* SVG Circular Timer */}
                       <div className="relative w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center pointer-events-auto bg-white/5 rounded-full backdrop-blur-sm shadow-xl">
                          <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle cx="50%" cy="50%" r="45%" className={`fill-none ${isLight ? 'stroke-slate-200' : 'stroke-slate-800'} stroke-[4]`} />
                            <circle cx="50%" cy="50%" r="45%" 
                              className={`fill-none stroke-[4] transition-all duration-1000 ease-linear
                                ${turnTimeLeft <= 5 ? 'stroke-red-500 animate-pulse' : (turnTimeLeft <= 10 ? 'stroke-orange-500' : (isLight ? activeStyle.text.replace('text-', 'stroke-').replace('400', '500') : activeStyle.text.replace('text-', 'stroke-')))}
                              `}
                              style={{
                                strokeDasharray: 283, // 2 * pi * 45 (approx)
                                strokeDashoffset: 283 - (283 * (turnTimeLeft / config.turnTime)),
                                strokeLinecap: 'round'
                              }}
                            />
                          </svg>
                          <span className={`font-space font-black text-3xl sm:text-4xl drop-shadow-lg
                            ${turnTimeLeft <= 5 ? 'text-red-500 animate-pulse' : textMain}
                          `}>{turnTimeLeft}</span>
                       </div>
                     </div>
                  )}

                  <form onSubmit={validateAndSubmitWord} className="relative w-full flex items-center mt-2 group">
                    
                    {/* Error Banner */}
                    <div className={`absolute -top-14 sm:-top-16 left-1/2 -translate-x-1/2 ${isLight ? 'bg-red-100 border-red-300 text-red-700' : 'bg-red-950/90 border-red-500 text-red-200'} border-x border-t px-6 py-2 rounded-t-xl font-bold text-sm sm:text-base whitespace-nowrap shadow-[0_0_20px_rgba(239,68,68,0.3)] flex items-center transition-all duration-200 z-50
                      ${error && gameState === 'playing' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                      <XCircle size={18} className={`mr-2 ${isLight ? 'text-red-500' : 'text-red-400'}`} /> {error}
                    </div>

                    <div className={`relative flex-1 ${shake ? 'animate-shake' : ''} flex`}>
                      <div className={`absolute -inset-0.5 bg-gradient-to-r rounded-l-2xl blur opacity-30 group-focus-within:opacity-100 transition duration-500
                        ${gameState === 'playing' ? activeStyle.glow : (isLight ? 'from-slate-300 to-slate-200' : 'from-slate-600 to-slate-500')}`}>
                      </div>

                      <div className={`relative flex items-center w-full ${isLight ? 'bg-white border-slate-300' : 'bg-[#0a0d20] border-slate-700'} border-2 border-r-0 rounded-l-2xl overflow-hidden shadow-inner focus-within:border-transparent transition-colors`}>
                        
                        {/* Terminal Target Letter Box */}
                        {gameState === 'playing' && (
                          <div className={`px-4 sm:px-8 py-4 sm:py-6 border-r ${isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/80'} flex flex-col items-center justify-center
                            ${isLight ? activeStyle.text.replace('400', '600') : activeStyle.text}`}>
                            <span className={`font-space text-4xl sm:text-6xl font-black uppercase ${!isLight ? 'drop-shadow-[0_0_15px_currentColor]' : 'drop-shadow-md'}`}>{targetLetter}</span>
                          </div>
                        )}

                        <input
                          ref={inputRef}
                          type="text"
                          value={currentInput}
                          onChange={(e) => {
                            playSound('type');
                            setCurrentInput(e.target.value);
                            if (error && gameState === 'playing') setError(''); 
                          }}
                          disabled={gameState !== 'playing' || isLoading}
                          placeholder={gameState === 'playing' ? `AWAITING INPUT...` : "SYSTEM OFFLINE"}
                          className={`w-full bg-transparent px-4 sm:px-6 py-4 sm:py-6 text-2xl sm:text-4xl font-space font-black ${textMain} ${isLight ? 'placeholder-slate-500' : 'placeholder-slate-600'} focus:outline-none transition-all
                            disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed uppercase tracking-widest ${isLight ? '' : 'drop-shadow-md'}
                          `}
                          autoComplete="off"
                          spellCheck="false"
                          maxLength={30}
                        />
                        
                        {isLoading && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className={`w-6 h-6 sm:w-8 sm:h-8 border-4 ${isLight ? 'border-slate-200 border-t-slate-800' : 'border-slate-600 border-t-white'} rounded-full animate-spin`}></div>
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={gameState !== 'playing' || isLoading || !currentInput.trim()}
                      className={`shrink-0 text-white px-6 sm:px-12 py-4 sm:py-[1.6rem] rounded-r-2xl font-space font-black tracking-widest transition-all text-lg sm:text-xl border-2 border-l-0 border-transparent relative overflow-hidden
                        disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-600 disabled:border-slate-300 dark:disabled:border-slate-700
                        ${gameState === 'playing' ? activeStyle.btn : (isLight ? 'bg-slate-400' : 'bg-slate-700')}
                      `}
                      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 80%, 90% 100%, 0 100%)' }} // Futuristic cut corner
                    >
                      <span className="hidden sm:inline relative z-10">EXECUTE</span>
                      <ChevronRight className="sm:hidden relative z-10" size={28} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </>
        )}

        {/* === MATCH RESULT CINEMATIC SCREEN === */}
        {gameState === 'gameover' && (() => {
          
          // Determine winner safely
          let maxScore = -Infinity;
          let winnerIds: number[] = [];
          
          for(let i=1; i<=config.teamCount; i++) {
            if (scores[`t${i}`] > maxScore) {
              maxScore = scores[`t${i}`];
              winnerIds = [i];
            } else if (scores[`t${i}`] === maxScore) {
              winnerIds.push(i);
            }
          }

          const isTie = winnerIds.length > 1;
          const wId = winnerIds[0];
          const wColor = tColors[wId];
          
          // Check for grand champion
          const hasGrandChampion = Object.values(teamWins).some(wins => wins >= config.targetWins);

          return (
            <div className={`absolute inset-0 z-50 ${isLight ? 'bg-slate-50/95' : 'bg-[#050816]/95'} backdrop-blur-2xl overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-700`}>
              <div className="w-full min-h-full flex flex-col items-center p-4 sm:p-8 pt-16">
               
               <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                 {/* Winner Ambient Glow */}
                 {!isTie && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[80%] rounded-full blur-[200px] opacity-30" style={{backgroundColor: wColor.colorHex}}></div>}
               </div>

               <div className="relative z-10 w-full max-w-4xl flex flex-col items-center mt-8 sm:mt-12">
                 <h2 className={`text-xl sm:text-2xl font-bold tracking-[0.5em] ${hasGrandChampion ? 'text-purple-400' : textMuted} uppercase mb-4`}>
                   {hasGrandChampion ? "Grand Champion Crowned" : "Match Terminated"}
                 </h2>
                 
                 {error && (
                   <p className="text-red-500 dark:text-red-400 font-bold mb-8 text-sm sm:text-lg bg-red-100 dark:bg-red-500/10 px-6 py-2 rounded-full border border-red-300 dark:border-red-500/30 backdrop-blur-md flex items-center gap-2">
                     <AlertOctagon size={18} /> {error}
                   </p>
                 )}
                 
                 {/* Cinematic Winner Card */}
                 <div className={`w-full ${isLight ? 'bg-white shadow-xl' : 'bg-[#0a0d20]/80 shadow-2xl'} p-8 sm:p-12 rounded-[3rem] border flex flex-col items-center relative overflow-hidden mb-12
                   ${isTie ? (isLight ? 'border-slate-300' : 'border-slate-700') : `${wColor.border} shadow-[0_0_80px_-20px_currentColor]`}
                 `} style={{ color: isTie ? (isLight ? '#64748b' : '#94a3b8') : wColor.colorHex }}>
                    
                    {!isTie && <div className="absolute top-0 left-0 w-full h-2" style={{backgroundColor: wColor.colorHex}}></div>}
                    
                    <Trophy size={80} className={`mb-6 ${isTie ? 'text-slate-400 dark:text-slate-500' : wColor.text} drop-shadow-2xl`} />
                    
                    <h3 className={`text-5xl sm:text-7xl font-space font-black ${textMain} text-center drop-shadow-lg mb-2`}>
                      {isTie ? "DRAW DETECTED" : `${config.teamNames[wId - 1]} WINS`}
                    </h3>
                    
                    <div className="text-7xl sm:text-9xl font-black font-space mt-4 drop-shadow-[0_0_30px_currentColor]">
                       {maxScore} <span className="text-2xl text-slate-400 dark:text-white/50 tracking-widest">PTS</span>
                    </div>
                 </div>
                 
                 {/* Detailed Match Statistics */}
                 <div className="w-full grid grid-cols-2 gap-4 sm:gap-6 mb-12">
                   {/* Remaining Teams Scores */}
                   {Array.from({length: config.teamCount}).map((_, idx) => {
                     const tId = idx + 1;
                     const tData = tColors[tId];
                     const isW = winnerIds.includes(tId);
                     return (
                       <div key={tId} className={`p-4 sm:p-6 rounded-2xl relative overflow-hidden border ${isW ? `${tData.border} ${isLight ? 'bg-slate-50' : 'bg-slate-900'}` : (isLight ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/5')} backdrop-blur-sm flex flex-col items-center sm:items-start transition-colors`}>
                         <p className={`${isLight ? tData.text.replace('400', '600') : tData.text} text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1 sm:mb-2`}>{config.teamNames[idx]}</p>
                         <div className="flex items-end gap-4">
                           <p className={`text-3xl sm:text-4xl font-space font-black ${textMain}`}>{scores[`t${tId}`]}</p>
                           <div className="flex gap-1 mb-2">
                             {Array.from({length: config.targetWins}).map((_, i) => (
                               <Trophy key={i} size={14} className={i < teamWins[`t${tId}`] ? tData.text : 'text-slate-500 opacity-30'} />
                             ))}
                           </div>
                         </div>
                       </div>
                     )
                   })}
                 </div>

                 <div className={`w-full ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/10'} rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-around items-center gap-8 mb-12 backdrop-blur-md transition-colors`}>
                    <div className="text-center">
                      <p className={`${textMuted} text-xs font-bold uppercase tracking-widest mb-2`}>Total Links</p>
                      <p className="text-4xl font-space font-black text-cyan-500 dark:text-cyan-400">{Math.max(0, wordChain.length - 1)}</p>
                    </div>
                    <div className={`w-px h-16 ${isLight ? 'bg-slate-200' : 'bg-white/10'} hidden sm:block`}></div>
                    <div className="text-center">
                      <p className={`${textMuted} text-xs font-bold uppercase tracking-widest mb-2`}>Longest Word</p>
                      <p className="text-2xl sm:text-3xl font-space font-black text-pink-500 dark:text-pink-400 uppercase tracking-wider">{longestWord || 'N/A'}</p>
                      <p className={`${textMuted} text-xs mt-1`}>{longestWord.length} Letters</p>
                    </div>
                 </div>

                 <div className="flex flex-wrap gap-4 sm:gap-8 w-full justify-center">
                   <button 
                     onClick={() => setGameState('lobby')}
                     className={`px-6 py-4 ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300' : 'bg-slate-800 text-white hover:bg-slate-700 border-slate-600'} font-bold rounded-2xl transition-all hover:-translate-y-1 text-sm sm:text-base flex items-center justify-center border`}
                   >
                     <Settings size={20} className="mr-2" /> Lobby
                   </button>
                   {!hasGrandChampion && (
                     <button 
                       onClick={continueGame}
                       className={`px-8 py-4 ${isLight ? 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg shadow-cyan-500/30' : 'bg-cyan-500 text-white hover:bg-cyan-400 shadow-[0_0_30px_-5px_rgba(34,211,238,0.5)]'} font-space font-black rounded-2xl transition-all hover:scale-105 active:scale-95 text-sm sm:text-lg flex items-center justify-center`}
                     >
                       <Play size={24} className="mr-3" /> CONTINUE CHAIN
                     </button>
                   )}
                   <button 
                     onClick={startGame}
                     className={`px-8 sm:px-12 py-4 ${isLight ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-xl' : 'bg-white text-[#050816] hover:bg-slate-200 shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)]'} font-space font-black rounded-2xl transition-all hover:scale-105 active:scale-95 text-sm sm:text-lg flex items-center justify-center`}
                   >
                     <RotateCcw size={24} className="mr-3" /> REBOOT
                   </button>
                 </div>
               </div>
            </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
