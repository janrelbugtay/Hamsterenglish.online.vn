import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { ViewState } from "../types";
import {
  Gamepad2,
  Home,
  Search,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  Shield,
  Users,
  BookOpen,
  Loader2,
  Award,
  Presentation,
  CornerDownLeft,
  Box,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { LanguageSelector } from "./LanguageSelector";
import { STUDIO_GAMES } from "../data/studioGames";
import { HamsterBrandLogo } from "./HamsterBrandLogo";

interface NavigationProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  openAuthModal?: () => void;
  openGoogleAuthModal?: (feature?: string) => void;
}

export function Navigation({
  currentView,
  onViewChange,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  openAuthModal,
  openGoogleAuthModal,
}: NavigationProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = Boolean(
    user &&
      !user.isAnonymous &&
      user.email?.toLowerCase().trim() === "janrelbugtay03@gmail.com"
  );

  const navItems = [
    { id: "home", label: t("nav.home"), icon: Home, view: "home" as ViewState },
    {
      id: "public-dashboard",
      label: t("nav.community"),
      icon: Users,
      view: "public-dashboard" as ViewState,
    },
    { id: "games", label: t("nav.myGames"), icon: Gamepad2, view: "games" as ViewState },
    {
      id: "my-slides",
      label: t("nav.mySlides"),
      icon: Presentation,
      view: "my-slides" as ViewState,
    },
    {
      id: "homework",
      label: t("nav.homework"),
      icon: BookOpen,
      view: "homework" as ViewState,
    },
    {
      id: "class-rewards",
      label: t("nav.classRewards"),
      icon: Award,
      view: "class-rewards" as ViewState,
    },
    ...(isAdmin
      ? [
          {
            id: "admin-dashboard",
            label: t("nav.adminDashboard"),
            icon: Shield,
            view: "admin-dashboard" as ViewState,
          },
          {
            id: "ai-3d-character-studio",
            label: "AI 3D Character Studio",
            icon: Box,
            view: "ai-3d-character-studio" as ViewState,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col p-5 shadow-sm shrink-0 h-full",
          "fixed md:static inset-y-0 left-0 z-50 w-[240px] md:w-[228px] transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            className="group flex items-center gap-2.5 p-1.5 -ml-1.5 cursor-pointer text-left rounded-2xl hover:bg-amber-50/60 dark:hover:bg-slate-700/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple"
            onClick={() => {
              onViewChange("home");
              setIsMobileMenuOpen(false);
            }}
          >
            <HamsterBrandLogo variant="sidebar" />
          </button>
          <button
            type="button"
            aria-label="Close navigation menu"
            className="md:hidden text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple cursor-pointer"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              currentView === item.view ||
              (item.id === "class-rewards" &&
                (currentView === "class-rewards" || currentView === "class-record")) ||
              (item.id === "admin-dashboard" && currentView === "admin-dashboard") ||
              (item.id === "ai-3d-character-studio" && currentView === "ai-3d-character-studio");

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  const freeViews = ["home", "homework", "public-dashboard", "my-slides"];
                  if (!user) {
                    if (freeViews.includes(item.view)) {
                      onViewChange(item.view);
                    } else {
                      if (openAuthModal) {
                        openAuthModal();
                      }
                      onViewChange(item.view);
                    }
                  } else {
                    const googleProtectedViews = [
                      "games",
                      "class-rewards",
                      "class-record",
                      "admin-dashboard",
                      "ai-3d-character-studio",
                    ];
                    if (user.isAnonymous && googleProtectedViews.includes(item.view)) {
                      if (openGoogleAuthModal) {
                        openGoogleAuthModal(item.label);
                      }
                      onViewChange(item.view);
                    } else {
                      onViewChange(item.view);
                    }
                  }
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold transition-all text-sm text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple",
                  isActive
                    ? "bg-slate-100 dark:bg-slate-700 text-brand-purple dark:text-purple-300"
                    : "text-[#64748b] dark:text-slate-300 hover:bg-[#f8fafc] dark:hover:bg-slate-800/50"
                )}
              >
                <item.icon size={20} className="shrink-0" />
                <span className="whitespace-nowrap truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export function Header({
  onViewChange,
  setIsMobileMenuOpen,
  openAuthModal,
  searchQuery = "",
  onSearchChange,
  publishedGames = {},
  isAdmin = false,
}: {
  onViewChange?: (view: ViewState, data?: any) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
  openAuthModal?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  publishedGames?: Record<string, boolean>;
  isAdmin?: boolean;
}) {
  const { user, logout, loading, isAuthenticating } = useAuth();
  const { t } = useLanguage();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("hamster_theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      document.body?.classList.add("dark");
      return true;
    }
    if (saved === "light") {
      document.documentElement.classList.remove("dark");
      document.body?.classList.remove("dark");
      return false;
    }
    return document.documentElement.classList.contains("dark");
  });

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      document.body?.classList.add("dark");
      localStorage.setItem("hamster_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body?.classList.remove("dark");
      localStorage.setItem("hamster_theme", "light");
    }
  };

  const resolvedIsAdmin =
    isAdmin ||
    Boolean(
      user &&
        !user.isAnonymous &&
        user.email?.toLowerCase().trim() === "janrelbugtay03@gmail.com"
    );

  // Filter studio games cleanly for instant global quick-launch
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const visibleGames = STUDIO_GAMES.filter(
      (g) =>
        g.id === "hamster-paintball" ||
        resolvedIsAdmin ||
        publishedGames[g.id] !== false
    );
    if (!q) return visibleGames.slice(0, 6);
    return visibleGames
      .filter((g) => {
        const hay = `${g.title} ${g.subject} ${g.description} ${g.players} ${g.category || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [searchQuery, publishedGames, resolvedIsAdmin]);

  useEffect(() => {
    setActiveResultIdx(0);
  }, [searchQuery]);

  // Global keyboard shortcut: Cmd/Ctrl + K or "/" focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (document.activeElement?.tagName || "").toUpperCase()
        )
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    if (isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchOpen]);

  const handleLaunchFromSearch = (gameId: string) => {
    setIsSearchOpen(false);
    if (onSearchChange) onSearchChange("");
    searchInputRef.current?.blur();
    if (onViewChange) {
      onViewChange(gameId as ViewState);
    }
  };

  const handleDropdownItemClick = (view: ViewState) => {
    if (onViewChange) {
      onViewChange(view);
    }
    setShowDropdown(false);
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-slate-800/50 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shrink-0 relative z-50">
      <div className="flex items-center gap-2 md:gap-4 w-3/5 sm:w-1/2 md:w-[360px]">
        <button
          type="button"
          aria-label="Open navigation menu"
          className="md:hidden text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple cursor-pointer"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu size={24} />
        </button>

        <div ref={searchWrapRef} className="relative w-full">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 opacity-75 pointer-events-none"
            size={17}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(e) => {
              onSearchChange?.(e.target.value);
              setIsSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIsSearchOpen(true);
                setActiveResultIdx((prev) =>
                  searchMatches.length ? (prev + 1) % searchMatches.length : 0
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIsSearchOpen(true);
                setActiveResultIdx((prev) =>
                  searchMatches.length
                    ? (prev - 1 + searchMatches.length) % searchMatches.length
                    : 0
                );
              } else if (e.key === "Enter" && isSearchOpen && searchMatches[activeResultIdx]) {
                e.preventDefault();
                handleLaunchFromSearch(searchMatches[activeResultIdx].id);
              } else if (e.key === "Escape") {
                if (searchQuery) {
                  onSearchChange?.("");
                } else {
                  setIsSearchOpen(false);
                  searchInputRef.current?.blur();
                }
              }
            }}
            placeholder={t("header.searchGames")}
            aria-label={t("header.searchGames")}
            className="w-full pl-10 pr-16 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-purple transition-all"
          />

          {searchQuery ? (
            <button
              type="button"
              aria-label="Clear game search"
              onClick={() => {
                onSearchChange?.("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          ) : (
            <span className="hidden lg:inline-flex items-center gap-0.5 absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400 pointer-events-none select-none">
              ⌘K
            </span>
          )}

          {/* Global Quick-Launch Search Dropdown */}
          {isSearchOpen && (
            <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700/70 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold">
                  {searchQuery.trim()
                    ? `${searchMatches.length} matching ${searchMatches.length === 1 ? "game" : "games"}`
                    : "Quick Launch Games"}
                </span>
                <span className="hidden sm:inline font-mono text-[11px]">Enter to launch</span>
              </div>
              {searchMatches.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No studio games match "{searchQuery}".
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {searchMatches.map((game, idx) => {
                    const isHighlighted = idx === activeResultIdx;
                    return (
                      <li key={game.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveResultIdx(idx)}
                          onClick={() => handleLaunchFromSearch(game.id)}
                          className={cn(
                            "w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer",
                            isHighlighted
                              ? "bg-slate-100 dark:bg-slate-700/70"
                              : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-lg shrink-0">
                              {game.icon || "🎮"}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {game.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {game.subject} · {game.players}
                              </p>
                            </div>
                          </div>
                          {isHighlighted && (
                            <CornerDownLeft
                              size={14}
                              className="text-brand-purple shrink-0"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={t("header.toggleTheme")}
            title={t("header.toggleTheme")}
            className="text-slate-500 hover:text-brand-purple transition-colors bg-slate-100 hover:bg-slate-200 p-2 rounded-full dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {!loading &&
          (user ? (
            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-brand-purple/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple cursor-pointer"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-700 shadow-sm object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-brand-yellow flex items-center justify-center border-2 border-white shadow-sm font-bold text-white">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
                  </div>
                )}
              </button>

              {showDropdown && (
                <>
                  {/* Backdrop overlay to close dropdown on click outside */}
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/80">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                        {user.displayName || t("header.userFallback")}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {user.email || (user.isAnonymous ? t("header.guestAccount") : "")}
                      </p>
                    </div>
                    <div className="py-1.5">
                      {user.isAnonymous && (
                        <button
                          type="button"
                          onClick={() => {
                            if (openAuthModal) openAuthModal();
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand-purple transition-colors flex items-center justify-between cursor-pointer"
                        >
                          {t("header.signInRegister")}
                        </button>
                      )}
                      {resolvedIsAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDropdownItemClick("admin-dashboard")}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-slate-700 hover:text-brand-purple transition-colors flex items-center gap-2.5 cursor-pointer"
                        >
                          <Shield size={16} className="text-brand-purple" />
                          <span>{t("nav.adminDashboard")}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setShowDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>{t("header.signOut")}</span>
                        <LogOut size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              disabled={isAuthenticating}
              className="bg-brand-purple hover:bg-brand-purple/90 text-white font-semibold py-1.5 px-3 md:px-4 rounded-full text-sm transition-colors shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              {isAuthenticating && <Loader2 className="animate-spin" size={14} />}
              <span>{isAuthenticating ? t("header.signingIn") : t("header.signIn")}</span>
            </button>
          ))}
      </div>
    </header>
  );
}
