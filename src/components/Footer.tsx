import React from "react";
import { Sparkles, Gamepad2, Heart, Award, Shield } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full mt-12 pt-8 pb-10 border-t border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-sm">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-3">
          <img
            src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000"
            alt="Hamster English Logo"
            className="w-8 h-8 rounded-xl object-cover shadow-sm shrink-0"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>Hamster English</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple dark:bg-purple-900/40 dark:text-purple-300">
                ESL Studio
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Interactive AI-powered games & classroom engagement
            </p>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Gamepad2 size={13} className="text-brand-purple" />
            15+ Classroom Games
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Sparkles size={13} className="text-amber-500" />
            AI Generator
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Award size={13} className="text-emerald-500" />
            Interactive Camera
          </span>
        </div>

        {/* Copyright */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <span>© {currentYear} Hamster English. Built with</span>
          <Heart size={12} className="text-rose-500 fill-rose-500 inline" />
          <span>for educators.</span>
        </div>
      </div>
    </footer>
  );
}
