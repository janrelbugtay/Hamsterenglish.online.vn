import { MediaPickerModal } from "../components/MediaPickerModal";
import { BulkPasteVideoModal } from "../components/BulkPasteVideoModal";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { ArrowLeft, Edit3, Trash2, Heart, Plus, Sparkles, BookOpen, Search, Save, X, Play, Folder, Image as ImageIcon, Info, ClipboardList, Copy, Trophy, Shuffle, Volume2, VolumeX, Users, Camera, Type, Check } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { GameModeModal } from "../components/GameModeModal";
import { SetupCurriculumHeader, SmartOptionInput, convertQuestionsContentMode } from "../components/SetupSmartControls";
import { OptionContentMode, parseOptionContent, formatOptionContent } from "../utils/mediaAndPresets";
import {
  SumoStadiumEnvironment,
  SumoCharacter,
  CircularSumoArena,
  SumoCharacterPickerModal,
  SUMO_CHARACTER_OPTIONS,
  SUMO_CAMERA_OPTIONS,
  SumoCharacterType,
  SumoCameraMode
} from "../components/SumoStadiumEnvironment";

let sharedAudioCtx: AudioContext | null = null;
let soundMutedGlobal = false;

const playSFX = (type: 'push' | 'stun' | 'win' | 'taiko' | 'clack' | 'freeze') => {
  if (soundMutedGlobal) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    const ctx = sharedAudioCtx;
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (type === 'push' || type === 'taiko') {
      // Deep resonant Taiko bass drum boom + impact
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);

      // Noise punch for tactile sumo impact
      const bufferSize = Math.floor(ctx.sampleRate * 0.08);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(320, ctx.currentTime);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
    } else if (type === 'clack') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'stun') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else if (type === 'win') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.28, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.12 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.5);
      });
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface Question {
  id: number | string;
  text: string;
  options: string[];
  answerIndex: number;
}

interface GameData {
  id: number | string;
  title?: string;
  folderId?: string;
  topic?: string;
  classLevel?: string;
  questions: Question[];
  isPublic?: boolean;
}

const BLANK_QUESTION = (): Question => ({
  id: Date.now(),
  text: "",
  options: ["", "", "", ""],
  answerIndex: 0
});

const DEFAULT_QUESTIONS: Question[] = [];


export function Sumo({ onViewChange, initialGame }: { onViewChange: (view: ViewState, data?: any) => void, initialGame?: any }) {
  const { user } = useAuth();
  const hasLoadedQuestions = Boolean(
    initialGame && (
      (initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
      (initialGame.questions && initialGame.questions.length > 0)
    )
  );
  const [screen, setScreen] = useState<'menu' | 'playing' | 'end' | 'setup' | 'study'>(initialGame && !initialGame.editMode && hasLoadedQuestions ? 'menu' : 'setup');
  const [showModeModal, setShowModeModal] = useState(false);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [leftCharacter, setLeftCharacter] = useState<SumoCharacterType>('rikishi');
  const [rightCharacter, setRightCharacter] = useState<SumoCharacterType>('panda');
  const [cameraMode, setCameraMode] = useState<SumoCameraMode>('dynamic');
  const [fontSizeScale, setFontSizeScale] = useState<'small' | 'medium' | 'large'>('medium');
  const [showFontSizePopup, setShowFontSizePopup] = useState(false);

  const cycleCameraMode = useCallback(() => {
    setCameraMode((prev) => {
      const idx = SUMO_CAMERA_OPTIONS.findIndex((c) => c.id === prev);
      return SUMO_CAMERA_OPTIONS[(idx + 1) % SUMO_CAMERA_OPTIONS.length].id;
    });
  }, []);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null); 
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (initialGame) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : [BLANK_QUESTION()]);

      setActiveGame({
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList,
        isPublic: initialGame.isPublic || false
      });

      if (!initialGame.editMode && hasLoadedQuestions) {
        setScreen('menu');
      } else {
        setScreen('setup');
      }
    }
  }, [initialGame]);

  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        try {
          const qFolders = query(collection(db, 'gameFolders'), where('userId', '==', user.uid));
          const snap = await getDocs(qFolders);
          const fData: { id: string; name: string }[] = [];
          snap.forEach(d => fData.push({ id: d.id, name: d.data().name }));
          setFolders(fData);
        } catch (err) {
          console.error("Error loading folders", err);
        }
      };
      fetchFolders();
    }
  }, [user]);

  const [activeGame, setActiveGame] = useState<GameData | null>(() => {
    if (initialGame) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : [BLANK_QUESTION()]);
      return {
        id: initialGame.id,
        title: initialGame.name || initialGame.title || initialGame.topic || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList,
        isPublic: initialGame.isPublic || false
      };
    }
    return {
      id: Date.now(),
      title: "",
      folderId: "",
      topic: "",
      classLevel: "",
      questions: [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }]
    };
  });

  const saveGame = async (gameData: GameData) => {
    if (!user) {
      alert("You must be logged in to save games.");
      return;
    }

    try {
      const isPublicBool = Boolean(gameData.isPublic);
      const now = new Date().toISOString();

      const isOwnExistingGame = Boolean(
        initialGame?.id &&
        !String(initialGame.id).startsWith('sample-') &&
        (!initialGame.userId || initialGame.userId === user.uid)
      );

      const gameToSave = JSON.parse(JSON.stringify({
        name: gameData.topic || gameData.title || "Sumo Showdown",
        title: gameData.title || gameData.topic || "Sumo Showdown",
        folderId: gameData.folderId || "",
        topic: gameData.topic || "",
        className: gameData.classLevel || "",
        gameType: "sumo",
        customQuestions: gameData.questions,
        userId: user.uid,
        creatorName: user.displayName || user.email?.split('@')[0] || "Teacher",
        creatorEmail: user.email || "",
        updatedAt: now,
        publishedAt: isPublicBool ? now : (initialGame?.publishedAt || null),
        createdAt: (isOwnExistingGame && initialGame?.createdAt) ? initialGame.createdAt : now,
        isPublic: isPublicBool,
      }));

      if (isOwnExistingGame) {
        try {
          await updateDoc(doc(db, "mysteryBoxGames", initialGame.id), gameToSave);
        } catch (err: any) {
          if (err?.code === 'not-found') {
            await addDoc(collection(db, "mysteryBoxGames"), gameToSave);
          } else {
            throw err;
          }
        }
      } else {
        await addDoc(collection(db, "mysteryBoxGames"), gameToSave);
      }
      onViewChange("games");
    } catch (e: any) {
      console.error("Error saving game", e);
      alert("Failed to save game: " + (e?.message || String(e)));
      onViewChange("games");
    }
  };

  const questionsDB = (activeGame?.questions && activeGame.questions.length > 0) ? activeGame.questions : DEFAULT_QUESTIONS;

  const [questionMode, setQuestionMode] = useState<'single' | 'split'>('single');
  const [showStartBattleModal, setShowStartBattleModal] = useState(false);
  const questionModeRef = useRef<'single' | 'split'>('single');
  const leftQuestionsRef = useRef<any[]>([]);
  const rightQuestionsRef = useRef<any[]>([]);

  useEffect(() => {
    questionModeRef.current = questionMode;
  }, [questionMode]);

  const generateQuestionObj = (q: any) => {
    if (!q) {
      return { text: "Question", options: ["Option A", "Option B"], correctIndex: 0 };
    }
    
    // Get valid options
    let validOptions = Array.isArray(q.options) 
      ? [...q.options].filter(o => typeof o === 'string' && o.trim() !== "") 
      : [];
    
    const correctOpt = (Array.isArray(q.options) && q.options[q.answerIndex]) || validOptions[0] || "Correct Answer";
    
    // Ensure correct option is included
    if (!validOptions.includes(correctOpt)) {
       validOptions.unshift(correctOpt);
    }
    
    // Preserve natural option count for 2, 3, or 4 options (e.g. True/False or multiple choice)
    if (validOptions.length < 2) {
      validOptions.push("Option B");
    } else if (validOptions.length > 4) {
      // If there are more than 4, keep the correct one and 3 others
      const wrongOpts = validOptions.filter(o => o !== correctOpt).sort(() => Math.random() - 0.5).slice(0, 3);
      validOptions = [correctOpt, ...wrongOpts];
    }
    
    // Shuffle options
    const shuffledOpts = [...validOptions].sort(() => Math.random() - 0.5);
    
    return {
      text: q.text || "Question",
      options: shuffledOpts,
      correctIndex: Math.max(0, shuffledOpts.indexOf(correctOpt))
    };
  };

  const generateQuestion = (index: number) => {
    const q = questionsDB[index % questionsDB.length];
    return generateQuestionObj(q);
  };

  const generateQuestionFromList = (list: any[], index: number) => {
    if (!list || list.length === 0) return generateQuestion(index);
    const q = list[index % list.length];
    return generateQuestionObj(q);
  };

  const [leftTeam, setLeftTeam] = useState<any>({ score: 0, wins: 0, qIndex: 0, q: null, stunned: false, pushing: false, mistakes: 0, frozen: false });
  const [rightTeam, setRightTeam] = useState<any>({ score: 0, wins: 0, qIndex: 0, q: null, stunned: false, pushing: false, mistakes: 0, frozen: false });
  const [battlePos, setBattlePos] = useState(50);
  const [winner, setWinner] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<{ team: 'left' | 'right'; index: number } | null>(null);
  const [isRumbling, setIsRumbling] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    soundMutedGlobal = soundMuted;
  }, [soundMuted]);

  const matchOverRef = useRef(false);
  const stateRef = useRef({ screen, leftTeam, rightTeam, battlePos });
  useEffect(() => {
    stateRef.current = { screen, leftTeam, rightTeam, battlePos };
  }, [screen, leftTeam, rightTeam, battlePos]);

  const startGame = (continueMatch = false, chosenMode?: 'single' | 'split') => {
    const activeMode = chosenMode || questionMode;
    if (chosenMode) {
      setQuestionMode(chosenMode);
      questionModeRef.current = chosenMode;
    }

    // For Split Mode: each team gets their own independently shuffled deck of questions!
    const shuffledLeft = [...questionsDB].sort(() => Math.random() - 0.5);
    const shuffledRight = [...questionsDB].sort(() => Math.random() - 0.5);
    leftQuestionsRef.current = shuffledLeft;
    rightQuestionsRef.current = shuffledRight;

    setLeftTeam((prev: any) => {
       const nextIndex = continueMatch ? prev.qIndex : 0;
       const qSource = activeMode === 'split' ? shuffledLeft : questionsDB;
       return { ...prev, score: 0, qIndex: nextIndex, q: generateQuestionFromList(qSource, nextIndex), stunned: false, pushing: false };
    });
    setRightTeam((prev: any) => {
       const nextIndex = continueMatch ? prev.qIndex : 0;
       const qSource = activeMode === 'split' ? shuffledRight : questionsDB;
       return { ...prev, score: 0, qIndex: nextIndex, q: generateQuestionFromList(qSource, nextIndex), stunned: false, pushing: false };
    });
    setBattlePos(50);
    setWinner(null);
    matchOverRef.current = false;
    setShowStartBattleModal(false);
    setScreen('playing');
    playSFX('taiko');
    setTimeout(() => playSFX('clack'), 220);
  };

  const handleAnswer = useCallback((teamStr: string, selectedIndex: number) => {
    const state = stateRef.current;
    if (state.screen !== 'playing') return;

    const isLeft = teamStr === 'left';
    const teamState = isLeft ? state.leftTeam : state.rightTeam;
    const setTeamState = isLeft ? setLeftTeam : setRightTeam;

    if (teamState.stunned || teamState.pushing || teamState.frozen) return;

    if (selectedIndex === teamState.q.correctIndex) {
      setTeamState((prev: any) => ({ ...prev, pushing: true, score: prev.score + 1, mistakes: 0 }));
      setIsRumbling(true);
      setTimeout(() => setIsRumbling(false), 240);
      playSFX('push');
      const shiftAmount = 14; 
      
      if (matchOverRef.current) return;
      
      const nextPos = isLeft ? state.battlePos + shiftAmount : state.battlePos - shiftAmount;
      let matchOver = false;
      
      // When pushed to the end of the arena (past the outer straw boundary), that character LOSES!
      if (nextPos >= 84) {
         matchOverRef.current = true;
         matchOver = true;
         setBattlePos(86);
         setWinner('Blue Team');
         setLeftTeam(prev => ({ ...prev, wins: prev.wins + 1 }));
         playSFX('win');
         setTimeout(() => setScreen('end'), 2000);
      } else if (nextPos <= 16) {
         matchOverRef.current = true;
         matchOver = true;
         setBattlePos(14);
         setWinner('Red Team');
         setRightTeam(prev => ({ ...prev, wins: prev.wins + 1 }));
         playSFX('win');
         setTimeout(() => setScreen('end'), 2000);
      } else {
         setBattlePos(nextPos);
      }

      if (!matchOver) {
        if (questionModeRef.current === 'split') {
          // SPLIT QUESTION MODE: Only the answering team advances to their own next question in their independent randomized order!
          setTimeout(() => {
            const nextIndex = teamState.qIndex + 1;
            const qList = isLeft ? leftQuestionsRef.current : rightQuestionsRef.current;
            setTeamState((prev: any) => ({
              ...prev,
              pushing: false,
              qIndex: nextIndex,
              q: generateQuestionFromList(qList, nextIndex)
            }));
          }, 350);
        } else {
          // SINGLE QUESTION MODE: Both teams advance together to the next question in the middle!
          setTimeout(() => {
            const nextIndex = teamState.qIndex + 1;
            const newQ = generateQuestion(nextIndex);
            setLeftTeam((prev: any) => ({
               ...prev,
               pushing: false,
               qIndex: nextIndex,
               q: newQ
            }));
            setRightTeam((prev: any) => ({
               ...prev,
               pushing: false,
               qIndex: nextIndex,
               q: newQ
            }));
          }, 400);
        }
      }
    } else {
      setTeamState((prev: any) => {
         const nextMistakes = prev.mistakes + 1;
         if (nextMistakes >= 2) {
             playSFX('freeze');
             setTimeout(() => setTeamState((p: any) => ({ ...p, frozen: false, mistakes: 0 })), 3000);
             return { ...prev, frozen: true, mistakes: 0 };
         }
         
         playSFX('stun');
         setTimeout(() => setTeamState((p: any) => ({ ...p, stunned: false })), 1000);
         return { ...prev, stunned: true, mistakes: nextMistakes };
      });

      if (!matchOverRef.current) {
        setBattlePos(prev => {
          const penalty = isLeft ? -6 : 6;
          const adjusted = prev + penalty;
          if (adjusted >= 84) {
             matchOverRef.current = true;
             setWinner('Blue Team');
             setLeftTeam(p => ({ ...p, wins: p.wins + 1 }));
             playSFX('win');
             setTimeout(() => setScreen('end'), 2000);
             return 86;
          } else if (adjusted <= 16) {
             matchOverRef.current = true;
             setWinner('Red Team');
             setRightTeam(p => ({ ...p, wins: p.wins + 1 }));
             playSFX('win');
             setTimeout(() => setScreen('end'), 2000);
             return 14;
          }
          return adjusted;
        });
      }
    }
  }, []);

  const getBlueKeyHints = (count: number): string[] => {
    if (count === 2) return ['A', 'D'];
    if (count === 3) return ['A', 'S', 'D'];
    return ['W', 'A', 'S', 'D'];
  };

  const getRedKeyHints = (count: number): string[] => {
    if (count === 2) return ['←', '→'];
    if (count === 3) return ['←', '↓', '→'];
    return ['↑', '←', '↓', '→'];
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.screen !== 'playing') return;
      const key = e.key.toLowerCase();
      
      const leftOptsCount = stateRef.current.leftTeam?.q?.options?.length || 4;
      const rightOptsCount = stateRef.current.rightTeam?.q?.options?.length || 4;
      
      let leftMap: Record<string, number> = {};
      if (leftOptsCount === 2) {
        // 2 Options: A and D
        leftMap = { a: 0, d: 1, 1: 0, 2: 1, q: 0, e: 1 };
      } else if (leftOptsCount === 3) {
        // 3 Options: A, S, D
        leftMap = { a: 0, s: 1, d: 2, 1: 0, 2: 1, 3: 2, q: 0, w: 1, e: 2 };
      } else {
        // 4 Options: W, A, S, D
        leftMap = { w: 0, a: 1, s: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
      }
          
      let rightMap: Record<string, number> = {};
      if (rightOptsCount === 2) {
        // 2 Options: Left and Right arrows
        rightMap = { arrowleft: 0, arrowright: 1, 1: 0, 2: 1, j: 0, l: 1, 7: 0, 8: 1 };
      } else if (rightOptsCount === 3) {
        // 3 Options: Left, Down, Right arrows
        rightMap = { arrowleft: 0, arrowdown: 1, arrowright: 2, 1: 0, 2: 1, 3: 2, j: 0, k: 1, l: 2, 7: 0, 8: 1, 9: 2 };
      } else {
        // 4 Options: Up, Left, Down, Right arrows
        rightMap = { arrowup: 0, arrowleft: 1, arrowdown: 2, arrowright: 3, 1: 0, 2: 1, 3: 2, 4: 3, i: 0, j: 1, k: 2, l: 3, 7: 0, 8: 1, 9: 2, 0: 3 };
      }

      if (key in leftMap) {
         const idx = leftMap[key];
         setActiveKey({ team: 'left', index: idx });
         setTimeout(() => setActiveKey(null), 160);
         handleAnswer('left', idx);
      } else if (key in rightMap) {
         const idx = rightMap[key];
         setActiveKey({ team: 'right', index: idx });
         setTimeout(() => setActiveKey(null), 160);
         handleAnswer('right', idx);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnswer]);

  const scaleShift = fontSizeScale === 'large' ? -1 : fontSizeScale === 'small' ? 1 : 0;

  const getQuestionFontSize = (text: string, isSplit = false) => {
    const len = (text || "").trim().length;

    if (isSplit) {
      let tier = 0;
      if (len <= 32) tier = 0;
      else if (len <= 60) tier = 1;
      else if (len <= 95) tier = 2;
      else if (len <= 135) tier = 3;
      else tier = 4;

      const idx = Math.max(-1, Math.min(4, tier + scaleShift));
      if (idx <= -1) return "text-lg sm:text-2xl md:text-3xl lg:text-4xl";
      if (idx === 0) return "text-base sm:text-xl md:text-2xl lg:text-3xl";
      if (idx === 1) return "text-sm sm:text-lg md:text-xl lg:text-2xl";
      if (idx === 2) return "text-xs sm:text-base md:text-lg lg:text-xl";
      if (idx === 3) return "text-xs sm:text-sm md:text-base lg:text-lg";
      return "text-[11px] sm:text-xs md:text-sm lg:text-base";
    }

    let tier = 0;
    if (len <= 36) tier = 0;
    else if (len <= 68) tier = 1;
    else if (len <= 105) tier = 2;
    else if (len <= 145) tier = 3;
    else tier = 4;

    const idx = Math.max(-1, Math.min(4, tier + scaleShift));
    if (idx <= -1) return "text-2xl sm:text-4xl md:text-5xl lg:text-[3.25rem]";
    if (idx === 0) return "text-xl sm:text-3xl md:text-4xl lg:text-[2.75rem]";
    if (idx === 1) return "text-lg sm:text-2xl md:text-3xl lg:text-4xl";
    if (idx === 2) return "text-base sm:text-xl md:text-2xl lg:text-3xl";
    if (idx === 3) return "text-sm sm:text-lg md:text-xl lg:text-2xl";
    return "text-xs sm:text-base md:text-lg lg:text-xl";
  };

  const getOptionFontSize = (text: string, count = 4) => {
    const len = (text || "").trim().length;
    let tier = 0;
    if (len <= 8) tier = 0;
    else if (len <= 15) tier = 1;
    else if (len <= 24) tier = 2;
    else if (len <= 36) tier = 3;
    else tier = 4;

    if (count <= 2) tier -= 1;

    const idx = Math.max(-1, Math.min(4, tier + scaleShift));
    if (idx <= -1) return "text-lg sm:text-2xl md:text-3xl lg:text-4xl";
    if (idx === 0) return "text-base sm:text-xl md:text-2xl lg:text-3xl";
    if (idx === 1) return "text-sm sm:text-lg md:text-xl lg:text-2xl";
    if (idx === 2) return "text-xs sm:text-base md:text-lg lg:text-xl";
    if (idx === 3) return "text-[11px] sm:text-sm md:text-base lg:text-lg";
    return "text-[10px] sm:text-xs md:text-sm lg:text-base";
  };

  const renderQuestionText = (text: string) => {
    if (!text) return "";
    const parts = text.split(/_{2,}/);
    if (parts.length === 1) {
      return text;
    }
    return (
      <span>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <span>{part}</span>
            {i < parts.length - 1 && (
              <span className="inline-block border-b-4 md:border-b-[5px] border-[#8c5225] min-w-[2.5rem] sm:min-w-[4rem] md:min-w-[5rem] mx-1.5 align-baseline translate-y-[-2px]" />
            )}
          </React.Fragment>
        ))}
      </span>
    );
  };

  if (screen === 'setup') {
    return (
      <GameEditor 
        game={activeGame!} 
        onSave={saveGame} 
        onCancel={() => onViewChange("games")}
        folders={folders}
      />
    );
  }

  if (screen === 'study') {
    const studyQuestions = activeGame?.questions || DEFAULT_QUESTIONS;
    const currentQ = studyQuestions[studyIndex];
    
    return (
      <div id="game-container" className="w-full min-h-full flex-1 bg-white text-black flex flex-col font-sans p-4 sm:p-6 md:p-8 relative">
        {/* Header — Pure White Background with Black Text & Top-Right Font Size Pop-Up */}
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl mb-8 border-2 border-slate-200 shadow-xs">
           <button 
             onClick={() => setScreen('menu')}
             className="flex items-center gap-2 py-2 px-4 rounded-full transition-all bg-white hover:bg-slate-100 border-2 border-slate-300 text-black font-bold cursor-pointer"
           >
             <ArrowLeft size={20} className="text-black" /> Back to Menu
           </button>
           <div className="flex items-center gap-3">
             <div className="text-lg sm:text-xl font-black text-black">
                Question {studyIndex + 1} of {studyQuestions.length}
             </div>
             <div className="relative">
               <button
                 onClick={() => setShowFontSizePopup((prev) => !prev)}
                 className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 border-2 border-slate-300 text-black font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
                 title="Change Font Size (Small, Medium, Large)"
               >
                 <Type size={16} className="text-black" />
                 <span className="capitalize">{fontSizeScale}</span>
               </button>
               {showFontSizePopup && (
                 <>
                   <div
                     className="fixed inset-0 z-40"
                     onClick={() => setShowFontSizePopup(false)}
                   />
                   <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border-2 border-slate-300 p-2 z-50">
                     <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2.5 py-1">
                       Font Size
                     </div>
                     {([
                       { id: 'small', label: 'Small', badge: 'A' },
                       { id: 'medium', label: 'Medium', badge: 'A+' },
                       { id: 'large', label: 'Large', badge: 'A++' },
                     ] as const).map((item) => {
                       const active = fontSizeScale === item.id;
                       return (
                         <button
                           key={item.id}
                           onClick={() => {
                             setFontSizeScale(item.id);
                             setShowFontSizePopup(false);
                           }}
                           className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer mb-1 last:mb-0 ${
                             active
                               ? 'bg-black text-white'
                               : 'text-black hover:bg-slate-100'
                           }`}
                         >
                           <span>{item.label}</span>
                           <span className={`px-2 py-0.5 rounded-md text-xs font-black ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-black'}`}>
                             {item.badge}
                           </span>
                         </button>
                       );
                     })}
                   </div>
                 </>
               )}
             </div>
           </div>
        </div>
        
        {/* Main Content — Pure White Background & Crisp Black Text */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-5xl mx-auto w-full">
           {studyQuestions.length > 0 ? (
              <>
                 <h1 className={`${getQuestionFontSize(currentQ?.text || "", false)} font-black text-black tracking-tight leading-snug text-center max-w-full break-words mb-12`}>
                     {renderQuestionText(currentQ?.text || "")}
                 </h1>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                     {currentQ?.options.map((opt, i) => {
                         if (!opt || opt.trim() === '') return null;
                         const isSelected = studySelectedOption === i;
                         const isCorrect = i === currentQ.answerIndex;
                         const showAsCorrect = studySelectedOption !== null && isCorrect;
                         const showAsIncorrect = studySelectedOption !== null && isSelected && !isCorrect;
                         
                         return (
                             <button
                                 key={i}
                                 onClick={() => {
                                     if (studySelectedOption === null) {
                                         setStudySelectedOption(i);
                                     }
                                 }}
                                 disabled={studySelectedOption !== null}
                                 className={`relative p-6 rounded-2xl ${getOptionFontSize(opt, 2)} font-bold transition-all duration-200 border-2 cursor-pointer ${
                                     showAsCorrect
                                       ? 'bg-green-500 text-white border-green-600 shadow-[0_6px_0_#15803d] scale-[1.02] z-10'
                                       : showAsIncorrect
                                         ? 'bg-red-500 text-white border-red-600 shadow-[0_4px_0_#991b1b]'
                                         : studySelectedOption !== null
                                           ? 'bg-white text-black/40 border-slate-200 shadow-none'
                                           : 'bg-white text-black border-slate-300 hover:border-black hover:bg-slate-50 shadow-[0_5px_0_#cbd5e1]'
                                 }`}
                             >
                                 <div className="flex items-center justify-center gap-4">
                                     <span>{opt}</span>
                                     {showAsCorrect && <span className="text-2xl font-black">✓</span>}
                                     {showAsIncorrect && <span className="text-2xl font-black">✕</span>}
                                 </div>
                             </button>
                         );
                     })}
                 </div>
                 
                 <div className={`mt-12 h-20 transition-all duration-300 ${studySelectedOption !== null ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                     <button
                         onClick={() => {
                             if (studyIndex < studyQuestions.length - 1) {
                                 setStudyIndex(studyIndex + 1);
                                 setStudySelectedOption(null);
                             } else {
                                 setScreen('menu');
                                 setStudyIndex(0);
                                 setStudySelectedOption(null);
                             }
                         }}
                         className="px-10 py-4 bg-black hover:bg-slate-800 text-white font-black text-xl rounded-full shadow-[0_6px_0_#334155] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                     >
                         {studyIndex < studyQuestions.length - 1 ? 'Next Question →' : 'Finish Study'}
                     </button>
                 </div>
              </>
           ) : (
              <div className="text-black text-3xl font-bold">No questions available!</div>
           )}
        </div>
      </div>
    );
  }

  if (screen === 'menu') {
    const leftInfo = SUMO_CHARACTER_OPTIONS.find((c) => c.id === leftCharacter);
    const rightInfo = SUMO_CHARACTER_OPTIONS.find((c) => c.id === rightCharacter);

    return (
      <div id="game-container" className="w-full min-h-full flex-1 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 text-white flex flex-col justify-between font-sans p-4 sm:p-6 md:p-8 overflow-y-auto relative select-none">
        {/* FULL-SCREEN TOP HEADER BAR */}
        <div className="w-full max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/15 z-20 shrink-0">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onViewChange("home")}
              className="flex items-center gap-2 p-2.5 rounded-full transition-colors bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer"
              title="Back to Home"
            >
              <ArrowLeft size={22} />
            </button>
            <FullscreenButton targetId="game-container" />
            <button
              onClick={() => setShowModeModal(true)}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Switch to Bubble Pop or Yoga Quiz"
            >
              <Shuffle size={15} className="text-amber-400" />
              <span>Switch Mode</span>
            </button>
          </div>

          <div className="text-center flex-1 min-w-[200px]">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white italic uppercase tracking-tight leading-none drop-shadow">
              {activeGame?.title || "SUMO SHOWDOWN"}
            </h1>
            <p className="text-amber-300 font-bold text-xs sm:text-sm uppercase tracking-widest mt-1">
              {activeGame?.topic || "Choose Your Sumo Fighters & Start Battle"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStudyIndex(0); setStudySelectedOption(null); setScreen('study'); }}
              className="px-4 sm:px-5 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all hover:scale-105 cursor-pointer"
            >
              <span>📖</span>
              <span>STUDY MODE</span>
            </button>
          </div>
        </div>

        {/* FULL-SCREEN CHOOSE FIGHTER ARENA (LEFT BLUE ROSTER · CENTER VS STAGE · RIGHT RED ROSTER) */}
        <div className="w-full max-w-[1440px] mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch my-4 z-20">
          {/* BLUE TEAM FIGHTER ROSTER (5 cols) */}
          <div className="lg:col-span-5 bg-blue-950/65 border-2 border-blue-500/50 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-blue-500 inline-block shadow-[0_0_10px_#3b82f6]" />
                <span className="font-black text-base sm:text-lg md:text-xl text-blue-300 uppercase tracking-wider">
                  Choose Blue Fighter
                </span>
              </div>
              <span className="bg-blue-600 text-white font-black text-xs px-3 py-1 rounded-full shadow">
                {leftInfo?.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1">
              {SUMO_CHARACTER_OPTIONS.map((opt) => {
                const selected = leftCharacter === opt.id;
                return (
                  <button
                    key={`menu-left-${opt.id}`}
                    onClick={() => setLeftCharacter(opt.id)}
                    className={`p-2.5 sm:p-3 rounded-2xl border-2 flex flex-col items-center justify-between text-center transition-all cursor-pointer ${
                      selected
                        ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white border-amber-300 shadow-[0_0_20px_rgba(59,130,246,0.65)] scale-[1.03]'
                        : 'bg-slate-900/80 hover:bg-blue-900/50 text-slate-200 border-blue-500/30 hover:border-blue-400'
                    }`}
                  >
                    <div className="py-1 flex items-center justify-center">
                      <SumoCharacter team="left" character={opt.id} size="card" />
                    </div>
                    <div className="mt-1">
                      <div className="font-black text-xs sm:text-sm leading-tight">{opt.name}</div>
                      <div className={`text-[10px] font-semibold mt-0.5 ${selected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {opt.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CENTER LIVE MATCHUP SHOWCASE & START BATTLE CTA (2 cols) */}
          <div className="lg:col-span-2 bg-gradient-to-b from-sky-200 via-emerald-100 to-emerald-300 text-slate-900 rounded-3xl p-4 sm:p-5 border-4 border-amber-400 shadow-2xl flex flex-col items-center justify-between gap-3">
            <div className="flex flex-col items-center text-center w-full">
              <span className="text-[11px] font-black uppercase tracking-wider text-white bg-blue-600 px-3 py-0.5 rounded-full shadow mb-1">
                Blue: {leftInfo?.name}
              </span>
              <SumoCharacter team="left" character={leftCharacter} compact />
            </div>

            <div className="w-12 h-12 rounded-full bg-amber-400 border-4 border-white shadow-lg flex items-center justify-center font-black italic text-xl text-slate-950 shrink-0">
              VS
            </div>

            <div className="flex flex-col items-center text-center w-full">
              <SumoCharacter team="right" character={rightCharacter} compact />
              <span className="text-[11px] font-black uppercase tracking-wider text-white bg-red-600 px-3 py-0.5 rounded-full shadow mt-1">
                Red: {rightInfo?.name}
              </span>
            </div>
          </div>

          {/* RED TEAM FIGHTER ROSTER (5 cols) */}
          <div className="lg:col-span-5 bg-red-950/65 border-2 border-red-500/50 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block shadow-[0_0_10px_#ef4444]" />
                <span className="font-black text-base sm:text-lg md:text-xl text-red-300 uppercase tracking-wider">
                  Choose Red Fighter
                </span>
              </div>
              <span className="bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow">
                {rightInfo?.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1">
              {SUMO_CHARACTER_OPTIONS.map((opt) => {
                const selected = rightCharacter === opt.id;
                return (
                  <button
                    key={`menu-right-${opt.id}`}
                    onClick={() => setRightCharacter(opt.id)}
                    className={`p-2.5 sm:p-3 rounded-2xl border-2 flex flex-col items-center justify-between text-center transition-all cursor-pointer ${
                      selected
                        ? 'bg-gradient-to-b from-red-500 to-red-700 text-white border-amber-300 shadow-[0_0_20px_rgba(239,68,68,0.65)] scale-[1.03]'
                        : 'bg-slate-900/80 hover:bg-red-900/50 text-slate-200 border-red-500/30 hover:border-red-400'
                    }`}
                  >
                    <div className="py-1 flex items-center justify-center">
                      <SumoCharacter team="right" character={opt.id} size="card" />
                    </div>
                    <div className="mt-1">
                      <div className="font-black text-xs sm:text-sm leading-tight">{opt.name}</div>
                      <div className={`text-[10px] font-semibold mt-0.5 ${selected ? 'text-red-100' : 'text-slate-400'}`}>
                        {opt.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* FULL-SCREEN BOTTOM ACTION BAR */}
        <div className="w-full max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 z-20 shrink-0">
          <button 
            onClick={() => setShowStartBattleModal(true)} 
            className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xl sm:text-2xl md:text-3xl font-black px-14 py-4 sm:py-5 rounded-full shadow-[0_8px_0_#ca8a04] active:translate-y-1 active:shadow-none transition-all w-full sm:w-auto cursor-pointer hover:scale-105"
          >
            ⚔️ START BATTLE
          </button>
          <button
            onClick={() => { setStudyIndex(0); setStudySelectedOption(null); setScreen('study'); }}
            className="bg-white hover:bg-slate-100 text-slate-900 text-lg sm:text-xl font-black px-10 py-4 sm:py-5 rounded-full shadow-[0_6px_0_#94a3b8] active:translate-y-1 active:shadow-none transition-all w-full sm:w-auto flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <span>📖</span> STUDY MODE
          </button>
        </div>

        {/* Sumo Battle Mode Selection Modal (Single Question vs Split Questions) */}
        {showStartBattleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 md:p-10 max-w-xl w-full text-center shadow-2xl border-4 border-amber-400 relative">
              <button 
                onClick={() => setShowStartBattleModal(false)}
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
                title="Close"
              >
                <X size={24} />
              </button>

              <div className="flex justify-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-md"></div>
                <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-white shadow-md"></div>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tight mb-2">
                Choose Battle Mode
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm font-semibold mb-6">
                Choose how questions will appear in this Sumo battle:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-left">
                {/* SINGLE QUESTION MODE BUTTON */}
                <button
                  onClick={() => startGame(false, 'single')}
                  className="group p-5 rounded-3xl border-3 border-amber-300 hover:border-amber-500 bg-amber-50/70 hover:bg-amber-100/90 transition-all shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">🎯</span>
                      <span className="font-black text-base sm:text-lg text-slate-900 uppercase">Single Question</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Both Red and Blue race to answer <strong className="text-slate-900">1 shared question</strong> centered in the middle of the arena.
                    </p>
                  </div>
                  <div className="mt-4 inline-flex items-center text-xs font-black text-amber-800 uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    Start Single Battle →
                  </div>
                </button>

                {/* SPLIT QUESTION MODE BUTTON */}
                <button
                  onClick={() => startGame(false, 'split')}
                  className="group p-5 rounded-3xl border-3 border-indigo-300 hover:border-indigo-500 bg-indigo-50/70 hover:bg-indigo-100/90 transition-all shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">⚡</span>
                      <span className="font-black text-base sm:text-lg text-slate-900 uppercase">Split Questions</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Each team has their own <strong className="text-slate-900">randomized question order</strong> appearing directly on Red side and Blue side.
                    </p>
                  </div>
                  <div className="mt-4 inline-flex items-center text-xs font-black text-indigo-800 uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    Start Split Battle →
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowStartBattleModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* 3-Mode Selection Modal */}
        <GameModeModal
          isOpen={showModeModal}
          gameData={{
            id: activeGame?.id,
            name: activeGame?.title,
            topic: activeGame?.topic,
            className: activeGame?.classLevel,
            gameType: 'sumo',
            customQuestions: activeGame?.questions || DEFAULT_QUESTIONS
          }}
          onClose={() => setShowModeModal(false)}
          onSelectMode={(mode, adaptedData) => {
            onViewChange(mode as ViewState, adaptedData);
          }}
        />
      </div>
    );
  }

  if (screen === 'end') {
    return (
      <div id="game-container" className="w-full min-h-full flex-1 bg-slate-100 dark:bg-black/95 flex items-center justify-center font-sans p-2 sm:p-4 overflow-y-auto relative">
        <div className="absolute top-4 left-4 z-[60] flex items-center gap-2">
          <button 
            onClick={() => onViewChange("home")}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-black/20 hover:bg-slate-300/50 dark:hover:bg-black/50 border-slate-300/50 dark:border-white/20"
          >
            <ArrowLeft size={24} />
          </button>
          <FullscreenButton targetId="game-container" />
          <button
            onClick={() => setShowModeModal(true)}
            className="px-3.5 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Switch to Bubble Pop or Yoga Quiz"
          >
            <Shuffle size={14} className="text-amber-400" />
            <span>Switch Mode</span>
          </button>
          <button 
            onClick={() => {
              setLeftTeam(prev => ({ ...prev, wins: 0 }));
              setRightTeam(prev => ({ ...prev, wins: 0 }));
              setScreen('menu');
            }}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 bg-red-100/80 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 border-red-300/50 dark:border-red-500/20 shadow-sm"
            title="Quit Game"
          >
            <X size={24} />
          </button>
        </div>

        <div className="bg-white p-10 md:p-16 rounded-[2.5rem] text-center shadow-2xl border-8 border-yellow-400">
          <h2 className={`text-5xl md:text-7xl font-black mb-4 uppercase italic ${winner === 'Blue Team' ? 'text-blue-600' : 'text-red-600'}`}>
            {winner}
          </h2>
          <p className="text-2xl font-black text-slate-800 mb-10 uppercase tracking-widest">Wins the Match!</p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button onClick={() => startGame(true)} className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-2xl font-black px-8 py-5 rounded-full shadow-[0_6px_0_#ca8a04] active:translate-y-1 active:shadow-[0_0px_0_#ca8a04] transition-all">
              Continue
            </button>
            <button onClick={() => {
                setLeftTeam((prev: any) => ({ ...prev, wins: 0 }));
                setRightTeam((prev: any) => ({ ...prev, wins: 0 }));
                startGame(false);
              }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xl font-bold px-8 py-5 rounded-full shadow-[0_6px_0_#94a3b8] active:translate-y-1 active:shadow-[0_0px_0_#94a3b8] transition-all">
              Restart
            </button>
          </div>
        </div>

        {/* 3-Mode Selection Modal */}
        <GameModeModal
          isOpen={showModeModal}
          gameData={{
            id: activeGame?.id,
            name: activeGame?.title,
            topic: activeGame?.topic,
            className: activeGame?.classLevel,
            gameType: 'sumo',
            customQuestions: activeGame?.questions || DEFAULT_QUESTIONS
          }}
          onClose={() => setShowModeModal(false)}
          onSelectMode={(mode, adaptedData) => {
            onViewChange(mode as ViewState, adaptedData);
          }}
        />
      </div>
    );
  }

    const currentQText = leftTeam.q?.text || rightTeam.q?.text || DEFAULT_QUESTIONS[0].text;

    return (
      <div id="game-container" className="w-full min-h-full flex-1 select-none overflow-hidden font-sans relative flex flex-col">
        <SumoStadiumEnvironment 
          battlePos={battlePos} 
          winner={winner} 
          isRumbling={isRumbling}
        >
          {/* TOP ROW: Back icon on top left, Blue & Red team banners in the middle, 3 icons on top right */}
          <div className="w-full flex items-center justify-between shrink-0 z-50 relative gap-2 sm:gap-4 px-1 sm:px-2 mb-1 sm:mb-2">
            {/* TOP LEFT: Back Icon */}
            <button 
              onClick={() => onViewChange("home")}
              className="p-2 sm:p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md border border-amber-900/15 transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Exit to Games"
            >
              <ArrowLeft size={22} className="stroke-[2.5]" />
            </button>

            {/* TOP MIDDLE: Blue Team and Red Team Banners with Real Character SVG Avatars */}
            <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
              {/* Blue Team Banner */}
              <div className="bg-[#0055fe] rounded-2xl md:rounded-3xl px-2.5 sm:px-4 md:px-5 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2.5 shadow-lg shadow-blue-500/25 border-b-4 border-[#0038b3]">
                <button
                  onClick={() => setShowCharacterModal(true)}
                  className="bg-white/95 hover:bg-white rounded-full p-0.5 shadow-sm flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
                  title="Change Blue Team Sumo Character"
                >
                  <SumoCharacter team="left" character={leftCharacter} size="icon" />
                </button>
                <span className="font-black italic text-xs sm:text-sm md:text-lg lg:text-xl text-white uppercase tracking-wider select-none">
                  BLUE TEAM
                </span>
                <div className="bg-white text-blue-700 font-black text-xs sm:text-sm md:text-base px-2 py-0.5 sm:px-3 sm:py-0.5 rounded-full shadow-sm tracking-wide">
                  {leftTeam.wins} WINS
                </div>
              </div>

              {/* Red Team Banner */}
              <div className="bg-[#cc0000] rounded-2xl md:rounded-3xl px-2.5 sm:px-4 md:px-5 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2.5 shadow-lg shadow-red-500/25 border-b-4 border-[#990000]">
                <div className="bg-white text-red-700 font-black text-xs sm:text-sm md:text-base px-2 py-0.5 sm:px-3 sm:py-0.5 rounded-full shadow-sm tracking-wide">
                  {rightTeam.wins} WINS
                </div>
                <span className="font-black italic text-xs sm:text-sm md:text-lg lg:text-xl text-white uppercase tracking-wider select-none">
                  RED TEAM
                </span>
                <button
                  onClick={() => setShowCharacterModal(true)}
                  className="bg-white/95 hover:bg-white rounded-full p-0.5 shadow-sm flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
                  title="Change Red Team Sumo Character"
                >
                  <SumoCharacter team="right" character={rightCharacter} size="icon" />
                </button>
              </div>
            </div>

            {/* TOP RIGHT: Five Controls (Choose Fighters, Font Size Pop-Up, Fullscreen, Sound, Shuffle) */}
            <div className="relative flex items-center gap-1.5 sm:gap-2 bg-white/90 backdrop-blur-md px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full shadow-md border border-amber-900/15">
              <button
                onClick={() => setShowCharacterModal(true)}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 font-black text-[11px] sm:text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Choose Sumo Characters"
              >
                <Users size={15} className="text-amber-700" />
                <span className="hidden sm:inline">Characters</span>
              </button>

              {/* FONT SIZE ICON + POP-UP SELECTOR (SMALL / MEDIUM / LARGE) */}
              <div className="relative">
                <button
                  onClick={() => setShowFontSizePopup((prev) => !prev)}
                  className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full font-black text-[11px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer ${
                    showFontSizePopup
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900'
                  }`}
                  title="Adjust Question & Option Font Size (Small, Medium, Large)"
                >
                  <Type size={15} />
                  <span className="hidden md:inline capitalize">{fontSizeScale}</span>
                </button>

                {showFontSizePopup && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowFontSizePopup(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2.5 py-1">
                        Font Size
                      </div>
                      {([
                        { id: 'small', label: 'Small', badge: 'A' },
                        { id: 'medium', label: 'Medium', badge: 'A+' },
                        { id: 'large', label: 'Large', badge: 'A++' },
                      ] as const).map((item) => {
                        const active = fontSizeScale === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setFontSizeScale(item.id);
                              setShowFontSizePopup(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer mb-1 last:mb-0 ${
                              active
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span>{item.label}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-black ${
                                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <FullscreenButton 
                targetId="game-container" 
                className="!p-1.5 sm:!p-2 !rounded-full !bg-blue-100 hover:!bg-blue-200 !text-blue-700 !border-0 !shadow-none cursor-pointer" 
              />
              <button
                onClick={() => setSoundMuted(!soundMuted)}
                className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-all cursor-pointer"
                title={soundMuted ? "Unmute Sound" : "Mute Sound"}
              >
                {soundMuted ? <VolumeX size={20} className="text-red-500" /> : <Volume2 size={20} className="text-emerald-600" />}
              </button>
              <button
                onClick={() => setShowModeModal(true)}
                className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-all cursor-pointer"
                title="Switch Mode"
              >
                <Shuffle size={20} />
              </button>
            </div>
          </div>

          {/* STATIONARY CLOSE-UP CIRCULAR SUMO DOHYO ARENA & HEROIC FIGHTERS */}
          <div className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col items-center justify-center relative min-h-[250px] sm:min-h-[320px] md:min-h-[370px] pb-1 overflow-visible">
            <CircularSumoArena
              battlePos={battlePos}
              winner={winner}
              isRumbling={isRumbling}
              leftPushing={leftTeam.pushing}
              rightPushing={rightTeam.pushing}
              leftStunned={leftTeam.stunned}
              rightStunned={rightTeam.stunned}
              leftFrozen={leftTeam.frozen}
              rightFrozen={rightTeam.frozen}
              leftCharacter={leftCharacter}
              rightCharacter={rightCharacter}
            />

            {/* Grammar Question Centered Directly UNDER the Arena in Single Question Mode */}
            {questionMode === 'single' && (
              <div className="w-full max-w-5xl mx-auto pt-1 pb-1.5 px-4 text-center z-20 shrink-0 pointer-events-none">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl py-3 sm:py-4 px-6 sm:px-10 shadow-xl border-2 border-amber-900/15">
                  <div className={`${getQuestionFontSize(currentQText, false)} font-black text-[#0f172a] leading-snug tracking-tight drop-shadow-xs break-words`}>
                    {renderQuestionText(currentQText)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM ANSWER AREA (TWO HORIZONTAL CONTAINERS SIDE BY SIDE) */}
          <div className="w-full flex flex-col md:flex-row gap-2 sm:gap-3 md:gap-5 shrink-0 z-20">
            {/* BLUE ANSWER CONTAINER */}
            <div className="flex-1 bg-[#0055fe] rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] p-2 sm:p-4 md:p-5 shadow-2xl border-b-4 md:border-b-8 border-[#0038b3] flex flex-col justify-between">
              {/* Split Mode: Blue Question displayed directly on Blue side */}
              {questionMode === 'split' && (
                <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-3xl p-2.5 sm:p-4 mb-1.5 sm:mb-3.5 shadow-lg border-2 border-blue-400/40 text-center flex flex-col justify-center min-h-[56px] sm:min-h-[88px]">
                  <div className={`${getQuestionFontSize(leftTeam.q?.text || "", true)} font-black text-[#0f172a] leading-snug px-1.5 break-words`}>
                    {renderQuestionText(leftTeam.q?.text || "")}
                  </div>
                </div>
              )}

              <div className={`grid gap-1.5 sm:gap-3 md:gap-4 ${
                (leftTeam.q?.options?.length || 4) === 2 
                  ? 'grid-cols-2' 
                  : (leftTeam.q?.options?.length || 4) === 3 
                    ? 'grid-cols-3' 
                    : 'grid-cols-4'
              }`}>
                {leftTeam.q?.options.map((opt: string, idx: number) => {
                  const keyHints = getBlueKeyHints(leftTeam.q?.options?.length || 4);
                  const isKeyActive = activeKey?.team === 'left' && activeKey?.index === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveKey({ team: 'left', index: idx });
                        setTimeout(() => setActiveKey(null), 160);
                        handleAnswer('left', idx);
                      }}
                      disabled={leftTeam.stunned || leftTeam.frozen}
                      className={`bg-white hover:bg-blue-50 active:translate-y-2 rounded-xl sm:rounded-2xl md:rounded-3xl p-1.5 sm:p-2.5 md:p-3 flex flex-col items-center justify-between min-h-[56px] sm:min-h-[80px] md:min-h-[108px] lg:min-h-[124px] shadow-[0_3px_0_#cbd5e1] sm:shadow-[0_5px_0_#cbd5e1] md:shadow-[0_7px_0_#94a3b8] active:shadow-[0_2px_0_#94a3b8] transition-all cursor-pointer ${
                        isKeyActive ? 'translate-y-2 shadow-[0_2px_0_#94a3b8] bg-blue-100 ring-4 ring-white' : ''
                      } ${leftTeam.stunned || leftTeam.frozen ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="w-4 h-4 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded sm:rounded-lg bg-[#dbeafe] flex items-center justify-center font-black text-[#0055fe] text-[9px] sm:text-xs md:text-sm shadow-xs mb-0.5 sm:mb-1 shrink-0">
                        {keyHints[idx] || (idx + 1)}
                      </div>
                      <div className="flex-1 w-full flex flex-col items-center justify-center px-1 overflow-hidden gap-1">
                        {(() => {
                          const parsedOpt = parseOptionContent(typeof opt === 'string' ? opt : '');
                          return (
                            <>
                              {parsedOpt.imageUrl && (
                                <img
                                  src={parsedOpt.imageUrl}
                                  alt={parsedOpt.text || `Option ${idx + 1}`}
                                  className="max-h-12 sm:max-h-16 w-auto object-contain rounded-lg"
                                />
                              )}
                              {parsedOpt.text && (
                                <span className={`${getOptionFontSize(parsedOpt.text, leftTeam.q?.options?.length || 4)} font-black text-[#0f172a] text-center leading-tight break-words whitespace-normal line-clamp-2`}>
                                  {parsedOpt.text}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RED ANSWER CONTAINER */}
            <div className="flex-1 bg-[#cc0000] rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] p-2 sm:p-4 md:p-5 shadow-2xl border-b-4 md:border-b-8 border-[#990000] flex flex-col justify-between">
              {/* Split Mode: Red Question displayed directly on Red side */}
              {questionMode === 'split' && (
                <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-3xl p-2.5 sm:p-4 mb-1.5 sm:mb-3.5 shadow-lg border-2 border-red-400/40 text-center flex flex-col justify-center min-h-[56px] sm:min-h-[88px]">
                  <div className={`${getQuestionFontSize(rightTeam.q?.text || "", true)} font-black text-[#0f172a] leading-snug px-1.5 break-words`}>
                    {renderQuestionText(rightTeam.q?.text || "")}
                  </div>
                </div>
              )}

              <div className={`grid gap-1.5 sm:gap-3 md:gap-4 ${
                (rightTeam.q?.options?.length || 4) === 2 
                  ? 'grid-cols-2' 
                  : (rightTeam.q?.options?.length || 4) === 3 
                    ? 'grid-cols-3' 
                    : 'grid-cols-4'
              }`}>
                {rightTeam.q?.options.map((opt: string, idx: number) => {
                  const keyHints = getRedKeyHints(rightTeam.q?.options?.length || 4);
                  const isKeyActive = activeKey?.team === 'right' && activeKey?.index === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveKey({ team: 'right', index: idx });
                        setTimeout(() => setActiveKey(null), 160);
                        handleAnswer('right', idx);
                      }}
                      disabled={rightTeam.stunned || rightTeam.frozen}
                      className={`bg-white hover:bg-red-50 active:translate-y-2 rounded-xl sm:rounded-2xl md:rounded-3xl p-1.5 sm:p-2.5 md:p-3 flex flex-col items-center justify-between min-h-[56px] sm:min-h-[80px] md:min-h-[108px] lg:min-h-[124px] shadow-[0_3px_0_#cbd5e1] sm:shadow-[0_5px_0_#cbd5e1] md:shadow-[0_7px_0_#94a3b8] active:shadow-[0_2px_0_#94a3b8] transition-all cursor-pointer ${
                        isKeyActive ? 'translate-y-2 shadow-[0_2px_0_#94a3b8] bg-red-100 ring-4 ring-white' : ''
                      } ${rightTeam.stunned || rightTeam.frozen ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="w-4 h-4 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded sm:rounded-lg bg-[#fee2e2] flex items-center justify-center font-black text-[#cc0000] text-[9px] sm:text-xs md:text-sm shadow-xs mb-0.5 sm:mb-1 shrink-0">
                        {keyHints[idx] || (idx + 1)}
                      </div>
                      <div className="flex-1 w-full flex flex-col items-center justify-center px-1 overflow-hidden gap-1">
                        {(() => {
                          const parsedOpt = parseOptionContent(typeof opt === 'string' ? opt : '');
                          return (
                            <>
                              {parsedOpt.imageUrl && (
                                <img
                                  src={parsedOpt.imageUrl}
                                  alt={parsedOpt.text || `Option ${idx + 1}`}
                                  className="max-h-12 sm:max-h-16 w-auto object-contain rounded-lg"
                                />
                              )}
                              {parsedOpt.text && (
                                <span className={`${getOptionFontSize(parsedOpt.text, rightTeam.q?.options?.length || 4)} font-black text-[#0f172a] text-center leading-tight break-words whitespace-normal line-clamp-2`}>
                                  {parsedOpt.text}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SumoStadiumEnvironment>

        {/* Sumo Character Picker Modal */}
        <SumoCharacterPickerModal
          isOpen={showCharacterModal}
          leftCharacter={leftCharacter}
          rightCharacter={rightCharacter}
          onSelectLeft={setLeftCharacter}
          onSelectRight={setRightCharacter}
          onClose={() => setShowCharacterModal(false)}
        />

        {/* 3-Mode Selection Modal */}
        <GameModeModal
          isOpen={showModeModal}
          gameData={{
            id: activeGame?.id,
            name: activeGame?.title,
            topic: activeGame?.topic,
            className: activeGame?.classLevel,
            gameType: 'sumo',
            customQuestions: activeGame?.questions || DEFAULT_QUESTIONS
          }}
          onClose={() => setShowModeModal(false)}
          onSelectMode={(mode, adaptedData) => {
            onViewChange(mode as ViewState, adaptedData);
          }}
        />
      </div>
    );
}

function GameEditor({ game, onSave, onCancel, folders }: { game: GameData, onSave: (q: GameData) => void, onCancel: () => void, folders: { id: string; name: string }[] }) {
  const [folderId, setFolderId] = useState(game.folderId || "");
  const [topic, setTopic] = useState(game.topic || "");
  const [classLevel, setClassLevel] = useState(game.classLevel || "");
  const [localFolders, setLocalFolders] = useState<{ id: string; name: string }[]>(folders || []);
  const [contentMode, setContentMode] = useState<OptionContentMode>("both");
  const [autoRecommendPhoto, setAutoRecommendPhoto] = useState<boolean>(true);
  const [questions, setQuestions] = useState<Question[]>(() => {
    return game.questions.map(q => {
        if (!q.options || q.options.length < 2) return { ...q, options: ['', ''], answerIndex: 0 };
        return { ...q, options: [...q.options] };
    });
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string, optIndex: number, initialQuery?: string } | null>(null);

  useEffect(() => {
    setLocalFolders(folders || []);
  }, [folders]);

  const handleContentModeChange = (nextMode: OptionContentMode) => {
    setContentMode(nextMode);
    convertQuestionsContentMode(questions, nextMode, (updated) => {
      setQuestions(updated);
      setToastMsg(
        nextMode === "words"
          ? "📝 Converted options to Words Only!"
          : nextMode === "photos_gifs"
          ? "🎨 Converted options to Cartoon PNGs & GIFs!"
          : "✨ Converted options to Both (Words + Cartoon PNGs)!"
      );
      setTimeout(() => setToastMsg(""), 3000);
    });
  };

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

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [copiedPromptInModal, setCopiedPromptInModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const handleCopyAiPrompt = () => {
    const promptText = `Create 50 fill-in-the-blank questions on the topic of Passive Voice. Each question should have 4 multiple-choice options (A, B, C, and D) and include the correct answer.`;
    navigator.clipboard.writeText(promptText);
    setCopiedPromptInModal(true);
    setTimeout(() => setCopiedPromptInModal(false), 2500);
  };

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
      options: item.options || ["", ""],
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
    
    setShowBulkPasteModal(false);
    setBulkText("");
    setToastMsg(`Successfully added ${newItems.length} items!`);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleBulkPaste = (e: React.ClipboardEvent) => {
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
        options: item.options || ["", ""],
        answerIndex: item.answerIndex || 0,
      }));

      setQuestions(prev => {
        if (prev.length === 1 && !prev[0].text.trim()) {
          return newItems;
        }
        return [...prev, ...newItems];
      });
      setToastMsg(`Smart Paste: Added ${newItems.length} items`);
      setTimeout(() => setToastMsg(""), 3000);
    }
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


  const initiateSave = () => {
    const validQuestions = questions.filter(q => q.text.trim());
    if(validQuestions.length === 0) {
      setErrorMsg("Please add at least one complete question.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const handleSave = (isPublic: boolean) => {
    setShowPublishModal(false);
    const generatedTitle = topic.trim() ? topic.trim() : "Sumo Showdown";
    const validQuestions = questions.filter(q => q.text.trim());
    
    onSave({
      ...game,
      title: generatedTitle,
      folderId,
      topic,
      classLevel,
      questions: validQuestions,
      isPublic
    });
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8">
  
        {toastMsg && (
          <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
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
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Bulk Add Q&As</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Paste text to automatically generate questions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVideoGuide(true)}
                    className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-600 dark:text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Watch Video Tutorial"
                  >
                    <Play size={13} className="fill-current text-purple-500" />
                    <span>Video Guide</span>
                  </button>
                  <button onClick={() => setShowBulkPasteModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Walkthrough Banner: 3 Simple Steps */}
              <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Sparkles size={14} /> 3 Simple Steps to Generate 50+ Questions
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAiPrompt}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    {copiedPromptInModal ? (
                      <>
                        <Check size={12} className="text-green-300" />
                        <span>Copied Prompt!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy AI Prompt</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-purple-500/20 flex flex-col gap-1">
                    <span className="font-bold text-purple-600 dark:text-purple-400">1. Prompt ChatGPT / Claude</span>
                    <span className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">Click &ldquo;Copy AI Prompt&rdquo; above and paste it into ChatGPT, Claude, or Gemini.</span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-indigo-500/20 flex flex-col gap-1">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">2. Copy AI Output</span>
                    <span className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">Copy the 50 numbered questions and answer choices directly from the AI.</span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-blue-500/20 flex flex-col gap-1">
                    <span className="font-bold text-blue-600 dark:text-blue-400">3. Paste Here &amp; Click Apply</span>
                    <span className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">Paste in the box below and click &ldquo;Append&rdquo; or &ldquo;Replace All&rdquo; to auto-divide!</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-2">Supported formats:</h4>
                <ul className="text-xs text-blue-600/80 dark:text-blue-400/80 space-y-1 list-disc list-inside">
                  <li><strong>Standard text:</strong> Paste a list of terms/questions, one per line.</li>
                  <li><strong>Excel/Sheets:</strong> Copy cells (Question | Option1 | Option2 | Option3 | Option4).</li>
                  <li><strong>Numbered Q&As:</strong> "1. Question?\nA. Option 1\nB. Option 2".</li>
                </ul>
              </div>

              <textarea 
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Example:\n1. What is the capital of France?\nA. London\nB. Paris\nC. Berlin\nD. Madrid\nAnswer: B\n\nOr paste tabular data directly from Excel!"}
                className="w-full h-64 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-white p-4 rounded-xl focus:border-cyan-500 resize-none font-medium text-sm leading-relaxed"
              ></textarea>

              {bulkText.trim() && (
                <div className="flex items-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in">
                  <Sparkles size={16} />
                  <p>
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
      <div className="bg-white dark:bg-slate-800/80 p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">GAME SETUP</h2>
                <div className="flex gap-3 items-center">
                    <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button onClick={initiateSave} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer">
                        <Save size={18} /> Save GameData
                    </button>
                </div>
            </div>
            
            <SetupCurriculumHeader
              topic={topic}
              setTopic={setTopic}
              classLevel={classLevel}
              setClassLevel={setClassLevel}
              folderId={folderId}
              setFolderId={setFolderId}
              folders={localFolders}
              onCreateFolder={(name) => {
                const newF = { id: `folder_${Date.now()}`, name };
                setLocalFolders((prev) => [...prev, newF]);
                setFolderId(newF.id);
              }}
              contentMode={contentMode}
              setContentMode={handleContentModeChange}
              autoRecommendPhoto={autoRecommendPhoto}
              setAutoRecommendPhoto={setAutoRecommendPhoto}
              onApplyStarterTopic={(starterQs) => {
                const formatted = starterQs.map((sq, i) => ({
                  id: Date.now() + i + Math.random(),
                  text: sq.text,
                  options: sq.options,
                  answerIndex: sq.answerIndex,
                }));
                setQuestions(formatted);
                convertQuestionsContentMode(formatted, contentMode, (updated) => {
                  setQuestions(updated);
                });
                setToastMsg(`✨ Loaded ${formatted.length} "${topic}" questions with auto Cartoon PNGs!`);
                setTimeout(() => setToastMsg(""), 3500);
              }}
            />
        </div>

        {errorMsg && (
          <div className="bg-red-500/20 text-red-400 p-3 mx-6 mt-6 rounded-lg font-medium text-center border border-red-500/30 animate-pulse">
            {errorMsg}
          </div>
        )}

        <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50" onPaste={handleBulkPaste}>
          {/* Smart Paste Banner */}
          <div className="bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                <Info size={18} />
              </div>
              <p className="text-xs sm:text-sm font-medium">
                <span className="font-bold">Smart Paste:</span> Paste multiple lines, numbered Q&As, or Excel rows directly into any box below — they will automatically populate!
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => setShowVideoGuide(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-500/25 flex items-center gap-1.5 cursor-pointer border border-purple-400/30"
                title="Watch Video Tutorial: How to Bulk Paste with AI"
              >
                <div className="w-4 h-4 rounded-full bg-white text-purple-700 flex items-center justify-center shrink-0">
                  <Play size={10} className="ml-0.5 fill-current" />
                </div>
                <span>How to Bulk Paste</span>
              </button>
              <button
                onClick={() => setShowBulkPasteModal(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <ClipboardList size={14} /> Bulk Paste Modal
              </button>
            </div>
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
                className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer"
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
                  placeholder="Type your question here..."
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-slate-800 dark:text-white font-medium"
                />
              </div>

              <div className="ml-12 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((opt, optIndex) => (
                  <SmartOptionInput
                    key={optIndex}
                    value={opt}
                    optionIndex={optIndex}
                    isCorrect={q.answerIndex === optIndex}
                    onSelectCorrect={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                    onChangeValue={(val) => updateOption(q.id, optIndex, val)}
                    onOpenMediaPicker={(initialQuery) => setActiveGiphyInput({ qId: q.id, optIndex, initialQuery })}
                    contentMode={contentMode}
                    autoRecommendPhoto={autoRecommendPhoto}
                    placeholder={`Option ${optIndex + 1} (e.g. apple)`}
                    radioName={`answer-${q.id}`}
                  />
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
        initialQuery={activeGiphyInput?.initialQuery || ""}
        onSelect={(url) => {
          if (activeGiphyInput) {
            const targetQ = questions.find((q) => q.id === activeGiphyInput.qId);
            const currentRaw = targetQ?.options[activeGiphyInput.optIndex] || "";
            const parsed = parseOptionContent(currentRaw);
            const nextVal = formatOptionContent(parsed.text, url, contentMode === "words" ? "both" : contentMode);
            updateOption(activeGiphyInput.qId, activeGiphyInput.optIndex, nextVal);
            setActiveGiphyInput(null);
          }
        }}
      />

      <BulkPasteVideoModal
        isOpen={showVideoGuide}
        onClose={() => setShowVideoGuide(false)}
        onOpenBulkPasteWithSample={(sample) => {
          setBulkText(sample);
          setShowBulkPasteModal(true);
        }}
      />
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

  const allEmptyOptions = items.every(q => q.options!.every(o => o === ""));
  
  // Ensure each question has at least 4 options
  items.forEach(q => {
     if (q.options) {
        while (q.options.length < 4) {
            q.options.push("");
        }
     }
  });

  if (allEmptyOptions && items.length > 0) {
     return items; 
  }

  return items;
}
