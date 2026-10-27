import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { MediaPickerModal } from "../components/MediaPickerModal";
import { BulkPasteVideoModal } from "../components/BulkPasteVideoModal";
import { SetupCurriculumHeader, SmartOptionInput, SmartQuestionInput, convertQuestionsContentMode } from "../components/SetupSmartControls";
import { parseOptionContent, formatOptionContent, AnswerContentMode } from "../utils/mediaAndPresets";
import { ArrowLeft, Edit3, Trash2, Heart, Plus, Sparkles, BookOpen, Search, Save, X, Play, Folder, Image as ImageIcon, ClipboardList, Info, Settings, Copy, Flag, Volume2, VolumeX, Shuffle, Check } from "lucide-react";
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { GameModeModal } from "../components/GameModeModal";
import { drawCharacterHand, HandCharacterType, toPx, distPx } from "../utils/superheroHands";
import { drawAnimatedNose, NoseStyle } from "../utils/animatedNose";

type GameScreen = 'intro' | 'lobby' | 'editor' | 'setup' | 'loading' | 'game' | 'results' | 'study';

interface PlayerData {
  level: number;
  xp: number;
  xpNext: number;
  coins: number;
}

interface StatsData {
  gamesPlayed: number;
  bubblesPopped: number;
}

interface Question {
  id: number | string;
  text: string;
  image?: string;
  options: string[];
  answerIndex: number;
}

interface Quiz {
  id: number | string;
  title?: string;
  subject?: string;
  folderId?: string;
  topic?: string;
  classLevel?: string;
  questions: Question[];
  thumbnail?: string;
  isFavorite?: boolean;
  isPublic?: boolean;
}

const BLANK_QUESTION = (): Question => ({
  id: Date.now(),
  text: "",
  options: ["", "", "", ""],
  answerIndex: 0
});

const DEFAULT_BUBBLE_QUESTIONS: Question[] = [];

export function BubblePop({ onViewChange, initialGame }: { onViewChange: (view: ViewState, data?: any) => void, initialGame?: any }) {
  const { user } = useAuth();
  const hasLoadedQuestions = Boolean(
    initialGame && (
      (initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
      (initialGame.questions && initialGame.questions.length > 0)
    )
  );
  const [screen, setScreen] = useState<GameScreen>(initialGame && !initialGame.editMode && hasLoadedQuestions ? 'setup' : 'editor');
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [showModeModal, setShowModeModal] = useState(false);

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
  const [playerData, setPlayerData] = useState<PlayerData>({
    level: 12, xp: 2430, xpNext: 3000, coins: 150
  });

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(() => {
    if (initialGame) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : [BLANK_QUESTION()]);

      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList,
      };
    }
    return {
      id: Date.now(),
      title: "",
      folderId: "",
      topic: "",
      classLevel: "",
      questions: [{ id: Date.now(), text: "", options: ["", "", "", ""], answerIndex: 0 }]
    };
  });

  useEffect(() => {
    if (initialGame) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : [BLANK_QUESTION()]);

      setActiveQuiz({
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "Bubble Pop",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList,
      });

      if (!initialGame.editMode && hasLoadedQuestions) {
        setScreen('setup');
      } else {
        setScreen('editor');
      }
    }
  }, [initialGame]);

  const saveQuiz = async (quiz: Quiz) => {
    if (!user) {
      alert("You must be logged in to save games.");
      return;
    }

    try {
      const isPublicBool = Boolean(quiz.isPublic);
      const now = new Date().toISOString();

      const isOwnExistingGame = Boolean(
        initialGame?.id &&
        !String(initialGame.id).startsWith('sample-') &&
        (!initialGame.userId || initialGame.userId === user.uid)
      );

      const gameToSave = JSON.parse(JSON.stringify({
        name: quiz.title || quiz.topic || "Bubble Pop Game",
        title: quiz.title || quiz.topic || "Bubble Pop Game",
        folderId: quiz.folderId || "",
        topic: quiz.topic || "",
        className: quiz.classLevel || "",
        gameType: "bubble-pop",
        customQuestions: quiz.questions,
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
    } catch (error: any) {
      console.error("Error saving game:", error);
      alert("Failed to save game: " + (error?.message || String(error)));
      onViewChange("games");
    }
  };

  const [statsData, setStatsData] = useState<StatsData>({
    gamesPlayed: 0, bubblesPopped: 0
  });
  
  const [numPlayers, setNumPlayers] = useState(1);
  const [scores, setScores] = useState([0, 0]);
  const [frozenTeams, setFrozenTeams] = useState([false, false]);
  const [questionText, setQuestionText] = useState("Loading...");
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [resultsTitle, setResultsTitle] = useState("Good Try!");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const cameraRef = useRef<any>(null);
  const handsRef = useRef<any>(null);
  const faceMeshRef = useRef<any>(null);
  const detectedHandsRef = useRef<any[]>([]);
  const detectedFacesRef = useRef<any[]>([]);
  const lastNosePopTimeRef = useRef(0);

  // Tracker mode & customization state
  const [trackerMode, setTrackerMode] = useState<'finger' | 'hand' | 'nose'>(() => {
    try {
      const saved = localStorage.getItem('bubbleTrackerMode_v1');
      if (saved === 'finger' || saved === 'hand' || saved === 'nose') return saved;
    } catch (e) {}
    return 'finger';
  });
  const [handCharacter, setHandCharacter] = useState<HandCharacterType>(() => {
    try {
      const saved = localStorage.getItem('bubbleHandCharacter_v1');
      if (saved) return saved as HandCharacterType;
    } catch (e) {}
    return 'spiderman';
  });
  const [noseStyle, setNoseStyle] = useState<NoseStyle>(() => {
    try {
      const saved = localStorage.getItem('bubbleNoseStyle_v1');
      if (saved) return saved as NoseStyle;
    } catch (e) {}
    return 'real';
  });
  const [showTrackerModal, setShowTrackerModal] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('bubbleTrackerMode_v1', trackerMode); } catch (e) {}
  }, [trackerMode]);
  useEffect(() => {
    try { localStorage.setItem('bubbleHandCharacter_v1', handCharacter); } catch (e) {}
  }, [handCharacter]);
  useEffect(() => {
    try { localStorage.setItem('bubbleNoseStyle_v1', noseStyle); } catch (e) {}
  }, [noseStyle]);

  const trackerModeRef = useRef(trackerMode);
  trackerModeRef.current = trackerMode;
  const handCharacterRef = useRef(handCharacter);
  handCharacterRef.current = handCharacter;
  const noseStyleRef = useRef(noseStyle);
  noseStyleRef.current = noseStyle;

  const [cameraError, setCameraError] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [p1Name, setP1Name] = useState("Team 1");
  const [p2Name, setP2Name] = useState("Team 2");
  const [speed, setSpeed] = useState(1);
  const [showInGameSettings, setShowInGameSettings] = useState(false);
  const handleSetSpeed = (val: number) => { setSpeed(val); gameState.current.speed = val; };
  const handleSetBubbleSize = (val: number) => { setBubbleSize(val); gameState.current.size = val; };
  const handleSetTwistEnabled = (val: boolean) => { setTwistEnabled(val); gameState.current.twist = val; };
  const [bubbleSize, setBubbleSize] = useState(1);
  const [twistEnabled, setTwistEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState('theme-sky');
  const [studyIndex, setStudyIndex] = useState(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null);
  const handleSetVoiceEnabled = (val: boolean) => { setVoiceEnabled(val); gameState.current.voice = val; };
  
  // Game engine state refs
  const gameState = useRef({
    isActive: false,
    numPlayers: 1,
    scores: [0, 0],
    frozenTeams: [false, false],
    currentQuestionIndex: 0,
    combo: 0,
    maxCombo: 0,
    correctPops: 0,
    wrongPops: 0,
    questionStartTime: 0,
    questions: [] as Question[],
    speed: 1,
    size: 1,
    twist: false,
    voice: true
  });
  
  const questionTimerRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Graphics state
  const graphicsState = useRef({
    bubbles: [] as any[],
    particles: [] as any[],
    shockwaves: [] as any[],
    floatingTexts: [] as any[],
    ambientParticles: [] as any[],
    isQuestionActive: false
  });
  
  const pointerColors = [
    { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)' }, 
    { main: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)' }  
  ];

  const pointers = useRef([
    { x: -100, y: -100, targetX: -100, targetY: -100, detected: false, history: [] as any[], color: pointerColors[0] },
    { x: -100, y: -100, targetX: -100, targetY: -100, detected: false, history: [] as any[], color: pointerColors[1] }
  ]);

  useEffect(() => {
    const saved = localStorage.getItem('bubbleAcademySave');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.player) setPlayerData(parsed.player);
            if (parsed.stats) setStatsData(parsed.stats);
        } catch (e) {}
    }
    
    return () => {
      gameState.current.isActive = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      if (cameraRef.current && cameraRef.current.stop) {
          cameraRef.current.stop();
      }
      if (handsRef.current && handsRef.current.close) {
          try { handsRef.current.close(); } catch(e) {}
      }
      if (faceMeshRef.current && faceMeshRef.current.close) {
          try { faceMeshRef.current.close(); } catch(e) {}
      }
    };
  }, []);

  const saveGame = (p: PlayerData, s: StatsData) => {
    localStorage.setItem('bubbleAcademySave', JSON.stringify({ player: p, stats: s }));
  };

  const initAudio = () => {
    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
    }
  };

  const playSound = (type: 'pop' | 'win' | 'lose') => {
    if (!audioCtxRef.current) return;
    const osc = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);
    const now = audioCtxRef.current.currentTime;
    const comboMultiplier = Math.min(gameState.current.combo || 0, 10);
    const pitchShift = 1 + (comboMultiplier * 0.1); 
    
    if (type === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 * pitchShift, now);
        osc.frequency.exponentialRampToValueAtTime(100 * pitchShift, now + 0.1);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'win') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440 * pitchShift, now);
        osc.frequency.setValueAtTime(554.37 * pitchShift, now + 0.1);
        osc.frequency.setValueAtTime(659.25 * pitchShift, now + 0.2);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now); osc.stop(now + 0.45);
    } else if (type === 'lose') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.3);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.35);
    }
  };

  const speakText = (text: string) => {
    if (!gameState.current.voice) return;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const cleanedText = text.replace(/_+/g, "blank");
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        
        // Try to find a natural female voice
        const voices = window.speechSynthesis.getVoices();
        const femaleVoices = voices.filter(v => 
            v.name.includes('Google US English') || 
            v.name.includes('Samantha') || 
            v.name.includes('Victoria') ||
            v.name.includes('Karen') ||
            v.name.includes('Tessa') ||
            (v.name.includes('Female') && v.lang.startsWith('en')) ||
            (v.name.includes('Zira') && v.lang.startsWith('en'))
        );
        
        if (femaleVoices.length > 0) {
            utterance.voice = femaleVoices[0];
        }
        
        utterance.rate = 0.95; 
        utterance.pitch = 1.15; 
        window.speechSynthesis.speak(utterance);
    }
  };

  const startGameMode = async (players: number) => {
    setNumPlayers(players);
    gameState.current.numPlayers = players;
    initAudio();
    
    setScreen('loading');
    
    if (!videoRef.current?.srcObject && !isCameraActive) {
       try {
           await setupCamera();
       } catch (err) {
           console.warn("Camera could not start; continuing with mouse/touch mode:", err);
       }
    }
    
    continueStartGame(players);
  };

  const continueStartGame = (players: number = numPlayers) => {
    if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
    }

    gameState.current = {
        isActive: true,
        numPlayers: players,
        scores: [0, 0],
        frozenTeams: [false, false],
        currentQuestionIndex: 0,
        combo: 0,
        maxCombo: 0,
        correctPops: 0,
        wrongPops: 0,
        questionStartTime: 0,
        questions: activeQuiz ? [...activeQuiz.questions].sort(() => 0.5 - Math.random()) : [],
        speed: speed,
        size: bubbleSize,
        twist: twistEnabled,
        voice: voiceEnabled
    };

    // Clean reset for pointers
    pointers.current.forEach(p => {
        p.x = -100;
        p.y = -100;
        p.targetX = -100;
        p.targetY = -100;
        p.detected = false;
        p.history = [];
    });
    
    setScores([0, 0]);
    setCombo(0);
    setShowCombo(false);
    setScreen('game');
    
    setTimeout(() => {
        runGameEngine();
        startQuestion();
    }, 100);
  };

  class Bubble {
      index: number; text: string; isCorrect: boolean; color: string;
      radius: number; scale: number; targetScale: number;
      x: number; y: number; baseVy: number; vy: number; vx: number;
      time: number; popped: boolean; state: string; width: number; height: number;
      imageElement?: HTMLImageElement;
      playerId?: number;

      constructor(index: number, text: string, isCorrect: boolean, totalOptions: number, w: number, h: number, playerId?: number) {
          this.playerId = playerId;
          this.index = index; this.text = text; this.isCorrect = isCorrect;
          const bubbleColors = ['#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#f97316'];
          this.color = bubbleColors[index % bubbleColors.length];
          this.width = w; this.height = h;
          
          this.radius = Math.min(w, h) * 0.09 * (gameState.current.size || 1); 
          this.scale = 0; 
          this.targetScale = 1;
          
          let usableW = w;
          let xOffset = 0;
          if (playerId === 0) { usableW = w / 2; xOffset = 0; }
          else if (playerId === 1) { usableW = w / 2; xOffset = w / 2; }
          
          const sectionWidth = usableW / totalOptions;
          this.x = xOffset + (sectionWidth * index) + (sectionWidth / 2) + ((Math.random() - 0.5) * sectionWidth * 0.4); 
          this.y = -this.radius - (Math.random() * 200); 
          this.baseVy = (1.5 + Math.random()) * (gameState.current.speed || 1);
          this.vy = this.baseVy;
          this.vx = (Math.random() - 0.5) * 1.5 * (gameState.current.speed || 1); 
          this.time = Math.random() * 100;
          this.popped = false;
          this.state = 'normal';

          const parsedOpt = parseOptionContent(this.text);
          this.text = parsedOpt.text || '';
          if (parsedOpt.imageUrl) {
              this.imageElement = new Image();
              this.imageElement.onload = () => { (this.imageElement as any).isLoaded = true; };
              this.imageElement.src = parsedOpt.imageUrl;
          }
      }
      update() {
          if (this.popped) return;
          this.time += 0.05 * (gameState.current.speed || 1);
          this.scale += (this.targetScale - this.scale) * 0.15;
          
          if (gameState.current.twist) {
              this.vx = Math.sin(this.time * 2) * 5 * (gameState.current.speed || 1);
              this.x += this.vx;
          } else {
              this.x += this.vx + Math.sin(this.time) * 1.5 * (gameState.current.speed || 1);
          }
          
          this.y += this.vy + Math.cos(this.time * 0.5) * 0.5 * (gameState.current.speed || 1);
          if (this.y > this.height + this.radius) {
              this.y = -this.radius;
              let usableW = this.width;
              let xOffset = 0;
              if (this.playerId === 0) { usableW = this.width / 2; xOffset = 0; }
              else if (this.playerId === 1) { usableW = this.width / 2; xOffset = this.width / 2; }
              this.x = xOffset + (usableW * 0.15) + (Math.random() * usableW * 0.7);
          }
          
          let minX = this.radius;
          let maxX = this.width - this.radius;
          if (this.playerId === 0) maxX = (this.width / 2) - this.radius;
          if (this.playerId === 1) minX = (this.width / 2) + this.radius;
          
          if (this.x < minX || this.x > maxX) {
              this.vx *= -1;
              if (this.x < minX) this.x = minX;
              if (this.x > maxX) this.x = maxX;
          }
      }
      draw(ctx: CanvasRenderingContext2D) {
          if (this.popped) return;
          ctx.save();
          ctx.translate(this.x, this.y);
          const wobble = 1 + Math.sin(this.time * 2) * 0.03;
          let finalScale = this.scale * wobble;
          if(this.state === 'shaking') finalScale += (Math.random() - 0.5) * 0.1;
          ctx.scale(finalScale, 1/finalScale);
          if (gameState.current.twist) {
              ctx.rotate(this.time * 2 * (gameState.current.speed || 1));
          }

          const grad = ctx.createRadialGradient(-this.radius*0.3, -this.radius*0.3, this.radius*0.1, 0, 0, this.radius);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          grad.addColorStop(0.2, this.color);
          grad.addColorStop(0.8, this.color + 'aa');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');

          ctx.beginPath();
          ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.shadowColor = this.color;
          ctx.shadowBlur = 15;
          ctx.stroke();
          ctx.shadowBlur = 0; 

          ctx.beginPath();
          ctx.arc(-this.radius*0.3, -this.radius*0.3, this.radius*0.4, Math.PI, Math.PI*1.5);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = this.radius * 0.15;
          ctx.lineCap = 'round';
          ctx.stroke();

          if (this.imageElement && (this.imageElement as any).isLoaded) {
              ctx.save();
              ctx.beginPath();
              ctx.arc(0, 0, this.radius * 0.82, 0, Math.PI * 2);
              ctx.clip();
              if (this.text) {
                  const imgSize = this.radius * 1.15;
                  ctx.drawImage(this.imageElement, -imgSize / 2, -this.radius * 0.72, imgSize, imgSize);
              } else {
                  const imgSize = this.radius * 1.55;
                  ctx.drawImage(this.imageElement, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
              }
              ctx.restore();

              if (this.text) {
                  ctx.fillStyle = '#ffffff';
                  const fontSize = Math.max(12, this.text.length > 6 ? this.radius * 0.28 : this.radius * 0.34);
                  ctx.font = `900 ${fontSize}px 'Fredoka', sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.lineWidth = 4;
                  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
                  ctx.strokeText(this.text, 0, this.radius * 0.56);
                  ctx.fillText(this.text, 0, this.radius * 0.56);
              }
          } else if (this.text) {
              ctx.fillStyle = '#ffffff';
              const fontSize = this.text.length > 4 ? this.radius * 0.40 : this.radius * 0.55;
              ctx.font = `900 ${fontSize}px 'Fredoka', sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.shadowColor = 'rgba(0,0,0,0.6)';
              ctx.shadowBlur = 4;
              ctx.fillText(this.text, 0, this.radius * 0.05);
          }
          ctx.restore();
      }
      checkCollision(px: number, py: number, pIndex?: number) {
          if (this.popped || this.scale < 0.8) return false;
          if (this.playerId !== undefined && pIndex !== undefined && this.playerId !== pIndex) return false;
          const dx = this.x - px;
          const dy = this.y - py;
          return (dx*dx + dy*dy) < (this.radius * this.radius);
      }
  }

  class Particle {
      x: number; y: number; color: string; isSparkle: boolean;
      vx: number; vy: number; life: number; size: number;
      constructor(x: number, y: number, color: string, isSparkle = false) {
          this.x = x; this.y = y; this.color = color; this.isSparkle = isSparkle;
          const speed = isSparkle ? 20 : 12;
          this.vx = (Math.random() - 0.5) * speed;
          this.vy = (Math.random() - 0.5) * speed;
          this.life = 1.0;
          this.size = isSparkle ? Math.random() * 4 + 2 : Math.random() * 8 + 4;
      }
      update() {
          this.x += this.vx; this.y += this.vy;
          this.vy += 0.4; this.life -= 0.03;
      }
      draw(ctx: CanvasRenderingContext2D) {
          if (this.life <= 0) return;
          ctx.save();
          ctx.globalAlpha = this.life;
          if (this.isSparkle) {
              ctx.fillStyle = '#ffffff';
              // Removed shadowBlur to fix heavy lag during multi-explosions
              ctx.beginPath();
              ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
              ctx.fill();
          } else {
              ctx.fillStyle = this.color;
              ctx.beginPath();
              ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
              ctx.fill();
          }
          ctx.restore();
      }
  }

  class Shockwave {
      x: number; y: number; color: string; radius: number; life: number;
      constructor(x: number, y: number, color: string) {
          this.x = x; this.y = y; this.color = color;
          this.radius = 10; this.life = 1.0;
      }
      update() { this.radius += 8; this.life -= 0.05; }
      draw(ctx: CanvasRenderingContext2D) {
          if (this.life <= 0) return;
          ctx.save();
          ctx.globalAlpha = this.life;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
          ctx.lineWidth = 4;
          ctx.strokeStyle = this.color;
          ctx.stroke();
          ctx.restore();
      }
  }

  class FloatingText {
      x: number; y: number; text: string; color: string; life: number; vy: number; vx: number; size: number;
      targetX?: number; targetY?: number; delay: number;
      
      constructor(x: number, y: number, text: string, color: string, isCombo = false, targetX?: number, targetY?: number) {
          this.x = x; this.y = y; this.text = text; this.color = color;
          this.life = 1.5; // Longer life
          this.size = isCombo ? 100 : 40;
          this.targetX = targetX;
          this.targetY = targetY;
          this.delay = 45; // wait ~0.75s floating up before moving to target
          this.vx = 0;
          this.vy = -1.5; // Float up slowly initially
      }
      update() { 
          if (this.targetX !== undefined && this.targetY !== undefined) {
              if (this.delay > 0) {
                  this.delay--;
                  this.y += this.vy;
              } else {
                  const dx = this.targetX - this.x;
                  const dy = this.targetY - this.y;
                  const dist = Math.sqrt(dx*dx + dy*dy);
                  if (dist > 15) {
                      this.vx = (dx / dist) * 25;
                      this.vy = (dy / dist) * 25;
                      this.x += this.vx;
                      this.y += this.vy;
                  }
              }
          } else {
              this.y += this.vy;
          }
          this.life -= 0.015; 
      }
      draw(ctx: CanvasRenderingContext2D) {
          if (this.life <= 0) return;
          ctx.save();
          ctx.globalAlpha = Math.min(1, this.life); // Cap at 1
          ctx.font = `900 ${this.size}px 'Fredoka', sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 6; ctx.strokeStyle = '#000000';
          ctx.strokeText(this.text, this.x, this.y);
          ctx.fillStyle = this.color;
          ctx.fillText(this.text, this.x, this.y);
          ctx.restore();
      }
  }

  const createExplosion = (x: number, y: number, color: string, isPrimary = true) => {
      graphicsState.current.shockwaves.push(new Shockwave(x, y, color));
      const pCount = isPrimary ? 12 : 5;
      const sCount = isPrimary ? 8 : 3;
      for (let i=0; i<pCount; i++) graphicsState.current.particles.push(new Particle(x, y, color, false)); 
      for (let i=0; i<sCount; i++) graphicsState.current.particles.push(new Particle(x, y, color, true));  
  };

  const startQuestion = () => {
    if (gameState.current.currentQuestionIndex >= gameState.current.questions.length) {
        showResults();
        return;
    }
    const q = gameState.current.questions[gameState.current.currentQuestionIndex];
    const parsedQ = parseOptionContent(q.text || '');
    const qImg = parsedQ.imageUrl || q.image || null;
    const qDisplayText = parsedQ.text || (qImg ? '' : q.text);
    setQuestionText(qDisplayText);
    setQuestionImage(qImg);
    if (qDisplayText) {
      speakText(qDisplayText);
    }
    
    gameState.current.frozenTeams = [false, false];
    setFrozenTeams([false, false]);
    
    graphicsState.current.bubbles = []; 
    graphicsState.current.floatingTexts = [];
    graphicsState.current.isQuestionActive = false;
    
    let timeLeft = 3; 
    setCountdown(timeLeft);
    
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    
    questionTimerRef.current = setInterval(() => {
        if (!gameState.current.isActive) {
            clearInterval(questionTimerRef.current);
            return;
        }
        timeLeft--;
        if (timeLeft > 0) {
            setCountdown(timeLeft);
            playSound('pop'); 
        } else {
            clearInterval(questionTimerRef.current);
            setCountdown(null);
            
            const w = containerRef.current?.clientWidth || 800;
            const h = containerRef.current?.clientHeight || 600;

            const rawOptions = Array.isArray(q.options) ? q.options : [];
            let validOpts = rawOptions.filter((opt: any) => typeof opt === 'string' && opt.trim() !== "");
            if (validOpts.length < 2) validOpts = ["Yes", "No"];
            const correctOptText = rawOptions[q.answerIndex] !== undefined ? rawOptions[q.answerIndex] : validOpts[0];

            validOpts.forEach((optText, i) => {
                const isCorrect = optText === correctOptText;
                if (gameState.current.numPlayers === 2) {
                    graphicsState.current.bubbles.push(new Bubble(i, optText, isCorrect, validOpts.length, w, h, 0));
                    graphicsState.current.bubbles.push(new Bubble(i, optText, isCorrect, validOpts.length, w, h, 1));
                } else {
                    graphicsState.current.bubbles.push(new Bubble(i, optText, isCorrect, validOpts.length, w, h));
                }
            });
            
            graphicsState.current.isQuestionActive = true;
            gameState.current.questionStartTime = Date.now(); 
        }
    }, 1000);
  };

  const handlePop = (bubble: any, playerIndex: number) => {
    if (!graphicsState.current.isQuestionActive || bubble.popped || bubble.state === 'shaking') return;
    if (gameState.current.frozenTeams[playerIndex]) return;
    
    bubble.state = 'shaking'; 
    
    setTimeout(() => {
        bubble.popped = true;
        createExplosion(bubble.x, bubble.y, bubble.color);
        
        if (bubble.isCorrect) {
            playSound('win');
            setStatsData(prev => ({...prev, bubblesPopped: prev.bubblesPopped + 1}));
            gameState.current.correctPops++;
            gameState.current.combo++;
            
            if(gameState.current.combo > gameState.current.maxCombo) {
                gameState.current.maxCombo = gameState.current.combo;
            }
            
            let points = 5;
            gameState.current.scores[playerIndex] += points;
            
            const w = containerRef.current?.clientWidth || 800;
            const targetX = playerIndex === 0 ? 100 : w - 100;
            graphicsState.current.floatingTexts.push(new FloatingText(bubble.x, bubble.y, `+5`, '#4ade80', true, targetX, 80));
            
            if(gameState.current.combo > 1) {
                setCombo(gameState.current.combo);
                setShowCombo(true);
                // Trigger re-render animation using a small timeout hack in real life, but React handles it by remounting if keyed or we can just rely on css animation triggers on state change.
            }
            
            setScores([...gameState.current.scores]);
            graphicsState.current.isQuestionActive = false;
            
            graphicsState.current.bubbles.forEach(b => {
                if (!b.popped) {
                    setTimeout(() => {
                        b.popped = true;
                        createExplosion(b.x, b.y, b.color, false);
                        playSound('pop');
                    }, Math.random() * 300);
                }
            });

            setQuestionText(`Amazing!`);
            setQuestionImage(null);
            speakText("Correct!");
            
            setTimeout(() => {
                gameState.current.currentQuestionIndex++;
                setCurrentQuestionIndex(gameState.current.currentQuestionIndex);
                setShowCombo(false);
                
                if (gameState.current.currentQuestionIndex >= gameState.current.questions.length) {
                    showResults();
                } else {
                    startQuestion();
                }
            }, 2000);

        } else {
            playSound('lose');
            gameState.current.wrongPops++;
            gameState.current.combo = 0; 
            setShowCombo(false);

            const penalty = 5;
            gameState.current.scores[playerIndex] = Math.max(0, gameState.current.scores[playerIndex] - penalty);
            setScores([...gameState.current.scores]);
            
            const w = containerRef.current?.clientWidth || 800;
            const targetX = playerIndex === 0 ? 100 : w - 100;
            graphicsState.current.floatingTexts.push(new FloatingText(bubble.x, bubble.y, `-5`, '#ef4444', true, targetX, 80));
            
            if (gameState.current.numPlayers === 2) {
                const otherTeamIndex = playerIndex === 0 ? 1 : 0;
                if (gameState.current.frozenTeams[otherTeamIndex]) {
                    // Unfreeze both since both got it wrong
                    gameState.current.frozenTeams = [false, false];
                    setFrozenTeams([false, false]);
                } else {
                    // Freeze the team that got it wrong
                    const newFrozen = [...gameState.current.frozenTeams];
                    newFrozen[playerIndex] = true;
                    gameState.current.frozenTeams = newFrozen;
                    setFrozenTeams(newFrozen);
                }
            }
            
            if (canvasRef.current) {
                canvasRef.current.classList.add('shake');
                setTimeout(() => canvasRef.current?.classList.remove('shake'), 400);
            }
        }
    }, 100);
  };

  const showResults = () => {
    gameState.current.isActive = false;
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
    }
    
    const total = gameState.current.correctPops + gameState.current.wrongPops;
    const acc = total === 0 ? 0 : Math.round((gameState.current.correctPops / total) * 100);
    const totalScore = gameState.current.scores[0] + gameState.current.scores[1];
    
    const xp = totalScore + (gameState.current.maxCombo * 20);
    const coins = Math.floor(xp / 10);
    
    let newLevel = playerData.level;
    let newXp = playerData.xp + xp;
    let newXpNext = playerData.xpNext;

    if(newXp >= newXpNext) {
        newLevel++;
        newXp -= newXpNext;
        newXpNext = Math.floor(newXpNext * 1.5);
    }

    const newPlayerData = {
        ...playerData,
        level: newLevel,
        xp: newXp,
        xpNext: newXpNext,
        coins: playerData.coins + coins
    };

    const newStatsData = {
        ...statsData,
        gamesPlayed: statsData.gamesPlayed + 1
    };

    setPlayerData(newPlayerData);
    setStatsData(newStatsData);
    saveGame(newPlayerData, newStatsData);

    setAccuracy(acc);
    setXpEarned(xp);
    setCoinsEarned(coins);
    
    let title = "Good Try!";
    if (gameState.current.numPlayers === 1) {
        if (acc > 90) title = "Perfect Round!";
        else if (acc > 70) title = "Excellent!";
    } else {
        if (gameState.current.scores[0] > gameState.current.scores[1]) {
            title = `${p1Name} Wins!`;
        } else if (gameState.current.scores[1] > gameState.current.scores[0]) {
            title = `${p2Name} Wins!`;
        } else {
            title = "It's a Tie!";
        }
    }
    setResultsTitle(title);
    
    playSound('win');
    setScreen('results');
  };

  const runGameEngine = () => {
    if (!gameState.current.isActive) return;
    
    animationRef.current = requestAnimationFrame(runGameEngine);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (gameState.current.numPlayers === 2) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([15, 15]);
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.stroke();
        ctx.restore();
    }

    // Video rendering handled by DOM element underneath the canvas now.
    
    

    graphicsState.current.bubbles.forEach(b => { b.update(); b.draw(ctx); });
    
    ctx.globalCompositeOperation = 'lighter'; 
    graphicsState.current.particles = graphicsState.current.particles.filter(p => p.life > 0);
    graphicsState.current.particles.forEach(p => { p.update(); p.draw(ctx); });
    
    graphicsState.current.shockwaves = graphicsState.current.shockwaves.filter(s => s.life > 0);
    graphicsState.current.shockwaves.forEach(s => { s.update(); s.draw(ctx); });
    ctx.globalCompositeOperation = 'source-over'; 

    graphicsState.current.floatingTexts = graphicsState.current.floatingTexts.filter(ft => ft.life > 0);
    graphicsState.current.floatingTexts.forEach(ft => { ft.update(); ft.draw(ctx); });

    // Ambient background particles
    if (Math.random() < 0.2) {
        graphicsState.current.ambientParticles.push({
            x: Math.random() * width,
            y: height + 20,
            vy: -1 - Math.random() * 2,
            size: Math.random() * 4 + 1,
            alpha: Math.random() * 0.5 + 0.1
        });
    }
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    graphicsState.current.ambientParticles = graphicsState.current.ambientParticles.filter(p => p.y > -20);
    graphicsState.current.ambientParticles.forEach(p => {
        p.y += p.vy;
        p.x += Math.sin(p.y * 0.01) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();

    const vW = videoRef.current?.videoWidth || 640;
    const vH = videoRef.current?.videoHeight || 480;
    const currentMode = trackerModeRef.current;
    const currentHandChar = handCharacterRef.current;
    const currentNoseStyle = noseStyleRef.current;

    // 1. FINGER TRACKER MODE: Keep magical glowing ball and starlight cursor
    if (currentMode === 'finger') {
      pointers.current.forEach((pointer, pIndex) => {
        if (gameState.current.numPlayers === 1) {
            pointer.color = pIndex === 0 
                ? { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)' } 
                : { main: '#a855f7', glow: 'rgba(168, 85, 247, 0.6)' };
        } else {
            pointer.color = pIndex === 0 
                ? { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)' } 
                : { main: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)' };
        }

        if (pointer.detected) {
            if (pointer.x === -100) { 
                pointer.x = pointer.targetX; 
                pointer.y = pointer.targetY; 
                pointer.history = [{ x: pointer.x, y: pointer.y }];
            } else {
                const dx = pointer.targetX - pointer.x;
                const dy = pointer.targetY - pointer.y;
                const dist = Math.hypot(dx, dy);

                if (dist > 1.5) {
                    let alpha = 0.45;
                    if (dist < 12) alpha = 0.22;
                    else if (dist > 70) alpha = 0.65;

                    const maxStep = 110;
                    let stepX = dx * alpha;
                    let stepY = dy * alpha;
                    const stepDist = Math.hypot(stepX, stepY);
                    if (stepDist > maxStep) {
                        stepX = (stepX / stepDist) * maxStep;
                        stepY = (stepY / stepDist) * maxStep;
                    }

                    pointer.x += stepX;
                    pointer.y += stepY;
                }
            }
            
            if (gameState.current.numPlayers === 2) {
                if (pIndex === 0) {
                    pointer.x = Math.min(pointer.x, (width / 2) - 10);
                } else if (pIndex === 1) {
                    pointer.x = Math.max(pointer.x, (width / 2) + 10);
                }
            }
            
            pointer.history.push({x: pointer.x, y: pointer.y});
            if (pointer.history.length > 15) pointer.history.shift();

            if (graphicsState.current.isQuestionActive) {
                let poppedThisFrame = false;
                const effectivePlayerIndex = gameState.current.numPlayers === 1 ? 0 : pIndex;
                graphicsState.current.bubbles.forEach(b => {
                    if (poppedThisFrame || b.popped) return;
                    
                    const prevPoint = pointer.history.length > 3 ? pointer.history[pointer.history.length - 3] : null;
                    const isContinuousSwipe = prevPoint && Math.hypot(pointer.x - prevPoint.x, pointer.y - prevPoint.y) < 120;
                    
                    const isHitting = b.checkCollision(pointer.x, pointer.y, effectivePlayerIndex) ||
                                      (isContinuousSwipe && b.checkCollision(prevPoint.x, prevPoint.y, effectivePlayerIndex));
                                      
                    if (isHitting) { 
                        handlePop(b, effectivePlayerIndex); 
                        poppedThisFrame = true; 
                    }
                });
            }
        } else if (pointer.history.length > 0) {
            pointer.history.shift(); 
            if (pointer.history.length === 0) {
                pointer.x = -100; pointer.y = -100;
            }
        }

        // Draw Magical Ball / Star Trail
        if (pointer.history.length > 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath();
            ctx.moveTo(pointer.history[0].x, pointer.history[0].y);
            for (let i = 1; i < pointer.history.length; i++) {
                ctx.lineTo(pointer.history[i].x, pointer.history[i].y);
            }
            ctx.strokeStyle = pointer.color.glow;
            ctx.lineWidth = 30;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            
            ctx.strokeStyle = pointer.color.main;
            ctx.lineWidth = 10;
            ctx.stroke();
            ctx.restore();
            
            const tip = pointer.history[pointer.history.length - 1];
            ctx.save();
            ctx.translate(tip.x, tip.y);
            
            const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            
            ctx.rotate(Date.now() * 0.003);
            ctx.scale(pulse, pulse);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = pointer.color.main;
            ctx.shadowBlur = 25;
            
            // Intricate magic star ball cursor
            ctx.beginPath();
            ctx.moveTo(0, -25); ctx.quadraticCurveTo(6, -6, 25, 0);
            ctx.quadraticCurveTo(6, 6, 0, 25); ctx.quadraticCurveTo(-6, 6, -25, 0);
            ctx.quadraticCurveTo(-6, -6, 0, -25);
            ctx.fill();
            
            // Inner core
            ctx.fillStyle = pointer.color.main;
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
      });
    }

    // 2. HAND TRACKER MODE: Stylized Character Hands (Spider-Man, Thanos, Witch, Hulk, etc.)
    else if (currentMode === 'hand') {
      const hands = detectedHandsRef.current;
      
      if (hands.length > 0) {
        hands.forEach((hand) => {
          if (!hand || hand.length < 21) return;
          const palmPx = toPx(hand[9] || hand[0], width, height, vW, vH);
          const effectivePlayer = gameState.current.numPlayers === 1 ? 0 : (palmPx.x < width / 2 ? 0 : 1);

          // Multi-point strike collision (palm center + all 5 fingertips)
          const strikePoints = [
            toPx(hand[9], width, height, vW, vH),   // Palm center
            toPx(hand[4], width, height, vW, vH),   // Thumb tip
            toPx(hand[8], width, height, vW, vH),   // Index tip
            toPx(hand[12], width, height, vW, vH),  // Middle tip
            toPx(hand[16], width, height, vW, vH),  // Ring tip
            toPx(hand[20], width, height, vW, vH),  // Pinky tip
          ];

          if (graphicsState.current.isQuestionActive) {
            let poppedThisHand = false;
            graphicsState.current.bubbles.forEach(b => {
              if (poppedThisHand || b.popped) return;
              for (const pt of strikePoints) {
                if (b.checkCollision(pt.x, pt.y, effectivePlayer)) {
                  handlePop(b, effectivePlayer);
                  poppedThisHand = true;
                  break;
                }
              }
            });
          }

          // Draw chosen Character Hand directly onto the canvas with real isotropic projection
          drawCharacterHand(
            ctx,
            hand,
            currentHandChar,
            width,
            height,
            false,
            0,
            performance.now(),
            vW,
            vH
          );
        });
      } else {
        // Fallback for mouse / preview when no camera hand is detected
        pointers.current.forEach((pointer, pIndex) => {
          if (!pointer.detected) return;
          const effectivePlayer = gameState.current.numPlayers === 1 ? 0 : pIndex;
          if (graphicsState.current.isQuestionActive) {
            graphicsState.current.bubbles.forEach(b => {
              if (!b.popped && b.checkCollision(pointer.x, pointer.y, effectivePlayer)) {
                handlePop(b, effectivePlayer);
              }
            });
          }
          ctx.save();
          ctx.translate(pointer.x, pointer.y);
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 15;
          ctx.font = '48px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const icon = currentHandChar === 'spiderman' ? '🕷️' :
                       currentHandChar === 'thanos' ? '🧤' :
                       currentHandChar === 'witch' ? '🧙‍♀️' :
                       currentHandChar === 'hulk' ? '💪' :
                       currentHandChar === 'ironman' ? '🤖' :
                       currentHandChar === 'frost' ? '❄️' : '⚡';
          ctx.fillText(icon, 0, 0);
          ctx.restore();
        });
      }
    }

    // 3. NOSE TRACKER MODE: Real Animated Sniffing Nose & Whimsical Styles
    else if (currentMode === 'nose') {
      const faces = detectedFacesRef.current;

      if (faces.length > 0) {
        faces.forEach((face) => {
          if (!face || face.length < 5) return;
          const tip = face[1];
          if (!tip) return;
          const tipPx = toPx(tip, width, height, vW, vH);
          const bridgePx = face[168] ? toPx(face[168], width, height, vW, vH) : undefined;

          // Dynamically compute nose size from eye distance
          let noseSize = 38;
          if (face[33] && face[263]) {
            const eye1 = toPx(face[33], width, height, vW, vH);
            const eye2 = toPx(face[263], width, height, vW, vH);
            const eyeDist = Math.hypot(eye2.x - eye1.x, eye2.y - eye1.y);
            noseSize = Math.max(22, Math.min(65, eyeDist * 0.38));
          }

          let angle = 0;
          if (bridgePx) {
            angle = Math.atan2(tipPx.x - bridgePx.x, tipPx.y - bridgePx.y);
          }

          const effectivePlayer = gameState.current.numPlayers === 1 ? 0 : (tipPx.x < width / 2 ? 0 : 1);

          // Nose Bubble Collision Check
          if (graphicsState.current.isQuestionActive) {
            let poppedThisFace = false;
            graphicsState.current.bubbles.forEach(b => {
              if (poppedThisFace || b.popped) return;
              const dx = b.x - tipPx.x;
              const dy = b.y - tipPx.y;
              const hitRadius = b.radius + (noseSize * 0.7);
              if (dx * dx + dy * dy < hitRadius * hitRadius) {
                if (b.playerId === undefined || b.playerId === effectivePlayer) {
                  lastNosePopTimeRef.current = Date.now();
                  handlePop(b, effectivePlayer);
                  poppedThisFace = true;
                }
              }
            });
          }

          const isPopping = (Date.now() - lastNosePopTimeRef.current) < 350;

          // Render Real Animated Nose directly over player's nose
          drawAnimatedNose({
            ctx,
            noseTip: tipPx,
            noseBridge: bridgePx,
            noseSize,
            angle,
            style: currentNoseStyle,
            isPopping,
            time: performance.now()
          });
        });
      } else {
        // Fallback for mouse / preview when no camera face is detected
        pointers.current.forEach((pointer, pIndex) => {
          if (!pointer.detected) return;
          const effectivePlayer = gameState.current.numPlayers === 1 ? 0 : pIndex;
          if (graphicsState.current.isQuestionActive) {
            graphicsState.current.bubbles.forEach(b => {
              if (!b.popped && b.checkCollision(pointer.x, pointer.y, effectivePlayer)) {
                lastNosePopTimeRef.current = Date.now();
                handlePop(b, effectivePlayer);
              }
            });
          }
          const isPopping = (Date.now() - lastNosePopTimeRef.current) < 350;
          drawAnimatedNose({
            ctx,
            noseTip: { x: pointer.x, y: pointer.y },
            noseSize: 38,
            angle: 0,
            style: currentNoseStyle,
            isPopping,
            time: performance.now()
          });
        });
      }
    }
  };

  const onHandsResults = (results: any) => {
    if (!gameState.current.isActive) return;
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    const vW = videoRef.current?.videoWidth || 640;
    const vH = videoRef.current?.videoHeight || 480;

    pointers.current.forEach(p => p.detected = false);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        detectedHandsRef.current = [];
        return;
    }

    // Mirror horizontal coordinates to match CSS object-cover mirrored video
    detectedHandsRef.current = results.multiHandLandmarks.map((hand: any[]) =>
        hand.map((lm: any) => ({
            x: 1.0 - lm.x,
            y: lm.y,
            z: lm.z
        }))
    );

    // Extract index finger tips for finger tracker
    const detected: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < detectedHandsRef.current.length; i++) {
        const landmarks = detectedHandsRef.current[i];
        if (!landmarks || landmarks.length < 9) continue;
        const tip = landmarks[8];
        if (!tip || isNaN(tip.x) || isNaN(tip.y)) continue;
        const pt = toPx(tip, width, height, vW, vH);
        detected.push(pt);
    }

    if (detected.length === 0) return;

    if (gameState.current.numPlayers === 1) {
        if (detected.length === 1) {
            const hand = detected[0];
            const p0 = pointers.current[0];
            const p1 = pointers.current[1];
            const d0 = p0.x !== -100 ? Math.hypot(hand.x - p0.x, hand.y - p0.y) : Infinity;
            const d1 = p1.x !== -100 ? Math.hypot(hand.x - p1.x, hand.y - p1.y) : Infinity;
            if (d1 < d0 && d1 < 220) {
                p1.targetX = hand.x; p1.targetY = hand.y; p1.detected = true;
            } else {
                p0.targetX = hand.x; p0.targetY = hand.y; p0.detected = true;
            }
        } else {
            detected.sort((a, b) => a.x - b.x);
            pointers.current[0].targetX = detected[0].x;
            pointers.current[0].targetY = detected[0].y;
            pointers.current[0].detected = true;
            pointers.current[1].targetX = detected[1].x;
            pointers.current[1].targetY = detected[1].y;
            pointers.current[1].detected = true;
        }
    } else {
        const leftHands = detected.filter(h => h.x < width / 2);
        const rightHands = detected.filter(h => h.x >= width / 2);
        if (leftHands.length > 0) {
            pointers.current[0].targetX = Math.min(leftHands[0].x, (width / 2) - 12);
            pointers.current[0].targetY = leftHands[0].y;
            pointers.current[0].detected = true;
        }
        if (rightHands.length > 0) {
            pointers.current[1].targetX = Math.max(rightHands[0].x, (width / 2) + 12);
            pointers.current[1].targetY = rightHands[0].y;
            pointers.current[1].detected = true;
        }
    }
  };

  const onFaceResults = (results: any) => {
    if (!gameState.current.isActive) return;
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    const vW = videoRef.current?.videoWidth || 640;
    const vH = videoRef.current?.videoHeight || 480;

    pointers.current.forEach(p => p.detected = false);

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        detectedFacesRef.current = [];
        return;
    }

    // Mirror face landmarks to match mirrored video
    detectedFacesRef.current = results.multiFaceLandmarks.map((face: any[]) =>
        face.map((lm: any) => ({
            x: 1.0 - lm.x,
            y: lm.y,
            z: lm.z
        }))
    );

    const detected: Array<{ x: number; y: number }> = [];
    detectedFacesRef.current.forEach(face => {
        if (!face || face.length < 5) return;
        const tip = face[1];
        if (!tip || isNaN(tip.x) || isNaN(tip.y)) return;
        const pt = toPx(tip, width, height, vW, vH);
        detected.push(pt);
    });

    if (detected.length === 0) return;

    if (gameState.current.numPlayers === 1) {
        pointers.current[0].targetX = detected[0].x;
        pointers.current[0].targetY = detected[0].y;
        pointers.current[0].detected = true;
    } else {
        const leftFaces = detected.filter(f => f.x < width / 2);
        const rightFaces = detected.filter(f => f.x >= width / 2);
        if (leftFaces.length > 0) {
            pointers.current[0].targetX = Math.min(leftFaces[0].x, (width / 2) - 12);
            pointers.current[0].targetY = leftFaces[0].y;
            pointers.current[0].detected = true;
        }
        if (rightFaces.length > 0) {
            pointers.current[1].targetX = Math.max(rightFaces[0].x, (width / 2) + 12);
            pointers.current[1].targetY = rightFaces[0].y;
            pointers.current[1].detected = true;
        }
    }
  };

  const setupCamera = async () => {
    try {
        setCameraError("");
        const win = window as any;

        // Safely stop any previous camera stream or MediaPipe instances
        if (cameraRef.current && cameraRef.current.stop) {
            cameraRef.current.stop();
            cameraRef.current = null;
        }
        if (handsRef.current && handsRef.current.close) {
            try { handsRef.current.close(); } catch(e) {}
            handsRef.current = null;
        }
        if (faceMeshRef.current && faceMeshRef.current.close) {
            try { faceMeshRef.current.close(); } catch(e) {}
            faceMeshRef.current = null;
        }

        // Initialize MediaPipe Hands
        if (win.Hands) {
            const hands = new win.Hands({
                locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            hands.setOptions({ 
                maxNumHands: 2, 
                modelComplexity: 1, 
                minDetectionConfidence: 0.6, 
                minTrackingConfidence: 0.6 
            });
            hands.onResults(onHandsResults);
            handsRef.current = hands;
        }

        // Initialize MediaPipe FaceMesh
        if (win.FaceMesh) {
            const faceMesh = new win.FaceMesh({
                locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });
            faceMesh.setOptions({
                maxNumFaces: 2,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            faceMesh.onResults(onFaceResults);
            faceMeshRef.current = faceMesh;
        }
        
        if (videoRef.current) {
            let stream: MediaStream | null = null;
            if (navigator?.mediaDevices?.getUserMedia) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { 
                            facingMode: 'user',
                            width: { ideal: 640 },
                            height: { ideal: 480 },
                            frameRate: { ideal: 30 }
                        } 
                    });
                } catch (prefErr: any) {
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: 'user' }
                        });
                    } catch (fallback1Err: any) {
                        try {
                            stream = await navigator.mediaDevices.getUserMedia({
                                video: true
                            });
                        } catch (finalErr: any) {
                            console.warn("Webcam not detected or access denied:", finalErr?.name || finalErr?.message);
                            setCameraError("Webcam not detected on this device. Mouse and touch pointer mode are enabled automatically!");
                            setIsCameraActive(false);
                            return;
                        }
                    }
                }
            } else {
                setCameraError("Camera API not supported in this browser. Mouse/touch pointer mode is active.");
                setIsCameraActive(false);
                return;
            }

            if (!stream) {
                setIsCameraActive(false);
                return;
            }

            videoRef.current.srcObject = stream;
            
            await new Promise((resolve) => {
                if (videoRef.current) {
                    videoRef.current.onloadedmetadata = () => resolve(null);
                } else {
                    resolve(null);
                }
            });
            
            try {
                await videoRef.current.play();
            } catch (playErr) {
                // Autoplay will proceed on user gesture
            }
            
            let active = true;
            let isProcessing = false;
            let lastFrameTime = 0;
            let animId: number | null = null;
            const TARGET_INTERVAL_MS = 33; // ~30 FPS throttling keeps CPU/GPU cool

            const sendFrames = async (time: number) => {
                if (!active || !videoRef.current) return;
                
                if (
                    videoRef.current.readyState >= 2 && 
                    !isProcessing && 
                    (time - lastFrameTime >= TARGET_INTERVAL_MS)
                ) {
                    isProcessing = true;
                    lastFrameTime = time;
                    try {
                        const currentMode = trackerModeRef.current;
                        if (currentMode === 'nose') {
                            if (faceMeshRef.current) {
                                await faceMeshRef.current.send({ image: videoRef.current });
                            }
                        } else {
                            if (handsRef.current) {
                                await handsRef.current.send({ image: videoRef.current });
                            }
                        }
                    } catch (err) {
                        // ignore dropped frames
                    } finally {
                        isProcessing = false;
                    }
                }
                if (active) {
                    animId = requestAnimationFrame(sendFrames);
                }
            };
            animId = requestAnimationFrame(sendFrames);
            
            cameraRef.current = {
                stop: () => {
                    active = false;
                    if (animId) cancelAnimationFrame(animId);
                    stream.getTracks().forEach(t => t.stop());
                    if (videoRef.current) videoRef.current.srcObject = null;
                }
            };
            
            setIsCameraActive(true);
            setCameraError("");
        }
    } catch (e: any) {
        console.warn("Camera setup notice:", e?.message || e);
        setCameraError("Camera unavailable. Mouse and touch controls are ready!");
        setIsCameraActive(false);
    }
  };

  
  useEffect(() => {
    if (screen === 'setup' && !isCameraActive && !cameraRef.current && !cameraError) {
        setupCamera().catch(e => console.warn("Initial camera setup notice:", e?.message || e));
    }
  }, [screen, isCameraActive, cameraError]);

  useEffect(() => {
    if (canvasRef.current && screen === 'game') {
        const handleMouseMove = (e: MouseEvent) => {
            if (!gameState.current.isActive) return;
            const rect = canvasRef.current!.getBoundingClientRect();
            const width = rect.width;
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            
            if (gameState.current.numPlayers === 1) {
                pointers.current[0].x = mx; pointers.current[0].y = my; pointers.current[0].detected = true; pointers.current[0].targetX = mx; pointers.current[0].targetY = my;
            } else {
                const isLeft = mx < width / 2;
                pointers.current[isLeft ? 0 : 1].x = mx; pointers.current[isLeft ? 0 : 1].y = my;
                pointers.current[isLeft ? 0 : 1].detected = true; pointers.current[isLeft ? 0 : 1].targetX = mx; pointers.current[isLeft ? 0 : 1].targetY = my;
            }
        };

        const handleTouch = (e: TouchEvent) => {
            if (!gameState.current.isActive || !e.touches.length) return;
            const rect = canvasRef.current!.getBoundingClientRect();
            const width = rect.width;
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                const tx = touch.clientX - rect.left;
                const ty = touch.clientY - rect.top;
                if (gameState.current.numPlayers === 1) {
                    pointers.current[0].x = tx; pointers.current[0].y = ty; pointers.current[0].detected = true; pointers.current[0].targetX = tx; pointers.current[0].targetY = ty;
                } else {
                    const isLeft = tx < width / 2;
                    pointers.current[isLeft ? 0 : 1].x = tx; pointers.current[isLeft ? 0 : 1].y = ty;
                    pointers.current[isLeft ? 0 : 1].detected = true; pointers.current[isLeft ? 0 : 1].targetX = tx; pointers.current[isLeft ? 0 : 1].targetY = ty;
                }
            }
        };

        const canvas = canvasRef.current;
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('touchstart', handleTouch, { passive: true });
        canvas.addEventListener('touchmove', handleTouch, { passive: true });
        return () => {
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('touchstart', handleTouch);
            canvas.removeEventListener('touchmove', handleTouch);
        };
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== 'study' || !activeQuiz) return;

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') {
            if (studyIndex < activeQuiz.questions.length - 1) {
                setStudyIndex(prev => prev + 1);
                setStudySelectedOption(null);
            } else {
                setScreen('setup');
                setStudyIndex(0);
                setStudySelectedOption(null);
            }
        } else if (e.key === 'ArrowLeft') {
            if (studyIndex > 0) {
                setStudyIndex(prev => prev - 1);
                setStudySelectedOption(null);
            } else {
                setScreen('setup');
                setStudyIndex(0);
                setStudySelectedOption(null);
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, studyIndex, activeQuiz]);

  return (
    <div id="game-container" className="w-full min-h-full flex-1 bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-white flex flex-col font-['Fredoka',sans-serif] overflow-hidden relative selection:bg-cyan-500/30 rounded-xl" ref={containerRef}>
      
      {/* Back button overlay */}
      <div className="absolute top-4 left-4 z-[60] flex items-center gap-3">
        <button 
          onClick={() => {
              gameState.current.isActive = false;
              if (cameraRef.current && cameraRef.current.stop) { cameraRef.current.stop(); setIsCameraActive(false); }
              setIsCameraActive(false);
              if (handsRef.current && handsRef.current.close) handsRef.current.close();
              onViewChange("home");
          }}
          className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-black/20 hover:bg-slate-300/50 dark:hover:bg-black/50 border-slate-300/50 dark:border-white/20"
        >
          <ArrowLeft size={24} />
        </button>

        {/* Switch Mode Button */}
        <button
          onClick={() => setShowModeModal(true)}
          className="px-3.5 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="Play this lesson in Yoga Quiz or Sumo Showdown"
        >
          <Shuffle size={14} className="text-amber-400" />
          <span>Switch Mode</span>
        </button>
      </div>
        <div className="absolute top-4 right-4 z-[70] flex gap-3 pointer-events-auto">
        {screen === 'game' && (
          <>
            <button 
              onClick={() => setShowTrackerModal(true)} 
              className="h-12 px-3.5 sm:px-4 flex items-center gap-2 rounded-full bg-white/25 dark:bg-black/45 hover:bg-white/35 dark:hover:bg-black/65 backdrop-blur-md border border-white/30 dark:border-white/20 text-slate-800 dark:text-white transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer font-bold" 
              title="Tracker Options: Finger Ball, Character Hands, or Animated Nose"
            >
              <span className="text-xl">
                {trackerMode === 'finger' && '☝️'}
                {trackerMode === 'hand' && (
                  handCharacter === 'spiderman' ? '🕷️' :
                  handCharacter === 'thanos' ? '🧤' :
                  handCharacter === 'witch' ? '🧙‍♀️' :
                  handCharacter === 'hulk' ? '💪' :
                  handCharacter === 'ironman' ? '🤖' :
                  handCharacter === 'frost' ? '❄️' : '⚡'
                )}
                {trackerMode === 'nose' && (
                  noseStyle === 'real' ? '👃' :
                  noseStyle === 'clown' ? '🔴' :
                  noseStyle === 'rudolph' ? '🦌' :
                  noseStyle === 'pig' ? '🐷' :
                  noseStyle === 'cat' ? '🐱' : '🤥'
                )}
              </span>
              <span className="hidden sm:inline text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                {trackerMode === 'finger' && 'Finger'}
                {trackerMode === 'hand' && (
                  handCharacter === 'spiderman' ? 'Spidey' :
                  handCharacter === 'thanos' ? 'Thanos' :
                  handCharacter === 'witch' ? 'Witch' :
                  handCharacter === 'hulk' ? 'Hulk' :
                  handCharacter === 'ironman' ? 'Iron Man' :
                  handCharacter === 'frost' ? 'Frost' : 'Cyber'
                )}
                {trackerMode === 'nose' && (
                  noseStyle === 'real' ? 'Real Nose' :
                  noseStyle === 'clown' ? 'Clown' :
                  noseStyle === 'rudolph' ? 'Rudolph' :
                  noseStyle === 'pig' ? 'Pig' :
                  noseStyle === 'cat' ? 'Cat' : 'Pinocchio'
                )}
              </span>
            </button>
            <button onClick={() => setShowInGameSettings(!showInGameSettings)} className="w-12 h-12 flex justify-center items-center rounded-full bg-white/20 dark:bg-black/40 hover:bg-white/30 backdrop-blur-md border border-white/30 text-slate-800 dark:text-white transition-all shadow-lg cursor-pointer">
                <Settings size={20} />
            </button>
          </>
        )}
        <FullscreenButton targetId="game-container" className="" />
      </div>

      {screen === 'study' && activeQuiz && (
        <div 
            className="absolute inset-0 z-[100] flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white overflow-hidden" 
            id="study-container"
        >
            <div className="absolute top-4 left-4 z-20">
                <button 
                    onClick={() => {
                        setScreen('setup');
                        setStudyIndex(0);
                        setStudySelectedOption(null);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full shadow-sm text-white font-bold transition-all cursor-pointer hover:scale-105 active:scale-95"
                >
                    <ArrowLeft size={24} /> Back
                </button>
            </div>
            <div className="absolute top-4 right-4 z-20 text-white [&>button]:bg-white/10 [&>button]:hover:bg-white/20 [&>button]:border [&>button]:border-white/20 [&>button]:text-white">
                <FullscreenButton targetId="study-container" />
            </div>

            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-cyan-300 font-extrabold text-xl bg-white/10 border border-white/20 px-6 py-2 rounded-full z-10 backdrop-blur-md shadow-md">
                {studyIndex + 1} / {activeQuiz.questions.length}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-12 w-full h-full max-w-5xl mx-auto">
                {activeQuiz.questions.length > 0 ? (
                    <>
                        {(() => {
                            const currentStudyQ = activeQuiz.questions[studyIndex];
                            const parsedStudyQ = parseOptionContent(currentStudyQ?.text || '');
                            const studyQImg = parsedStudyQ.imageUrl || currentStudyQ?.image || null;
                            return (
                                <div className="flex flex-col items-center justify-center gap-5 mb-10 max-w-full">
                                    {studyQImg && (
                                        <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-3xl bg-white/95 p-3 shadow-2xl border-4 border-cyan-400/50 flex items-center justify-center overflow-hidden">
                                            <img src={studyQImg} alt={parsedStudyQ.text || 'Question Media'} className="w-full h-full object-contain rounded-2xl" />
                                        </div>
                                    )}
                                    {parsedStudyQ.text && (
                                        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight text-center max-w-full break-words drop-shadow-lg">
                                            {parsedStudyQ.text}
                                        </h1>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
                            {activeQuiz.questions[studyIndex]?.options.map((opt, i) => {
                                if (!opt || opt.trim() === '') return null;
                                const isSelected = studySelectedOption === i;
                                const isCorrect = i === activeQuiz.questions[studyIndex].answerIndex;
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
                                        className={`relative p-6 sm:p-8 rounded-[2rem] text-2xl sm:text-3xl font-bold transition-all duration-300 transform border-2 cursor-pointer ${
                                            showAsCorrect ? 'bg-emerald-500 border-emerald-300 text-white shadow-[0_0_40px_rgba(16,185,129,0.5)] scale-105 z-10' :
                                            showAsIncorrect ? 'bg-rose-500 border-rose-300 text-white opacity-90 scale-95 shadow-[0_0_25px_rgba(244,63,94,0.4)]' :
                                            studySelectedOption !== null ? 'bg-white/5 border-white/10 text-white/40 opacity-40 cursor-not-allowed' :
                                            'bg-white/10 text-white hover:bg-white/20 hover:scale-105 hover:shadow-xl shadow-lg border-white/20 hover:border-cyan-400'
                                        }`}
                                    >
                                        <div className="flex items-center justify-center gap-4">
                                            {(() => {
                                                const parsed = parseOptionContent(opt);
                                                return (
                                                    <>
                                                        {parsed.imageUrl && (
                                                            <img src={parsed.imageUrl} alt={parsed.text || 'Option'} className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl bg-white/90 p-1 shrink-0" />
                                                        )}
                                                        {parsed.text && <span>{parsed.text}</span>}
                                                    </>
                                                );
                                            })()}
                                            {showAsCorrect && <span className="text-4xl animate-bounce">✅</span>}
                                            {showAsIncorrect && <span className="text-4xl">❌</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className={`mt-12 h-20 transition-all duration-500 ${studySelectedOption !== null ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                            <button
                                onClick={() => {
                                    if (studyIndex < activeQuiz.questions.length - 1) {
                                        setStudyIndex(studyIndex + 1);
                                        setStudySelectedOption(null);
                                    } else {
                                        setScreen('setup');
                                        setStudyIndex(0);
                                        setStudySelectedOption(null);
                                    }
                                }}
                                className="px-12 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-2xl rounded-full shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                            >
                                {studyIndex < activeQuiz.questions.length - 1 ? 'Next Question →' : 'Finish Study'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="text-slate-500 text-3xl font-bold">No questions in this quiz!</div>
                )}
            </div>
        </div>
      )}

      {screen === 'game' && showInGameSettings && (
          <div className="absolute right-4 top-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-2 border-blue-500 rounded-3xl p-6 shadow-2xl w-80 pointer-events-auto z-[80]">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">Game Settings</h3>
                  <button onClick={() => setShowInGameSettings(false)} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition-colors cursor-pointer">
                      <X size={16} />
                  </button>
              </div>
              <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold">
                      <div className="flex justify-between items-center">
                          <span>Bubble Speed</span>
                          <div className="flex gap-2">
                                <button onClick={() => handleSetSpeed(0.25)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${speed === 0.25 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Slow</button>
                                <button onClick={() => handleSetSpeed(1)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${speed === 1 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Normal</button>
                                <button onClick={() => handleSetSpeed(2.5)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${speed === 2.5 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Fast</button>
                          </div>
                      </div>
                  </div>
                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold">
                      <div className="flex justify-between items-center">
                          <span>Bubble Size</span>
                          <div className="flex gap-2">
                                <button onClick={() => handleSetBubbleSize(0.5)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${bubbleSize === 0.5 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Small</button>
                                <button onClick={() => handleSetBubbleSize(1)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${bubbleSize === 1 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Normal</button>
                                <button onClick={() => handleSetBubbleSize(2)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${bubbleSize === 2 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Big</button>
                          </div>
                      </div>
                  </div>
                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold">
                        <div className="flex justify-between items-center">
                            <span>Twist Mode</span>
                            <button onClick={() => handleSetTwistEnabled(!twistEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${twistEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${twistEnabled ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                  </div>
                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold">
                        <div className="flex justify-between items-center">
                            <span>Voice Narration</span>
                            <button onClick={() => handleSetVoiceEnabled(!voiceEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${voiceEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${voiceEnabled ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                  </div>

                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span>Tracker Mode</span>
                      <button 
                        onClick={() => {
                          setShowInGameSettings(false);
                          setShowTrackerModal(true);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-sm shadow-md flex items-center justify-between cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <span className="flex items-center gap-2">
                          <span>{trackerMode === 'finger' ? '☝️' : trackerMode === 'hand' ? '🖐️' : '👃'}</span>
                          <span className="capitalize">{trackerMode} Tracker</span>
                        </span>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">Change</span>
                      </button>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <button 
                        onClick={() => {
                          setShowInGameSettings(false);
                          showResults();
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Flag size={16} />
                        End Game & View Results
                      </button>
                  </div>
              </div>
          </div>
      )}

      {screen === 'game' && (
        <div className="absolute bottom-4 right-4 z-[50] flex flex-col items-end pointer-events-none">
            <div className="bg-white/80 dark:bg-black/60 backdrop-blur-md rounded-2xl px-6 py-3 shadow-lg border border-slate-200 dark:border-white/20">
                <div className="text-slate-500 dark:text-slate-400 font-bold text-sm tracking-widest uppercase mb-1">Question</div>
                <div className="text-3xl font-black text-slate-800 dark:text-white flex items-baseline gap-1">
                    <span>{currentQuestionIndex + 1}</span>
                    <span className="text-xl text-slate-400 dark:text-slate-500">/{gameState.current.questions.length}</span>
                </div>
            </div>
        </div>
      )}

      <style>{`
        .glass-panel {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.1);
        }
        .dark .glass-panel {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        }
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            transition: all 0.2s;
        }
        .btn-primary:hover {
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 10px 25px rgba(139, 92, 246, 0.5);
        }
        .loading-bar-container {
            width: 300px; height: 20px; background: rgba(0,0,0,0.3);
            border-radius: 10px; overflow: hidden; border: 2px solid rgba(255,255,255,0.2);
        }
        .loading-bar-fill {
            height: 100%; background: linear-gradient(90deg, #4ade80, #3b82f6);
            transition: width 0.1s linear;
        }
        @keyframes popIn {
            0% { transform: scale(0); opacity: 0; }
            80% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
            10%, 90% { transform: translate3d(-10px, 0, 0); }
            20%, 80% { transform: translate3d(15px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-20px, 0, 0); }
            40%, 60% { transform: translate3d(20px, 0, 0); }
        }
      `}</style>
      
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]" autoPlay playsInline muted></video>

      {/* Screen: Intro */}
      {screen === 'intro' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900">
            <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-pulse drop-shadow-[0_0_20px_rgba(168,85,247,0.5)] tracking-wider">
                BUBBLE ACADEMY
            </h1>
            <p className="mt-4 text-xl text-slate-400">Loading Magic Engines...</p>
        </div>
      )}

      {/* Screen: Editor */}
      {screen === 'editor' && activeQuiz && (
        <QuizEditor 
          quiz={activeQuiz} 
          onSave={saveQuiz} 
          onCancel={() => onViewChange('games')} 
          folders={folders}
        />
      )}

      {/* Screen: Setup */}
      {screen === 'setup' && (
        <div className={`absolute inset-0 z-40 flex flex-col items-center justify-center p-8 overflow-hidden backdrop-blur-sm transition-colors duration-1000 ${selectedTheme === "theme-ocean" ? "bg-gradient-to-b from-sky-600/90 to-cyan-600/90 dark:from-sky-800/90 dark:to-cyan-900/90" : selectedTheme === "theme-space" ? "bg-gradient-to-b from-slate-900/90 to-indigo-950/90" : selectedTheme === "theme-jungle" ? "bg-gradient-to-b from-green-600/90 to-emerald-400/90 dark:from-green-900/90 dark:to-emerald-800/90" : selectedTheme === "theme-sunset" ? "bg-gradient-to-b from-orange-400/90 to-yellow-300/90 dark:from-orange-800/90 dark:to-yellow-700/90" : "bg-gradient-to-b from-sky-400/90 to-blue-200/90 dark:from-sky-900/90 dark:to-blue-950/90"}`}>
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
                    Bubble Pop
                </h2>
                
                <div className="flex flex-col xl:flex-row gap-6 w-full max-w-7xl justify-center items-stretch relative z-10">
    <div className="flex-1 w-full max-w-2xl bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-[2rem] border border-white/20 p-8 shadow-2xl flex flex-col items-center">

                    <div className="flex gap-6 mb-8 w-full justify-center">
                        <button
                            onClick={() => setNumPlayers(1)}
                            className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-3xl border border-white/20 transition-all duration-300 ${numPlayers === 1 ? 'bg-blue-500/30 scale-105 shadow-[0_0_30px_rgba(59,130,246,0.3)]' : 'bg-black/20 hover:bg-white/10'}`}
                        >
                            <div className="text-5xl bg-blue-500 w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.6)]">👤</div>
                            <span className="text-white font-bold text-2xl">1 Player</span>
                        </button>
                        <button
                            onClick={() => setNumPlayers(2)}
                            className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-3xl border border-white/20 transition-all duration-300 ${numPlayers === 2 ? 'bg-red-500/30 scale-105 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-black/20 hover:bg-white/10'}`}
                        >
                            <div className="text-5xl bg-red-500 w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.6)]">👥</div>
                            <span className="text-white font-bold text-2xl">2 Players</span>
                        </button>

                                        </div>
                    <div className="w-full max-w-md flex flex-col gap-4 mb-10">
                        <div className="flex gap-3 items-center">
                            <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xl shadow-[0_0_15px_rgba(59,130,246,0.6)]">1</div>
                            <input type="text" value={p1Name} onChange={e => setP1Name(e.target.value)} className="flex-1 bg-black/20 text-white font-bold placeholder-white/50 border border-white/20 rounded-2xl px-5 py-4 outline-none focus:border-white/50 transition-colors text-lg" placeholder="Team 1 Name" />
                        </div>
                        {numPlayers === 2 && (
                            <div className="flex gap-3 items-center">
                                <div className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xl shadow-[0_0_15px_rgba(239,68,68,0.6)]">2</div>
                                <input type="text" value={p2Name} onChange={e => setP2Name(e.target.value)} className="flex-1 bg-black/20 text-white font-bold placeholder-white/50 border border-white/20 rounded-2xl px-5 py-4 outline-none focus:border-white/50 transition-colors text-lg" placeholder="Team 2 Name" />
                            </div>
                        )}

                    <div className="bg-black/20 p-4 rounded-2xl border border-white/20 flex flex-col gap-4 mt-2">
                        <div className="flex justify-between items-center text-white">
                            <span className="font-bold">Speed</span>
                            <div className="flex gap-2">
                                <button onClick={() => handleSetSpeed(0.25)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${speed === 0.25 ? 'bg-blue-500' : 'bg-white/20 hover:bg-white/30'}`}>Slow</button>
                                <button onClick={() => handleSetSpeed(1)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${speed === 1 ? 'bg-blue-500' : 'bg-white/20 hover:bg-white/30'}`}>Normal</button>
                                <button onClick={() => handleSetSpeed(2.5)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${speed === 2.5 ? 'bg-blue-500' : 'bg-white/20 hover:bg-white/30'}`}>Fast</button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-white">
                            <span className="font-bold">Bubble Size</span>
                            <div className="flex gap-2">
                                <button onClick={() => handleSetBubbleSize(0.5)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${bubbleSize === 0.5 ? 'bg-blue-500' : 'bg-white/20 hover:bg-white/30'}`}>Small</button>
                                <button onClick={() => handleSetBubbleSize(1)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${bubbleSize === 1 ? 'bg-blue-500' : 'bg-white/20 hover:bg-white/30'}`}>Normal</button>
                                <button onClick={() => handleSetBubbleSize(2)} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${bubbleSize === 2 ? 'bg-blue-500' : 'bg-white/20 hover:bg-white/30'}`}>Big</button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-white">
                            <span className="font-bold">Twist Mode</span>
                            <button onClick={() => handleSetTwistEnabled(!twistEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${twistEnabled ? 'bg-blue-500' : 'bg-white/30'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${twistEnabled ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                        <div className="flex justify-between items-center text-white">
                            <span className="font-bold">Voice Narration</span>
                            <button onClick={() => handleSetVoiceEnabled(!voiceEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${voiceEnabled ? 'bg-blue-500' : 'bg-white/30'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${voiceEnabled ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                        <div className="flex justify-between items-center text-white pt-2 border-t border-white/10">
                            <span className="font-bold">Tracker</span>
                            <button
                                onClick={() => setShowTrackerModal(true)}
                                className="px-4 py-2 rounded-xl text-sm font-black bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white flex items-center gap-2 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            >
                                <span className="text-base">
                                  {trackerMode === 'finger' && '☝️'}
                                  {trackerMode === 'hand' && (
                                    handCharacter === 'spiderman' ? '🕷️' :
                                    handCharacter === 'thanos' ? '🧤' :
                                    handCharacter === 'witch' ? '🧙‍♀️' :
                                    handCharacter === 'hulk' ? '💪' :
                                    handCharacter === 'ironman' ? '🤖' :
                                    handCharacter === 'frost' ? '❄️' : '⚡'
                                  )}
                                  {trackerMode === 'nose' && (
                                    noseStyle === 'real' ? '👃' :
                                    noseStyle === 'clown' ? '🔴' :
                                    noseStyle === 'rudolph' ? '🦌' :
                                    noseStyle === 'pig' ? '🐷' :
                                    noseStyle === 'cat' ? '🐱' : '🤥'
                                  )}
                                </span>
                                <span className="capitalize">{trackerMode}</span>
                                <span className="text-xs opacity-80 bg-white/20 px-1.5 py-0.5 rounded">Change</span>
                            </button>
                        </div>
                    </div>
                    </div>

                    <button
                        onClick={() => startGameMode(numPlayers)}
                        className="px-12 py-5 bg-gradient-to-r from-blue-500 to-sky-400 text-white font-black text-2xl rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-105 active:scale-95 transition-all w-full max-w-md"
                    >
                        START GAME
                    </button>
    </div>

    <div className="w-full xl:w-96 flex flex-col gap-6">
        <div className="w-full rounded-[2rem] bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 shadow-2xl p-6 flex flex-col justify-center flex-1">
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

        <button onClick={() => setScreen('study')} className="group relative w-full h-48 rounded-[2rem] bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 shadow-2xl overflow-hidden transition-all duration-500 hover:scale-105 hover:bg-white/30 hover:-translate-y-1 cursor-pointer flex items-center justify-center p-6 gap-6">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 dark:to-black/20 pointer-events-none"></div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-400/30 rounded-full blur-2xl group-hover:bg-purple-400/50 transition-colors"></div>
            
            <div className="relative z-10 text-7xl transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 drop-shadow-xl">
                📖
            </div>
            <div className="flex flex-col items-start relative z-10 text-left">
                <h3 className="text-3xl font-black text-white mb-1 drop-shadow-md">Study Mode</h3>
                <p className="text-purple-100 font-medium text-sm">Review Questions!</p>
            </div>
        </button>
    </div>
</div>

                <div className="flex flex-wrap justify-center gap-4 relative z-10">
                  <button onClick={() => onViewChange('games')} className="px-8 py-4 rounded-full bg-white/20 backdrop-blur-md shadow-lg hover:bg-white/30 text-xl font-bold text-white border border-white/40 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                    <ArrowLeft size={24} /> Back to Games
                  </button>
                </div>
            </div>
        </div>
      )}

      {/* Screen: Loading */}
      {screen === 'loading' && (
        <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-[#0f172a] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-[spin_120s_linear_infinite]"></div>
            <div className="text-6xl mb-8 animate-bounce z-10">🫧</div>
            <h2 className="text-3xl font-bold mb-2 z-10 text-slate-800 dark:text-white">Loading Camera & AI...</h2>
            {cameraError ? (
                <div className="flex flex-col items-center z-10 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl max-w-lg text-center">
                    <p className="text-red-500 font-bold mb-2 text-xl">Camera Error</p>
                    <p className="text-red-400 mb-6">{cameraError}</p>
                    <div className="flex gap-4">
                        <button onClick={() => {
                            if (cameraRef.current && cameraRef.current.stop) { cameraRef.current.stop(); setIsCameraActive(false); }
                            setScreen('setup');
                        }} className="px-6 py-3 bg-slate-800 text-white rounded-full font-bold hover:bg-slate-700 transition-colors">
                            Back to Setup
                        </button>
                        <button onClick={() => continueStartGame(numPlayers)} className="px-6 py-3 bg-blue-500 text-white rounded-full font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30">
                            Play with Mouse Instead
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <p className="text-slate-400 mb-8 z-10">Please grant camera permissions.</p>
                    <div className="loading-bar-container z-10">
                        <div className="loading-bar-fill animate-[pulse_2s_infinite]" style={{ width: '100%' }}></div>
                    </div>
                </>
            )}
        </div>
      )}

      {/* Screen: Game */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-30 flex flex-col">
            {!isCameraActive && <div className={`absolute inset-0 -z-10 pointer-events-none transition-colors duration-1000 ${
    selectedTheme === "theme-ocean" ? "bg-gradient-to-b from-sky-600 to-cyan-600 dark:from-sky-800 dark:to-cyan-900" :
    selectedTheme === "theme-space" ? "bg-gradient-to-b from-slate-900 to-indigo-950" :
    selectedTheme === "theme-jungle" ? "bg-gradient-to-b from-green-600 to-emerald-400 dark:from-green-900 dark:to-emerald-800" :
    selectedTheme === "theme-sunset" ? "bg-gradient-to-b from-orange-400 to-yellow-300 dark:from-orange-800 dark:to-yellow-700" :
    "bg-[radial-gradient(circle_at_50%_100%,#dbeafe,#f8fafc)] dark:bg-[radial-gradient(circle_at_50%_100%,#1e3a8a,#0f172a)]"
}`}></div>}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10"></canvas>
            
            {/* Frozen Overlays */}
            {frozenTeams[0] && (
                <div className="absolute top-0 left-0 w-1/2 h-full bg-cyan-400/20 backdrop-blur-[2px] border-r-4 border-cyan-300/50 flex flex-col items-center justify-center pointer-events-none z-[15]">
                    <span className="text-6xl md:text-8xl animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">❄️</span>
                    <span className="font-black text-white text-3xl md:text-5xl uppercase tracking-widest mt-4 drop-shadow-md">FROZEN</span>
                </div>
            )}
            {frozenTeams[1] && (
                <div className="absolute top-0 right-0 w-1/2 h-full bg-cyan-400/20 backdrop-blur-[2px] border-l-4 border-cyan-300/50 flex flex-col items-center justify-center pointer-events-none z-[15]">
                    <span className="text-6xl md:text-8xl animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">❄️</span>
                    <span className="font-black text-white text-3xl md:text-5xl uppercase tracking-widest mt-4 drop-shadow-md">FROZEN</span>
                </div>
            )}

            <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none z-20 pt-20">
                <div className="flex justify-center items-start w-full gap-4 relative">
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 pointer-events-auto">
                        {countdown !== null && (
                            <div className="glass-panel bg-blue-100/90 dark:bg-blue-900/80 rounded-full px-8 py-3 border-2 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                                <span className="text-2xl font-bold text-blue-200">Bubbles in <span className="text-slate-800 dark:text-white text-3xl font-black">{countdown}</span>...</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="absolute top-20 left-6 z-[50] pointer-events-auto">
                    <button onClick={() => {
                        gameState.current.isActive = false;
                        if (questionTimerRef.current) clearInterval(questionTimerRef.current);
                        setScreen('setup');
                    }} className="glass-panel px-6 py-2 rounded-full hover:bg-white/20 font-bold border border-white/20 cursor-pointer text-slate-800 dark:text-white shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center">Exit</button>
                </div>

                <div className="flex justify-center items-end w-full gap-1.5 sm:gap-2 md:gap-4 pointer-events-none mt-auto px-2 sm:px-12 lg:px-20 relative z-30">
                    <div className={`bg-white/80 dark:bg-slate-900/80 rounded-2xl sm:rounded-3xl p-2 sm:p-3 min-w-[70px] sm:min-w-[100px] md:min-w-[140px] border border-white/40 dark:border-white/10 flex flex-col items-center shadow-xl backdrop-blur-md pointer-events-auto shadow-[0_8px_30px_rgb(0,0,0,0.12)] shrink-0 mb-2 transition-transform hover:scale-105 relative overflow-hidden ${frozenTeams[0] ? 'opacity-70 grayscale border-cyan-400/50' : ''}`}>
                        {frozenTeams[0] && <div className="absolute inset-0 bg-cyan-400/20 backdrop-blur-[2px] z-10 flex items-center justify-center pointer-events-none"><span className="text-4xl absolute opacity-50">❄️</span></div>}
                        <div className="flex flex-col items-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                            <div className="min-w-[2.5rem] sm:min-w-[3rem] md:min-w-[4rem] px-1.5 sm:px-2 md:px-3 h-5 sm:h-6 md:h-8 rounded-full bg-blue-500 flex items-center justify-center text-[10px] sm:text-xs md:text-sm font-black text-white shadow-inner uppercase tracking-wider">{p1Name}</div>
                            <div className="text-[8px] sm:text-[9px] md:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">Score</div>
                        </div>
                        <div className="text-2xl sm:text-3xl md:text-5xl font-black text-blue-500 dark:text-blue-400 drop-shadow-sm tabular-nums tracking-tighter">{scores[0]}</div>
                    </div>

                    <div className="glass-panel bg-white/90 dark:bg-slate-900/90 rounded-2xl sm:rounded-3xl w-full max-w-4xl p-2.5 sm:p-4 md:p-6 text-center border-t-4 border-indigo-500 shadow-2xl relative overflow-hidden backdrop-blur-xl mb-2 pointer-events-auto flex-1">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
                            {questionImage && (
                                <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl bg-white/95 dark:bg-slate-800/95 p-1.5 shadow-lg border-2 border-indigo-400/50 flex items-center justify-center shrink-0 overflow-hidden">
                                    <img
                                        src={questionImage}
                                        alt={questionText || "Question Media"}
                                        className="w-full h-full object-contain rounded-xl"
                                    />
                                </div>
                            )}
                            {questionText && (
                                <h1 className="text-base sm:text-xl md:text-3xl font-black text-slate-800 dark:text-white leading-snug sm:leading-relaxed drop-shadow-md">
                                    {questionText}
                                </h1>
                            )}
                        </div>
                        
                        {showCombo && (
                            <div key={`combo-${combo}`} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-center animate-pop">
                                <div className="text-[8px] sm:text-[10px] md:text-xs font-bold text-yellow-400 uppercase tracking-widest">Combo</div>
                                <div className="text-base sm:text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-orange-500">x{combo}</div>
                            </div>
                        )}
                    </div>
                    
                    {numPlayers === 2 ? (
                        <div className={`bg-white/80 dark:bg-slate-900/80 rounded-2xl sm:rounded-3xl p-2 sm:p-3 min-w-[70px] sm:min-w-[100px] md:min-w-[140px] border border-white/40 dark:border-white/10 flex flex-col items-center shadow-xl backdrop-blur-md pointer-events-auto shadow-[0_8px_30px_rgb(0,0,0,0.12)] shrink-0 mb-2 transition-transform hover:scale-105 relative overflow-hidden ${frozenTeams[1] ? 'opacity-70 grayscale border-cyan-400/50' : ''}`}>
                            {frozenTeams[1] && <div className="absolute inset-0 bg-cyan-400/20 backdrop-blur-[2px] z-10 flex items-center justify-center pointer-events-none"><span className="text-4xl absolute opacity-50">❄️</span></div>}
                            <div className="flex flex-col items-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                                <div className="min-w-[2.5rem] sm:min-w-[3rem] md:min-w-[4rem] px-1.5 sm:px-2 md:px-3 h-5 sm:h-6 md:h-8 rounded-full bg-red-500 flex items-center justify-center text-[10px] sm:text-xs md:text-sm font-black text-white shadow-inner uppercase tracking-wider">{p2Name}</div>
                                <div className="text-[8px] sm:text-[9px] md:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">Score</div>
                            </div>
                            <div className="text-2xl sm:text-3xl md:text-5xl font-black text-red-500 dark:text-red-400 drop-shadow-sm tabular-nums tracking-tighter">{scores[1]}</div>
                        </div>
                    ) : (
                        <div className="hidden sm:block min-w-[100px] md:min-w-[140px] shrink-0"></div>
                    )}
                </div>
            </div>
        </div>
      )}
            {/* Screen: Results */}
      {screen === 'results' && (
        <div className="absolute inset-0 z-50 bg-slate-100 dark:bg-[#0f121b] flex flex-col items-center justify-center overflow-hidden font-sans">
            <div className="rounded-3xl p-8 max-w-2xl w-full text-center relative z-10 bg-white dark:bg-[#252836] shadow-2xl border border-slate-200 dark:border-slate-700/50">
                <h2 className={`text-4xl md:text-5xl font-black uppercase tracking-widest mb-6 drop-shadow-sm ${numPlayers === 2 && scores[0] !== scores[1] ? (scores[0] > scores[1] ? 'text-blue-500' : 'text-red-500') : 'text-yellow-400'}`}>{resultsTitle}</h2>
                
                {numPlayers === 1 ? (
                    <>
                        <div className="flex justify-center gap-3 mb-10">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <div key={star} className="relative">
                                    <svg 
                                        viewBox="0 0 24 24" 
                                        className={`w-12 h-12 md:w-16 md:h-16 transition-all duration-500 transform ${accuracy >= (star * 20 - 10) ? 'scale-100 opacity-100' : 'scale-75 opacity-30 grayscale'}`}
                                        style={{
                                            filter: accuracy >= (star * 20 - 10) ? 'drop-shadow(0 8px 6px rgba(0,0,0,0.4))' : 'none',
                                            animation: accuracy >= (star * 20 - 10) ? `popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${star * 0.1}s both` : 'none'
                                        }}
                                    >
                                        <path 
                                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
                                            fill={accuracy >= (star * 20 - 10) ? "#facc15" : "#475569"} 
                                            stroke={accuracy >= (star * 20 - 10) ? "#ca8a04" : "#334155"} 
                                            strokeWidth="1.5"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </div>
                            ))}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 md:gap-6 mb-10">
                            <div className="bg-slate-50 dark:bg-[#303343] p-5 rounded-xl border border-slate-200 dark:border-white/5 shadow-inner flex flex-col items-center justify-center">
                                <div className="text-slate-400 text-xs md:text-sm font-black uppercase tracking-wider mb-2">Accuracy</div>
                                <div className="text-3xl md:text-5xl font-black text-emerald-400 drop-shadow-sm">{accuracy}%</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-[#303343] p-5 rounded-xl border border-slate-200 dark:border-white/5 shadow-inner flex flex-col items-center justify-center">
                                <div className="text-slate-400 text-xs md:text-sm font-black uppercase tracking-wider mb-2">Score</div>
                                <div className="text-3xl md:text-5xl font-black text-sky-400 drop-shadow-sm">{scores[0]}</div>
                            </div>
                            
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-8 mb-10 w-full">
                        <div className="flex items-center justify-center gap-4 w-full">
                            <div className={`flex flex-col items-center flex-1 p-6 rounded-2xl border-4 transition-all ${scores[0] > scores[1] ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105 shadow-xl' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 grayscale-[20%]'}`}>
                                <div className="min-w-[4rem] px-4 py-1 rounded-full bg-blue-500 text-white font-bold uppercase tracking-wider mb-4 shadow-md">{p1Name}</div>
                                <div className={`text-5xl md:text-7xl font-black tabular-nums tracking-tighter ${scores[0] > scores[1] ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>{scores[0]}</div>
                            </div>
                            
                            <div className="text-3xl font-black text-slate-300 dark:text-slate-600 px-2 italic">VS</div>
                            
                            <div className={`flex flex-col items-center flex-1 p-6 rounded-2xl border-4 transition-all ${scores[1] > scores[0] ? 'border-red-500 bg-red-50 dark:bg-red-900/20 scale-105 shadow-xl' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 grayscale-[20%]'}`}>
                                <div className="min-w-[4rem] px-4 py-1 rounded-full bg-red-500 text-white font-bold uppercase tracking-wider mb-4 shadow-md">{p2Name}</div>
                                <div className={`text-5xl md:text-7xl font-black tabular-nums tracking-tighter ${scores[1] > scores[0] ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>{scores[1]}</div>
                            </div>
                        </div>
                        
                        
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button onClick={() => setScreen('setup')} className="px-8 py-4 bg-slate-200 hover:bg-slate-300 dark:bg-[#393c4b] dark:hover:bg-[#444857] rounded-xl font-black text-lg transition-colors cursor-pointer text-slate-700 dark:text-white shadow-lg">Back to Setup</button>
                    <button onClick={() => startGameMode(numPlayers)} className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 rounded-xl font-black text-lg text-slate-800 dark:text-white cursor-pointer shadow-lg hover:shadow-indigo-500/25 transition-all">Play Again</button>
                </div>
            </div>
        </div>
      )}

      {/* 3-Mode Selection Modal */}
      <GameModeModal
        isOpen={showModeModal}
        gameData={{
          id: activeQuiz?.id,
          name: activeQuiz?.title,
          topic: activeQuiz?.topic,
          className: activeQuiz?.classLevel,
          gameType: 'bubble-pop',
          customQuestions: activeQuiz?.questions || []
        }}
        onClose={() => setShowModeModal(false)}
        onSelectMode={(mode, adaptedData) => {
          gameState.current.isActive = false;
          if (cameraRef.current && cameraRef.current.stop) { cameraRef.current.stop(); setIsCameraActive(false); }
          setIsCameraActive(false);
          if (handsRef.current && handsRef.current.close) handsRef.current.close();
          onViewChange(mode as ViewState, adaptedData);
        }}
      />

      {/* Tracker Mode Selection Modal */}
      {showTrackerModal && typeof document !== 'undefined' && createPortal(
        <TrackerModal
          isOpen={showTrackerModal}
          onClose={() => setShowTrackerModal(false)}
          trackerMode={trackerMode}
          onSelectMode={(mode) => {
            setTrackerMode(mode);
            pointers.current.forEach(p => {
              p.x = -100; p.y = -100;
              p.targetX = -100; p.targetY = -100;
              p.detected = false;
              p.history = [];
            });
            detectedHandsRef.current = [];
            detectedFacesRef.current = [];
          }}
          handCharacter={handCharacter}
          onSelectHand={setHandCharacter}
          noseStyle={noseStyle}
          onSelectNose={setNoseStyle}
        />,
        document.body
      )}
    </div>
  );
}


function QuizEditor({ quiz, onSave, onCancel, folders }: { quiz: Quiz, onSave: (q: Quiz) => void, onCancel: () => void, folders: { id: string; name: string }[] }) {
  const [folderId, setFolderId] = useState(quiz.folderId || "");
  const [topic, setTopic] = useState(quiz.topic || "");
  const [classLevel, setClassLevel] = useState(quiz.classLevel || "");
  const [questions, setQuestions] = useState<Question[]>(quiz.questions);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string, optIndex: number | 'question', query?: string } | null>(null);
  const [contentMode, setContentMode] = useState<AnswerContentMode>('both');
  const [autoPhotosEnabled, setAutoPhotosEnabled] = useState<boolean>(true);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [copiedPromptInModal, setCopiedPromptInModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const handleCopyAiPrompt = () => {
    navigator.clipboard.writeText(`Create 50 fill-in-the-blank questions on the topic of Passive Voice. Each question should have 4 multiple-choice options (A, B, C, and D) and include the correct answer.`);
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
        options: item.options || ["", ""],
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
    const validQuestions = questions.filter(q => (q.text && q.text.trim()) || q.image);
    if(validQuestions.length === 0) {
      setErrorMsg("Please add at least one complete question.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const confirmSave = (isPublic: boolean) => {
    const generatedTitle = "Bubble Pop Game";
    const validQuestions = questions.filter(q => (q.text && q.text.trim()) || q.image);
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
            
            <SetupCurriculumHeader
                topic={topic}
                setTopic={setTopic}
                classLevel={classLevel}
                setClassLevel={setClassLevel}
                folderId={folderId}
                setFolderId={setFolderId}
                folders={folders}
                contentMode={contentMode}
                setContentMode={setContentMode}
                autoPhotosEnabled={autoPhotosEnabled}
                setAutoPhotosEnabled={setAutoPhotosEnabled}
                onApplyModeToAll={async (mode) => {
                  const updated = await convertQuestionsContentMode(questions, mode);
                  setQuestions(updated);
                  setToastMsg(
                    mode === 'words'
                      ? '🔤 Switched all options to Words Only!'
                      : mode === 'photos_gifs'
                      ? '🖼️ Switched all options to Cartoon PNGs / GIFs!'
                      : '✨ Switched all options to Words + Cartoon PNGs!'
                  );
                  setTimeout(() => setToastMsg(''), 3000);
                }}
                onLoadStarterQuestions={(newQs, topicName) => {
                  setQuestions(newQs);
                  setToastMsg(`✨ Loaded ${newQs.length} "${topicName}" questions with Cartoon PNGs!`);
                  setTimeout(() => setToastMsg(''), 3500);
                }}
            />
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

        <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50">
          {/* Bulk Paste Action Bar */}
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
              <button
                type="button"
                onClick={() => setShowVideoGuide(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-purple-500/25 flex items-center gap-2 cursor-pointer border border-purple-400/30"
                title="Watch Video Tutorial: How to Bulk Paste with AI"
              >
                <div className="w-5 h-5 rounded-full bg-white text-purple-700 flex items-center justify-center shrink-0">
                  <Play size={11} className="ml-0.5 fill-current" />
                </div>
                <span>How to Bulk Paste</span>
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
                title="Delete Question"
                className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
              >
                <Trash2 size={14} />
              </button>
              
              <div className="flex gap-4 mb-4 items-start">
                <div className="w-8 h-8 mt-2 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                  {index + 1}
                </div>
                <SmartQuestionInput
                  id={`question-input-${index}`}
                  value={q.text}
                  imageUrl={q.image}
                  onChange={(newVal) => updateQuestion(q.id, 'text', newVal)}
                  onChangeImage={(newImg) => updateQuestion(q.id, 'image', newImg || undefined)}
                  onOpenMediaPicker={(initialQ) =>
                    setActiveGiphyInput({ qId: q.id, optIndex: 'question', query: initialQ })
                  }
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={(e) => handlePaste(e, index)}
                  placeholder="Type your question here (or click Add Media for picture/GIF question)..."
                  autoPhotosEnabled={autoPhotosEnabled}
                />
              </div>

              <div className="ml-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {q.options.map((opt, optIndex) => (
                  <div key={optIndex} className="flex items-start gap-2">
                    <input 
                      type="radio" 
                      name={`answer-${q.id}`} 
                      checked={q.answerIndex === optIndex}
                      onChange={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                      className="w-4 h-4 mt-3 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
                    />
                    <SmartOptionInput
                      value={opt}
                      onChange={(val) => updateOption(q.id, optIndex, val)}
                      onOpenMediaPicker={(initialQ) =>
                        setActiveGiphyInput({ qId: q.id, optIndex, query: initialQ })
                      }
                      placeholder={`Option ${optIndex + 1} (e.g. apple)`}
                      isCorrect={q.answerIndex === optIndex}
                      contentMode={contentMode}
                      autoPhotosEnabled={autoPhotosEnabled}
                    />
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
        initialQuery={activeGiphyInput?.query || ''}
        onClose={() => setActiveGiphyInput(null)}
        onSelect={(url) => {
          if (activeGiphyInput) {
            const targetQ = questions.find((item) => item.id === activeGiphyInput.qId);
            if (activeGiphyInput.optIndex === 'question') {
              const rawExistingQ = targetQ?.text || '';
              const parsedExistingQ = parseOptionContent(rawExistingQ);
              const questionTextToKeep = parsedExistingQ.text;
              const finalQuestionVal = questionTextToKeep
                ? formatOptionContent(questionTextToKeep, url, 'both')
                : url;
              setQuestions((prev) =>
                prev.map((qItem) =>
                  qItem.id === activeGiphyInput.qId
                    ? { ...qItem, text: finalQuestionVal, image: url }
                    : qItem
                )
              );
            } else {
              const optIdx = activeGiphyInput.optIndex;
              const rawExisting = targetQ?.options[optIdx] || '';
              const parsedExisting = parseOptionContent(rawExisting);
              const wordToKeep = parsedExisting.text || activeGiphyInput.query || '';
              const finalVal =
                contentMode === 'photos_gifs' || !wordToKeep
                  ? url
                  : formatOptionContent(wordToKeep, url, 'both');
              updateOption(activeGiphyInput.qId, optIdx, finalVal);
            }
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

      {/* Bulk Paste Modal */}
      {showBulkPasteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 transform scale-100 animate-in fade-in zoom-in-95 duration-150 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                      Bulk Paste &amp; Auto-Divide
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paste multiple questions, numbered lists with options &amp; answer (e.g. Answer: B), or tabular TSV data.
                  </p>
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
                <button 
                  type="button"
                  onClick={() => { setShowBulkPasteModal(false); setBulkText(""); }}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Step-by-step instructions with Video walkthrough & prompt copy */}
            <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Play size={14} className="ml-0.5 fill-current" />
                  </div>
                  <div>
                    <span className="font-black text-sm text-slate-800 dark:text-white block">
                      How to Bulk Paste: 3 Simple Steps
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Generate 20-30 questions with AI and auto-populate in seconds
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowVideoGuide(true)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-500/25 flex items-center gap-1.5 cursor-pointer text-xs shrink-0 self-start sm:self-auto"
                >
                  <Play size={12} className="fill-current" />
                  <span>Watch Video Guide</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between gap-1.5">
                  <span className="font-bold text-purple-600 dark:text-purple-400">1. Prompt AI</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Ask ChatGPT/Claude for multiple-choice questions with answers.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyAiPrompt}
                    className="mt-1 px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedPromptInModal ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    <span>{copiedPromptInModal ? "Copied Prompt!" : "Copy AI Prompt"}</span>
                  </button>
                </div>

                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between gap-1.5">
                  <span className="font-bold text-blue-600 dark:text-blue-400">2. Copy Output</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Highlight all questions generated by the AI and copy to clipboard.
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">Ctrl+C or ⌘+C</span>
                </div>

                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between gap-1.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">3. Paste &amp; Click + Add</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Paste below. Questions, options &amp; answers are auto-divided!
                  </p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Ready in 1 click!</span>
                </div>
              </div>
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
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={18} />
                + Add
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Paste Video Explanation Modal */}
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

interface TrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackerMode: 'finger' | 'hand' | 'nose';
  onSelectMode: (mode: 'finger' | 'hand' | 'nose') => void;
  handCharacter: HandCharacterType;
  onSelectHand: (char: HandCharacterType) => void;
  noseStyle: NoseStyle;
  onSelectNose: (style: NoseStyle) => void;
}

function TrackerModal({
  isOpen,
  onClose,
  trackerMode,
  onSelectMode,
  handCharacter,
  onSelectHand,
  noseStyle,
  onSelectNose
}: TrackerModalProps) {
  if (!isOpen) return null;

  const characters: Array<{
    id: HandCharacterType;
    name: string;
    icon: string;
    badge: string;
    color: string;
    desc: string;
  }> = [
    { id: 'spiderman', name: 'Spider-Man', icon: '🕷️', badge: 'Web Shooter', color: 'from-red-500 to-blue-600', desc: 'Classic red & navy suit, web shooter with glowing web trails' },
    { id: 'thanos', name: 'Thanos Gauntlet', icon: '🧤', badge: '6 Infinity Stones', color: 'from-amber-500 to-yellow-600', desc: 'Golden Titan armor with 6 glowing Infinity Stones' },
    { id: 'witch', name: 'Wicked Witch', icon: '🧙‍♀️', badge: 'Arcane Claws', color: 'from-emerald-500 to-purple-700', desc: 'Emerald skin, obsidian claws & glowing purple spell runes' },
    { id: 'hulk', name: 'Incredible Hulk', icon: '💪', badge: 'Gamma Power', color: 'from-green-600 to-emerald-500', desc: 'Massive gamma muscle fist with pulsing lime green veins' },
    { id: 'ironman', name: 'Iron Man', icon: '🤖', badge: 'Repulsor Core', color: 'from-red-600 to-amber-500', desc: 'Stark hot-rod titanium armor with glowing palm repulsor' },
    { id: 'frost', name: 'Frost Mage', icon: '❄️', badge: 'Glacial Ice', color: 'from-cyan-500 to-blue-500', desc: 'Translucent ice crystal palm with glowing snowflake runes' },
    { id: 'cyberpunk', name: 'Cyberpunk Mecha', icon: '⚡', badge: 'Laser Circuits', color: 'from-fuchsia-500 to-cyan-500', desc: 'Graphite mecha chassis with neon laser circuits & emitter tips' },
  ];

  const noseStyles: Array<{
    id: NoseStyle;
    name: string;
    icon: string;
    badge: string;
    color: string;
    desc: string;
  }> = [
    { id: 'real', name: 'Real Sniffing Nose', icon: '👃', badge: 'Cute 3D Sniffer', color: 'from-amber-400 to-rose-400', desc: 'Cute 3D anatomical nose with breathing pulse & sniffing air puffs' },
    { id: 'clown', name: 'Red Clown Nose', icon: '🔴', badge: 'Glossy & Squeaky', color: 'from-red-500 to-rose-600', desc: 'Bouncy, glossy red clown nose with squash-and-stretch on pop' },
    { id: 'rudolph', name: 'Rudolph Beacon', icon: '🦌', badge: 'Glowing Ruby', color: 'from-red-600 to-amber-500', desc: 'Glowing ruby red beacon with sparkling fairy stardust' },
    { id: 'pig', name: 'Cute Pig Snout', icon: '🐷', badge: 'Pink Snout', color: 'from-pink-400 to-rose-400', desc: 'Wiggling pink piggy snout with cartoon snort puffs' },
    { id: 'cat', name: 'Cat Whiskers', icon: '🐱', badge: 'Whiskers & Button', color: 'from-slate-700 to-slate-900', desc: 'Wet black button nose with twitching whisker arrays' },
    { id: 'pinocchio', name: 'Pinocchio Nose', icon: '🤥', badge: 'Wooden Cone', color: 'from-amber-600 to-yellow-700', desc: 'Wooden cone nose that funny extends on every bubble pop' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl flex flex-col gap-6 transform scale-100 animate-in fade-in zoom-in-95 duration-150 border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-blue-500/30">
              {trackerMode === 'finger' && '☝️'}
              {trackerMode === 'hand' && '🖐️'}
              {trackerMode === 'nose' && '👃'}
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                Choose Your Tracker
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Play with your Finger Ball, Superhero Character Hands, or Animated Nose!
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-2.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
          <button
            onClick={() => onSelectMode('finger')}
            className={`py-3 px-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all font-bold text-xs sm:text-sm cursor-pointer ${
              trackerMode === 'finger'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span className="text-xl">☝️</span>
            <span>Finger Ball</span>
          </button>
          <button
            onClick={() => onSelectMode('hand')}
            className={`py-3 px-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all font-bold text-xs sm:text-sm cursor-pointer ${
              trackerMode === 'hand'
                ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white shadow-lg shadow-red-500/30 scale-[1.02]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span className="text-xl">🖐️</span>
            <span>Hand Tracker</span>
          </button>
          <button
            onClick={() => onSelectMode('nose')}
            className={`py-3 px-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all font-bold text-xs sm:text-sm cursor-pointer ${
              trackerMode === 'nose'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30 scale-[1.02]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span className="text-xl">👃</span>
            <span>Nose Tracker</span>
          </button>
        </div>

        {/* Tab 1: Finger Mode Content */}
        {trackerMode === 'finger' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 border-2 border-blue-500/30 flex flex-col sm:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-4xl shadow-[0_0_35px_rgba(59,130,246,0.6)] animate-pulse shrink-0">
                ⭐
              </div>
              <div className="flex flex-col gap-2 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h4 className="text-xl font-black text-slate-800 dark:text-white">
                    Magical Starlight Pointer Ball
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    Classic
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Point your index finger toward the camera to control the glowing star ball with smooth starlight trails and pop bubbles with pinpoint precision!
                </p>
                <div className="flex flex-wrap gap-2 pt-1 justify-center sm:justify-start">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    ✨ Glowing Particle Trail
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    🎯 Pinpoint Fingertip Precision
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    👥 1 or 2 Players
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Hand Mode Character Grid */}
        {trackerMode === 'hand' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Choose Superhero or Fantasy Hand ({characters.length} Available)
              </span>
              <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                <span>Multi-point bubble popping (palm + all 5 fingers)</span>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto custom-scrollbar p-1">
              {characters.map((c) => {
                const isSelected = handCharacter === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelectHand(c.id)}
                    className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3.5 transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 shadow-lg shadow-blue-500/20 scale-[1.01]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${c.color} text-white flex items-center justify-center text-2xl shadow-md shrink-0`}>
                      {c.icon}
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-slate-800 dark:text-white text-base truncate">
                          {c.name}
                        </span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-black">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        {c.badge}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {c.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Nose Mode Style Grid */}
        {trackerMode === 'nose' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Choose Animated Nose Style ({noseStyles.length} Available)
              </span>
              <span className="text-xs font-bold text-pink-500 flex items-center gap-1">
                <span>Renders animated nose on your face & pops with nose!</span>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto custom-scrollbar p-1">
              {noseStyles.map((n) => {
                const isSelected = noseStyle === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => onSelectNose(n.id)}
                    className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3.5 transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'border-pink-500 bg-pink-50/80 dark:bg-pink-950/40 shadow-lg shadow-pink-500/20 scale-[1.01]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${n.color} text-white flex items-center justify-center text-2xl shadow-md shrink-0`}>
                      {n.icon}
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-slate-800 dark:text-white text-base truncate">
                          {n.name}
                        </span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-black">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400">
                        {n.badge}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {n.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer / Done */}
        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 cursor-pointer text-base"
          >
            Apply & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ROBUST PARSER HELPER ---
function parsePastedQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const items: Partial<Question>[] = [];

  // 1. TSV / Excel paste check
  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim());
    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length >= 2) {
        // Skip header row if present
        const p0Lower = parts[0].toLowerCase();
        if (p0Lower.includes('question') && (parts[1].toLowerCase().includes('option') || parts[1].toLowerCase().includes('answer'))) {
          return;
        }

        let qText = parts[0];
        let opts = ["", "", "", ""];
        let ansRaw = "";

        if (/^\d+$/.test(parts[0]) && parts.length >= 6) {
          // Format: ID \t Question \t Opt1 \t Opt2 \t Opt3 \t Opt4 \t Answer
          qText = parts[1];
          opts = [parts[2] || "", parts[3] || "", parts[4] || "", parts[5] || ""];
          ansRaw = parts[6] || "";
        } else {
          opts = [parts[1] || "", parts[2] || "", parts[3] || "", parts[4] || ""];
          ansRaw = parts[5] || "";
        }

        let ansIdx = 0;
        const letterMatch = ansRaw.match(/^[A-Da-d]$/);
        const numMatch = ansRaw.match(/^[1-4]$/);
        if (letterMatch) {
          ansIdx = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
        } else if (numMatch) {
          ansIdx = parseInt(numMatch[0]) - 1;
        } else if (ansRaw) {
          const found = opts.findIndex(o => o && o.toLowerCase() === ansRaw.toLowerCase());
          if (found >= 0) ansIdx = found;
        }

        items.push({
          text: qText,
          options: opts,
          answerIndex: Math.max(0, Math.min(3, ansIdx))
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

  // 2. Multi-line / Standard Text Parsing
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let currentQ: Partial<Question> | null = null;

  const isQuestionStart = (line: string) => {
    return /^(?:question\s*\d+|q\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i.test(line);
  };

  const getQuestionText = (line: string) => {
    const m = line.match(/^(?:question\s*\d+|q\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i);
    return m ? m[1].trim() : line;
  };

  const isAnswerLine = (line: string) => {
    return /^(?:correct\s*)?(?:ans(?:wer)?|key)\s*(?:is)?\s*[:=\-]?\s*(.+)/i.test(line);
  };

  const extractAnswerIndex = (line: string, opts: string[] = ["", "", "", ""]) => {
    const m = line.match(/^(?:correct\s*)?(?:ans(?:wer)?|key)\s*(?:is)?\s*[:=\-]?\s*(.+)/i);
    if (!m) return -1;
    const raw = m[1].trim();

    const letter = raw.match(/[\(\[]?([A-Da-d])[\)\]\.\:]?/);
    if (letter) {
      return letter[1].toUpperCase().charCodeAt(0) - 65;
    }
    const num = raw.match(/^[1-4]$/);
    if (num) {
      return parseInt(num[0]) - 1;
    }
    const found = opts.findIndex(o => o && (o.toLowerCase() === raw.toLowerCase() || raw.toLowerCase().includes(o.toLowerCase())));
    if (found >= 0) return found;

    return 0;
  };

  const isOptionLine = (line: string) => {
    if (/^(?:[\(\[]?[A-Da-d][\)\]\.\:\-]|[\(\[][A-Da-d][\)\]])\s*(.*)/.test(line)) {
      return true;
    }
    if (/^(?:[\(\[][1-4][\)\]]|[1-4]\))\s*(.*)/.test(line)) {
      return true;
    }
    return false;
  };

  const extractOption = (line: string) => {
    const mLetter = line.match(/^(?:[\(\[]?([A-Da-d])[\)\]\.\:\-]|[\(\[]([A-Da-d])[\)\]])\s*(.*)/);
    if (mLetter) {
      const char = (mLetter[1] || mLetter[2]).toUpperCase();
      const idx = char.charCodeAt(0) - 65;
      return { index: idx, text: mLetter[3].trim() };
    }
    const mNum = line.match(/^(?:[\(\[]([1-4])[\)\]]|([1-4])\))\s*(.*)/);
    if (mNum) {
      const num = parseInt(mNum[1] || mNum[2]) - 1;
      return { index: num, text: mNum[3].trim() };
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isAnswerLine(line)) {
      if (currentQ) {
        const ans = extractAnswerIndex(line, currentQ.options);
        if (ans >= 0) currentQ.answerIndex = ans;
      }
      continue;
    }

    if (isOptionLine(line)) {
      const opt = extractOption(line);
      if (opt) {
        if (!currentQ) {
          currentQ = { text: "Question", options: ["", "", "", ""], answerIndex: 0 };
          items.push(currentQ);
        }
        if (opt.index >= 0 && opt.index < 4) {
          currentQ.options![opt.index] = opt.text;
        } else {
          const emptyIdx = currentQ.options!.findIndex(o => o === "");
          if (emptyIdx !== -1) currentQ.options![emptyIdx] = opt.text;
        }
      }
      continue;
    }

    if (isQuestionStart(line)) {
      const qText = getQuestionText(line);
      currentQ = { text: qText, options: ["", "", "", ""], answerIndex: 0 };
      items.push(currentQ);
      continue;
    }

    if (currentQ && currentQ.options && currentQ.options.every(o => o === "")) {
      currentQ.text += " " + line;
    } else {
      currentQ = { text: line, options: ["", "", "", ""], answerIndex: 0 };
      items.push(currentQ);
    }
  }

  items.forEach(q => {
    if (q.options) {
      while (q.options.length > 2 && q.options[q.options.length - 1] === "") {
        q.options.pop();
      }
    }
  });

  return items;
}
