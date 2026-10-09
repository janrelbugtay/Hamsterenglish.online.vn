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
import { ClassRecord } from "./views/ClassRecord";
import { PhonemicMaster } from "./views/PhonemicMaster";
import SquidGamePicker from "./views/SquidGamePicker";
import { useAuth } from "./contexts/AuthContext";
import { doc, onSnapshot, getDoc, updateDoc, increment, setDoc } from "firebase/firestore";
import { db } from "./lib/firebase";
import { AlertTriangle, Loader2 } from "lucide-react";
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

  const handleViewChange = (view: ViewState, data?: any) => {
    if (view === "admin-dashboard" && !isAdmin) {
      setCurrentView("home");
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
    // Views that require Google sign in: Homework, Class rewards, My Games, Generator, Admin
    const googleRequiredViews = ["games", "homework", "class-rewards", "class-record", "generator", "admin-dashboard"];

    if ((!user || user.isAnonymous) && googleRequiredViews.includes(currentView)) {
      const getFeatureInfo = () => {
        switch (currentView) {
          case "games":
            return {
              title: "My Games",
              desc: "Sign in with Google to create, customize, and save your personal games and library."
            };
          case "homework":
            return {
              title: "Homework",
              desc: "Sign in with Google to assign, track, and review homework for your students."
            };
          case "class-rewards":
          case "class-record":
            return {
              title: "Class Rewards",
              desc: "Sign in with Google to manage class vaults, student points, and reward systems."
            };
          case "generator":
            return {
              title: "Create Game",
              desc: "Sign in with Google to create and publish new learning games."
            };
          default:
            return {
              title: "Account Area",
              desc: "Please sign in with Google to access this feature."
            };
        }
      };

      const feature = getFeatureInfo();

      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-4">
          <div className="bg-white dark:bg-slate-800 p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 text-center max-w-md w-full">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-brand-purple rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xs">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
              Sign In with Google
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              {feature.desc}
            </p>
            
            {authError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-left">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium whitespace-pre-line">
                  {authError}
                </p>
              </div>
            )}
            
            <button
              onClick={() => signInWithGoogle()}
              disabled={isAuthenticating}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 text-slate-800 dark:text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {isAuthenticating ? (
                <Loader2 className="animate-spin text-brand-purple" size={22} />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              <span>{isAuthenticating ? "Connecting..." : "Continue with Google"}</span>
            </button>

            <button
              onClick={() => setCurrentView("public-dashboard")}
              className="w-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold py-2 transition-colors cursor-pointer"
            >
              Play free games in Community without signing in →
            </button>
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

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 overflow-hidden">
      <AuthSliderModal 
        isOpen={isAuthModalOpen} 
        initialRoomCode={initialRoomCode}
        onClose={() => setIsAuthModalOpen(false)} 
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
          if (googleAuthFeature === "Create Game" || googleAuthFeature === "My Games") {
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
        openGoogleAuthModal={openGoogleAuthModal}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          onViewChange={handleViewChange} 
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          openAuthModal={() => setIsAuthModalOpen(true)}
        />
        <main className={`flex-1 overflow-y-auto ${currentView === "class-record" || currentView === "class-rewards" || currentView === "sumo" ? "p-2 md:p-3 space-y-0" : "p-4 md:p-8 space-y-6"}`}>
          {renderView()}
          {currentView !== "sumo" && currentView !== "class-record" && currentView !== "class-rewards" && <Footer />}
        </main>
      </div>
    </div>
  );
}
