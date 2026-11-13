/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { ViewState } from "./types";
import { Navigation, Header } from "./components/Navigation";
import { Footer } from "./components/Footer";
import { Home } from "./views/Home";
import { AIGenerator } from "./views/AIGenerator";
import { AdminDashboard } from "./views/AdminDashboard";
import { UserDashboard } from "./views/UserDashboard";
import { GamesLibrary } from "./views/GamesLibrary";
import { PublicDashboard } from "./views/PublicDashboard";
import { MysteryBox } from "./views/MysteryBox";
import { MediaStudio } from "./views/MediaStudio";
import { NeonChain } from "./views/NeonChain";
import { BubblePop } from "./views/BubblePop";
import { RollerCoasterQuiz } from "./views/RollerCoasterQuiz";
import { SlapAndChop } from "./views/SlapAndChop";
import { SharkAttack } from "./views/SharkAttack";
import { FlashcardsMatch } from "./views/FlashcardsMatch";
import { YogaQuiz } from "./views/YogaQuiz";
import { BubbleSentencePro } from "./views/BubbleSentencePro";
import { FamilyFeud } from "./views/FamilyFeud";
import { Sumo } from "./views/Sumo";
import { HamsterPopQuiz } from "./views/HamsterPopQuiz";
import { StudentRace } from "./views/StudentRace";
import { LetterLock } from "./views/LetterLock";
import { TicTacToe } from "./views/TicTacToe";
import { Homework } from "./views/Homework";
import { ClassRecord, getBestSavedClasses, isDefaultMockClasses, STORAGE_KEY, sortClassesByName } from "./views/ClassRecord";
import { PhonemicMaster } from "./views/PhonemicMaster";
import SquidGamePicker from "./views/SquidGamePicker";
import { HamsterPaintball } from "./views/HamsterPaintball";
import { MySlides } from "./views/MySlides";
import { useAuth } from "./contexts/AuthContext";
import { doc, onSnapshot, getDoc, updateDoc, increment, setDoc } from "firebase/firestore";
import { db } from "./lib/firebase";
import { Loader2 } from "lucide-react";
import { AuthSliderModal } from "./components/AuthSliderModal";
import { GoogleAuthModal } from "./components/GoogleAuthModal";

export default function App() {
  // Synchronously detect direct student homework links (?hwPin=... or #homework-...)
  const getUrlHwPin = (preserveExisting = false) => {
    if (typeof window === 'undefined') return null;
    try {
      // 1. Check window.location.search (?hwPin=... or ?pin=...)
      const params = new URLSearchParams(window.location.search);
      let pin = params.get('hwPin') || params.get('pin');
      
      // 2. Check window.location.hash
      if (!pin && window.location.hash) {
        const hash = window.location.hash;
        if (hash.includes('hwPin=') || hash.includes('pin=')) {
          const qPart = hash.includes('?') ? hash.split('?')[1] : hash.replace(/^#\/?/, '');
          const hashParams = new URLSearchParams(qPart);
          pin = hashParams.get('hwPin') || hashParams.get('pin');
        } else if (hash.startsWith('#homework-')) {
          pin = hash.replace('#homework-', '').replace(/^\/+/, '');
        }
      }

      if (pin) {
        const cleanMatch = pin.trim().match(/\d{6}/);
        const cleanPin = cleanMatch ? cleanMatch[0] : pin.trim().replace(/[^0-9A-Za-z_-]/g, '');
        if (cleanPin) {
          sessionStorage.setItem('active_hw_pin', cleanPin);
          return cleanPin;
        }
      }
      if (preserveExisting) {
        const saved = sessionStorage.getItem('active_hw_pin');
        if (saved) return saved;
      }
      sessionStorage.removeItem('active_hw_pin');
      return null;
    } catch (e) {
      return null;
    }
  };

  // Synchronously detect direct Hamster Paintball join links (?game=hamster-paintball&room=XXXXXX)
  const getUrlPaintballParams = (): { roomCode?: string } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      let gameParam = searchParams.get('game');
      let roomParam = searchParams.get('room') || searchParams.get('paintballRoom');

      if (!gameParam && !roomParam && window.location.hash) {
        const rawHash = window.location.hash;
        if (rawHash.includes('hamster-paintball') || rawHash.includes('paintballRoom=')) {
          const qPart = rawHash.includes('?') ? rawHash.split('?')[1] : rawHash.replace(/^#\/?/, '');
          const hashParams = new URLSearchParams(qPart);
          gameParam = hashParams.get('game') || (rawHash.includes('hamster-paintball') ? 'hamster-paintball' : null);
          roomParam = hashParams.get('room') || hashParams.get('paintballRoom');
        }
      }

      if (gameParam === 'hamster-paintball' || searchParams.get('paintballRoom')) {
        const cleanRoom = (roomParam || '').trim().replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6);
        return { roomCode: cleanRoom || undefined };
      }
      return null;
    } catch {
      return null;
    }
  };

  const initialHwPin = getUrlHwPin();
  const initialPaintball = !initialHwPin ? getUrlPaintballParams() : null;
  const [isLockedHomeworkLink, setIsLockedHomeworkLink] = useState<boolean>(Boolean(initialHwPin));

  const [currentView, setCurrentView] = useState<ViewState>(
    initialHwPin ? "homework" : initialPaintball ? "hamster-paintball" : "home"
  );
  const [selectedGame, setSelectedGame] = useState<any>(
    initialHwPin
      ? { pinCode: initialHwPin }
      : initialPaintball
      ? { roomCode: initialPaintball.roomCode }
      : null
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGoogleAuthModalOpen, setIsGoogleAuthModalOpen] = useState(false);
  const [googleAuthFeature, setGoogleAuthFeature] = useState<string>("Account Area");
  const [initialRoomCode, setInitialRoomCode] = useState<string>('');
  const [joinData, setJoinData] = useState<{code: string, nickname: string, gameType: string} | null>(null);
  const [publishedGames, setPublishedGames] = useState<Record<string, boolean>>(() => {
    try {
      const cached = localStorage.getItem('publishedGamesV2');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {};
  });
  const prevUserRef = useRef<any>(null);
  const { user, loading, isAuthenticating, authError, signInWithGoogle } = useAuth();
  
  const isAdmin = Boolean(user && !user.isAnonymous && user.email?.toLowerCase().trim() === "janrelbugtay03@gmail.com");

  // Listen to publishedGamesV2 from settings/general
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'general'),
      (snap) => {
        if (snap.exists()) {
          const pub = snap.data().publishedGamesV2 || {};
          setPublishedGames(pub);
          try {
            localStorage.setItem('publishedGamesV2', JSON.stringify(pub));
          } catch (e) {}
        }
      },
      (err) => {
        console.warn("Notice in App settings listener:", err?.message || err);
      }
    );
    return () => unsub();
  }, []);

  const openGoogleAuthModal = (feature: string = "Account Area") => {
    setGoogleAuthFeature(feature);
    setIsGoogleAuthModalOpen(true);
  };

  // Route new sign-ins directly to "home" while preserving homework, Hamster Paintball join links, and slide deep-links
  useEffect(() => {
    if (user && !user.isAnonymous) {
      const justLoggedIn = !prevUserRef.current || prevUserRef.current.isAnonymous;
      if (justLoggedIn) {
        const activePin = getUrlHwPin(true);
        const hasHwInUrl = Boolean(activePin) || isLockedHomeworkLink;
        const activePb = getUrlPaintballParams();
        const hasSlideInUrl =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).has('slideId');

        if (hasHwInUrl && activePin) {
          setSelectedGame((prev: any) => (prev?.pinCode ? prev : { pinCode: activePin }));
        } else if (activePb) {
          setSelectedGame((prev: any) =>
            prev?.roomCode ? prev : { roomCode: activePb.roomCode }
          );
        }

        setCurrentView((prev) => {
          if (prev === 'homework' || hasHwInUrl) return 'homework';
          if (prev === 'hamster-paintball' || activePb) return 'hamster-paintball';
          if (prev === 'my-slides' || hasSlideInUrl) return 'my-slides';
          return 'home';
        });
      }
    }
    prevUserRef.current = user;
  }, [user, isLockedHomeworkLink]);

  // Proactive multi-device cloud sync on authentication
  useEffect(() => {
    if (!user || user.isAnonymous) return;

    const syncClassesBackground = async () => {
      try {
        const localClasses = getBestSavedClasses();
        const hasCustomLocal = localClasses.length > 0 && !isDefaultMockClasses(localClasses);
        const userDocRef = doc(db, 'userClassData', user.uid);
        const backupDocRef = doc(db, 'users', user.uid, 'classesData', 'current');

        if (hasCustomLocal) {
          // Device has classes: ensure cloud has them in sorted order
          const sorted = sortClassesByName(localClasses);
          const payload = { classes: sorted, updatedAt: Date.now() };
          await setDoc(userDocRef, payload, { merge: true });
          await setDoc(backupDocRef, payload, { merge: true });
        } else {
          // Device has no local classes: check if cloud has classes and cache them
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data?.classes) && data.classes.length > 0) {
              const sorted = sortClassesByName(data.classes);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
              localStorage.removeItem('squid_hamster_class_dollars_v13');
              localStorage.removeItem('squid_user_classes');
            }
          }
        }
      } catch (err: any) {
        console.warn('Background class sync note:', err?.message);
      }
    };

    syncClassesBackground();
  }, [user]);

  const viewHistoryRef = useRef<Array<{ view: ViewState; game: any }>>([]);
  const currentViewRef = useRef<ViewState>(currentView);
  currentViewRef.current = currentView;
  const selectedGameRef = useRef<any>(selectedGame);
  selectedGameRef.current = selectedGame;

  useEffect(() => {
    const checkUrlParams = (e?: PopStateEvent) => {
      // If user clicked Browser Back and an active game screen can step 1 step back internally:
      const activeStepBack = (window as any).__activeViewStepBack;
      if (e && typeof activeStepBack === 'function') {
        const handledInternally = activeStepBack();
        if (handledInternally) {
          try {
            window.history.pushState({ appStep: true, view: currentViewRef.current }, '', window.location.href);
          } catch {}
          return;
        }
      }

      // If user clicked Browser Back and we have previous views in our history stack, go 1 step back:
      if (e && viewHistoryRef.current.length > 0) {
        const prev = viewHistoryRef.current.pop()!;
        setCurrentView(prev.view);
        setSelectedGame(prev.game || null);
        try {
          window.history.pushState({ appStep: true, view: prev.view }, '', window.location.href);
        } catch {}
        return;
      }

      const hwPin = getUrlHwPin(false);
      if (hwPin) {
        setIsLockedHomeworkLink(true);
        setSelectedGame({ pinCode: hwPin });
        setCurrentView('homework');
        return;
      }
      const pbParams = getUrlPaintballParams();
      if (pbParams) {
        setSelectedGame((prev: any) => ({ ...(prev || {}), roomCode: pbParams.roomCode }));
        setCurrentView('hamster-paintball');
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const code = params.get('joinCode');
      if (code) {
        setInitialRoomCode(code);
        setIsAuthModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      const slideIdParam = params.get('slideId');
      if (slideIdParam) {
        setCurrentView('my-slides');
        return;
      }
    };

    checkUrlParams();
    try {
      window.history.replaceState({ appStep: true, view: currentViewRef.current }, '', window.location.href);
    } catch {}
    const onPopState = (e: PopStateEvent) => checkUrlParams(e);
    const onHashChange = () => checkUrlParams();
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const [pendingAction, setPendingAction] = useState<{ view: ViewState; data?: any } | null>(null);

  // Name Picker games, Homework, My Slides, and Hamster Paintball multiplayer links can be used freely by students without signing in
  const isNamePickerView = (v: ViewState) => v === "squid-game-picker" || v === "student-race";
  const isPublicStudentView = (v: ViewState) => isNamePickerView(v) || v === "homework" || v === "public-dashboard" || v === "hamster-paintball" || v === "my-slides";

  // Proactively redirect to home if visitor has no session and is on an action view
  useEffect(() => {
    if (!loading && !user && currentView !== "home" && !isPublicStudentView(currentView)) {
      setPendingAction({ view: currentView, data: selectedGame });
      setCurrentView("home");
      setIsAuthModalOpen(true);
    }
  }, [loading, user, currentView]);

  const handleViewChange = (view: ViewState, data?: any) => {
    // Players on a shared homework link can ONLY access the homework window given within the link
    if (isLockedHomeworkLink) {
      setCurrentView("homework");
      return;
    }
    if (view === "admin-dashboard" && !isAdmin) {
      setCurrentView("home");
      return;
    }

    // Name Picker, Homework, and Hamster Paintball are accessible for students without signing in
    const isFreeAccess = view === "home" || isPublicStudentView(view);
    if (!user && !isFreeAccess) {
      setPendingAction({ view, data });
      setIsAuthModalOpen(true);
      return;
    }

    // Support 1-step-back navigation when data?.stepBack is passed or when navigating between views
    if (data && data.__stepBack && viewHistoryRef.current.length > 0) {
      const prev = viewHistoryRef.current.pop()!;
      setCurrentView(prev.view);
      setSelectedGame(prev.game || null);
      return;
    }

    if (currentViewRef.current !== view) {
      viewHistoryRef.current.push({
        view: currentViewRef.current,
        game: selectedGameRef.current
      });
      if (viewHistoryRef.current.length > 20) {
        viewHistoryRef.current.shift();
      }
      try {
        window.history.pushState({ appStep: true, view }, '', window.location.href);
      } catch {}
    }

    setCurrentView(view);
    if (data && !data.__stepBack) {
      setSelectedGame(data);
    } else if (!data) {
      setSelectedGame(null);
    }
  };

  useEffect(() => {
    const trackVisit = async () => {
      if (!sessionStorage.getItem("visit_tracked")) {
        try {
          const ref = doc(db, 'settings', 'general');
          const snap = await getDoc(ref);
          if (snap.exists()) {
            await updateDoc(ref, { pageVisits: increment(1) });
          } else {
            await setDoc(ref, { pageVisits: 1 });
          }
          sessionStorage.setItem("visit_tracked", "true");
        } catch (e: any) {
          console.warn("Notice tracking visit:", e?.message || e);
        }
      }
    };
    trackVisit();
  }, []);

  const renderView = () => {
    // Views that require user authentication or cloud save: Class rewards, My Games, Generator, Admin
    const googleRequiredViews = ["games", "class-rewards", "class-record", "generator", "admin-dashboard"];

    if ((!user || user.isAnonymous) && googleRequiredViews.includes(currentView)) {
      const getFeatureInfo = () => {
        switch (currentView) {
          case "games":
            return {
              title: "My Games",
              desc: "Create, customize, and save your personal games and custom library."
            };
          case "homework":
            return {
              title: "Homework",
              desc: "Assign, track, and review homework assignments for your students."
            };
          case "class-rewards":
          case "class-record":
            return {
              title: "Class Rewards",
              desc: "Manage class vaults, student points, and reward systems across devices."
            };
          case "generator":
            return {
              title: "Create Game",
              desc: "Create and publish customized ESL learning games."
            };
          default:
            return {
              title: "Account Area",
              desc: "Sign in or create an account to save your progress."
            };
        }
      };

      const feature = getFeatureInfo();

      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-4 font-sans">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-800 text-left max-w-[420px] w-full">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center shrink-0 border-2 border-indigo-200 dark:border-indigo-800 shadow-sm mb-3 overflow-hidden">
                <img 
                  src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000" 
                  alt="Hamster English Studio" 
                  className="w-14 h-14 rounded-xl object-cover" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/bubble-pop-card.jpg?v=3';
                  }}
                />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {feature.title}
              </h2>
            </div>

            {/* Concise Greeting from Teacher Jan */}
            <div className="mb-5 p-3.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 flex items-center gap-3">
              <img
                src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w200"
                alt="Teacher Jan"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/images/bubble-pop-card.jpg?v=3';
                }}
                className="w-10 h-10 rounded-xl object-cover border-2 border-white dark:border-slate-700 shadow-xs shrink-0"
              />
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-snug font-semibold">
                Hi, I'm <strong className="font-extrabold text-slate-900 dark:text-white">Teacher Jan</strong>! Sign in with Google to save your work and custom games.
              </p>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-xl text-center">
                <p className="text-xs text-rose-700 dark:text-rose-300 font-bold whitespace-pre-line">
                  {authError}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => signInWithGoogle()}
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-3 h-12 px-5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-extrabold text-sm sm:text-base transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-60 group"
              >
                {isAuthenticating ? (
                  <Loader2 className="animate-spin text-indigo-400 dark:text-indigo-600" size={20} />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-xs">
                    <svg className="w-4 h-4 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                )}
                <span>{isAuthenticating ? "Signing in..." : "Sign in with Google"}</span>
              </button>

              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full text-center h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Enter 6-Digit Room Code →</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case "home":
        return <Home onViewChange={handleViewChange} openAuthModal={() => setIsAuthModalOpen(true)} openGoogleAuthModal={openGoogleAuthModal} />;
      case "generator":
        return <AIGenerator />;
      case "admin-dashboard":
        return isAdmin ? <AdminDashboard onViewChange={handleViewChange} /> : <Home onViewChange={handleViewChange} openAuthModal={() => setIsAuthModalOpen(true)} openGoogleAuthModal={openGoogleAuthModal} />;
      case "user-dashboard":
        return <UserDashboard />;
      case "media-studio":
        return <MediaStudio />;
      case "mystery-box":
        return <MysteryBox onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "neon-chain":
        return <NeonChain onViewChange={handleViewChange} />;
      case "bubble-pop":
        return <BubblePop onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "roller-coaster-quiz":
        return <RollerCoasterQuiz onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "hamster-paintball":
        return <HamsterPaintball onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "slap-and-chop":
        return <SlapAndChop onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "shark-attack":
        return <SharkAttack onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "flashcards-match":
        return <FlashcardsMatch onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "yoga-quiz":
        return <YogaQuiz onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "bubble-sentence-pro":
        return <BubbleSentencePro onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "family-feud":
        return <FamilyFeud onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "sumo":
        return <Sumo onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "hamster-pop-quiz":
        return <HamsterPopQuiz onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "student-race":
        return <StudentRace onViewChange={handleViewChange} />;
      case "squid-game-picker":
        return <SquidGamePicker onViewChange={handleViewChange} />;
      case "letter-lock":
        return <LetterLock />;
      case "tic-tac-toe":
        return <TicTacToe onViewChange={handleViewChange} initialJoinData={joinData} initialGame={selectedGame} />;
      case "homework":
        return <Homework onViewChange={handleViewChange} initialData={selectedGame} />;
      case "class-rewards":
      case "class-record":
        return <ClassRecord onViewChange={handleViewChange} openAuthModal={() => setIsAuthModalOpen(true)} />;
      case "phonemic-master":
        return <PhonemicMaster onViewChange={handleViewChange} />;
      case "dashboard":
        return <UserDashboard />;
      case "public-dashboard":
        return <PublicDashboard onViewChange={handleViewChange} />;
      case "games":
        return <GamesLibrary onViewChange={handleViewChange} isAdmin={isAdmin} publishedGames={publishedGames} />;
      case "my-slides":
        return <MySlides onViewChange={handleViewChange} />;
      case "leaderboard":
        // Fallback for demo purposes
        return (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                Coming Soon
              </h2>
              <p className="text-slate-500">This view is under construction.</p>
              <button
                onClick={() => setCurrentView("home")}
                className="mt-6 px-6 py-2 bg-brand-purple text-white rounded-full font-medium"
              >
                Back to Home
              </button>
            </div>
          </div>
        );
      default:
        return <Home onViewChange={handleViewChange} openAuthModal={() => setIsAuthModalOpen(true)} openGoogleAuthModal={openGoogleAuthModal} />;
    }
  };

  const isGame = [
    "mystery-box", "bubble-pop", "roller-coaster-quiz", "hamster-paintball", "slap-and-chop", "shark-attack", "yoga-quiz", "bubble-sentence-pro",
    "family-feud", "sumo", "hamster-pop-quiz", "student-race",
    "squid-game-picker", "letter-lock", "tic-tac-toe", "neon-chain",
    "flashcards-match", "phonemic-master"
  ].includes(currentView);
  const isClass = currentView === "class-record" || currentView === "class-rewards";
  const isAdminView = currentView === "admin-dashboard" && isAdmin;

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 overflow-hidden">
      <AuthSliderModal 
        isOpen={isAuthModalOpen} 
        initialRoomCode={initialRoomCode}
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={() => {
          if (pendingAction) {
            setCurrentView(pendingAction.view);
            setSelectedGame(pendingAction.data || null);
            setPendingAction(null);
          }
        }}
        onJoinRoom={(code, name, type) => {
          setJoinData({code, nickname: name, gameType: type});
          if (type === 'hamster-paintball') {
            setSelectedGame({ roomCode: code, playerName: name });
          }
          setCurrentView(type as ViewState);
        }}
      />
      <GoogleAuthModal
        isOpen={isGoogleAuthModalOpen}
        onClose={() => setIsGoogleAuthModalOpen(false)}
        featureName={googleAuthFeature}
        onViewChange={handleViewChange}
        onJoinRoom={(code, name, type) => {
          setJoinData({code, nickname: name, gameType: type});
          if (type === 'hamster-paintball') {
            setSelectedGame({ roomCode: code, playerName: name });
          }
          setCurrentView(type as ViewState);
        }}
        onSuccess={() => {
          if (pendingAction) {
            setCurrentView(pendingAction.view);
            setSelectedGame(pendingAction.data || null);
            setPendingAction(null);
          } else if (googleAuthFeature === "Create Game" || googleAuthFeature === "My Games") {
            setCurrentView("games");
          } else if (googleAuthFeature === "Homework") {
            setCurrentView("homework");
          } else if (googleAuthFeature === "Class rewards" || googleAuthFeature === "Class Rewards") {
            setCurrentView("class-rewards");
          }
        }}
      />
      {!isLockedHomeworkLink && (
        <Navigation 
          currentView={currentView} 
          onViewChange={handleViewChange} 
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          openAuthModal={() => setIsAuthModalOpen(true)}
          openGoogleAuthModal={openGoogleAuthModal}
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isLockedHomeworkLink && (
          <div className={isGame ? "hidden md:block shrink-0" : "shrink-0"}>
            <Header 
              onViewChange={handleViewChange} 
              setIsMobileMenuOpen={setIsMobileMenuOpen}
              openAuthModal={() => setIsAuthModalOpen(true)}
            />
          </div>
        )}
        <main
          className={`flex-1 custom-scrollbar ${
            isAdminView
              ? "p-0 space-y-0 h-full flex flex-col overflow-hidden"
              : isLockedHomeworkLink || isGame
              ? "p-0 space-y-0 h-full flex flex-col overflow-y-auto"
              : isClass
              ? "p-2 md:p-3 space-y-0 overflow-y-auto"
              : "p-4 md:p-8 space-y-6 overflow-y-auto"
          }`}
        >
          {renderView()}
          {!isLockedHomeworkLink && !isGame && !isClass && !isAdminView && <Footer />}
        </main>
      </div>
    </div>
  );
}
