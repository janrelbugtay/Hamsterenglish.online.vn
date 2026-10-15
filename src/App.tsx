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
import { ClassRecord, getBestSavedClasses, isDefaultMockClasses, STORAGE_KEY } from "./views/ClassRecord";
import { PhonemicMaster } from "./views/PhonemicMaster";
import SquidGamePicker from "./views/SquidGamePicker";
import { useAuth } from "./contexts/AuthContext";
import { doc, onSnapshot, getDoc, updateDoc, increment, setDoc } from "firebase/firestore";
import { db } from "./lib/firebase";
import { Loader2 } from "lucide-react";
import { AuthSliderModal } from "./components/AuthSliderModal";
import { GoogleAuthModal } from "./components/GoogleAuthModal";

export default function App() {
  // Show Home for visitors and new logins instead of community (public-dashboard)
  const [currentView, setCurrentView] = useState<ViewState>("home");
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGoogleAuthModalOpen, setIsGoogleAuthModalOpen] = useState(false);
  const [googleAuthFeature, setGoogleAuthFeature] = useState<string>("Account Area");
  const [initialRoomCode, setInitialRoomCode] = useState<string>('');
  const [joinData, setJoinData] = useState<{code: string, nickname: string, gameType: string} | null>(null);
  const prevUserRef = useRef<any>(null);
  const { user, loading, isAuthenticating, authError, signInWithGoogle } = useAuth();
  
  const isAdmin = Boolean(user && !user.isAnonymous && user.email?.toLowerCase().trim() === "janrelbugtay03@gmail.com");

  const openGoogleAuthModal = (feature: string = "Account Area") => {
    setGoogleAuthFeature(feature);
    setIsGoogleAuthModalOpen(true);
  };

  // Route new sign-ins directly to "home"
  useEffect(() => {
    if (user && !user.isAnonymous) {
      const justLoggedIn = !prevUserRef.current || prevUserRef.current.isAnonymous;
      if (justLoggedIn) {
        // Direct to Home instead of community
        setCurrentView("home");
      }
    }
    prevUserRef.current = user;
  }, [user]);

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
          // Device has classes: ensure cloud has them
          const payload = { classes: localClasses, updatedAt: Date.now() };
          await setDoc(userDocRef, payload, { merge: true });
          await setDoc(backupDocRef, payload, { merge: true });
        } else {
          // Device has no local classes: check if cloud has classes and cache them
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data?.classes) && data.classes.length > 0) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data.classes));
              localStorage.setItem('squid_hamster_class_dollars_v13', JSON.stringify(data.classes));
              localStorage.setItem('squid_user_classes', JSON.stringify(data.classes));
            }
          }
        }
      } catch (err: any) {
        console.warn('Background class sync note:', err?.message);
      }
    };

    syncClassesBackground();
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('joinCode');
    if (code) {
      setInitialRoomCode(code);
      setIsAuthModalOpen(true);
      // Remove it from URL so refreshing doesn't keep triggering it
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [pendingAction, setPendingAction] = useState<{ view: ViewState; data?: any } | null>(null);

  // Proactively redirect to home if visitor has no session and is on a non-home view
  useEffect(() => {
    if (!loading && !user && currentView !== "home") {
      setPendingAction({ view: currentView, data: selectedGame });
      setCurrentView("home");
      setIsAuthModalOpen(true);
    }
  }, [loading, user]);

  const handleViewChange = (view: ViewState, data?: any) => {
    if (view === "admin-dashboard" && !isAdmin) {
      setCurrentView("home");
      return;
    }

    // All actions and games require signing in or playing as guest
    if (!user && view !== "home") {
      setPendingAction({ view, data });
      setIsAuthModalOpen(true);
      return;
    }

    setCurrentView(view);
    if (data) {
      setSelectedGame(data);
    } else {
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
        } catch (e) {
          console.error("Failed to track visit", e);
        }
      }
    };
    trackVisit();
  }, []);

  const renderView = () => {
    // Views that require user authentication or cloud save: Homework, Class rewards, My Games, Generator, Admin
    const googleRequiredViews = ["games", "homework", "class-rewards", "class-record", "generator", "admin-dashboard"];

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
          <div className="bg-white dark:bg-slate-800 p-7 sm:p-9 rounded-[28px] shadow-xl border border-slate-200 dark:border-slate-700 text-left max-w-[460px] w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-purple/10 dark:bg-brand-purple/20 flex items-center justify-center shrink-0 border border-brand-purple/20">
                <img 
                  src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000" 
                  alt="Hamster English Logo" 
                  className="w-10 h-10 rounded-xl object-cover" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                  Sign In or Choose How to Play
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Access <span className="font-semibold text-brand-purple dark:text-purple-300">{feature.title}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60">
              {feature.desc} Choose how you would like to continue:
            </p>

            {authError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-left">
                <p className="text-xs text-rose-600 dark:text-rose-300 font-medium whitespace-pre-line leading-relaxed">
                  {authError}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {/* CHOICE 1: LOG IN WITH GOOGLE */}
              <button
                onClick={() => signInWithGoogle()}
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-3 h-12 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-2xl transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
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
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {isAuthenticating ? "Connecting to Google..." : "Log in with Google"}
                </span>
              </button>

              {/* CHOICE 2: PLAY AS GUEST (MANDATORY NAME INPUT) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-col gap-2">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full text-center py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Play as Guest (Enter Name to Play) →</span>
                </button>
              </div>
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
      case "flashcards-match":
        return <FlashcardsMatch onViewChange={handleViewChange} />;
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
        return <TicTacToe onViewChange={handleViewChange} initialJoinData={joinData} />;
      case "homework":
        return <Homework onViewChange={handleViewChange} />;
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
        return <GamesLibrary onViewChange={handleViewChange} isAdmin={isAdmin} />;
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
    "mystery-box", "bubble-pop", "yoga-quiz", "bubble-sentence-pro",
    "family-feud", "sumo", "hamster-pop-quiz", "student-race",
    "squid-game-picker", "letter-lock", "tic-tac-toe", "neon-chain",
    "flashcards-match", "phonemic-master"
  ].includes(currentView);
  const isClass = currentView === "class-record" || currentView === "class-rewards";

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
          setCurrentView(type as ViewState);
        }}
      />
      <GoogleAuthModal
        isOpen={isGoogleAuthModalOpen}
        onClose={() => setIsGoogleAuthModalOpen(false)}
        featureName={googleAuthFeature}
        onViewChange={handleViewChange}
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
      <Navigation 
        currentView={currentView} 
        onViewChange={handleViewChange} 
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        openAuthModal={() => setIsAuthModalOpen(true)}
        openGoogleAuthModal={openGoogleAuthModal}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={isGame ? "hidden md:block shrink-0" : "shrink-0"}>
          <Header 
            onViewChange={handleViewChange} 
            setIsMobileMenuOpen={setIsMobileMenuOpen}
            openAuthModal={() => setIsAuthModalOpen(true)}
          />
        </div>
        <main className={`flex-1 ${isGame ? "p-0 space-y-0 h-full flex flex-col overflow-y-auto" : isClass ? "p-2 md:p-3 space-y-0 overflow-y-auto" : "p-4 md:p-8 space-y-6 overflow-y-auto"}`}>
          {renderView()}
          {!isGame && !isClass && <Footer />}
        </main>
      </div>
    </div>
  );
}
