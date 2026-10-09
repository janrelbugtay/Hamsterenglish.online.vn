import React, { useState, useEffect, useRef } from 'react';
import { User, Play, ChevronRight, RefreshCw, ArrowLeft, Save, Edit3, Trash2, Sun, Moon, Maximize, Minimize, ClipboardList, Info, Check } from 'lucide-react';
import { ViewState } from "../types";
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { Plus, Folder } from 'lucide-react';

const GAME_DATA = [
  {
    question: "Name a color in a rainbow.",
    answers: [
      { text: "Red", points: 40, aliases: ["red"] },
      { text: "Blue", points: 25, aliases: ["blue"] },
      { text: "Yellow", points: 15, aliases: ["yellow"] },
      { text: "Green", points: 10, aliases: ["green"] },
      { text: "Orange", points: 10, aliases: ["orange"] }
    ]
  },
  {
    question: "Name an animal you can keep as a pet.",
    answers: [
      { text: "Dog", points: 50, aliases: ["dog", "puppy"] },
      { text: "Cat", points: 30, aliases: ["cat", "kitten"] },
      { text: "Fish", points: 10, aliases: ["fish", "goldfish"] },
      { text: "Bird", points: 5, aliases: ["bird", "parrot"] },
      { text: "Rabbit", points: 5, aliases: ["rabbit", "bunny"] }
    ]
  },
  {
    question: "Name a fruit that is yellow.",
    answers: [
      { text: "Banana", points: 60, aliases: ["banana"] },
      { text: "Lemon", points: 25, aliases: ["lemon"] },
      { text: "Mango", points: 10, aliases: ["mango"] },
      { text: "Pineapple", points: 5, aliases: ["pineapple"] }
    ]
  },
  {
    question: "Name something you wear on your feet.",
    answers: [
      { text: "Shoes", points: 45, aliases: ["shoe", "shoes", "sneaker", "sneakers"] },
      { text: "Socks", points: 35, aliases: ["sock", "socks"] },
      { text: "Boots", points: 10, aliases: ["boot", "boots"] },
      { text: "Sandals", points: 10, aliases: ["sandal", "sandals", "flip flops"] }
    ]
  },
  {
    question: "Name something people drink in the morning.",
    answers: [
      { text: "Coffee", points: 50, aliases: ["coffee"] },
      { text: "Water", points: 20, aliases: ["water"] },
      { text: "Milk", points: 15, aliases: ["milk"] },
      { text: "Tea", points: 10, aliases: ["tea"] },
      { text: "Juice", points: 5, aliases: ["juice", "orange juice"] }
    ]
  }
];

const normalizeString = (str: string) => {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const checkAnswer = (input: string, answers: any[]) => {
  const normalizedInput = normalizeString(input);
  for (let i = 0; i < answers.length; i++) {
    const ans = answers[i];
    const matchTerms = [ans.text, ...(ans.aliases || [])].map(normalizeString);
    if (matchTerms.includes(normalizedInput)) {
      return i; 
    }
  }
  return -1; 
};

const playSound = (type: string) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'correct') {
      // Bright, chiming bell sound
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      
      osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc2.frequency.setValueAtTime(1108.73, ctx.currentTime); // C#6

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);

      osc1.start(); osc2.start();
      osc1.stop(ctx.currentTime + 1.0);
      osc2.stop(ctx.currentTime + 1.0);

    } else if (type === 'wrong') {
      // Harsh, loud TV buzzer
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';

      osc1.frequency.setValueAtTime(120, ctx.currentTime);
      osc2.frequency.setValueAtTime(125, ctx.currentTime);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02);
      gain.gain.setValueAtTime(0.5, ctx.currentTime + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc1.start(); osc2.start();
      osc1.stop(ctx.currentTime + 0.5);
      osc2.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.error("Audio error:", e);
  }
};

const StrikeOverlay = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-[20rem] h-[20rem] bg-red-600/50 blur-[80px] rounded-full"></div>
        <div className="text-red-600 font-black text-[15rem] md:text-[20rem] leading-none drop-shadow-[0_0_40px_rgba(220,38,38,1)] animate-shake z-10" style={{ WebkitTextStroke: '6px #450a0a' }}>
          X
        </div>
      </div>
    </div>
  );
};

const AnswerBoard = ({ answers, revealedIndices, isDark }: { answers: any[], revealedIndices: number[], isDark: boolean }) => {
  const slots = Array.from({ length: 8 }).map((_, i) => answers[i] || null);

  return (
    <div className={`relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t-4 border-indigo-500 rounded-[2rem] p-4 md:p-8 shadow-2xl w-full max-w-5xl overflow-hidden`}>
      {/* Clean modern overlay replacing the heavy gold styling */}
      <div className="absolute inset-0 pointer-events-none rounded-[2rem] border border-slate-200 dark:border-white/10"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 relative z-10">
        {slots.map((answer, index) => {
          const isRevealed = revealedIndices.includes(index);
          const hasAnswer = answer !== null;

          return (
            <div 
              key={index} 
              className={`h-20 md:h-[6.5rem] relative overflow-hidden rounded-xl border-2 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'} shadow-md`}
            >
              {/* Revealed State Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 flex justify-between items-center px-4 md:px-6"
                   style={{ backgroundImage: isDark ? 'linear-gradient(90deg, #1e293b 0%, #334155 50%, #1e293b 100%)' : 'linear-gradient(90deg, #e2e8f0 0%, #f8fafc 50%, #e2e8f0 100%)' }}>
                <span className={`${isDark ? 'text-white' : 'text-slate-900'} font-black text-2xl md:text-4xl uppercase tracking-widest truncate pr-4 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]`} style={{ fontFamily: 'Impact, sans-serif' }}>
                  {answer?.text}
                </span>
                <div className={`h-full flex items-center border-l-4 border-[#0f172a] pl-4 md:pl-6 ${isDark ? 'bg-[#0f172a]/80' : 'bg-slate-200/80'} shadow-[inset_10px_0_15px_rgba(0,0,0,0.4)]`}>
                  <span className="text-yellow-400 font-black text-3xl md:text-5xl drop-shadow-[0_0_12px_rgba(250,204,21,0.8)]" style={{ fontFamily: 'Impact, sans-serif' }}>
                    {answer?.points}
                  </span>
                </div>
              </div>

              {/* Covered State Flap */}
              <div 
                className={`absolute inset-0 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-900 border-[3px] border-blue-400 flex items-center justify-center transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-top ${isRevealed ? 'rotate-x-90 opacity-0' : 'rotate-x-0 opacity-100 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]'}`}
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              >
                {/* Subtle digital pattern on the flap */}
                <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                
                <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>
                
                {hasAnswer ? (
                  <div className="w-16 h-12 md:w-24 md:h-16 rounded-full bg-indigo-600 border-4 border-indigo-300 flex items-center justify-center shadow-inner relative overflow-hidden">
                    <span className="text-white font-black text-3xl md:text-4xl drop-shadow-md relative z-10" style={{ fontFamily: 'Impact, sans-serif' }}>
                      {index + 1}
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-full opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-300 to-transparent"></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export function FamilyFeud({ onViewChange, initialGame }: { onViewChange: (view: ViewState) => void, initialGame?: any }) {
  const { user } = useAuth();
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  
  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        const qFolders = query(collection(db, "gameFolders"), where("userId", "==", user.uid));
        const foldersSnap = await getDocs(qFolders);
        const f: any[] = [];
        foldersSnap.forEach(doc => f.push({ id: doc.id, ...doc.data() }));
        setFolders(f);
      };
      fetchFolders();
    }
  }, [user]);

  const [gameState, setGameState] = useState(initialGame && !initialGame.editMode ? 'playing' : 'setup');
  
  const [folderId, setFolderId] = useState(initialGame?.folderId || "");
  const [topic, setTopic] = useState(initialGame?.topic || "");
  const [classLevel, setClassLevel] = useState(initialGame?.className || "");
  
  // Custom rounds
  const defaultRound = {
    question: '',
    answers: Array.from({ length: 8 }, () => ({ text: '', points: 0 }))
  };
  
  const [rounds, setRounds] = useState<any[]>(
    initialGame?.customQuestions && initialGame.customQuestions.length > 0 
      ? initialGame.customQuestions 
      : [JSON.parse(JSON.stringify(defaultRound))]
  );
  
  const [customGameData, setCustomGameData] = useState<any>(initialGame?.customQuestions || null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  
  // Bulk Paste State
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  
  const parseFamilyFeudText = (rawText: string) => {
    if (!rawText.trim()) return [];
    
    const allLines = rawText.split(/\r?\n/).map((l: string) => l.trim());
    const parsedRounds: any[] = [];
    let currentRound: any = null;
    
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      if (!line) continue;
      
      const isExplicitTopic = /^(topic|question)/i.test(line);
      const match = line.match(/(.*?)(?:\s*[-:]?\s*\(?(\d+)\)?)?\s*$/);
      const hasPoints = match && match[2] !== undefined && match[2] !== "";
      
      if (isExplicitTopic || (!hasPoints && (!currentRound || currentRound.answers.length >= 8))) {
        if (currentRound) {
           parsedRounds.push(currentRound);
        }
        currentRound = {
          question: line.replace(/^(topic|question)\s*\d*[:.-]?\s*/i, ''),
          answers: []
        };
      } else {
        if (!currentRound) {
          currentRound = { question: '', answers: [] };
        }
        if (currentRound.answers.length < 8) {
           let points = 10;
           let text = line;
           if (line.includes('\t')) {
              const parts = line.split('\t');
              const lastPart = parseInt(parts[parts.length - 1], 10);
              if (!isNaN(lastPart)) {
                points = lastPart;
                text = parts.slice(0, -1).join(' ').trim();
              }
           } else if (hasPoints) {
              text = match[1].trim();
              points = parseInt(match[2], 10);
           }
           text = text.replace(/[-:]$/, '').trim();
           text = text.replace(/^([a-eA-E1-8])[\.\)\:\-]\s+/, '');
           if (text) {
             currentRound.answers.push({ text, points });
           }
        }
      }
    }
    
    if (currentRound) {
      parsedRounds.push(currentRound);
    }
    
    parsedRounds.forEach(r => {
      while (r.answers.length < 8) {
        r.answers.push({ text: '', points: 0 });
      }
    });
    
    return parsedRounds;
  };

  const handleApplyBulkPaste = (action: 'replace' | 'append') => {
    const parsed = parseFamilyFeudText(bulkText);
    if (parsed.length === 0) {
      alert("Could not find any topics/answers. Please format correctly.");
      return;
    }
    if (action === 'replace') {
      setRounds(parsed);
    } else {
      setRounds(prev => {
        // Overwrite the first round if it has no answers, even if it has a topic
        if (prev.length === 1 && prev[0].answers.every((a: any) => !a.text.trim())) {
          return parsed;
        }
        return [...prev, ...parsed];
      });
    }
    setToastMsg(`✨ Added ${parsed.length} topics!`);
    setTimeout(() => setToastMsg(""), 3500);
    setShowBulkPasteModal(false);
    setBulkText("");
  };
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const isDark = theme === 'dark';
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [revealedAnswers, setRevealedAnswers] = useState<number[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({ 1: 0, 2: 0 });
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [showStrike, setShowStrike] = useState(false);
  const [feedback, setFeedback] = useState('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const gameData = customGameData || initialGame?.customQuestions || GAME_DATA;
  const currentQ = gameData[currentQuestionIndex];

  useEffect(() => {
    if (gameState === 'playing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState, currentPlayer]);

  const startGame = () => {
    setScores({ 1: 0, 2: 0 });
    setCurrentQuestionIndex(0);
    setRevealedAnswers([]);
    setCurrentPlayer(1);
    setGameState('playing');
  };

  const nextRound = () => {
    if (currentQuestionIndex + 1 < gameData.length) {
      setCurrentQuestionIndex(prev => prev + 1);
      setRevealedAnswers([]);
      setGameState('playing');
    } else {
      setGameState('game_over');
    }
  };

  const revealAll = () => {
    if (!currentQ) return;
    const allIndices = currentQ.answers.map((_: any, i: number) => i);
    setRevealedAnswers(allIndices);
    setGameState('round_over');
  };

  const revealAnswer = (index: number) => {
    if (!currentQ || gameState === 'setup' || gameState === 'game_over') return;
    if (!revealedAnswers.includes(index) && currentQ.answers[index]) {
      const newRevealed = [...revealedAnswers, index];
      setRevealedAnswers(newRevealed);
      if (newRevealed.length === currentQ.answers.length && gameState !== 'round_over') {
        setTimeout(() => setGameState('round_over'), 1000);
      }
    }
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || gameState !== 'playing') return;

    const answerIndex = checkAnswer(inputValue, currentQ.answers);

    if (answerIndex !== -1 && !revealedAnswers.includes(answerIndex)) {
      playSound('correct');
      setFeedback('correct');
      setTimeout(() => setFeedback('idle'), 1000);

      const points = currentQ.answers[answerIndex].points;
      setScores(prev => ({
        ...prev,
        [currentPlayer]: prev[currentPlayer] + points
      }));
      
      const newRevealed = [...revealedAnswers, answerIndex];
      setRevealedAnswers(newRevealed);

      if (newRevealed.length === currentQ.answers.length) {
        setTimeout(() => setGameState('round_over'), 1000);
      } else {
        setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      }
    } else {
      playSound('wrong');
      setFeedback('wrong');
      setShowStrike(true);
      setTimeout(() => {
        setShowStrike(false);
        setFeedback('idle');
        setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
      }, 1500); 
    }

    setInputValue('');
  };

    const handleStartCustomGame = () => {
    const validRounds = rounds.map(r => ({
      ...r,
      answers: r.answers
        .filter((a: any) => a.text.trim() !== '')
        .map((a: any) => ({ text: a.text.toUpperCase(), points: Number(a.points) || 0 }))
    })).filter(r => r.question.trim() !== '' && r.answers.length > 0);

    if (validRounds.length === 0) {
      alert("Please add at least one complete topic with answers.");
      return;
    }

    setCustomGameData(validRounds);
    startGame();
  };

  const updateSetupAnswer = (roundIndex: number, answerIndex: number, field: 'text' | 'points', value: string) => {
    const newRounds = [...rounds];
    if (field === 'points') {
      newRounds[roundIndex].answers[answerIndex].points = parseInt(value) || 0;
    } else {
      newRounds[roundIndex].answers[answerIndex].text = value;
    }
    setRounds(newRounds);
  };
  
  const updateSetupTopic = (roundIndex: number, value: string) => {
    const newRounds = [...rounds];
    newRounds[roundIndex].question = value;
    setRounds(newRounds);
  };
  
  const addTopic = () => {
    setRounds([...rounds, JSON.parse(JSON.stringify(defaultRound))]);
  };
  
  const deleteTopic = (index: number) => {
    if (rounds.length > 1) {
      setRounds(rounds.filter((_, i) => i !== index));
    }
  };

  const confirmSave = async (isPublicGame: boolean) => {
    if (!user) {
      alert("You must be logged in to save games.");
      return;
    }

    setShowPublishModal(false);
    onViewChange("games");

    try {
      const validRounds = rounds.map(r => ({
        ...r,
        answers: r.answers
          .filter((a: any) => a.text.trim() !== '')
          .map((a: any) => ({ text: a.text.toUpperCase(), points: Number(a.points) || 0 }))
      })).filter(r => r.question.trim() !== '' && r.answers.length > 0);

      const gameToSave = JSON.parse(JSON.stringify({
        name: rounds[0]?.question || "Family Feud Game",
        folderId: folderId || "",
        topic: rounds[0]?.question || "",
        className: classLevel || "",
        gameType: "family-feud",
        customQuestions: validRounds,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
        isPublic: isPublicGame,
      }));

      if (initialGame?.id) {
        await updateDoc(doc(db, "mysteryBoxGames", initialGame.id), gameToSave);
      } else {
        await addDoc(collection(db, "mysteryBoxGames"), {
          ...gameToSave,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error saving game:", error);
    }
  };
  const renderSetupScreen = () => (
    <>
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 flex flex-col items-center overflow-y-auto w-full">
      <div className="w-full max-w-5xl mt-12 mb-20">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col gap-6">
          
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-6">
            <h2 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Game Setup</h2>
            <div className="flex items-center gap-4">
              <button onClick={() => onViewChange("games")} className="px-6 py-2.5 font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => setShowPublishModal(true)} className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors shadow-md shadow-blue-500/20">
                <Save size={20} /> Save Game
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Game Mode</label>
              <div className="px-4 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-300">
                Family Feud
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Topic</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Everyday Items" className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-900 dark:text-white" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Class Level</label>
              <input type="text" value={classLevel} onChange={e => setClassLevel(e.target.value)} placeholder="e.g. KET, Starters" className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-900 dark:text-white" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Folder</label>
              <select value={folderId} onChange={e => setFolderId(e.target.value)} className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-900 dark:text-white appearance-none">
                <option value="">No Folder (Root)</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-8">
            {/* Smart Tip Bar */}
            <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-blue-900 dark:text-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                  <Info size={18} />
                </div>
                <p className="text-xs sm:text-sm font-medium">
                  <span className="font-bold">Smart Paste:</span> Paste multiple topics and answers with points directly.
                </p>
              </div>
              <button
                onClick={() => setShowBulkPasteModal(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer self-end sm:self-auto"
              >
                <ClipboardList size={14} /> Bulk Paste
              </button>
            </div>

            {rounds.map((round, rIndex) => (
              <div key={rIndex} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 relative group">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3 w-full">
                    <span className="text-slate-400 font-bold text-xl">Topic {rIndex + 1}</span>
                    <input 
                      type="text" 
                      value={round.question}
                      onChange={e => updateSetupTopic(rIndex, e.target.value)}
                      className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl font-bold text-lg outline-none focus:border-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
                      placeholder="Enter the survey question/topic..."
                    />
                  </div>
                  <button 
                    onClick={() => deleteTopic(rIndex)}
                    className="ml-4 p-3 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-600 rounded-xl transition-colors shrink-0 disabled:opacity-30"
                    disabled={rounds.length === 1}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {round.answers.map((answer: any, aIndex: number) => (
                    <div key={aIndex} className="flex gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center font-bold shrink-0">
                        {aIndex + 1}
                      </div>
                      <input 
                        type="text"
                        value={answer.text}
                        onChange={e => updateSetupAnswer(rIndex, aIndex, 'text', e.target.value)}
                        className="flex-1 bg-transparent font-bold outline-none text-slate-700 dark:text-white placeholder-slate-400"
                        placeholder="Answer"
                      />
                      <input 
                        type="number"
                        value={answer.points || ''}
                        onChange={e => updateSetupAnswer(rIndex, aIndex, 'points', e.target.value)}
                        className="w-16 bg-transparent font-bold outline-none text-right text-indigo-500 dark:text-indigo-400 placeholder-slate-300"
                        placeholder="Pts"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <button
              onClick={addTopic}
              className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-500 hover:text-blue-500 dark:text-slate-400 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={24} /> ADD TOPIC
            </button>
          </div>
          
          <button
            onClick={handleStartCustomGame}
            className="mt-6 px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-2xl rounded-2xl shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all w-full flex items-center justify-center gap-3"
          >
             START PLAYING NOW
          </button>
        </div>
      </div>
      
      {showPublishModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl border-2 border-blue-500/30 flex flex-col items-center text-center">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Save Game</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium">Would you like to publish this game to the public gallery so others can play it, or keep it private?</p>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => confirmSave(true)}
                className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-sky-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                🌍 Publish to Public
              </button>
              <button 
                onClick={() => confirmSave(false)}
                className="w-full py-3.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                🔒 Keep Private
              </button>
              <button 
                onClick={() => setShowPublishModal(false)}
                className="w-full py-2 mt-2 text-slate-500 dark:text-slate-400 font-medium hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full font-bold shadow-xl shadow-slate-900/20 flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <Check size={20} className="text-green-400" />
          {toastMsg}
        </div>
      )}

      {/* Bulk Paste Modal */}
      {showBulkPasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
                <ClipboardList size={22} className="text-blue-500" />
                Bulk Paste Topics
              </h3>
              <button 
                onClick={() => setShowBulkPasteModal(false)}
                className="text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-white p-2 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-xl text-sm font-medium border border-blue-100 dark:border-blue-800/50 flex gap-3">
                <Info size={20} className="shrink-0 text-blue-500" />
                <p>
                  Paste your questions and answers here. Separate each topic with a <strong>blank line</strong>. <br/>
                  The <strong>first line</strong> of a block is the Topic. The following lines are answers, with points at the end.<br/>
                  <span className="opacity-75 mt-2 block font-mono text-xs">
                    Topic 1<br/>
                    Answer One 50<br/>
                    Answer Two 30<br/>
                    <br/>
                    Topic 2<br/>
                    Another Answer 40
                  </span>
                </p>
              </div>

              <textarea 
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder="Paste your text here..."
                className="w-full h-64 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-mono text-sm resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />

              {bulkText.trim() && (
                <div className="flex justify-center -mt-2 mb-2">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-600">
                    Found <span className="font-bold text-slate-800 dark:text-white">{parseFamilyFeudText(bulkText).length}</span> topics. 
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  onClick={() => handleApplyBulkPaste('replace')}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Replace All
                </button>
                <button 
                  onClick={() => handleApplyBulkPaste('append')}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
                >
                  Append to End
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderGameOver = () => {
    const winner = scores[1] > scores[2] ? 'Team 1' : scores[1] < scores[2] ? 'Team 2' : 'Tie';
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in zoom-in mt-24">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-[0_5px_5px_rgba(0,0,0,1)]">
          GAME OVER
        </h1>
        <div className="text-4xl text-yellow-400 font-black drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
          {winner === 'Tie' ? "IT'S A TIE!" : `${winner} WINS!`}
        </div>
        <div className="flex gap-12 text-4xl font-black bg-black/50 p-8 rounded-3xl border border-slate-700 shadow-2xl">
          <div className="flex flex-col items-center gap-2">
            <span className="text-blue-500 text-xl tracking-widest uppercase">Team 1</span>
            <span className="text-white">{scores[1]}</span>
          </div>
          <div className="w-px bg-slate-600"></div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-green-500 text-xl tracking-widest uppercase">Team 2</span>
            <span className="text-white">{scores[2]}</span>
          </div>
        </div>
        <button 
          onClick={startGame}
          className="mt-8 px-8 py-4 bg-gradient-to-b from-blue-600 to-blue-800 text-white rounded-full font-bold text-xl hover:from-blue-500 hover:to-blue-700 transition-all shadow-[0_0_20px_rgba(37,99,235,0.5)] flex items-center gap-3 border-2 border-blue-400"
        >
          <RefreshCw size={24} /> PLAY AGAIN
        </button>
      </div>
    );
  };

  const renderHeaderInfo = () => {
    if (gameState === 'setup' || gameState === 'game_over') return null;
    return (
       <div className="w-full max-w-5xl mx-auto mt-6 px-4">
        <div className={`bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-center relative overflow-hidden`}>
          <h2 className={`text-2xl md:text-5xl font-black ${isDark ? 'text-white' : 'text-slate-900'} drop-shadow-[0_4px_6px_rgba(0,0,0,1)] leading-tight tracking-wide`} style={{ fontFamily: 'Impact, sans-serif' }}>
            {currentQ.question}
          </h2>
        </div>
      </div>
    );
  };

  const bgColors: Record<string, Record<string, string>> = {
    dark: {
      idle: 'bg-[#0f172a]',
      correct: 'bg-green-950',
      wrong: 'bg-red-950'
    },
    light: {
      idle: 'bg-slate-50',
      correct: 'bg-green-100',
      wrong: 'bg-red-100'
    }
  };

  return (
    <div ref={gameContainerRef} className={`h-[calc(100vh-2rem)] w-full -m-4 md:-m-8 ${bgColors[theme][feedback]} font-sans ${isDark ? 'text-white' : 'text-slate-900'} flex flex-col relative selection:bg-blue-500/30 transition-colors duration-500 overflow-hidden`} style={{ margin: '-1rem', height: 'calc(100% + 2rem)' }}>
      <div className="absolute top-4 left-4 z-[60] flex items-center gap-3">
        <button 
          onClick={() => onViewChange("home")}
          className={`flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border ${isDark ? 'text-white/80 hover:text-white bg-black/20 hover:bg-black/50 border-white/20' : 'text-slate-600 hover:text-slate-900 bg-white/50 hover:bg-white border-slate-300'}`}
          title="Back to Home"
        >
          <ArrowLeft size={24} />
        </button>
        <button 
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className={`flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border ${isDark ? 'text-white/80 hover:text-white bg-black/20 hover:bg-black/50 border-white/20' : 'text-slate-600 hover:text-slate-900 bg-white/50 hover:bg-white border-slate-300'}`}
          title="Toggle Theme"
        >
          {isDark ? <Sun size={24} /> : <Moon size={24} />}
        </button>
        <button 
          onClick={async () => {
            try {
              if (!document.fullscreenElement) {
                if (gameContainerRef.current) {
                  const p = gameContainerRef.current.requestFullscreen();
                  if (p && p.catch) p.catch(() => {});
                }
              } else {
                if (document.exitFullscreen) {
                  const p = document.exitFullscreen();
                  if (p && p.catch) p.catch(() => {});
                }
              }
            } catch (err) {}
          }}
          className={`flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border ${isDark ? 'text-white/80 hover:text-white bg-black/20 hover:bg-black/50 border-white/20' : 'text-slate-600 hover:text-slate-900 bg-white/50 hover:bg-white border-slate-300'}`}
          title="Toggle Fullscreen"
        >
          <Maximize size={24} />
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0); }
          15% { transform: translateX(-20px) rotate(-3deg); }
          30% { transform: translateX(20px) rotate(3deg); }
          45% { transform: translateX(-20px) rotate(-3deg); }
          60% { transform: translateX(20px) rotate(3deg); }
          75% { transform: translateX(-10px) rotate(-1deg); }
          90% { transform: translateX(10px) rotate(1deg); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>

      {/* Grid Scanline Overlay for TV effect */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
           style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '100% 4px' }}>
      </div>

      {/* Studio Lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-yellow-500/15 rounded-full blur-[150px] pointer-events-none mix-blend-screen"></div>
      <div className="absolute top-[20%] right-[10%] w-[30vw] h-[30vw] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen"></div>


      {/* Host Controls Sidebar */}
      {gameState !== 'setup' && (
        <div className={`absolute top-0 right-0 h-full ${isDark ? 'bg-slate-950/90' : 'bg-white/95'} backdrop-blur-md border-l ${isDark ? 'border-slate-800' : 'border-slate-200'} p-4 shadow-2xl ${isDark ? 'text-white' : 'text-slate-900'} flex flex-col gap-4 z-50 w-44 overflow-y-auto`}>
          <div className={`font-black text-center border-b border-slate-700 pb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'} tracking-widest text-xs`}>HOST PANEL</div>

          <div className="text-center font-bold text-slate-500 text-[10px] tracking-widest -mb-2 mt-2">REVEAL TILE</div>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
              const hasAnswer = !!currentQ?.answers[index];
              const isRevealed = revealedAnswers.includes(index);
              return (
                <button
                  key={index}
                  onClick={() => revealAnswer(index)}
                  disabled={!hasAnswer || isRevealed || gameState === 'setup' || gameState === 'game_over'}
                  className={`py-3 bg-slate-800 hover:bg-blue-600 disabled:bg-slate-900 disabled:text-slate-700 rounded ${isDark ? 'text-white' : 'text-slate-900'} font-bold transition-colors shadow-inner text-sm border border-slate-700 disabled:border-slate-800`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <div className="h-px bg-slate-800 my-4"></div>

          <div className="mt-auto flex flex-col gap-3">
            <button 
              onClick={revealAll} 
              disabled={gameState !== 'playing'}
              className={`w-full py-3 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-900' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'} disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold text-slate-300 transition-colors text-xs border border-slate-700`}
            >
              REVEAL ALL
            </button>
            
            <button 
              onClick={nextRound} 
              disabled={gameState === 'game_over'}
              className="w-full py-4 bg-gradient-to-b from-yellow-500 to-yellow-700 hover:from-yellow-400 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded font-black transition-all shadow-lg flex flex-col items-center justify-center gap-1 text-sm border-2 border-yellow-300"
            >
              NEXT TOPIC <ChevronRight size={18} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      <StrikeOverlay show={showStrike} />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col items-center z-10 w-full pb-32 transition-transform duration-300 ${gameState !== 'setup' ? 'pr-44' : ''} ${feedback === 'wrong' ? 'animate-shake' : ''}`}>
        
        {renderHeaderInfo()}

        {gameState === 'setup' && renderSetupScreen()}
        {gameState === 'game_over' && renderGameOver()}

        {(gameState === 'playing' || gameState === 'round_over') && (
          <div className="flex-1 w-full max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-start md:justify-center gap-8 lg:gap-16 px-4 mt-8 md:mt-12 overflow-y-auto">
            
            {/* Team 1 Area */}
            <div className={`flex flex-col items-center gap-3 transition-all duration-700 ${currentPlayer === 1 ? 'scale-110 drop-shadow-[0_0_40px_rgba(59,130,246,0.8)]' : 'opacity-40 grayscale-[60%] scale-95'}`}>
              <div className={`w-32 h-32 md:w-40 md:h-40 rounded-3xl border-[6px] ${currentPlayer === 1 ? 'border-blue-400 bg-gradient-to-br from-blue-500 to-blue-900 shadow-[0_0_30px_rgba(59,130,246,0.5),inset_0_4px_20px_rgba(255,255,255,0.4)]' : 'border-slate-700 bg-slate-800'} flex items-center justify-center relative overflow-hidden`}>
                {currentPlayer === 1 && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                <User size={80} className={currentPlayer === 1 ? (isDark ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' : 'text-blue-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]') : 'text-slate-600'} />
              </div>
              <div className={`text-7xl md:text-8xl font-black tracking-tighter drop-shadow-[0_5px_8px_rgba(0,0,0,1)] ${currentPlayer === 1 ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`} style={{ fontFamily: 'Impact, sans-serif' }}>
                {scores[1]}
              </div>
              <div className={`text-xl md:text-3xl font-black uppercase tracking-widest bg-black/50 px-6 py-2 rounded-full border-2 ${currentPlayer === 1 ? 'text-blue-400 border-blue-500/50' : 'text-slate-600 border-slate-800'}`}>Team 1</div>
            </div>

            {/* Center Board */}
            <div className="w-full md:w-auto flex-1 flex justify-center order-first md:order-none mb-8 md:mb-0 relative z-20">
               <AnswerBoard answers={currentQ.answers} revealedIndices={revealedAnswers} isDark={isDark} />
            </div>

            {/* Team 2 Area */}
            <div className={`flex flex-col items-center gap-3 transition-all duration-700 ${currentPlayer === 2 ? 'scale-110 drop-shadow-[0_0_40px_rgba(34,197,94,0.8)]' : 'opacity-40 grayscale-[60%] scale-95'}`}>
               <div className={`w-32 h-32 md:w-40 md:h-40 rounded-3xl border-[6px] ${currentPlayer === 2 ? 'border-green-400 bg-gradient-to-br from-green-500 to-green-900 shadow-[0_0_30px_rgba(34,197,94,0.5),inset_0_4px_20px_rgba(255,255,255,0.4)]' : 'border-slate-700 bg-slate-800'} flex items-center justify-center relative overflow-hidden`}>
                 {currentPlayer === 2 && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                 <User size={80} className={currentPlayer === 2 ? (isDark ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' : 'text-blue-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]') : 'text-slate-600'} />
              </div>
              <div className={`text-7xl md:text-8xl font-black tracking-tighter drop-shadow-[0_5px_8px_rgba(0,0,0,1)] ${currentPlayer === 2 ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`} style={{ fontFamily: 'Impact, sans-serif' }}>
                {scores[2]}
              </div>
              <div className={`text-xl md:text-3xl font-black uppercase tracking-widest bg-black/50 px-6 py-2 rounded-full border-2 ${currentPlayer === 2 ? 'text-green-400 border-green-500/50' : 'text-slate-600 border-slate-800'}`}>Team 2</div>
            </div>

          </div>
        )}
      </div>

      {/* Bottom Input Area */}
      {gameState === 'playing' && (
        <div className={`absolute bottom-0 left-0 w-[calc(100%-11rem)] ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-t p-6 shadow-2xl z-20`}>
          <div className="max-w-5xl mx-auto relative">
            <div className="text-center mb-6 text-xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4">
               <div className={`h-px w-16 ${currentPlayer === 1 ? 'bg-blue-500' : 'bg-green-500'}`}></div>
               <span className={currentPlayer === 1 ? 'text-blue-400 drop-shadow-[0_0_12px_rgba(96,165,250,0.8)]' : 'text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.8)]'}>
                 TEAM {currentPlayer}'S TURN TO GUESS
               </span>
               <div className={`h-px w-16 ${currentPlayer === 1 ? 'bg-blue-500' : 'bg-green-500'}`}></div>
            </div>
            <form onSubmit={handleGuessSubmit} className="flex gap-4">
               <button 
                 type="button" 
                 onClick={() => setInputValue('')}
                 className={`px-8 py-5 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-900' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'} rounded-2xl text-slate-400 font-bold transition-all border-b-4 border-slate-900 active:border-b-0 active:translate-y-1`}
               >
                 CLEAR
               </button>
               <input
                 ref={inputRef}
                 type="text"
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 placeholder="TYPE YOUR ANSWER..."
                 className={`flex-1 ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'} placeholder-slate-400 px-8 py-5 rounded-2xl font-black text-2xl uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500 border-2 shadow-sm transition-all`}
                 autoComplete="off"
               />
               <button 
                 type="submit"
                 disabled={!inputValue.trim()}
                 className="px-12 py-5 bg-gradient-to-b from-yellow-400 to-amber-600 hover:from-yellow-300 hover:to-amber-500 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-600 text-black rounded-2xl font-black transition-all shadow-[0_0_30px_rgba(245,158,11,0.5)] disabled:shadow-none flex items-center text-3xl border-b-[6px] border-amber-700 disabled:border-slate-900 active:border-b-0 active:translate-y-1"
                 style={{ fontFamily: 'Impact, sans-serif' }}
               >
                 SUBMIT
               </button>
            </form>
          </div>
        </div>
      )}

      {/* Round Over Action */}
      {gameState === 'round_over' && (
         <div className="absolute bottom-0 left-0 w-[calc(100%-11rem)] bg-gradient-to-t from-slate-900 to-blue-950 border-t-4 border-blue-800 p-8 shadow-[0_-20px_40px_rgba(0,0,0,0.8)] z-20 flex justify-center">
            <button 
              onClick={nextRound}
              className="px-12 py-5 bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black rounded-full font-black text-3xl transition-all shadow-[0_0_30px_rgba(234,179,8,0.6)] flex items-center gap-4 animate-bounce border-4 border-yellow-200"
            >
              NEXT QUESTION <ChevronRight strokeWidth={4} size={32} />
            </button>
         </div>
      )}

    </div>
  );
}
