import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { ArrowLeft, Trash2, Save, Play, Plus, Sparkles, ClipboardList, Check, Info, Copy, X, Image as ImageIcon } from "lucide-react";
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { BulkPasteVideoModal } from "../components/BulkPasteVideoModal";
import { MediaPickerModal } from "../components/MediaPickerModal";

type GameScreen = 'editor' | 'setup' | 'loading' | 'game' | 'study';

export interface Question {
  id: number | string;
  text: string;
  options: string[];
  answerIndex: number;
}

export interface Sentence {
  id: number | string;
  text: string;
  emoji: string;
  diff: number;
}

export interface GameData {
  id: number | string;
  title?: string;
  folderId?: string;
  topic?: string;
  classLevel?: string;
  sentences: Sentence[];
  questions?: Question[];
  isPublic?: boolean;
  mode?: 'word' | 'anagram' | 'multiple-choice';
}

export function BubbleSentencePro({ onViewChange, initialGame }: { onViewChange: (view: ViewState) => void, initialGame?: any }) {
  const { user } = useAuth();
  const [screen, setScreen] = useState<GameScreen>(initialGame && !initialGame.editMode ? 'setup' : 'editor');
  const [selectedTheme, setSelectedTheme] = useState('theme-sky');
  const [studyIndex, setStudyIndex] = useState(0);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [activeGame, setActiveGame] = useState<GameData>(() => {
    if (initialGame) {
      const gMode = initialGame.mode === 'multiple-choice'
        ? 'multiple-choice'
        : (initialGame.mode === 'anagram' 
            ? 'anagram' 
            : (initialGame.mode === 'word' 
                ? 'word' 
                : (initialGame.customQuestions && initialGame.customQuestions.length > 0 && (!initialGame.customSentences || initialGame.customSentences.length === 0) 
                    ? 'multiple-choice' 
                    : 'word')));
      return {
        id: initialGame.id,
        title: initialGame.name || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || "",
        classLevel: initialGame.className || "",
        sentences: initialGame.customSentences || [],
        questions: initialGame.customQuestions || [],
        mode: gMode,
      };
    }
    return {
      id: Date.now(),
      title: "",
      folderId: "",
      topic: "",
      classLevel: "",
      sentences: [{ id: Date.now(), text: "", emoji: "✨", diff: 1 }],
      questions: [{ id: Date.now(), text: "", options: ["", "", "", ""], answerIndex: 0 }],
      mode: 'word',
    };
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'QUIT_GAME') {
        setScreen('setup');
      } else if (e.data.type === 'IFRAME_READY') {
        if (iframeRef.current?.contentWindow) {
            const payloadItems = activeGame.mode === 'multiple-choice'
              ? (activeGame.questions && activeGame.questions.length > 0 ? activeGame.questions : activeGame.sentences)
              : activeGame.sentences;
            iframeRef.current.contentWindow.postMessage({
                type: 'LOAD_GAME',
                data: { 
                  ...activeGame, 
                  sentences: payloadItems,
                  customSentences: payloadItems,
                  customQuestions: activeGame.questions || [],
                  theme: selectedTheme 
                }
            }, '*');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeGame, selectedTheme]);

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

  const saveGame = async (gameData: GameData) => {
    if (!user) {
      alert("You must be logged in to save games.");
      return;
    }

    // Go to games view instantly for a snappy feel
    onViewChange("games");

    try {
      const isMcq = gameData.mode === 'multiple-choice';
      const gameToSave = JSON.parse(JSON.stringify({
        name: gameData.title || "",
        folderId: gameData.folderId || "",
        topic: gameData.topic || "",
        className: gameData.classLevel || "",
        gameType: "bubble-sentence-pro",
        customSentences: isMcq ? [] : gameData.sentences,
        customQuestions: isMcq ? (gameData.questions || []) : [],
        mode: gameData.mode || "word",
        isPublic: gameData.isPublic ?? false,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
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

  const startGame = () => {
    setScreen('game');
  };

  return (
    <div id="game-container" className="w-full h-full flex flex-col relative bg-slate-50 dark:bg-slate-900 overflow-hidden -mx-4 md:-mx-8 -my-4 md:-my-8">
      
      {screen !== 'game' && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/20 rounded-full blur-[100px]"></div>
        </div>
      )}

      {screen !== 'game' && (
        <div className="p-6 flex items-center justify-between z-10 relative">
            <button 
                onClick={() => setScreen(screen === 'editor' ? 'setup' : 'editor')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
                {screen === 'editor' ? 'Play Mode' : 'Edit Game'}
            </button>
            <button 
                onClick={() => onViewChange('games')}
                className="px-5 py-2.5 rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
                Exit
            </button>
        </div>
      )}

      {screen === 'editor' && (
        <GameEditor 
          game={activeGame} 
          onSave={saveGame} 
          onCancel={() => onViewChange('games')} 
          folders={folders}
          onUpdate={(updated) => setActiveGame(updated)}
        />
      )}

      {screen === 'setup' && (
        <div className={`absolute inset-0 z-40 flex flex-col items-center justify-center p-8 overflow-hidden transition-colors duration-1000 ${selectedTheme === "theme-ocean" ? "bg-gradient-to-b from-sky-600 to-cyan-600 dark:from-sky-800 dark:to-cyan-900" : selectedTheme === "theme-space" ? "bg-gradient-to-b from-slate-900 to-indigo-950" : selectedTheme === "theme-jungle" ? "bg-gradient-to-b from-green-600 to-emerald-400 dark:from-green-900 dark:to-emerald-800" : selectedTheme === "theme-sunset" ? "bg-gradient-to-b from-orange-400 to-yellow-300 dark:from-orange-800 dark:to-yellow-700" : "bg-gradient-to-b from-sky-400 to-blue-200 dark:from-sky-900 dark:to-blue-950"}`}>
            {/* Immersive Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-10 left-10 w-32 h-32 bg-white/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-20 w-48 h-48 bg-blue-300/30 rounded-full blur-3xl"></div>
                {/* Clouds */}
                <div className="absolute top-20 left-[10%] opacity-80 animate-float" style={{ animationDelay: '0s' }}>
                    <div className="w-24 h-8 bg-white rounded-full absolute top-4 left-4"></div>
                    <div className="w-16 h-16 bg-white rounded-full absolute top-0 left-8"></div>
                    <div className="w-12 h-12 bg-white rounded-full absolute top-2 left-2"></div>
                </div>
                <div className="absolute top-40 right-[15%] opacity-60 animate-float" style={{ animationDelay: '2s' }}>
                    <div className="w-32 h-10 bg-white rounded-full absolute top-6 left-6"></div>
                    <div className="w-20 h-20 bg-white rounded-full absolute top-0 left-10"></div>
                </div>
                {/* Floating Bubbles */}
                {Array.from({ length: 15 }).map((_, i) => (
                    <div 
                        key={i} 
                        className="absolute rounded-full border border-white/40 bg-gradient-to-tr from-white/10 to-white/30 backdrop-blur-[2px] shadow-[inset_0_0_10px_rgba(255,255,255,0.5)] animate-float-up"
                        style={{
                            width: `${Math.random() * 40 + 20}px`,
                            height: `${Math.random() * 40 + 20}px`,
                            left: `${Math.random() * 100}%`,
                            bottom: `-${Math.random() * 20 + 10}%`,
                            animationDuration: `${Math.random() * 10 + 10}s`,
                            animationDelay: `${Math.random() * 5}s`
                        }}
                    >
                        <div className="absolute top-[15%] left-[20%] w-1/4 h-1/4 bg-white/60 rounded-full blur-[1px]"></div>
                    </div>
                ))}
            </div>

            <div className="relative z-10 flex flex-col items-center">
                <h2 className="text-6xl sm:text-7xl font-black mb-12 text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-100 drop-shadow-[0_4px_4px_rgba(0,0,0,0.1)] text-center tracking-tight" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.5)' }}>
                    Bubble Island
                </h2>
                
                <div className="flex flex-wrap gap-8 max-w-6xl w-full justify-center items-center flex-col sm:flex-row perspective-[1000px]">
                    <button onClick={startGame} className="group relative w-full sm:w-80 h-[380px] rounded-[3rem] bg-white/20 dark:bg-slate-900/40 backdrop-blur-md border border-white/40 shadow-2xl overflow-hidden transition-all duration-500 hover:scale-105 hover:bg-white/30 hover:-translate-y-2 cursor-pointer flex flex-col items-center justify-center p-8">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 dark:to-black/20 pointer-events-none"></div>
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-400/30 rounded-full blur-2xl group-hover:bg-blue-400/50 transition-colors"></div>
                        
                        <div className="relative z-10 text-8xl mb-6 transform group-hover:scale-110 transition-transform duration-500 drop-shadow-xl" style={{ animation: 'bounce-idle 3s infinite ease-in-out' }}>
                            🫧
                        </div>
                        <h3 className="relative z-10 text-3xl font-black text-white mb-2 drop-shadow-md">Play Game</h3>
                        <p className="relative z-10 text-blue-50 font-medium text-center">Start popping bubbles!</p>
                    </button>

                    <div className="w-full sm:w-80 h-[380px] rounded-[3rem] bg-white/20 dark:bg-slate-900/40 backdrop-blur-md border border-white/40 shadow-2xl p-6 flex flex-col justify-center">
                        <h3 className="text-2xl font-black text-white mb-4 text-center drop-shadow-md">Choose Theme</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'theme-sky', name: 'Sky', icon: '☁️' },
                                { id: 'theme-ocean', name: 'Ocean', icon: '🌊' },
                                { id: 'theme-space', name: 'Space', icon: '🚀' },
                                { id: 'theme-jungle', name: 'Jungle', icon: '🌴' },
                                { id: 'theme-sunset', name: 'Sunset', icon: '🌅' }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedTheme(t.id)}
                                    className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all shadow-sm font-bold text-sm ${selectedTheme === t.id ? 'bg-white text-blue-600 border-2 border-blue-400 scale-105' : 'bg-white/20 text-white border-2 border-transparent hover:bg-white/30'}`}
                                >
                                    <span className="text-2xl">{t.icon}</span>
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <button onClick={() => setScreen('study')} className="group relative w-full sm:w-80 h-[380px] rounded-[3rem] bg-white/20 dark:bg-slate-900/40 backdrop-blur-md border border-white/40 shadow-2xl overflow-hidden transition-all duration-500 hover:scale-105 hover:bg-white/30 hover:-translate-y-2 cursor-pointer flex flex-col items-center justify-center p-8">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 dark:to-black/20 pointer-events-none"></div>
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-400/30 rounded-full blur-2xl group-hover:bg-purple-400/50 transition-colors"></div>
                        
                        <div className="relative z-10 text-8xl mb-6 transform group-hover:scale-110 transition-transform duration-500 drop-shadow-xl" style={{ animation: 'bounce-idle 3.5s infinite ease-in-out' }}>
                            📖
                        </div>
                        <h3 className="relative z-10 text-3xl font-black text-white mb-2 drop-shadow-md">Study Mode</h3>
                        <p className="relative z-10 text-purple-50 font-medium text-center">Review cards & answers!</p>
                    </button>

                </div>
                </div>
                
                <div className="flex flex-wrap justify-center gap-4 mt-12 relative z-10">
                  <button onClick={() => onViewChange('games')} className="px-8 py-4 rounded-full bg-white/20 backdrop-blur-md shadow-lg hover:bg-white/30 text-xl font-bold text-white border border-white/40 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                    <ArrowLeft size={24} /> Back to Games
                  </button>
                </div>
        </div>
      )}

      {screen === 'study' && (
        <div 
            className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-slate-900 overflow-hidden cursor-pointer select-none" 
            id="study-container"
            onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                const totalCount = activeGame.mode === 'multiple-choice' ? (activeGame.questions?.length || 1) : (activeGame.sentences.length || 1);
                setStudyIndex(Math.min(totalCount - 1, studyIndex + 1));
            }}
            tabIndex={0}
            onKeyDown={(e) => {
                const totalCount = activeGame.mode === 'multiple-choice' ? (activeGame.questions?.length || 1) : (activeGame.sentences.length || 1);
                if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
                    setStudyIndex(Math.min(totalCount - 1, studyIndex + 1));
                } else if (e.key === 'ArrowLeft') {
                    setStudyIndex(Math.max(0, studyIndex - 1));
                }
            }}
            ref={el => {
                if (el) el.focus();
            }}
        >
            <div className="absolute top-4 left-4 z-20">
                <button 
                    onClick={(e) => { e.stopPropagation(); setScreen('setup'); }}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full shadow-sm text-slate-600 dark:text-slate-300 font-bold transition-colors cursor-pointer"
                >
                    <ArrowLeft size={24} /> Back
                </button>
            </div>
            <div className="absolute top-4 right-4 z-20 text-slate-600 [&>button]:bg-slate-100 [&>button]:hover:bg-slate-200">
                <FullscreenButton targetId="study-container" />
            </div>

            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-slate-500 dark:text-slate-300 font-bold text-xl bg-slate-100 dark:bg-slate-800 px-6 py-2 rounded-full z-10 pointer-events-none">
                {studyIndex + 1} / {activeGame.mode === 'multiple-choice' ? (activeGame.questions?.length || 1) : (activeGame.sentences.length || 1)}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-12 relative w-full h-full">
                {activeGame.mode === 'multiple-choice' ? (
                  activeGame.questions && activeGame.questions.length > 0 ? (
                    <div className="max-w-3xl w-full flex flex-col items-center gap-6 px-4">
                      <span className="text-sm font-extrabold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-4 py-1.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                        Question {studyIndex + 1}
                      </span>
                      <h2 className="text-3xl sm:text-5xl font-black text-slate-800 dark:text-white text-center tracking-tight leading-tight">
                        {activeGame.questions[studyIndex]?.text}
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-4">
                        {activeGame.questions[studyIndex]?.options.map((opt, oIdx) => {
                          const isCorrect = (activeGame.questions![studyIndex]?.answerIndex === oIdx);
                          return (
                            <div 
                              key={oIdx}
                              className={`p-4 rounded-2xl flex items-center gap-3 font-bold border-2 transition-all ${isCorrect ? 'bg-green-500/10 border-green-500 text-green-700 dark:text-green-300 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                            >
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${isCorrect ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                {isCorrect ? '✓' : String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="flex-1 text-base sm:text-lg">{opt || `(Option ${oIdx + 1})`}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-3xl font-bold pointer-events-none">No questions to study!</div>
                  )
                ) : (
                  activeGame.sentences.length > 0 ? (
                      <h1 className="text-[12vw] sm:text-[10vw] font-black text-slate-800 dark:text-white tracking-tight leading-[1.1] text-center max-w-full break-words drop-shadow-sm pointer-events-none w-full px-8">
                          {activeGame.sentences[studyIndex]?.text}
                      </h1>
                  ) : (
                      <div className="text-slate-500 text-3xl font-bold pointer-events-none">No words/sentences to study!</div>
                  )
                )}
            </div>
            
            {/* Visual hint for interaction */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none opacity-40">
                <p className="text-slate-400 font-medium tracking-wide">Click anywhere or use ← → arrows to navigate</p>
            </div>
        </div>
      )}

      {screen === 'game' && (
        <div className="absolute inset-0 z-50 flex flex-col bg-white" id="game-container">
            <div className="absolute top-4 right-4 z-10">
                <FullscreenButton targetId="game-container" />
            </div>

            <iframe 
                ref={iframeRef}
                src="/bubble-sentence.html" 
                className="w-full h-full border-0"
                title="Bubble Island"
                onLoad={() => {
                  if (iframeRef.current?.contentWindow) {
                      const payloadItems = activeGame.mode === 'multiple-choice'
                        ? (activeGame.questions && activeGame.questions.length > 0 ? activeGame.questions : activeGame.sentences)
                        : activeGame.sentences;
                      iframeRef.current.contentWindow.postMessage({
                          type: 'LOAD_GAME',
                          data: { 
                            ...activeGame, 
                            sentences: payloadItems,
                            customSentences: payloadItems,
                            customQuestions: activeGame.questions || [],
                            theme: selectedTheme 
                          }
                      }, '*');
                  }
                }}
            />
        </div>
      )}
    </div>
  );
}

function parsePastedSentences(rawText: string, mode: 'word' | 'anagram' | 'multiple-choice' = 'word'): string[] {
  if (!rawText || !rawText.trim()) return [];

  const text = rawText.trim();
  let items: string[] = [];

  // 1. Check if text contains explicit newlines
  if (text.includes('\n') || text.includes('\r')) {
    items = text.split(/\r?\n/);
  }
  // 2. Check if numbered list on a single or unformatted line
  else if (/(?:^|\s+)(?:\d+[\.\)\:\-]|\[\d+\])\s+/.test(text)) {
    const splitByNumbers = text.split(/(?:^|\s+)(?:\d+[\.\)\:\-]|\[\d+\])\s+/).filter(Boolean);
    if (splitByNumbers.length > 1) {
      items = splitByNumbers;
    }
  }

  // 3. If still 1 item, evaluate mode and delimiters
  if (items.length <= 1) {
    if (mode === 'anagram') {
      if (text.includes(',') || text.includes(';') || text.includes('\t')) {
        items = text.split(/[,;\t]/);
      }
    } else {
      if (text.includes(';') || text.includes('\t')) {
        items = text.split(/[;\t]/);
      } else {
        const sentenceMatches = text.match(/[^.!?]+[.!?]+(?=(?:\s+[A-Z0-9"'])|$)|[^.!?]+$/g);
        if (sentenceMatches && sentenceMatches.length > 1) {
          items = sentenceMatches;
        }
      }
    }
  }

  // Clean each item: remove leading numberings/bullets, trim extra whitespace
  const cleaned = (items.length > 0 ? items : [text])
    .map(item => {
      let s = item.trim();
      s = s.replace(/^(?:\d+[\.\)\:\-]\s*|\[\d+\]\s*|[\-\*\•\–\—\>]\s*)+/g, '').trim();
      return s;
    })
    .filter(s => s.length > 0);

  return cleaned;
}

function parsePastedQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const items: Partial<Question>[] = [];
  
  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim());
    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length > 0) {
        items.push({
          text: parts[0],
          options: [
            parts[1] || "",
            parts[2] || "",
            parts[3] || "",
            parts[4] || ""
          ],
          answerIndex: 0
        });
      }
    });
    if (items.length > 0) {
      items.forEach(q => {
         if (q.options) {
            while (q.options.length > 2 && q.options[q.options.length - 1] === "") {
                q.options.pop();
            }
         }
      });
      return items;
    }
  }
  
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let currentQ: Partial<Question> | null = null;
  const optionRegex = /^([a-eA-E1-4])[\.\)\:\-]\s+(.*)/;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    const ansMatch = line.match(/^answer\s*[:=]?\s*([a-eA-E1-4])/i);
    if (ansMatch) {
       if (currentQ) {
          const val = ansMatch[1].toUpperCase();
          if (/[A-E]/.test(val)) currentQ.answerIndex = val.charCodeAt(0) - 65;
          else if (/[1-4]/.test(val)) currentQ.answerIndex = parseInt(val) - 1;
       }
       continue;
    }

    let inlineAnswerMatch = line.match(/\banswer\s*[:=]?\s*([a-eA-E1-4])\b/i);
    let inlineAnswerIndex = -1;
    if (inlineAnswerMatch) {
       const val = inlineAnswerMatch[1].toUpperCase();
       if (/[A-E]/.test(val)) inlineAnswerIndex = val.charCodeAt(0) - 65;
       else if (/[1-4]/.test(val)) inlineAnswerIndex = parseInt(val) - 1;
       line = line.replace(inlineAnswerMatch[0], '').trim();
    }
    
    if (line === '') continue;
    
    const optMatch = line.match(optionRegex);
    if (optMatch) {
       if (!currentQ) {
          currentQ = { text: "Question", options: ["", "", "", ""], answerIndex: 0 };
          items.push(currentQ);
       }
       
       const optText = optMatch[2].trim();
       const prefix = optMatch[1].toUpperCase();
       let expectedIndex = -1;
       if (/[A-E]/.test(prefix)) expectedIndex = prefix.charCodeAt(0) - 65;
       else if (/[1-4]/.test(prefix)) expectedIndex = parseInt(prefix) - 1;
       
       if (expectedIndex >= 0 && expectedIndex < 4) {
           currentQ.options![expectedIndex] = optText;
       } else {
           const emptyIdx = currentQ.options!.findIndex(o => o === "");
           if (emptyIdx !== -1) currentQ.options![emptyIdx] = optText;
       }
       
       if (inlineAnswerIndex !== -1) {
           currentQ.answerIndex = inlineAnswerIndex;
       }
    } else {
       const hasOptions = currentQ && currentQ.options!.some(o => o !== "");
       const qText = line.replace(/^(?:\d+[\.\)\:\-]|\[\d+\])\s+/, "");
       
       if (!currentQ || hasOptions) {
           currentQ = { text: qText, options: ["", "", "", ""], answerIndex: 0 };
           items.push(currentQ);
           if (inlineAnswerIndex !== -1) {
               currentQ.answerIndex = inlineAnswerIndex;
           }
       } else {
           currentQ.text += " " + qText;
           if (inlineAnswerIndex !== -1) {
               currentQ.answerIndex = inlineAnswerIndex;
           }
       }
    }
  }
  
  return items;
}

function GameEditor({ 
  game, 
  onSave, 
  onCancel, 
  folders, 
  onUpdate 
}: { 
  game: GameData, 
  onSave: (g: GameData) => void, 
  onCancel: () => void, 
  folders: { id: string; name: string }[],
  onUpdate?: (g: GameData) => void
}) {
  const [folderId, setFolderId] = useState(game.folderId || "");
  const [topic, setTopic] = useState(game.topic || "");
  const [classLevel, setClassLevel] = useState(game.classLevel || "");
  const [mode, setMode] = useState<'word' | 'anagram' | 'multiple-choice'>(game.mode || 'word');
  
  // Sentences state for Words and Anagram modes
  const [sentences, setSentences] = useState<Sentence[]>(() => {
    if (game.sentences && game.sentences.length > 0) return game.sentences;
    return [{ id: Date.now(), text: '', emoji: '✨', diff: 1 }];
  });

  // Multiple Choice Questions state (Bubble Pop style)
  const [questions, setQuestions] = useState<Question[]>(() => {
    if (game.questions && game.questions.length > 0) return game.questions;
    if (game.sentences && game.sentences.length > 0 && game.mode === 'multiple-choice') {
      return game.sentences.map((s: any, i) => ({
        id: s.id || Date.now() + i,
        text: s.text || "",
        options: s.options || ["", "", "", ""],
        answerIndex: typeof s.answerIndex === 'number' ? s.answerIndex : 0
      }));
    }
    return [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }];
  });

  // Sync state to parent so that switching to Play Mode is always updated
  useEffect(() => {
    if (onUpdate) {
      onUpdate({
        ...game,
        folderId,
        topic,
        classLevel,
        mode,
        sentences,
        questions,
      });
    }
  }, [folderId, topic, classLevel, mode, sentences, questions]);

  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string, optIndex: number } | null>(null);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const handleModeChange = (newMode: 'word' | 'anagram' | 'multiple-choice') => {
    setMode(newMode);
    if (newMode === 'multiple-choice') {
      // If questions has only 1 blank item and sentences has content, initialize questions from sentences
      if (questions.length === 1 && !questions[0].text.trim() && sentences.some(s => s.text.trim())) {
        const generatedQs: Question[] = sentences.filter(s => s.text.trim()).map((s, i) => ({
          id: Date.now() + i,
          text: s.text,
          options: ['', '', '', ''],
          answerIndex: 0
        }));
        if (generatedQs.length > 0) {
          setQuestions(generatedQs);
        }
      }
    } else {
      // If switching to word or anagram, and sentences has only 1 blank item while questions has text, initialize sentences from questions
      if (sentences.length === 1 && !sentences[0].text.trim() && questions.some(q => q.text.trim())) {
        const generatedSents: Sentence[] = questions.filter(q => q.text.trim()).map((q, i) => ({
          id: Date.now() + i,
          text: q.text,
          emoji: '✨',
          diff: 1
        }));
        if (generatedSents.length > 0) {
          setSentences(generatedSents);
        }
      }
    }
  };

  // --- Sentences Handlers (Words & Anagram) ---
  const addSentence = () => {
    setSentences([...sentences, { id: Date.now(), text: '', emoji: '✨', diff: 1 }]);
  };

  const updateSentence = (id: number | string, field: keyof Sentence, value: any) => {
    setSentences(sentences.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeSentence = (id: number | string) => {
    setSentences(prev => {
      if (prev.length > 1) {
        return prev.filter(s => s.id !== id);
      }
      return prev;
    });
  };

  const handleSentenceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === sentences.length - 1) {
        addSentence();
        setTimeout(() => {
          const nextInput = document.getElementById(`sentence-input-${index + 1}`);
          nextInput?.focus();
        }, 50);
      } else {
        const nextInput = document.getElementById(`sentence-input-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleSentencePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const parsedItems = parsePastedSentences(pastedText, mode);

    if (parsedItems.length > 1) {
      e.preventDefault();
      
      const newItems: Sentence[] = parsedItems.map((text, i) => ({
        id: Date.now() + i + Math.random(),
        text,
        emoji: '✨',
        diff: 1,
      }));

      setSentences(prev => {
        const updated = [...prev];
        const current = updated[index];

        if (current && !current.text.trim()) {
          updated.splice(index, 1, ...newItems);
        } else {
          updated.splice(index + 1, 0, ...newItems);
        }
        return updated;
      });

      setToastMsg(`✨ Automatically divided into ${parsedItems.length} numbered ${mode === 'anagram' ? 'words' : 'sentences'}!`);
      setTimeout(() => setToastMsg(""), 3500);

      setTimeout(() => {
        const targetIdx = index + parsedItems.length - (sentences[index]?.text.trim() ? 0 : 1);
        const targetInput = document.getElementById(`sentence-input-${targetIdx}`);
        targetInput?.focus();
      }, 80);
    } else if (parsedItems.length === 1 && parsedItems[0] !== pastedText) {
      e.preventDefault();
      updateSentence(sentences[index].id, 'text', parsedItems[0]);
    }
  };

  // --- Multiple Choice Handlers (Bubble Pop style) ---
  const addQuestion = () => {
    setQuestions([...questions, { id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }]);
  };

  const updateQuestion = (id: number | string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOption = (qId: number | string, optIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const addOption = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options.length < 6) {
        return { ...q, options: [...q.options, ''] };
      }
      return q;
    }));
  };

  const removeOption = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options.length > 2) {
        const newOptions = [...q.options];
        newOptions.pop();
        const newAnswerIndex = q.answerIndex >= newOptions.length ? newOptions.length - 1 : q.answerIndex;
        return { ...q, options: newOptions, answerIndex: newAnswerIndex };
      }
      return q;
    }));
  };

  const removeQuestion = (id: number | string) => {
    setQuestions(prev => {
      if (prev.length > 1) {
        return prev.filter(q => q.id !== id);
      }
      return prev;
    });
  };

  const duplicateQuestion = (index: number) => {
    setQuestions(prev => {
      const newQuestions = [...prev];
      const qToCopy = prev[index];
      const duplicatedQ: Question = {
        ...qToCopy,
        id: Date.now() + Math.random(),
        options: [...qToCopy.options]
      };
      newQuestions.splice(index + 1, 0, duplicatedQ);
      return newQuestions;
    });
  };

  const handleQuestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === questions.length - 1) {
        addQuestion();
        setTimeout(() => {
          const nextInput = document.getElementById(`question-input-${index + 1}`);
          nextInput?.focus();
        }, 50);
      } else {
        const nextInput = document.getElementById(`question-input-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleQuestionPaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const parsedItems = parsePastedQuiz(pastedText);
    if (parsedItems.length === 1 && parsedItems[0].text === pastedText && parsedItems[0].options?.every(o => !o)) {
      return;
    }

    if (parsedItems.length > 0) {
      e.preventDefault();
      const newItems: Question[] = parsedItems.map((item, i) => ({
        id: Date.now() + i + Math.random(),
        text: item.text || "",
        options: item.options || ["", "", "", ""],
        answerIndex: item.answerIndex || 0,
      }));

      setQuestions(prev => {
        const updated = [...prev];
        const current = updated[index];
        if (current && !current.text.trim()) {
          updated.splice(index, 1, ...newItems);
        } else {
          updated.splice(index + 1, 0, ...newItems);
        }
        return updated;
      });

      setToastMsg(`✨ Automatically divided into ${parsedItems.length} questions!`);
      setTimeout(() => setToastMsg(""), 3500);

      setTimeout(() => {
        const targetIdx = index + parsedItems.length - (questions[index]?.text.trim() ? 0 : 1);
        const targetInput = document.getElementById(`question-input-${targetIdx}`);
        targetInput?.focus();
      }, 80);
    }
  };

  // --- Bulk Paste Application ---
  const handleApplyBulkPaste = (action: 'replace' | 'append') => {
    if (mode === 'multiple-choice') {
      const parsed = parsePastedQuiz(bulkText);
      if (parsed.length === 0) {
        setErrorMsg("Please enter or paste at least one item.");
        setTimeout(() => setErrorMsg(""), 3000);
        return;
      }
      const newItems: Question[] = parsed.map((item, i) => ({
        id: Date.now() + i + Math.random(),
        text: item.text || "",
        options: item.options || ["", "", "", ""],
        answerIndex: item.answerIndex || 0,
      }));

      if (action === 'replace') {
        setQuestions(newItems);
      } else {
        setQuestions(prev => {
          if (prev.length === 1 && !prev[0].text.trim()) return newItems;
          return [...prev, ...newItems];
        });
      }
      setToastMsg(`✨ Added ${parsed.length} questions!`);
    } else {
      const parsed = parsePastedSentences(bulkText, mode);
      if (parsed.length === 0) {
        setErrorMsg("Please enter or paste at least one item.");
        setTimeout(() => setErrorMsg(""), 3000);
        return;
      }

      const newItems: Sentence[] = parsed.map((text, i) => ({
        id: Date.now() + i + Math.random(),
        text,
        emoji: '✨',
        diff: 1,
      }));

      if (action === 'replace') {
        setSentences(newItems);
      } else {
        setSentences(prev => {
          if (prev.length === 1 && !prev[0].text.trim()) return newItems;
          return [...prev, ...newItems];
        });
      }
      setToastMsg(`✨ Added ${parsed.length} numbered ${mode === 'anagram' ? 'words' : 'sentences'}!`);
    }

    setTimeout(() => setToastMsg(""), 3500);
    setShowBulkPasteModal(false);
    setBulkText("");
  };

  const initiateSave = () => {
    if (mode === 'multiple-choice') {
      const validQuestions = questions.filter(q => q.text.trim());
      if (validQuestions.length === 0) {
        setErrorMsg("Please add at least one complete question.");
        setTimeout(() => setErrorMsg(""), 3000);
        return;
      }
    } else {
      const validSentences = sentences.filter(s => s.text.trim());
      if (validSentences.length === 0) {
        setErrorMsg(`Please add at least one complete ${mode === 'anagram' ? 'word/phrase' : 'sentence'}.`);
        setTimeout(() => setErrorMsg(""), 3000);
        return;
      }
    }
    setShowPublishModal(true);
  };

  const handleSave = (isPublic: boolean) => {
    const generatedTitle = "Bubble Island Game";
    
    if (mode === 'multiple-choice') {
      const validQuestions = questions.filter(q => q.text.trim());
      const mappedSentences: Sentence[] = validQuestions.map((q, i) => ({
        id: q.id,
        text: q.text,
        options: q.options || ['', '', '', ''],
        answerIndex: q.answerIndex || 0,
        emoji: '✨',
        diff: 1,
      }));
      onSave({
        ...game,
        title: generatedTitle,
        folderId,
        topic,
        classLevel,
        sentences: mappedSentences,
        questions: validQuestions,
        mode,
        isPublic
      });
    } else {
      const validSentences = sentences.filter(s => s.text.trim());
      const mappedQuestions: Question[] = validSentences.map((s, i) => ({
        id: s.id,
        text: s.text,
        options: ['', '', '', ''],
        answerIndex: 0
      }));
      onSave({
        ...game,
        title: generatedTitle,
        folderId,
        topic,
        classLevel,
        sentences: validSentences,
        questions: mappedQuestions,
        mode,
        isPublic
      });
    }
  };

  const previewItemsCount = mode === 'multiple-choice' 
    ? parsePastedQuiz(bulkText).length 
    : parsePastedSentences(bulkText, mode).length;

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar pt-20">
      <div className="w-full min-h-full flex flex-col items-center pb-8 px-4">
      <div className="w-full max-w-4xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8 border border-white/20 dark:border-white/10">
        
        {/* Bulk Paste Modal */}
        {showBulkPasteModal && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 transform scale-100 animate-in fade-in zoom-in-95 duration-150 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold">
                    <ClipboardList size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                        Bulk Paste & Auto-Divide
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {mode === 'multiple-choice' 
                        ? "Paste multiple questions, numbered lists with options & answer (e.g. Answer: B), or tabular TSV data."
                        : "Paste multiple sentences, numbered lists, or words. They will be divided into separate numbers."}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowBulkPasteModal(false); setBulkText(""); }}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {mode === 'multiple-choice'
                    ? "Paste Text Below (Supports multi-line Q&A format or Excel copy)"
                    : `Paste Text Below (${mode === 'anagram' ? 'Words, Comma-Separated, or Numbered' : 'Multi-line Sentences or Numbered List'})`}
                </label>
                <textarea 
                  rows={7}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={mode === 'multiple-choice'
                    ? "Example:\n1. What is the capital of France?\na) London\nb) Paris\nc) Berlin\nd) Madrid\nAnswer: B\n\nOr paste tabular data directly from Excel!"
                    : mode === 'anagram' 
                      ? "Example:\n1. Apple\n2. Banana\n3. Orange\n\nOr: Cat, Dog, Elephant, Lion"
                      : "Example:\n1. The sun rises in the east.\n2. We love learning English.\n3. Practice makes perfect."
                  }
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white p-4 rounded-2xl focus:border-cyan-500 transition-colors custom-scrollbar"
                />
              </div>

              {bulkText.trim() && (
                <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-cyan-500 mt-0.5"><Info size={16} /></div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Found <span className="font-bold text-slate-800 dark:text-white">{previewItemsCount}</span> items. 
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <button
                  onClick={() => handleApplyBulkPaste('replace')}
                  disabled={previewItemsCount === 0}
                  className="flex-1 py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check size={18} /> Replace All List ({previewItemsCount})
                </button>
                <button
                  onClick={() => handleApplyBulkPaste('append')}
                  disabled={previewItemsCount === 0}
                  className="flex-1 py-3.5 px-4 rounded-xl font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Append to List ({previewItemsCount})
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Video Guide Modal */}
        <BulkPasteVideoModal
          isOpen={showVideoGuide}
          onClose={() => setShowVideoGuide(false)}
          onOpenBulkPasteWithSample={(sample) => {
            setBulkText(sample);
            setShowBulkPasteModal(true);
          }}
        />

        {/* Media Picker Modal */}
        <MediaPickerModal 
          isOpen={activeGiphyInput !== null}
          onClose={() => setActiveGiphyInput(null)}
          onSelect={(url) => {
            if (activeGiphyInput) {
              updateOption(activeGiphyInput.qId, activeGiphyInput.optIndex, url);
              setActiveGiphyInput(null);
            }
          }}
        />

        {showPublishModal && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div 
              className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 transform scale-100 animate-in fade-in zoom-in-95 duration-150 border border-slate-100 dark:border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-black text-slate-800 dark:text-white text-center">Publish Game?</h3>
              <p className="text-slate-600 dark:text-slate-300 text-center font-medium">
                Would you like to publish this game to the Community so other teachers can use it?
              </p>
              <div className="flex flex-col gap-3 mt-4">
                <button 
                  onClick={() => handleSave(true)}
                  className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  Yes, Publish (Public)
                </button>
                <button 
                  onClick={() => handleSave(false)}
                  className="w-full py-4 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-lg transition-colors cursor-pointer"
                >
                  No, Keep Private
                </button>
              </div>
              <button 
                onClick={() => setShowPublishModal(false)}
                className="mt-2 text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}

        <div className="bg-white dark:bg-slate-800 p-8 flex flex-col gap-6 border-b-2 border-cyan-500/50">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">GAME SETUP</h2>
                <div className="flex gap-3 items-center">
                    <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button onClick={initiateSave} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer">
                        <Save size={18} /> Save Game
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Game Mode</label>
                    <select 
                      value={mode}
                      onChange={(e) => handleModeChange(e.target.value as 'word' | 'anagram' | 'multiple-choice')}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 appearance-none cursor-pointer transition-colors"
                    >
                      <option value="word">Words (Sentences)</option>
                      <option value="anagram">Anagram (Letters)</option>
                      <option value="multiple-choice">Multiple Choices</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Topic</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Present Simple" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Class Level</label>
                    <input 
                      type="text" 
                      placeholder="e.g. KET, Starters" 
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Folder</label>
                    <select 
                      value={folderId}
                      onChange={(e) => setFolderId(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 appearance-none cursor-pointer transition-colors"
                    >
                      <option value="">No Folder (Root)</option>
                      {folders.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                </div>
            </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/20 text-red-400 p-3 mx-6 mt-6 rounded-lg font-medium text-center border border-red-500/30 animate-pulse">
            {errorMsg}
          </div>
        )}

        {toastMsg && (
          <div className="bg-cyan-500/20 text-cyan-500 dark:text-cyan-300 p-3 mx-6 mt-6 rounded-xl font-bold text-center border border-cyan-500/30 animate-in fade-in slide-in-from-top-2 duration-300 flex items-center justify-center gap-2 shadow-sm">
            <Sparkles size={18} /> {toastMsg}
          </div>
        )}

        {/* Dynamic Questions List Setup */}
        <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50">
          
          {mode === 'multiple-choice' ? (
            /* =================== BUBBLE POP STYLE MULTIPLE CHOICE SETUP =================== */
            <>
              {/* Action Bar */}
              <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="font-bold text-sm text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                  Questions ({questions.length})
                </span>
                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                  <button
                    type="button"
                    onClick={() => setShowBulkPasteModal(true)}
                    className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-blue-500/25 flex items-center gap-2.5 cursor-pointer"
                  >
                    <ClipboardList size={22} className="stroke-[2.5]" />
                    <span>Bulk Paste</span>
                  </button>
                </div>
              </div>

              {/* Questions List */}
              {questions.map((q, index) => (
                <div key={q.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group">
                  <button 
                    onClick={() => duplicateQuestion(index)}
                    title="Duplicate Question"
                    className="absolute right-6 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                  >
                    <Copy size={14} />
                  </button>
                  <button 
                    onClick={() => removeQuestion(q.id)}
                    title="Delete Question"
                    className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                  >
                    <Trash2 size={14} />
                  </button>
                  
                  <div className="flex gap-4 mb-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                      {index + 1}
                    </div>
                    <input 
                      id={`question-input-${index}`}
                      type="text"
                      value={q.text}
                      onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                      onKeyDown={(e) => handleQuestionKeyDown(e, index)}
                      onPaste={(e) => handleQuestionPaste(e, index)}
                      placeholder="Type your question here..."
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-slate-800 dark:text-white font-medium"
                    />
                  </div>

                  <div className="ml-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {q.options.map((opt, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name={`answer-${q.id}`} 
                          checked={q.answerIndex === optIndex}
                          onChange={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                          className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer"
                        />
                        {opt.startsWith('data:image') || opt.startsWith('http') ? (
                          <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 pr-3">
                            <img src={opt} alt="Option" className="w-8 h-8 rounded object-cover" />
                            <span className="text-xs text-slate-400 flex-1 truncate">Image/GIF</span>
                            <button onClick={() => updateOption(q.id, optIndex, '')} className="text-red-400 hover:text-red-300 cursor-pointer p-1">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center gap-2">
                            <input 
                              type="text"
                              value={opt}
                              onChange={(e) => updateOption(q.id, optIndex, e.target.value)}
                              placeholder={`Option ${optIndex + 1}`}
                              className={`flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border ${q.answerIndex === optIndex ? 'border-blue-500/50 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'} rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium`}
                            />
                            <button 
                              onClick={() => setActiveGiphyInput({ qId: q.id, optIndex })}
                              className="bg-purple-500/20 text-purple-400 p-2 rounded-lg hover:bg-purple-500 hover:text-white transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                              title="Search Giphy"
                            >
                              <ImageIcon size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="ml-12 mt-3 flex items-center gap-2">
                    {q.options.length < 6 && (
                      <button 
                        type="button"
                        onClick={() => addOption(q.id)}
                        className="text-xs font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
                      >
                        <Plus size={14} /> Add Option
                      </button>
                    )}
                    {q.options.length > 2 && (
                      <button 
                        type="button"
                        onClick={() => removeOption(q.id)}
                        className="text-xs font-bold text-slate-500 hover:text-red-500 dark:text-slate-400 flex items-center gap-1 cursor-pointer bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        <Trash2 size={14} /> Remove Option
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={addQuestion}
                  className="flex-1 py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={20} /> Add Another Question
                </button>
                <button 
                  onClick={() => setShowBulkPasteModal(true)}
                  className="sm:w-64 py-4 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-2xl text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-slate-700/80 hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <ClipboardList size={20} /> Paste Multiple List
                </button>
              </div>
            </>
          ) : (
            /* =================== WORDS / ANAGRAM QUESTIONS LIST SETUP =================== */
            <>
              {/* Smart Tip Bar */}
              <div className="bg-cyan-500/10 dark:bg-cyan-950/30 border border-cyan-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-cyan-900 dark:text-cyan-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 font-bold">
                    <Info size={18} />
                  </div>
                  <p className="text-xs sm:text-sm font-medium">
                    <span className="font-bold">Smart Paste:</span> Paste multiple lines or numbered lists directly into any box below — they will automatically divide into numbered items!
                  </p>
                </div>
                <button
                  onClick={() => setShowBulkPasteModal(true)}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer self-end sm:self-auto"
                >
                  <ClipboardList size={14} /> Bulk Paste Modal
                </button>
              </div>

              {sentences.map((s, index) => (
                <div key={s.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group transition-all hover:border-cyan-400/50">
                  <button 
                    onClick={() => removeSentence(s.id)}
                    className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                  >
                    <Trash2 size={14} />
                  </button>
                  
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-500 font-bold flex items-center justify-center shrink-0 border border-cyan-500/30">
                      {index + 1}
                    </div>
                    <input 
                      id={`sentence-input-${index}`}
                      type="text"
                      value={s.text}
                      onChange={(e) => updateSentence(s.id, 'text', e.target.value)}
                      onKeyDown={(e) => handleSentenceKeyDown(e, index)}
                      onPaste={(e) => handleSentencePaste(e, index)}
                      placeholder={mode === 'anagram' ? "Type or paste words here..." : "Type or paste your sentences here..."}
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-cyan-500 text-slate-800 dark:text-white font-medium transition-colors"
                    />
                  </div>
                </div>
              ))}
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={addSentence}
                  className="flex-1 py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={20} /> {mode === 'anagram' ? "Add Another Word/Phrase" : "Add Another Sentence"}
                </button>

                <button 
                  onClick={() => setShowBulkPasteModal(true)}
                  className="sm:w-64 py-4 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-2xl text-cyan-600 dark:text-cyan-400 font-bold hover:bg-cyan-50 dark:hover:bg-slate-700/80 hover:border-cyan-300 dark:hover:border-cyan-600 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <ClipboardList size={20} /> Paste Multiple List
                </button>
              </div>
            </>
          )}

        </div>
      </div>
      </div>
    </div>
  );
}
