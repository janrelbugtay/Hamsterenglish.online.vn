import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { ViewState } from "../types";
import {
  Gamepad2,
  Home,
  Bell,
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
  FileSpreadsheet,
  Award
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";

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
  openGoogleAuthModal 
}: NavigationProps) {
  const { user } = useAuth();
  const isAdmin = Boolean(user && !user.isAnonymous && user.email?.toLowerCase().trim() === "janrelbugtay03@gmail.com");

  const navItems = [
    { id: "home", label: "Home", icon: Home, view: "home" as ViewState },
    { id: "public-dashboard", label: "Community", icon: Users, view: "public-dashboard" as ViewState },
    { id: "games", label: "My Games", icon: Gamepad2, view: "games" as ViewState },
    { id: "homework", label: "Homework", icon: BookOpen, view: "homework" as ViewState },
    { id: "class-rewards", label: "Class rewards", icon: Award, view: "class-rewards" as ViewState },
    ...(isAdmin ? [{ id: "admin-dashboard", label: "Admin Dashboard", icon: Shield, view: "admin-dashboard" as ViewState }] : []),
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
      
      <aside className={cn(
        "bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col p-5 shadow-sm shrink-0 h-full",
        "fixed md:static inset-y-0 left-0 z-50 w-[240px] md:w-[220px] transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex items-center justify-between mb-8">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              onViewChange("home");
              setIsMobileMenuOpen(false);
            }}
          >
            <img 
              src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000" 
              alt="Hamster English Logo"
              className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-purple-200/50 shrink-0"
              referrerPolicy="no-referrer"
            />
            <span className="font-bold text-lg leading-tight tracking-tight">
              Hamster English
              <br />
              <span className="text-brand-purple">- ESL Studio</span>
            </span>
          </div>
          <button 
            className="md:hidden text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              currentView === item.view ||
              (item.id === "class-rewards" && (currentView === "class-rewards" || currentView === "class-record")) ||
              (item.id === "admin-dashboard" && currentView === "admin-dashboard");

            return (
              <button
                key={item.id}
                onClick={() => {
                  const googleProtectedViews = ["games", "homework", "class-rewards", "class-record"];
                  if ((!user || user.isAnonymous) && googleProtectedViews.includes(item.view)) {
                    if (openGoogleAuthModal) {
                      openGoogleAuthModal(item.label);
                    }
                    onViewChange(item.view);
                  } else {
                    onViewChange(item.view);
                  }
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold transition-all text-sm text-left cursor-pointer",
                  isActive
                    ? "bg-slate-100 dark:bg-slate-700 text-brand-purple dark:text-purple-300"
                    : "text-[#64748b] hover:bg-[#f8fafc] dark:hover:bg-slate-800/50",
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
}: {
  onViewChange?: (view: ViewState) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
  openAuthModal?: () => void;
}) {
  const { user, linkWithGoogle, logout, loading, isAuthenticating } = useAuth();
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(() => document.documentElement.classList.contains('dark'));
  
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const isAdmin = Boolean(user && !user.isAnonymous && user.email?.toLowerCase().trim() === "janrelbugtay03@gmail.com");

  const handleDropdownItemClick = (view: ViewState) => {
    if (onViewChange) {
      onViewChange(view);
    }
    setShowDropdown(false);
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-slate-800/50 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shrink-0 relative z-50">
      <div className="flex items-center gap-2 md:gap-4 w-1/2 md:w-1/3">
        <button 
          className="md:hidden text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 p-2"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu size={24} />
        </button>
        <div className="relative w-full hidden sm:block">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 opacity-60"
            size={18}
          />
          <input
            type="text"
            placeholder="Search games..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-6">
        <button 
          onClick={toggleDarkMode}
          className="text-slate-400 hover:text-brand-purple transition-colors bg-slate-100 hover:bg-slate-200 p-2 rounded-full dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {!loading &&
          (user ? (
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-brand-purple/20 transition-all focus:outline-none"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-700 shadow-sm object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-brand-yellow flex items-center justify-center border-2 border-white shadow-sm font-bold text-white">
                    {user.displayName?.charAt(0) ||
                      user.email?.charAt(0) ||
                      "U"}
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
                        {user.displayName || "User"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {user.email || (user.isAnonymous ? "Guest Account" : "")}
                      </p>
                    </div>
                    <div className="py-1.5">
                      {user.isAnonymous && (
                        <button
                          onClick={() => {
                            if (openAuthModal) openAuthModal();
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand-purple transition-colors flex items-center justify-between"
                        >
                          Sign In / Register
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDropdownItemClick("admin-dashboard")}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-slate-700 hover:text-brand-purple transition-colors flex items-center gap-2.5"
                        >
                          <Shield size={16} className="text-brand-purple" />
                          <span>Admin Dashboard</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          logout();
                          setShowDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-slate-700 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center justify-between"
                      >
                        <span>Sign Out</span>
                        <LogOut size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              disabled={isAuthenticating}
              className="bg-brand-purple hover:bg-brand-purple/90 text-white font-semibold py-1.5 px-3 md:px-4 rounded-full text-sm transition-colors shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isAuthenticating && <Loader2 className="animate-spin" size={14} />}
              <span>{isAuthenticating ? "Signing In..." : "Sign In"}</span>
            </button>
          ))}
      </div>
    </header>
  );
}

