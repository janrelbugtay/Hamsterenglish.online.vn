import React from 'react';
import { ViewState } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Home, Compass, FolderHeart, User, LogOut, LogIn } from 'lucide-react';

interface NavigationProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  openAuthModal: () => void;
}

export function Navigation({ currentView, onViewChange, openAuthModal }: NavigationProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => onViewChange("home")}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <span className="text-2xl group-hover:scale-110 transition-transform">🐹</span>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800 dark:text-white leading-none">
              Hamster<span className="text-teal-600">English</span>
            </h1>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Classroom Studio</span>
          </div>
        </div>

        {/* Center Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
          <button
            type="button"
            onClick={() => onViewChange("home")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentView === "home"
                ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Home size={15} />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange("public-dashboard")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentView === "public-dashboard"
                ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Compass size={15} />
            <span>Community</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange("games")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentView === "games"
                ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FolderHeart size={15} />
            <span>My Games</span>
          </button>
        </nav>

        {/* Auth status & actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="w-6 h-6 rounded-full bg-teal-500 text-white font-black text-xs flex items-center justify-center">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
                  {user.displayName || (user.isAnonymous ? "Guest" : "Teacher")}
                </span>
                {user.isAnonymous && (
                  <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-extrabold px-1.5 py-0.5 rounded-full">
                    Guest
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={signOut}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-600 active:scale-95 text-white text-xs font-bold rounded-2xl shadow-md shadow-teal-500/20 transition-all cursor-pointer"
            >
              <LogIn size={15} />
              <span>Sign In / Guest</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
