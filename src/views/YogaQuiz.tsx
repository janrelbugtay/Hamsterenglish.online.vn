import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";

import { MediaPickerModal } from "../components/MediaPickerModal";
import { ChevronLeft, Plus, Edit3, Trash2, Play, Search, Sparkles, Save, X, BookOpen, Clock, Heart, ArrowLeft, Download, Maximize, Minimize, ClipboardList, Info, Copy, Image as ImageIcon, Settings, User, Pencil, Shuffle } from 'lucide-react';
import Papa from 'papaparse';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { playSound } from '../lib/audio';
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Folder } from "lucide-react";
import { GameModeModal } from "../components/GameModeModal";

interface Question {
  id: number;
  text: string;
  options: string[];
  answerIndex: number;
}

interface Quiz {
  id: number;
  title: string;
  subject: string;
  topic?: string;
  classLevel?: string;
  questions: Question[];
  thumbnail: string;
  isFavorite?: boolean;
  folderId?: string;
  isPublic?: boolean;
}

const initialQuizzes: Quiz[] = [
  {
    id: 1,
    title: "Question Tags (Present & Past)",
    subject: "Grammar",
    topic: "Question Tags",
    classLevel: "KET",
    thumbnail: "📝",
    isFavorite: true,
    questions: [
      { id: 1, text: "He is happy, ____?", options: ["is he?", "isn’t he?", "aren’t they?"], answerIndex: 1 },
      { id: 2, text: "They are playing football, ____?", options: ["are they?", "aren’t they?", "isn’t he?"], answerIndex: 1 },
      { id: 3, text: "She can swim well, ____?", options: ["can’t she?", "can she?", "isn’t she?"], answerIndex: 0 },
      { id: 4, text: "Tom likes apples, ____?", options: ["doesn’t he?", "does he?", "aren’t they?"], answerIndex: 0 },
      { id: 5, text: "You are my friend, ____?", options: ["are you?", "aren’t you?", "doesn’t he?"], answerIndex: 1 },
    ]
  },
  {
    id: 2,
    title: "Simple Past Tense",
    subject: "Grammar",
    thumbnail: "🕰️",
    isFavorite: false,
    questions: [
      { id: 1, text: "Yesterday, I ____ to the park.", options: ["go", "goes", "went"], answerIndex: 2 },
      { id: 2, text: "They ____ pizza for dinner.", options: ["eat", "ate", "eated"], answerIndex: 1 },
      { id: 3, text: "She ____ a beautiful song.", options: ["sings", "sang", "sung"], answerIndex: 1 },
    ]
  },
  {
    id: 3,
    title: "Yoga Vocabulary",
    subject: "Vocabulary",
    thumbnail: "🧘‍♀️",
    isFavorite: true,
    questions: [
      { id: 1, text: "What is the English word for sitting cross-legged in yoga?", options: ["Tree Pose", "Downward Dog", "Lotus Pose"], answerIndex: 2 },
      { id: 2, text: "When you breathe in deeply, you...", options: ["Inhale", "Exhale", "Hold"], answerIndex: 0 },
    ]
  }
];

export function YogaQuiz({ onViewChange, initialGame }: { onViewChange: (view: ViewState, data?: any) => void, initialGame?: any }) {
  const { user } = useAuth();
  const hasLoadedQuestions = Boolean(
    initialGame && (
      (initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
      (initialGame.questions && initialGame.questions.length > 0)
    )
  );
  const [screen, setScreen] = useState<'editor' | 'game'>(initialGame && !initialGame.editMode && hasLoadedQuestions ? 'game' : 'editor');
  const [showModeModal, setShowModeModal] = useState(false);
  
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (initialGame && !initialGame.editMode && hasLoadedQuestions) {
      setScreen('game');
    } else {
      setScreen('editor');
    }
  }, [initialGame, hasLoadedQuestions]);

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

  const handleSaveQuiz = async (quiz: Quiz) => {
    if (!user) return;
    
    try {
      const gameToSave = {
        name: quiz.title || "Yoga Quiz",
        folderId: quiz.folderId || "",
        topic: quiz.topic || "",
        className: quiz.classLevel || "",
        gameType: "yoga-quiz",
        customQuestions: quiz.questions,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
        isPublic: quiz.isPublic ?? false,
      };

      if (initialGame?.id) {
        await updateDoc(doc(db, "mysteryBoxGames", initialGame.id), gameToSave);
      } else {
        await addDoc(collection(db, "mysteryBoxGames"), {
          ...gameToSave,
          createdAt: new Date().toISOString(),
        });
      }
      onViewChange("games");
    } catch (error) {
      console.error("Error saving game:", error);
    }
  };

  const getQuizData = (): Quiz => {
    const fallbackQuestions = [
      { id: 1, text: "Which sentence is grammatically correct?", options: ["She doesn't like apples.", "She don't like apples.", "She not like apples.", "She isn't like apples."], answerIndex: 0 },
      { id: 2, text: "What is the past tense of 'eat'?", options: ["Ate", "Eated", "Eating", "Eats"], answerIndex: 0 },
      { id: 3, text: "Which of these is a fruit?", options: ["Apple", "Carrot", "Potato", "Broccoli"], answerIndex: 0 },
      { id: 4, text: "They ____ to school by bus every day.", options: ["go", "goes", "gone", "going"], answerIndex: 0 },
      { id: 5, text: "Choose the opposite of 'Difficult':", options: ["Easy", "Hard", "Tough", "Heavy"], answerIndex: 0 }
    ];

    if (initialGame && (initialGame.customQuestions || initialGame.questions || initialGame.id)) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : fallbackQuestions);

      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "Yoga Quiz",
        subject: "Grammar",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList,
        thumbnail: "🧘",
        folderId: initialGame.folderId,
        isPublic: initialGame.isPublic,
      };
    }
    return {
        id: Date.now(),
        title: "",
        subject: "Grammar",
        topic: "",
        classLevel: "",
        questions: [{ id: Date.now(), text: "", options: ["", ""], answerIndex: 0 }],
        thumbnail: "🧘",
        folderId: "",
        isPublic: false
    };
  };

  const currentQuizData = getQuizData();

  if (screen === 'editor') {
    return <QuizEditor quiz={currentQuizData} onSave={handleSaveQuiz} onCancel={() => onViewChange("games")} folders={folders} />;
  }

  return (
    <div id="game-container" className="h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] w-full -m-4 md:-m-8 bg-[#ccfbf1] text-slate-900 flex flex-col font-sans overflow-hidden relative selection:bg-teal-500/30 rounded-xl" 
         style={{ margin: '-1rem', height: 'calc(100% + 2rem)', backgroundImage: 'radial-gradient(#99f6e4 2px, transparent 2px)', backgroundSize: '40px 40px' }}>
      
      <style>{`
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes popIn {
            0% { transform: scale(0.9); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop-in {
            animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(20, 184, 166, 0.2); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(20, 184, 166, 0.4); }
      `}</style>

      <YogaGame 
        quiz={currentQuizData} 
        onBack={() => onViewChange("games")} 
        onSwitchMode={() => setShowModeModal(true)}
      />

      {/* 3-Mode Selection Modal */}
      <GameModeModal
        isOpen={showModeModal}
        gameData={{
          id: currentQuizData.id,
          name: currentQuizData.title,
          topic: currentQuizData.topic,
          className: currentQuizData.classLevel,
          gameType: 'yoga-quiz',
          customQuestions: currentQuizData.questions || []
        }}
        onClose={() => setShowModeModal(false)}
        onSelectMode={(mode, adaptedData) => {
          onViewChange(mode as ViewState, adaptedData);
        }}
      />
    </div>
  );
}

// --- Components ---

function QuizEditor({ quiz, onSave, onCancel, folders }: { quiz: Quiz, onSave: (q: Quiz) => void, onCancel: () => void, folders: { id: string; name: string }[] }) {
  const [folderId, setFolderId] = useState(quiz.folderId || "");
  const [topic, setTopic] = useState(quiz.topic || "");
  const [classLevel, setClassLevel] = useState(quiz.classLevel || "");
  const [questions, setQuestions] = useState<Question[]>(quiz.questions);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string, optIndex: number } | null>(null);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const handleApplyBulkPaste = (action: 'replace' | 'append') => {
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
        if (prev.length === 1 && !prev[0].text.trim()) {
          return newItems;
        }
        return [...prev, ...newItems];
      });
    }

    setToastMsg(`✨ Added ${parsed.length} questions!`);
    setTimeout(() => setToastMsg(""), 3500);
    setShowBulkPasteModal(false);
    setBulkText("");
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const parsedItems = parsePastedQuiz(pastedText);
    
    // If it's just a single question with no options and it matches exactly, let normal paste handle it
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


  const addQuestion = () => {
    setQuestions([...questions, { id: Date.now(), text: '', options: ['', ''], answerIndex: 0 }]);
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
      const duplicatedQ = {
        ...qToCopy,
        id: Date.now() + Math.random(),
        options: [...qToCopy.options]
      };
      newQuestions.splice(index + 1, 0, duplicatedQ);
      return newQuestions;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
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

  const handleSave = () => {
    const validQuestions = questions.filter(q => q.text.trim());
    if(validQuestions.length === 0) {
      setErrorMsg("Please add at least one complete question.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const confirmSave = (isPublic: boolean) => {
    const generatedTitle = "Yoga Quiz";
    const validQuestions = questions.filter(q => q.text.trim());
    onSave({
      ...quiz,
      title: generatedTitle,
      folderId,
      topic,
      classLevel,
      questions: validQuestions,
      isPublic
    });
    setShowPublishModal(false);
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8">
        <div className="bg-white dark:bg-slate-800/80 p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">GAME SETUP</h2>
                <div className="flex gap-3 items-center">
                    <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer">
                        <Save size={18} /> Save Quiz
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Bulk Paste Modal */}
        {showBulkPasteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 transform scale-100 animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold">
                    <ClipboardList size={22} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                      Bulk Paste & Auto-Divide
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Paste multiple questions, numbered lists with options & answer (e.g. Answer: B), or tabular TSV data.
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
                  Paste Text Below (Supports multi-line Q&A format or Excel copy)
                </label>
                <textarea 
                  rows={7}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"Example:\n1. What is the capital of France?\na) London\nb) Paris\nc) Berlin\nd) Madrid\nAnswer: B\n\nOr paste tabular data directly from Excel!"}
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white p-4 rounded-2xl focus:border-cyan-500 transition-colors custom-scrollbar"
                />
              </div>

              {bulkText.trim() && (
                <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-cyan-500 mt-0.5"><Info size={16} /></div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Found <span className="font-bold text-slate-800 dark:text-white">{parsePastedQuiz(bulkText).length}</span> items. 
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
        )}

        <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50">
          {/* Smart Tip Bar */}
          <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                <Info size={18} />
              </div>
              <p className="text-xs sm:text-sm font-medium">
                <span className="font-bold">Smart Paste:</span> Paste multiple lines, numbered Q&As, or Excel rows directly into any box below — they will automatically populate!
              </p>
            </div>
            <button
              onClick={() => setShowBulkPasteModal(true)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer self-end sm:self-auto"
            >
              <ClipboardList size={14} /> Bulk Paste Modal
            </button>
          </div>
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
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={(e) => handlePaste(e, index)}
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
                      className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600"
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
              <div className="ml-12 mt-3 flex gap-2">
                  <button onClick={() => addOption(q.id)} disabled={q.options.length >= 6} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer">+ Option</button>
                  <button onClick={() => removeOption(q.id)} disabled={q.options.length <= 2} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer">- Option</button>
              </div>
            </div>
          ))}

          <button 
            onClick={addQuestion}
            className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={20} /> Add Another Question
          </button>
        </div>
      </div>
      </div>
      
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
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center transform scale-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Publish Game?</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium">Would you like to publish this game to the Community so other teachers can use it?</p>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => confirmSave(true)}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer text-lg"
              >
                Yes, Publish (Public)
              </button>
              <button 
                onClick={() => confirmSave(false)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer text-lg"
              >
                No, Keep Private
              </button>
              <button 
                onClick={() => setShowPublishModal(false)}
                className="w-full py-2 mt-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
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
    if (items.length > 0) return items;
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

  const allEmptyOptions = items.every(q => q.options!.every(o => o === ""));
  if (allEmptyOptions && items.length > 0) {
     return items; 
  }

  return items;
}


const fallbackEmojis = ['🧘', '🙆', '🧎', '🧍', '🚶', '🏃', '🤸'];
const AVAILABLE_POSES = [
    ...fallbackEmojis.map(e => ({ type: 'emoji', value: e }))
];

function YogaGame({ quiz, onBack, onSwitchMode }: { quiz: Quiz, onBack: () => void, onSwitchMode?: () => void }) {
    const [gameState, setGameState] = useState<'start' | 'playing' | 'end'>('start');
    const [activePoses, setActivePoses] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('yogaActivePoses_v3');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate that all saved poses actually exist
                const validPoses = parsed.filter((p: string) => AVAILABLE_POSES.some(ap => ap.value === p));
                if (validPoses.length > 0) return validPoses;
            }
        } catch(e) {}
        return AVAILABLE_POSES.map(p => p.value); // Select all by default
    });

    useEffect(() => {
        localStorage.setItem('yogaActivePoses_v3', JSON.stringify(activePoses));
    }, [activePoses]);

    const togglePose = (val: string) => {
        setActivePoses(prev => {
            if (prev.includes(val)) {
                if (prev.length <= 1) return prev; // prevent deselecting all
                return prev.filter(p => p !== val);
            }
            return [...prev, val];
        });
    };
    const [showSettings, setShowSettings] = useState(false);
    const [uiScale, setUiScale] = useState<'small' | 'medium' | 'big'>('medium');
    const [autoAdvanceDelay, setAutoAdvanceDelay] = useState<'manual' | 3 | 5 | 10>(3);
    const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [teams, setTeams] = useState([
        { id: '1', name: 'Player 1', score: 0, colorIdx: 0 }
    ]);

    const teamColors = [
        { bg: 'bg-blue-500', border: 'border-blue-600', borderLight: 'border-blue-200', text: 'text-blue-600' },
        { bg: 'bg-rose-500', border: 'border-rose-600', borderLight: 'border-rose-200', text: 'text-rose-600' },
        { bg: 'bg-green-500', border: 'border-green-600', borderLight: 'border-green-200', text: 'text-green-600' },
        { bg: 'bg-purple-500', border: 'border-purple-600', borderLight: 'border-purple-200', text: 'text-purple-600' },
        { bg: 'bg-orange-500', border: 'border-orange-600', borderLight: 'border-orange-200', text: 'text-orange-600' },
        { bg: 'bg-cyan-500', border: 'border-cyan-600', borderLight: 'border-cyan-200', text: 'text-cyan-600' }
    ];

    const addTeam = () => {
        const newId = Date.now().toString();
        setTeams([...teams, { id: newId, name: `Player ${teams.length + 1}`, score: 0, colorIdx: teams.length % teamColors.length }]);
    };

    const updateTeamScore = (id: string, delta: number) => {
        setTeams(teams.map(t => t.id === id ? { ...t, score: Math.max(0, t.score + delta) } : t));
    };

    const [isAnswering, setIsAnswering] = useState(false);
    const [shuffledOptions, setShuffledOptions] = useState<{text: string, isCorrect: boolean, poseIndex: number}[]>([]);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [timer, setTimer] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const { width, height } = useWindowSize();

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    let questionTextClass = "text-3xl md:text-4xl xl:text-5xl";
    let optionTextClass = "text-base md:text-xl xl:text-2xl";
    let playerTextClass = "text-lg md:text-xl";
    let optionEmojiClass = "text-[3rem] sm:text-[4rem] md:text-[5rem] lg:text-[6rem]";

    if (uiScale === 'small') {
        questionTextClass = "text-2xl md:text-4xl xl:text-5xl";
        optionTextClass = "text-base md:text-xl xl:text-2xl";
        playerTextClass = "text-base md:text-lg";
        optionEmojiClass = "text-[2rem] sm:text-[3rem] md:text-[4rem] lg:text-[5rem]";
    } else if (uiScale === 'big') {
        questionTextClass = "text-5xl md:text-6xl xl:text-7xl";
        optionTextClass = "text-xl md:text-3xl xl:text-4xl";
        playerTextClass = "text-2xl md:text-3xl";
        optionEmojiClass = "text-[4rem] sm:text-[5rem] md:text-[6rem] lg:text-[7rem]";
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            const p = document.documentElement.requestFullscreen();
            if (p && p.catch) p.catch(() => {});
        } else {
            document.exitFullscreen();
        }
    };

    const startGame = () => {
        setCurrentIdx(0);
        setTeams(teams.map(t => ({ ...t, score: 0 })));
        setGameState('playing');
        loadQuestion(0);
    };

    const loadQuestion = (idx: number) => {
        setIsAnswering(false);
        setSelectedOption(null);
        
        const currentItem = quiz.questions[idx];
        if (!currentItem) return;

        const rawOptions = Array.isArray(currentItem.options) ? currentItem.options : [];
        let validOpts = rawOptions.filter((opt: any) => typeof opt === 'string' && opt.trim() !== "");
        if (validOpts.length < 2) validOpts = ["Yes", "No"];
        const correctOptText = rawOptions[currentItem.answerIndex] !== undefined ? rawOptions[currentItem.answerIndex] : validOpts[0];

        let opts = validOpts
            .map((opt, i) => ({ 
                text: opt, 
                isCorrect: opt === correctOptText, 
                poseIndex: i % 6 
            }));
        
        // Shuffle the rendering order so the correct answer isn't always in the same visual position
        opts.sort(() => Math.random() - 0.5);
        
        // Assign a sequential pose index based on visual rendering order
        // This guarantees no duplicated poses in the grid (unless there are more options than checked poses)
        setShuffledOptions(opts.map((opt, idx) => ({...opt, poseIndex: idx})));
    };

    const handleAnswer = (index: number, isCorrect: boolean) => {
        if (isAnswering) return;
        setIsAnswering(true);
        setSelectedOption(index);
        
        if (isCorrect) {
            playSound('correct');
            setShowConfetti(true);
        } else {
            playSound('incorrect');
        }

        if (autoAdvanceDelay === 'manual') {
            return;
        }

        let timeLeft = autoAdvanceDelay;
        setTimer(timeLeft);
        
        const countdownInterval = setInterval(() => {
            timeLeft -= 1;
            if (timeLeft > 0) {
                setTimer(timeLeft);
            } else {
                clearInterval(countdownInterval);
                setTimer(null);
                setShowConfetti(false);
                const nextIdx = currentIdx + 1;
                if (nextIdx < quiz.questions.length) {
                    setCurrentIdx(nextIdx);
                    loadQuestion(nextIdx);
                } else {
                    setGameState('end');
                    playSound('win');
                }
            }
        }, 1000);
    };

    const handleNextClick = () => {
        if (!isAnswering) return;
        setTimer(null);
        setShowConfetti(false);
        const nextIdx = currentIdx + 1;
        if (nextIdx < quiz.questions.length) {
            setCurrentIdx(nextIdx);
            loadQuestion(nextIdx);
        } else {
            setGameState('end');
                    playSound('win');
        }
    };

    return (
      <div className={`flex-1 flex items-center justify-center p-2 md:p-6 mx-auto animate-fade-in ${isFullscreen ? 'fixed inset-0 z-50 bg-teal-50 w-full h-full max-w-none' : 'w-full max-w-[1400px]'}`}>
          {showConfetti && <Confetti width={width} height={height} numberOfPieces={300} recycle={false} style={{ position: 'fixed', zIndex: 100, top: 0, left: 0 }} />}
          
          {showSettings && (
              <div className="fixed inset-0 z-[150] flex items-center justify-center bg-teal-900/40 backdrop-blur-md p-4 animate-fade-in">
                  <div className="bg-white rounded-[3rem] p-8 md:p-12 max-w-2xl w-full shadow-2xl relative border-8 border-teal-100 max-h-[90vh] overflow-y-auto">
                      <button onClick={() => setShowSettings(false)} className="absolute top-6 right-8 text-pink-400 hover:text-pink-500 transition-colors cursor-pointer">
                          <X size={48} strokeWidth={4} />
                      </button>
                      <h2 className="text-4xl md:text-5xl font-black text-teal-800 mb-8 tracking-tight">⚙️ Settings</h2>
                      
                      <div className="space-y-8">
                          <div>
                              <label className="block text-teal-700 font-bold mb-4 text-2xl">Interface Scale</label>
                              <div className="flex gap-4">
                                  {(['small', 'medium', 'big'] as const).map((size) => (
                                      <button 
                                          key={size}
                                          onClick={() => setUiScale(size)}
                                          className={`flex-1 py-4 rounded-2xl font-black text-xl md:text-2xl capitalize transition-all border-4 shadow-sm cursor-pointer ${uiScale === size ? 'bg-teal-500 text-white border-teal-600 scale-105' : 'bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-100 hover:scale-105'}`}
                                      >
                                          {size}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          <div>
                              <label className="block text-teal-700 font-bold mb-4 text-2xl">Active Poses</label>
                              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 gap-4">
                                  {AVAILABLE_POSES.map((pose, i) => {
                                      const isSelected = activePoses.includes(pose.value);
                                      return (
                                          <button 
                                              key={i}
                                              onClick={() => togglePose(pose.value)}
                                              className={`aspect-square rounded-2xl flex items-center justify-center border-4 transition-all relative overflow-hidden ${isSelected ? 'border-teal-500 bg-teal-100 scale-105 shadow-md' : 'border-slate-200 bg-slate-50 opacity-60 grayscale hover:grayscale-0 hover:opacity-100'}`}
                                          >
                                              {pose.type === 'emoji' ? (
                                                  <span className="text-4xl drop-shadow-sm">{pose.value}</span>
                                              ) : (
                                                  <img src={pose.value} alt="Pose" className="w-full h-full object-cover rounded-xl" />
                                              )}
                                              {isSelected && (
                                                  <div className="absolute top-1 right-1 bg-teal-500 text-white rounded-full p-0.5">
                                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                  </div>
                                              )}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>

                          <div>
                              <label className="block text-teal-700 font-bold mb-4 text-2xl">Auto-advance Delay</label>
                              <div className="grid grid-cols-2 gap-4">
                                  {([3, 5, 10, 'manual'] as const).map((delay) => (
                                      <button 
                                          key={delay}
                                          onClick={() => setAutoAdvanceDelay(delay)}
                                          className={`py-4 rounded-2xl font-black text-xl md:text-2xl transition-all border-4 shadow-sm cursor-pointer ${autoAdvanceDelay === delay ? 'bg-indigo-500 text-white border-indigo-600 scale-105' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100 hover:scale-105'}`}
                                      >
                                          {delay === 'manual' ? 'When clicked' : `${delay} Seconds`}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </div>
                      
                      <button onClick={() => setShowSettings(false)} className="mt-10 w-full bg-teal-500 hover:bg-teal-600 text-white font-black text-2xl py-5 rounded-full shadow-[0_6px_0_#0f766e] active:shadow-none active:translate-y-2 transition-all cursor-pointer">
                          Done
                      </button>
                  </div>
              </div>
          )}

          {isAnswering && autoAdvanceDelay === 'manual' && (
              <div className="absolute bottom-12 left-0 right-0 z-[60] flex justify-center pointer-events-none animate-fade-in">
                  <button 
                    onClick={handleNextClick}
                    className="pointer-events-auto bg-indigo-500 hover:bg-indigo-600 text-white text-4xl md:text-5xl font-black py-6 px-16 rounded-[3rem] shadow-[0_10px_0_#4338ca] active:shadow-none active:translate-y-3 transition-all animate-bounce cursor-pointer"
                  >
                      NEXT ➡️
                  </button>
              </div>
          )}
          
          

          <div className={`bg-white shadow-2xl w-full overflow-hidden border-8 border-teal-500 relative flex flex-col ${isFullscreen ? 'h-full rounded-none border-0' : 'min-h-[75vh] rounded-[3rem]'}`}>
              
              {timer !== null && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/40 backdrop-blur-sm">
                      <div className="text-[12rem] font-black text-teal-500 drop-shadow-2xl animate-[ping_1s_cubic-bezier(0,0,0.2,1)_infinite]">
                          {timer}
                      </div>
                  </div>
              )}
              
              {gameState === 'start' && (
                  <div className="flex flex-col h-full flex-grow relative bg-slate-500 overflow-y-auto items-center justify-center p-4 md:p-8">
                      <div className="bg-white rounded-[3rem] w-full max-w-3xl shadow-2xl relative flex flex-col items-center p-8 md:p-12">
                          {onSwitchMode && (
                              <button 
                                  onClick={onSwitchMode} 
                                  className="absolute top-6 left-8 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black py-2.5 px-4 rounded-2xl flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer text-sm uppercase tracking-wide"
                                  title="Switch to Bubble Pop or Sumo Showdown"
                              >
                                  <Shuffle size={18} className="text-amber-300" />
                                  <span>Switch Mode</span>
                              </button>
                          )}
                          <button onClick={onBack} className="absolute top-6 right-8 text-pink-400 hover:text-pink-500 transition-colors cursor-pointer">
                              <X size={48} strokeWidth={4} />
                          </button>
                          
                          <h1 className="text-5xl md:text-6xl font-black text-slate-700 mt-4 mb-4 tracking-tight">Game Setup Lobby</h1>
                          
                          <div className="flex gap-6 mb-12 text-lg md:text-xl font-bold">
                              <span className="text-blue-300">Best Score: 0</span>
                              <span className="text-amber-400">Stars: 3</span>
                          </div>
                          
                          <div className="w-full max-w-xl flex flex-col gap-6">
                              <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
                                  <div className="flex items-center gap-3 text-blue-600 font-bold text-xl md:text-2xl">
                                      <User className="text-purple-500" size={32} strokeWidth={3} />
                                      <span>Number of players: {teams.length}</span>
                                  </div>
                                  <button onClick={addTeam} className="bg-sky-400 hover:bg-sky-500 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 shadow-md hover:scale-105 transition-transform cursor-pointer">
                                      <Plus size={24} strokeWidth={4} className="text-pink-300" />
                                      <span className="text-lg">Add Player</span>
                                  </button>
                              </div>
                              
                              <div className="flex flex-wrap gap-4 mt-2 mb-4 w-full justify-start min-h-[100px]">
                                  {teams.map((team) => (
                                      <div key={team.id} className="relative">
                                          {editingTeamId === team.id ? (
                                              <input
                                                  autoFocus
                                                  defaultValue={team.name}
                                                  onBlur={(e) => {
                                                      const newName = e.target.value.trim();
                                                      if (newName) {
                                                          setTeams(teams.map(t => t.id === team.id ? { ...t, name: newName } : t));
                                                      }
                                                      setEditingTeamId(null);
                                                  }}
                                                  onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                          e.currentTarget.blur();
                                                      }
                                                  }}
                                                  className="bg-white text-sky-500 font-bold py-3 px-6 rounded-full shadow-inner border-2 border-sky-400 focus:outline-none text-xl w-48"
                                              />
                                          ) : (
                                              <button 
                                                  onClick={() => setEditingTeamId(team.id)}
                                                  className="bg-sky-400 text-white font-bold py-3 px-6 rounded-full flex items-center gap-2 shadow-md hover:bg-sky-500 transition-colors text-xl cursor-pointer"
                                              >
                                                  {team.name} <Pencil size={20} className="text-yellow-200" />
                                              </button>
                                          )}
                                      </div>
                                  ))}
                              </div>
                              
                              <p className="text-cyan-200 italic font-bold text-center mb-8">Tip: Click a player name to edit it!</p>
                          </div>
                          
                          <button onClick={startGame} className="w-full max-w-xl bg-gradient-to-r from-[#4ff0b4] to-[#46e6a5] text-white font-black text-3xl md:text-4xl py-6 rounded-full shadow-[0_8px_0_#23c483] hover:shadow-[0_4px_0_#23c483] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all flex items-center justify-center gap-4 cursor-pointer mt-4">
                              🚀 START GAME
                          </button>
                      </div>
                  </div>
              )}

              {gameState === 'playing' && (
                  <div className="flex flex-col h-full flex-grow relative animate-fade-in min-h-0 overflow-hidden">
                      {/* Absolute Top Controls */}
                      <div className="absolute top-4 md:top-6 left-0 right-0 px-4 md:px-6 flex justify-between items-start z-20 pointer-events-none">
                          <div className="flex items-center gap-2 pointer-events-auto">
                            <button onClick={onBack} className="px-4 md:px-6 py-2 md:py-3 text-teal-600 hover:bg-teal-200 rounded-2xl transition-colors font-black cursor-pointer bg-teal-100 shadow-sm text-lg md:text-xl uppercase tracking-widest flex items-center gap-2">
                              <ArrowLeft size={24} /> Exit
                            </button>
                            {onSwitchMode && (
                              <button 
                                onClick={onSwitchMode} 
                                className="px-4 md:px-5 py-2 md:py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl transition-all hover:scale-105 active:scale-95 font-black cursor-pointer shadow-md text-sm md:text-base uppercase tracking-wider flex items-center gap-2"
                                title="Switch to Bubble Pop or Sumo Showdown"
                              >
                                <Shuffle size={20} className="text-amber-300" />
                                <span>Switch Mode</span>
                              </button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 pointer-events-auto">
                            <div className="font-bold text-teal-800 bg-teal-200/50 px-4 md:px-6 py-2 rounded-2xl shadow-sm border-[4px] border-teal-200 text-center flex items-center justify-center gap-2 h-[52px] md:h-[60px]">
                                <span className="text-3xl md:text-4xl font-black">{currentIdx + 1}</span> 
                                <span className="text-xl md:text-2xl opacity-70">/ {quiz.questions.length}</span>
                            </div>
                            <button onClick={() => setShowSettings(true)} className="w-[52px] h-[52px] md:w-[60px] md:h-[60px] text-teal-600 hover:bg-teal-200 rounded-2xl transition-colors font-bold cursor-pointer bg-teal-100 shadow-sm flex items-center justify-center" title="Settings">
                                <Settings size={28} />
                            </button>
                            <button onClick={toggleFullscreen} className="w-[52px] h-[52px] md:w-[60px] md:h-[60px] text-teal-600 hover:bg-teal-200 rounded-2xl transition-colors font-bold cursor-pointer bg-teal-100 shadow-sm flex items-center justify-center" title="Fullscreen">
                                {isFullscreen ? <Minimize size={28} /> : <Maximize size={28} />}
                            </button>
                          </div>
                      </div>
                      
                      {/* Header with progress */}
                      <div className="bg-teal-50 pt-20 md:pt-20 pb-4 px-4 border-b-[4px] border-teal-100 flex flex-col items-center shrink-0 gap-4">
                          {/* Center Teams */}
                          <div className="w-full max-w-[95vw] overflow-x-auto custom-scrollbar px-4 pb-4">
                              <div className="flex flex-nowrap justify-start lg:justify-center items-center gap-4 md:gap-6 min-w-full w-max mx-auto">
                              {teams.map((team, index) => {
                                  const theme = teamColors[team.colorIdx];
                                  // Alternate layout for variety, or just keep consistent. Let's make minus on left, plus on right for all in the middle
                                  return (
                                      <div key={team.id} className={`flex items-stretch rounded-3xl shadow-xl border-[6px] md:border-[8px] ${theme.border} overflow-hidden shrink-0 transform transition-transform hover:scale-105`}>
                                          <button onClick={() => updateTeamScore(team.id, -1)} className={`px-3 md:px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 transition-colors border-r-[6px] md:border-r-[8px] ${theme.borderLight} flex items-center justify-center cursor-pointer`}>
                                              <span className="font-black text-3xl md:text-4xl leading-none opacity-40 hover:opacity-100">-</span>
                                          </button>
                                          <button onClick={() => updateTeamScore(team.id, 1)} className={`px-4 md:px-6 py-2 md:py-3 font-black text-white ${theme.bg} hover:brightness-110 transition-all flex items-center gap-3 md:gap-4 cursor-pointer`}>
                                              <span className={playerTextClass}>{team.name}</span>
                                              <span className="bg-white/20 px-4 md:px-5 py-1 md:py-2 rounded-xl text-3xl md:text-4xl drop-shadow-lg leading-none">{team.score}</span>
                                          </button>
                                      </div>
                                  );
                              })}
                              </div>
                          </div>
                      </div>

                      <div className="p-4 md:p-6 flex-grow flex flex-col justify-center overflow-hidden bg-white/50">
                          {/* Question */}
                          <div className="text-center mb-4 md:mb-6 shrink-0">
                              <p className="text-teal-500 font-black uppercase tracking-widest text-sm md:text-base mb-2">Complete the sentence...</p>
                              <h2 className={`${questionTextClass} font-black text-indigo-900 bg-indigo-50 py-6 md:py-10 px-8 md:px-12 rounded-[2rem] border-[6px] border-indigo-100 shadow-inner inline-block min-w-[60%] max-w-[95%] leading-tight`}>
                                  {quiz.questions[currentIdx]?.text}
                              </h2>
                          </div>

                          {/* Answer Buttons */}
                          <div className="flex flex-row justify-center items-stretch gap-2 sm:gap-4 md:gap-6 w-full max-w-[98%] xl:max-w-7xl mx-auto">
                              {shuffledOptions.map((opt, index) => {
                                  const isMany = shuffledOptions.length > 4;
                                  let btnClasses = `flex-1 min-w-0 bg-white border-4 md:border-[6px] border-gray-100 text-gray-700 font-bold p-2 sm:p-3 md:p-4 ${isMany ? 'rounded-[1.5rem]' : 'md:p-6 rounded-[2rem]'} transition-all duration-300 flex flex-col items-center text-center shadow-lg relative group outline-none `;
                                  
                                  if (isAnswering) {
                                      if (index === selectedOption) {
                                          if (opt.isCorrect) {
                                              btnClasses += "bg-[#a7f3d0] border-[#059669] text-[#064e3b] scale-[1.02] md:scale-105 z-10 shadow-2xl animate-[bounce_0.6s_ease-out_forwards]";
                                          } else {
                                              btnClasses += "bg-[#fecaca] border-[#dc2626] text-[#7f1d1d] animate-[shake_0.5s_ease-out_forwards]";
                                          }
                                      } else if (opt.isCorrect) {
                                          btnClasses += "bg-[#a7f3d0] border-[#059669] text-[#064e3b] scale-[1.02] md:scale-105 z-10 shadow-2xl";
                                      } else {
                                          btnClasses += "opacity-60 scale-95";
                                      }
                                  } else {
                                     btnClasses += "hover:border-teal-400 hover:bg-teal-50 hover:shadow-2xl hover:scale-[1.02] cursor-pointer";
                                  }

                                  return (
                                      <button 
                                          key={index}
                                         disabled={isAnswering}
                                         onClick={() => handleAnswer(index, opt.isCorrect)}
                                         className={btnClasses}
                                      >
                                          {isAnswering && (index === selectedOption || opt.isCorrect) && (
                                              <div className={`absolute -top-4 -right-4 md:-top-6 md:-right-6 w-10 h-10 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white text-2xl md:text-4xl font-black shadow-lg z-30 animate-bounce ${opt.isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                                                  {opt.isCorrect ? '✓' : '✗'}
                                              </div>
                                          )}
                                          <div className={`w-full aspect-square max-h-[25vh] ${isMany ? 'md:max-h-[20vh]' : ''} rounded-xl md:rounded-[1.5rem] overflow-hidden relative bg-teal-50/50 border-4 border-teal-100 mb-2 md:mb-4 shadow-inner transition-transform duration-300 shrink-0 flex items-center justify-center ${!isAnswering ? 'group-hover:scale-[1.05]' : ''}`}>

                                              {(() => {
                                                  // We use the pre-assigned random poseIndex for this option (so it doesn't change on render)
                                                  // And if we have more options than active poses, we loop back through the active poses
                                                  const activePoseValue = activePoses[opt.poseIndex % activePoses.length] || AVAILABLE_POSES[0].value;
                                                  const poseObj = AVAILABLE_POSES.find(p => p.value === activePoseValue) || { type: 'emoji', value: activePoseValue };
                                                  
                                                  if (poseObj.type === 'image') {
                                                      return <img src={poseObj.value} alt="Pose" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />;
                                                  } else {
                                                      return <span className={`${optionEmojiClass} drop-shadow-sm leading-none`}>{poseObj.value}</span>;
                                                  }
                                              })()}
                                          </div>
                                          <span className={`${isMany ? 'text-lg sm:text-xl md:text-2xl xl:text-3xl' : 'text-2xl sm:text-3xl md:text-4xl xl:text-5xl'} font-black text-gray-800 leading-tight w-full flex items-center justify-center break-words pb-1 md:pb-2 flex-grow`}>{opt.text}</span>
                                      </button>
                                  );
                              })}
                          </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-teal-100 h-6 absolute bottom-0 left-0 shrink-0 overflow-hidden">
                          <div className="bg-teal-500 h-full transition-all duration-500 ease-out rounded-r-full" style={{ width: `${(currentIdx / quiz.questions.length) * 100}%` }}></div>
                      </div>
                  </div>
              )}

              {gameState === 'end' && (
                  <div className="p-8 md:p-16 xl:p-24 text-center flex flex-col items-center justify-center flex-grow animate-fade-in">
                      <div className="text-[6rem] md:text-[10rem] mb-10 drop-shadow-2xl animate-bounce">🏆</div>
                      {(() => {
                          const sortedTeams = [...teams].sort((a,b) => b.score - a.score);
                          const winner = sortedTeams[0];
                          const isTie = sortedTeams.length > 1 && sortedTeams[0].score === sortedTeams[1].score && sortedTeams[0].score > 0;
                          
                          if (isTie) {
                              return <h1 className="text-5xl md:text-7xl xl:text-8xl font-black text-teal-800 mb-12 drop-shadow-sm text-center">It's a Tie!</h1>;
                          } else {
                              return <h1 className="text-5xl md:text-7xl xl:text-[6rem] font-black text-teal-800 mb-12 drop-shadow-sm leading-tight text-center break-words max-w-[90vw]">{winner.name} Wins!</h1>;
                          }
                      })()}
                      
                      <div className="bg-indigo-50 border-8 border-indigo-100 rounded-[3rem] p-8 md:p-12 mb-12 w-full max-w-4xl shadow-inner mx-auto relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-100/50 rounded-bl-full pointer-events-none"></div>
                          <p className="text-indigo-400 font-black text-2xl md:text-3xl uppercase tracking-widest mb-6 relative z-10">Final Scores</p>
                          <div className="flex flex-wrap justify-center gap-4 md:gap-6 relative z-10">
                              {[...teams].sort((a,b) => b.score - a.score).map((team, idx) => (
                                  <div key={team.id} className={`flex flex-col items-center bg-white p-4 md:p-6 rounded-2xl shadow-sm border-4 min-w-[120px] md:min-w-[150px] ${idx === 0 ? 'border-yellow-400 scale-110 shadow-lg' : 'border-gray-100'}`}>
                                      {idx === 0 && <span className="text-4xl mb-2 drop-shadow-sm">👑</span>}
                                      <span className={`font-bold text-lg md:text-xl mb-2 text-gray-600`}>{team.name}</span>
                                      <span className={`text-4xl md:text-5xl font-black ${teamColors[team.colorIdx].text}`}>{team.score}</span>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="flex gap-4 w-full max-w-2xl mx-auto">
                          <button onClick={onBack} className="bg-teal-100 hover:bg-teal-200 text-teal-700 font-black py-6 px-8 rounded-full text-2xl transition transform hover:scale-105 shadow-[0_8px_0_#99f6e4] hover:translate-y-1 active:shadow-none active:translate-y-3 cursor-pointer shrink-0">
                              <ArrowLeft size={32} /> Lobby
                          </button>
                          <button onClick={startGame} className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-black py-6 md:py-8 px-12 md:px-20 rounded-full text-3xl md:text-5xl transition transform hover:scale-105 shadow-[0_12px_0_#0f766e] hover:shadow-[0_6px_0_#0f766e] hover:translate-y-2 active:shadow-none active:translate-y-4 cursor-pointer">
                              PLAY AGAIN
                          </button>
                      </div>
                  </div>
              )}
          </div>
      </div>
    );
}
