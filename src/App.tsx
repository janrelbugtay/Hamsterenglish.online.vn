/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { ViewState } from "./types";
import { Navigation, Header } from "./components/Navigation";
import { Footer } from "./components/Footer";
import { HamsterMascotIcon } from "./components/HamsterBrandLogo";
import { Home } from "./views/Home";
import { recordRecentGame } from "./data/studioGames";
import { HamsterPaintball } from "./views/HamsterPaintball";
import { ClassRecord, isDefaultMockClasses, sortClassesByName } from "./views/ClassRecord";
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
import { PhonemicMaster } from "./views/PhonemicMaster";
import SquidGamePicker from "./views/SquidGamePicker";
import { SleepingHamster } from "./views/SleepingHamster";
import { MySlides } from "./views/MySlides";
import { useAuth } from "./contexts/AuthContext";
import { useLanguage } from "./contexts/LanguageContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirestoreQuotaExhausted, ensureServerQuotaChecked } from "./lib/firebase";
import {
  validateFirestoreConnectionOnce,
  readClassSnapshotFromIDB,
  writeClassSnapshotToIDB,
  scanAllLocalClassBackups,
  saveClassesToLocalStorage,
  getLocalIntentionalEmpty,
  fetchClassSnapshotFromServer,
  fetchClassSnapshotFromFirestore,
  pushClassSnapshotToServerReliable,
  syncClassSnapshotToFirestore,
  pickBestClassSnapshot,
} from "./lib/classPersistence";
import { Loader2, QrCode, LogIn } from "lucide-react";
import { AuthSliderModal } from "./components/AuthSliderModal";
import { GoogleAuthModal } from "./components/GoogleAuthModal";
import { verifyMultiplayerRoomCode } from "./utils/roomCodeValidator";
import { hasTabLaunchUrlParams, resolveLaunchedGameFromUrl } from "./utils/gameTabLauncher";
import { GameModeModal } from "./components/GameModeModal";

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

  // Synchronously detect direct Sumo Royale join links (?game=sumo&room=XXXXXX)
  const getUrlSumoParams = (): { roomCode?: string } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      let gameParam = searchParams.get('game');
      let roomParam = searchParams.get('room') || searchParams.get('sumoRoom');

      if (!gameParam && !roomParam && window.location.hash) {
        const rawHash = window.location.hash;
        if (rawHash.includes('game=sumo') || rawHash.includes('sumoRoom=')) {
          const qPart = rawHash.includes('?') ? rawHash.split('?')[1] : rawHash.replace(/^#\/?/, '');
          const hashParams = new URLSearchParams(qPart);
          gameParam = hashParams.get('game') || (rawHash.includes('sumo') ? 'sumo' : null);
          roomParam = hashParams.get('room') || hashParams.get('sumoRoom');
        }
      }

      if (gameParam === 'sumo' || searchParams.get('sumoRoom')) {
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
  const initialSumo = !initialHwPin && !initialPaintball ? getUrlSumoParams() : null;
  const [isLockedHomeworkLink, setIsLockedHomeworkLink] = useState<boolean>(Boolean(initialHwPin));

  const [currentView, setCurrentView] = useState<ViewState>(
    initialHwPin
      ? "homework"
      : initialPaintball
      ? "hamster-paintball"
      : initialSumo
      ? "sumo"
      : "home"
  );
  const [selectedGame, setSelectedGame] = useState<any>(
    initialHwPin
      ? { pinCode: initialHwPin }
      : initialPaintball
      ? { roomCode: initialPaintball.roomCode }
      : initialSumo
      ? { roomCode: initialSumo.roomCode, isStudentJoin: true }
      : null
  );
  const [isTabLaunchPending, setIsTabLaunchPending] = useState<boolean>(() => hasTabLaunchUrlParams());
  const [newTabPickerGame, setNewTabPickerGame] = useState<any | null>(null);
  const newTabRootGameRef = useRef<any | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGoogleAuthModalOpen, setIsGoogleAuthModalOpen] = useState(false);
  const [googleAuthFeature, setGoogleAuthFeature] = useState<string>("Account Area");
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const [joinData] = useState<{code: string, nickname: string, gameType: string} | null>(null);
  const [publishedGames, setPublishedGames] = useState<Record<string, boolean>>(() => {
    try {
      const cached = localStorage.getItem('publishedGamesV2');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {};
  });
  const prevUserRef = useRef<any>(null);
  const { user, loading, isAuthenticating, authError, signInWithGoogle } = useAuth();
  const { t } = useLanguage();
  
  const isAdmin = Boolean(user && !user.isAnonymous && user.email?.toLowerCase().trim() === "janrelbugtay03@gmail.com");

  // Listen to publishedGamesV2 from settings/general (skip while student is directly inside Hamster Paintball to avoid extra Firestore listener overhead)
  useEffect(() => {
    if (currentView === "hamster-paintball" && Boolean(initialPaintball)) {
      return;
    }
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
  }, [currentView]);

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
        const activeSumo = getUrlSumoParams();
        const hasSlideInUrl =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).has('slideId');

        if (hasHwInUrl && activePin) {
          setSelectedGame((prev: any) => (prev?.pinCode ? prev : { pinCode: activePin }));
        } else if (activePb) {
          setSelectedGame((prev: any) =>
            prev?.roomCode ? prev : { roomCode: activePb.roomCode }
          );
        } else if (activeSumo) {
          setSelectedGame((prev: any) =>
            prev?.roomCode ? prev : { roomCode: activeSumo.roomCode, isStudentJoin: true }
          );
        }

        setCurrentView((prev) => {
          if (hasTabLaunchUrlParams()) return prev;
          if (prev === 'homework' || hasHwInUrl) return 'homework';
          if (prev === 'hamster-paintball' || activePb) return 'hamster-paintball';
          if (prev === 'sumo' && activeSumo) return 'sumo';
          if (prev === 'my-slides' || hasSlideInUrl) return 'my-slides';
          if (prev !== 'home') return prev;
          return 'home';
        });
      }
    }
    prevUserRef.current = user;
  }, [user, isLockedHomeworkLink]);

  // Validate Firestore connectivity once at startup
  useEffect(() => {
    validateFirestoreConnectionOnce();
  }, []);

  // Proactive multi-layer class persistence & cloud sync on authentication
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    let cancelled = false;

    const syncClassesBackground = async () => {
      try {
        const localScan = scanAllLocalClassBackups(user.uid, isDefaultMockClasses);
        const localIntentionalEmpty = getLocalIntentionalEmpty(user.uid);
        const localSnapshot = localScan
          ? {
              userId: user.uid,
              email: user.email || undefined,
              classes: localScan.classes,
              updatedAt: localScan.updatedAt || 0,
              intentionalEmptyReset: false,
            }
          : localIntentionalEmpty
          ? {
              userId: user.uid,
              email: user.email || undefined,
              classes: [],
              updatedAt: 0,
              intentionalEmptyReset: true,
            }
          : null;

        const [idbSnap, serverSnap, cloudResult] = await Promise.all([
          readClassSnapshotFromIDB(user.uid),
          fetchClassSnapshotFromServer(user.uid, user.email),
          fetchClassSnapshotFromFirestore(user.uid, 3200),
        ]);

        if (cancelled) return;

        if (serverSnap?.customRewards && serverSnap.customRewards.length > 0) {
          try {
            localStorage.setItem(
              `squid_custom_rewards_${user.uid}`,
              JSON.stringify(serverSnap.customRewards)
            );
          } catch {}
        }

        const winner = pickBestClassSnapshot(
          [
            { source: 'firestore', snapshot: cloudResult.snapshot },
            { source: 'server', snapshot: serverSnap },
            { source: 'idb', snapshot: idbSnap },
            { source: 'local', snapshot: localSnapshot },
          ],
          isDefaultMockClasses
        );

        if (!winner) return;

        const sorted = sortClassesByName(winner.snapshot.classes || []);
        const bestUpdatedAt = winner.snapshot.updatedAt || Date.now();
        const isIntentionalEmpty = Boolean(
          sorted.length === 0 && winner.snapshot.intentionalEmptyReset
        );

        if (sorted.length > 0 || isIntentionalEmpty) {
          saveClassesToLocalStorage(sorted, user.uid, bestUpdatedAt, isIntentionalEmpty);
          await writeClassSnapshotToIDB(user.uid, {
            userId: user.uid,
            email: user.email || undefined,
            classes: sorted,
            deletedClasses: winner.snapshot.deletedClasses,
            deletedStudents: winner.snapshot.deletedStudents,
            updatedAt: bestUpdatedAt,
            intentionalEmptyReset: isIntentionalEmpty,
          });

          if (winner.source !== 'server') {
            pushClassSnapshotToServerReliable(user.uid, {
              email: user.email,
              classes: sorted,
              deletedClasses: winner.snapshot.deletedClasses,
              deletedStudents: winner.snapshot.deletedStudents,
              updatedAt: bestUpdatedAt,
              intentionalEmptyReset: isIntentionalEmpty,
            }).catch(() => {});
          }

          const cloudUpdatedAt = cloudResult.snapshot?.updatedAt || 0;
          const needsCloudBackfill =
            winner.source !== 'firestore' &&
            !cloudResult.quotaExceeded &&
            !isFirestoreQuotaExhausted() &&
            (!cloudResult.snapshot || bestUpdatedAt > cloudUpdatedAt + 5000);

          if (needsCloudBackfill) {
            const quotaHit = await ensureServerQuotaChecked();
            if (!quotaHit) {
              syncClassSnapshotToFirestore(user.uid, {
                classes: sorted,
                deletedClasses: winner.snapshot.deletedClasses,
                deletedStudents: winner.snapshot.deletedStudents,
                updatedAt: bestUpdatedAt,
                intentionalEmptyReset: isIntentionalEmpty,
              }).catch(() => {});
            }
          }
        }
      } catch (err: any) {
        console.warn('Background class sync note:', err?.message);
      }
    };

    syncClassesBackground();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const viewHistoryRef = useRef<Array<{ view: ViewState; game: any }>>([]);
  const currentViewRef = useRef<ViewState>(currentView);
  currentViewRef.current = currentView;
  const selectedGameRef = useRef<any>(selectedGame);
  selectedGameRef.current = selectedGame;
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const scrollMainToTop = () => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
      mainScrollRef.current.scrollLeft = 0;
    }
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {}
  };

  useLayoutEffect(() => {
    scrollMainToTop();
  }, [currentView]);

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
      const sumoParams = getUrlSumoParams();
      if (sumoParams) {
        setSelectedGame((prev: any) => ({ ...(prev || {}), roomCode: sumoParams.roomCode, isStudentJoin: true }));
        setCurrentView('sumo');
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const code = params.get('joinCode');
      if (code) {
        const cleanJoinCode = code.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6);
        if (cleanJoinCode) {
          setSelectedGame({ roomCode: cleanJoinCode, isStudentJoin: true });
          setCurrentView('tic-tac-toe');
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      const slideIdParam = params.get('slideId');
      if (slideIdParam) {
        setCurrentView('my-slides');
        return;
      }
      if (params.get('playGame') || params.get('launchKey')) {
        setIsTabLaunchPending(true);
        resolveLaunchedGameFromUrl()
          .then((launched) => {
            if (launched && launched.game) {
              newTabRootGameRef.current = launched.game;
              if (launched.isMultiMode) {
                setNewTabPickerGame(launched.game);
              } else {
                setSelectedGame(launched.game);
                setCurrentView(launched.mode as ViewState);
              }
            }
          })
          .finally(() => {
            setIsTabLaunchPending(false);
          });
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
  const isPublicStudentView = (v: ViewState) => isNamePickerView(v) || v === "homework" || v === "public-dashboard" || v === "hamster-paintball" || v === "sleeping-hamster" || v === "my-slides";

  // Proactively redirect to home if visitor has no session and is on an action view
  useEffect(() => {
    if (isTabLaunchPending || newTabPickerGame) return;
    const isJoiningStudentRoom =
      (currentView === "tic-tac-toe" || currentView === "sumo") &&
      Boolean(selectedGame?.isStudentJoin || selectedGame?.roomCode);
    if (!loading && !user && currentView !== "home" && !isPublicStudentView(currentView) && !isJoiningStudentRoom && !selectedGame) {
      setPendingAction({ view: currentView, data: selectedGame });
      setCurrentView("home");
      setIsAuthModalOpen(true);
    }
  }, [loading, user, currentView, selectedGame, isTabLaunchPending, newTabPickerGame]);

  const [inlineRoomCode, setInlineRoomCode] = useState("");
  const [isInlineCheckingRoom, setIsInlineCheckingRoom] = useState(false);
  const [inlineRoomError, setInlineRoomError] = useState<string | null>(null);

  const handleViewChange = (view: ViewState, data?: any) => {
    // Players on a shared homework link can ONLY access the homework window given within the link
    if (isLockedHomeworkLink) {
      setCurrentView("homework");
      return;
    }
    if ((view === "admin-dashboard" || view === "ai-3d-character-studio") && !isAdmin) {
      setCurrentView("home");
      return;
    }

    // Name Picker, Homework, Hamster Paintball, and verified host multiplayer room joins are accessible without signing in
    const isFreeAccess = view === "home" || isPublicStudentView(view) || Boolean(data?.isStudentJoin);
    if (!user && !isFreeAccess) {
      setPendingAction({ view, data });
      setIsAuthModalOpen(true);
      return;
    }

    // Support 1-step-back navigation when data?.stepBack is passed or when navigating between views
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if (data && data.__stepBack && newTabRootGameRef.current) {
      setNewTabPickerGame(newTabRootGameRef.current);
      setCurrentView("home");
      setSelectedGame(null);
      return;
    }
    if (data && data.__stepBack && viewHistoryRef.current.length > 0) {
      const prev = viewHistoryRef.current.pop()!;
      setCurrentView(prev.view);
      setSelectedGame(prev.game || null);
      return;
    }
    if ((view === "home" || view === "games") && newTabRootGameRef.current && currentViewRef.current !== "home") {
      setNewTabPickerGame(newTabRootGameRef.current);
      setCurrentView("home");
      setSelectedGame(null);
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

    recordRecentGame(view);
    if (view !== "home") {
      setHeaderSearchQuery("");
    }
    setCurrentView(view);
    if (data && !data.__stepBack) {
      setSelectedGame(data);
    } else if (!data) {
      setSelectedGame(null);
    }
    scrollMainToTop();
    requestAnimationFrame(() => scrollMainToTop());
  };

  useEffect(() => {
    const trackVisit = async () => {
      if (!sessionStorage.getItem("visit_tracked")) {
        sessionStorage.setItem("visit_tracked", "true");
        try {
          const resp = await fetch("/api/platform-cache/visit", { method: "POST" });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.pageVisits) {
              try {
                localStorage.setItem("hamster_cached_page_visits_v1", String(data.pageVisits));
              } catch {}
            }
          }
        } catch {}
      }
    };
    trackVisit();
  }, []);

  const renderView = () => {
    // Views that require user authentication or cloud save: Class rewards, My Games, Generator, Admin
    const googleRequiredViews = ["games", "class-rewards", "class-record", "generator", "admin-dashboard", "ai-3d-character-studio"];

    if ((!user || user.isAnonymous) && googleRequiredViews.includes(currentView)) {
      const getFeatureInfo = () => {
        switch (currentView) {
          case "games":
            return {
              title: t("nav.myGames"),
              desc: t("auth.myGamesDesc")
            };
          case "homework":
            return {
              title: t("nav.homework"),
              desc: t("auth.homeworkDesc")
            };
          case "class-rewards":
          case "class-record":
            return {
              title: t("auth.classRewardsTitle"),
              desc: t("auth.classRewardsDesc")
            };
          case "generator":
            return {
              title: t("auth.createGameTitle"),
              desc: t("auth.createGameDesc")
            };
          default:
            return {
              title: t("auth.accountTitle"),
              desc: t("auth.accountDesc")
            };
        }
      };

      const feature = getFeatureInfo();

      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-4 font-sans">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-800 text-left max-w-[420px] w-full">
            <div className="flex flex-col items-center text-center mb-5">
              <HamsterMascotIcon size="lg" className="mb-3" />
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
                {t("auth.teacherJanPrefix")} <strong className="font-extrabold text-slate-900 dark:text-white">Teacher Jan</strong>{t("auth.teacherJanSuffix")}
              </p>
            </div>

            {(authError || inlineRoomError) && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-xl text-center">
                <p className="text-xs text-rose-700 dark:text-rose-300 font-bold whitespace-pre-line">
                  {inlineRoomError || authError}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => {
                  setInlineRoomError(null);
                  signInWithGoogle();
                }}
                disabled={isAuthenticating || isInlineCheckingRoom}
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
                <span>{isAuthenticating ? t("header.signingIn") : t("auth.signInGoogle")}</span>
              </button>
            </div>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-slate-900 px-3 font-extrabold text-slate-400 dark:text-slate-500 text-xs">
                  {t("auth.or")}
                </span>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setInlineRoomError(null);
                const cleaned = inlineRoomCode.replace(/[^0-9A-Za-z]/g, "").toUpperCase().trim().slice(0, 6);
                if (cleaned.length < 6) {
                  setInlineRoomError("Please enter the complete 6-character code from your host.");
                  return;
                }
                setIsInlineCheckingRoom(true);
                try {
                  const res = await verifyMultiplayerRoomCode(cleaned);
                  if (res.valid && res.gameView) {
                    setInlineRoomCode("");
                    handleViewChange(res.gameView, { roomCode: res.roomCode, isStudentJoin: true });
                  } else {
                    setInlineRoomError(
                      res.error || `Incorrect room code "${cleaned}". No host is currently hosting a game with this code.`
                    );
                  }
                } finally {
                  setIsInlineCheckingRoom(false);
                }
              }}
              className={`w-full flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 p-1.5 pl-3.5 rounded-2xl border-2 shadow-sm transition-colors ${
                inlineRoomError ? "border-rose-400" : "border-lime-400/80"
              }`}
            >
              <QrCode size={18} className="text-lime-600 dark:text-lime-400 shrink-0" />
              <input
                type="text"
                maxLength={6}
                value={inlineRoomCode}
                onChange={(e) => {
                  setInlineRoomCode(e.target.value.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 6));
                  if (inlineRoomError) setInlineRoomError(null);
                }}
                placeholder={t("home.roomCodePlaceholder")}
                className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-black font-mono tracking-wider uppercase text-slate-800 dark:text-white placeholder:font-sans placeholder:font-semibold placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inlineRoomCode.trim() || isInlineCheckingRoom || isAuthenticating}
                className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer whitespace-nowrap shrink-0"
              >
                {isInlineCheckingRoom ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                <span>{isInlineCheckingRoom ? "..." : t("home.joinLobby")}</span>
              </button>
            </form>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case "home":
        return (
          <Home
            onViewChange={handleViewChange}
            openAuthModal={() => setIsAuthModalOpen(true)}
            openGoogleAuthModal={openGoogleAuthModal}
            searchQuery={headerSearchQuery}
            onClearSearch={() => setHeaderSearchQuery("")}
          />
        );
      case "generator":
        return <AIGenerator />;
      case "admin-dashboard":
        return isAdmin ? (
          <AdminDashboard onViewChange={handleViewChange} />
        ) : (
          <Home
            onViewChange={handleViewChange}
            openAuthModal={() => setIsAuthModalOpen(true)}
            openGoogleAuthModal={openGoogleAuthModal}
            searchQuery={headerSearchQuery}
            onClearSearch={() => setHeaderSearchQuery("")}
          />
        );
      case "ai-3d-character-studio":
        return isAdmin ? (
          <div className="w-full h-full flex flex-col bg-[#0b0c10]">
            <iframe
              src="/form3d-studio.html?v=20261126_10"
              title="FORM3D – AI 3D Character Studio"
              className="w-full flex-1 border-0 bg-[#0b0c10]"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        ) : (
          <Home
            onViewChange={handleViewChange}
            openAuthModal={() => setIsAuthModalOpen(true)}
            openGoogleAuthModal={openGoogleAuthModal}
            searchQuery={headerSearchQuery}
            onClearSearch={() => setHeaderSearchQuery("")}
          />
        );
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
        return <LetterLock onViewChange={handleViewChange} />;
      case "tic-tac-toe":
        return <TicTacToe onViewChange={handleViewChange} initialJoinData={joinData} initialGame={selectedGame} />;
      case "homework":
        return <Homework onViewChange={handleViewChange} initialData={selectedGame} />;
      case "class-rewards":
      case "class-record":
        return <ClassRecord onViewChange={handleViewChange} openAuthModal={() => setIsAuthModalOpen(true)} />;
      case "phonemic-master":
        return <PhonemicMaster onViewChange={handleViewChange} />;
      case "sleeping-hamster":
        return <SleepingHamster onViewChange={handleViewChange} />;
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
                {t("app.comingSoon")}
              </h2>
              <p className="text-slate-500">{t("app.underConstruction")}</p>
              <button
                onClick={() => setCurrentView("home")}
                className="mt-6 px-6 py-2 bg-brand-purple text-white rounded-full font-medium"
              >
                {t("app.backHome")}
              </button>
            </div>
          </div>
        );
      default:
        return (
          <Home
            onViewChange={handleViewChange}
            openAuthModal={() => setIsAuthModalOpen(true)}
            openGoogleAuthModal={openGoogleAuthModal}
            searchQuery={headerSearchQuery}
            onClearSearch={() => setHeaderSearchQuery("")}
          />
        );
    }
  };

  const isGame = [
    "mystery-box", "bubble-pop", "roller-coaster-quiz", "hamster-paintball", "slap-and-chop", "shark-attack", "yoga-quiz", "bubble-sentence-pro",
    "family-feud", "sumo", "hamster-pop-quiz", "student-race",
    "squid-game-picker", "letter-lock", "tic-tac-toe", "neon-chain",
    "flashcards-match", "phonemic-master", "sleeping-hamster"
  ].includes(currentView);
  const isClass = currentView === "class-record" || currentView === "class-rewards";
  const isAutoFullscreenView = isGame || isClass || isTabLaunchPending || Boolean(newTabPickerGame);
  const isAdminView = (currentView === "admin-dashboard" || currentView === "ai-3d-character-studio") && isAdmin;

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 overflow-hidden">
      <AuthSliderModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onJoinRoom={(view, data) => {
          setPendingAction(null);
          setIsAuthModalOpen(false);
          handleViewChange(view, data);
        }}
        onSuccess={() => {
          if (pendingAction) {
            if (currentViewRef.current !== pendingAction.view) {
              viewHistoryRef.current.push({
                view: currentViewRef.current,
                game: selectedGameRef.current
              });
            }
            setCurrentView(pendingAction.view);
            setSelectedGame(pendingAction.data || null);
            setPendingAction(null);
          }
        }}
      />
      <GoogleAuthModal
        isOpen={isGoogleAuthModalOpen}
        onClose={() => setIsGoogleAuthModalOpen(false)}
        featureName={googleAuthFeature}
        onJoinRoom={(view, data) => {
          setPendingAction(null);
          setIsGoogleAuthModalOpen(false);
          handleViewChange(view, data);
        }}
        onSuccess={() => {
          if (pendingAction) {
            if (currentViewRef.current !== pendingAction.view) {
              viewHistoryRef.current.push({
                view: currentViewRef.current,
                game: selectedGameRef.current
              });
            }
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
      {!isLockedHomeworkLink && !isAutoFullscreenView && (
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
        {!isLockedHomeworkLink && !isAutoFullscreenView && (
          <div className="shrink-0">
            <Header
              onViewChange={handleViewChange}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
              openAuthModal={() => setIsAuthModalOpen(true)}
              searchQuery={headerSearchQuery}
              onSearchChange={setHeaderSearchQuery}
              publishedGames={publishedGames}
              isAdmin={isAdmin}
            />
          </div>
        )}
        <main
          ref={mainScrollRef}
          className={`flex-1 custom-scrollbar ${
            isAdminView
              ? "p-0 space-y-0 h-full flex flex-col overflow-hidden"
              : isLockedHomeworkLink || isAutoFullscreenView
              ? "p-0 space-y-0 w-full h-full flex flex-col overflow-y-auto"
              : "p-4 md:p-8 space-y-6 overflow-y-auto"
          }`}
        >
          {isTabLaunchPending ? (
            <div className="flex-1 flex items-center justify-center min-h-screen bg-white dark:bg-slate-900">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
            </div>
          ) : newTabPickerGame ? (
            <GameModeModal
              isOpen={true}
              fullTabPage={true}
              gameData={newTabPickerGame}
              publishedGames={publishedGames}
              onClose={() => setNewTabPickerGame(null)}
              onSelectMode={(mode, adaptedData) => {
                setNewTabPickerGame(null);
                setSelectedGame(adaptedData);
                setCurrentView(mode as ViewState);
              }}
            />
          ) : (
            renderView()
          )}
          {!isLockedHomeworkLink && !isAutoFullscreenView && !isAdminView && (
            <Footer onViewChange={handleViewChange} />
          )}
        </main>
      </div>
    </div>
  );
}
