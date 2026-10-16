import React, { useState } from 'react';
import { ViewState } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navigation } from './components/Navigation';
import { Home } from './views/Home';
import { YogaQuiz } from './views/YogaQuiz';
import { AuthSliderModal } from './components/AuthSliderModal';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { Compass, FolderHeart, Plus, Play, Sparkles } from 'lucide-react';

function AppContent() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>("home");
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGoogleAuthModalOpen, setIsGoogleAuthModalOpen] = useState(false);
  const [authFeature, setAuthFeature] = useState<string | undefined>(undefined);
  const [pendingAction, setPendingAction] = useState<{ view: ViewState; data?: any } | null>(null);

  const handleViewChange = (view: ViewState, data?: any) => {
    // Name picker does not require auth. All other game/creator actions require sign-in or guest
    const isPublicFree = view === "home" || view === "squid-game-picker";
    if (!isPublicFree && !user) {
      setPendingAction({ view, data });
      setIsAuthModalOpen(true);
      return;
    }

    if (data) setSelectedGame(data);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = () => {
    if (pendingAction) {
      if (pendingAction.data) setSelectedGame(pendingAction.data);
      setCurrentView(pendingAction.view);
      setPendingAction(null);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case "yoga-quiz":
        return <YogaQuiz onViewChange={handleViewChange} initialGame={selectedGame} />;
      case "public-dashboard":
        return (
          <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Compass className="text-teal-500" />
                  <span>Community Games Hub</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1 font-medium">Explore and play educational games created by teachers worldwide</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div 
                onClick={() => handleViewChange("yoga-quiz")}
                className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-teal-400 transition-all cursor-pointer flex flex-col gap-4 group"
              >
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-800 p-6 flex flex-col justify-between text-white relative">
                  <div className="flex justify-between items-center z-10">
                    <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">Yoga Quiz</span>
                    <span className="text-2xl">🧘</span>
                  </div>
                  <div className="z-10">
                    <h4 className="text-xl font-black">Yoga Poses & Vocabulary</h4>
                    <p className="text-xs text-teal-100 font-semibold mt-1">Picture identification & active physical yoga poses</p>
                  </div>
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-xs font-bold">Classroom Mode</span>
                  <button className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer">
                    <Play size={14} /> Play Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case "games":
        return (
          <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <FolderHeart className="text-teal-500" />
                  <span>My Games Library</span>
                </h2>
                <p className="text-sm text-slate-500 mt-1 font-medium">Your personalized classroom quizzes and lessons</p>
              </div>
              <button 
                onClick={() => { setSelectedGame({ editMode: true }); handleViewChange("yoga-quiz"); }}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-2xl flex items-center gap-2 transition-all cursor-pointer text-sm shadow-md"
              >
                <Plus size={18} /> New Game
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div 
                onClick={() => handleViewChange("yoga-quiz")}
                className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl p-2 bg-teal-50 dark:bg-teal-950/60 rounded-2xl">🧘</span>
                  <div>
                    <h4 className="text-base font-black text-slate-800 dark:text-white">Yoga Quiz</h4>
                    <span className="text-xs text-teal-600 font-bold">Interactive Lesson</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
                  <span className="text-xs text-slate-400 font-semibold">Active Game</span>
                  <span className="text-xs font-bold text-teal-600 hover:underline">Play / Edit &rarr;</span>
                </div>
              </div>
            </div>
          </div>
        );
      case "generator":
        return <YogaQuiz onViewChange={handleViewChange} initialGame={{ editMode: true }} />;
      case "home":
      default:
        return (
          <div className="px-4 py-8">
            <Home 
              onViewChange={handleViewChange} 
              openAuthModal={() => setIsAuthModalOpen(true)} 
              openGoogleAuthModal={(f) => { setAuthFeature(f); setIsGoogleAuthModalOpen(true); }} 
            />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      <Navigation 
        currentView={currentView} 
        onViewChange={handleViewChange} 
        openAuthModal={() => setIsAuthModalOpen(true)} 
      />

      <main className="flex-1 flex flex-col">
        {renderView()}
      </main>

      <AuthSliderModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={handleAuthSuccess} 
      />

      <GoogleAuthModal 
        isOpen={isGoogleAuthModalOpen} 
        onClose={() => setIsGoogleAuthModalOpen(false)} 
        onSuccess={handleAuthSuccess} 
        feature={authFeature} 
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
