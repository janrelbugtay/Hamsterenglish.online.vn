import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Compass, Globe, Search } from "lucide-react";
import {
  AppLanguageCode,
  LANGUAGE_OPTIONS,
  useLanguage,
} from "../contexts/LanguageContext";
import { cn } from "../lib/utils";

export function LanguageSelector() {
  const {
    language,
    currentLanguageOption,
    setLanguage,
    detectBrowserLanguage,
    t,
    translateAllScreens,
    setTranslateAllScreens,
    keepQuizPromptsEnglish,
    setKeepQuizPromptsEnglish,
  } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return LANGUAGE_OPTIONS;
    return LANGUAGE_OPTIONS.filter(
      (opt) =>
        opt.nativeName.toLowerCase().includes(q) ||
        opt.englishName.toLowerCase().includes(q) ||
        opt.shortLabel.toLowerCase().includes(q) ||
        opt.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelect = (code: AppLanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className="relative shrink-0" data-no-translate>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${t("header.chooseLanguage")}: ${currentLanguageOption.nativeName}`}
        title={`${t("header.chooseLanguage")} (${currentLanguageOption.nativeName})`}
        className={cn(
          "h-9 px-2.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple",
          isOpen
            ? "bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/25 dark:text-purple-300"
            : "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-brand-purple dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-purple-300"
        )}
      >
        <Globe size={18} className="shrink-0" />
        <span className="text-xs font-bold tracking-wide tabular-nums">
          {currentLanguageOption.shortLabel}
        </span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={t("lang.title")}
          className="absolute right-0 mt-3 w-[320px] sm:w-[360px] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
        >
          {/* Header + Auto-Detect */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/70 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/90">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {t("lang.title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t("lang.subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                detectBrowserLanguage();
                setIsOpen(false);
                setSearchQuery("");
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-brand-purple hover:text-brand-purple dark:hover:text-purple-300 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Compass size={13} />
              <span>{t("lang.autoDetect")}</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="p-3 pb-2">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("lang.searchPlaceholder")}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-purple"
              />
            </div>
          </div>

          {/* Language Grid */}
          <div className="px-3 pb-3 max-h-64 overflow-y-auto custom-scrollbar">
            {filteredLanguages.length === 0 ? (
              <p className="py-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("lang.noResults")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {filteredLanguages.map((opt) => {
                  const isSelected = opt.code === language;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => handleSelect(opt.code)}
                      className={cn(
                        "flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer",
                        isSelected
                          ? "bg-brand-purple/10 border-brand-purple/40 text-brand-purple dark:bg-brand-purple/20 dark:border-purple-400/50 dark:text-purple-200"
                          : "bg-white dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-tight truncate">
                          {opt.nativeName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate">
                          <span>{opt.englishName}</span>
                          {opt.dir === "rtl" && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>RTL</span>
                            </>
                          )}
                        </div>
                      </div>
                      {isSelected ? (
                        <Check size={14} className="shrink-0 text-brand-purple dark:text-purple-300" />
                      ) : (
                        <span className="text-[10px] font-mono font-semibold text-slate-400 shrink-0">
                          {opt.shortLabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ESL Smart Translation Preferences */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/70 bg-slate-50/70 dark:bg-slate-900/40 space-y-2.5">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t("lang.translateAll")}
              </span>
              <input
                type="checkbox"
                checked={translateAllScreens}
                onChange={(e) => setTranslateAllScreens(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-purple cursor-pointer shrink-0"
              />
            </label>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {t("lang.keepEslEnglish")}
              </span>
              <input
                type="checkbox"
                checked={keepQuizPromptsEnglish}
                onChange={(e) => setKeepQuizPromptsEnglish(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-purple cursor-pointer shrink-0"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
