import React, { useState, useEffect } from "react";
import { PlusCircle, QrCode, LogIn, LayoutGrid, Loader2, AlertCircle, History, SearchX, X, ArrowRight } from "lucide-react";
import { Game, GameCategoryId, ViewState } from "../types";
import { cn } from "../lib/utils";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, isFirestoreQuotaExhausted } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import {
  STUDIO_GAMES,
  GAME_CATEGORY_SECTIONS,
  getRecentGameIds,
} from "../data/studioGames";

import { verifyMultiplayerRoomCode } from "../utils/roomCodeValidator";

export function Home({
  onViewChange,
  searchQuery = "",
  onClearSearch,
}: {
  onViewChange?: (view: ViewState, data?: any) => void;
  openAuthModal?: () => void;
  openGoogleAuthModal?: (feature?: string) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}) {
  const [joinRoomInput, setJoinRoomInput] = useState("");
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [joinRoomError, setJoinRoomError] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleQuickJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinRoomInput.replace(/[^0-9A-Za-z]/g, "").toUpperCase().trim().slice(0, 6);
    if (!cleaned || !onViewChange) return;
    if (cleaned.length < 6) {
      setJoinRoomError("Please enter the complete 6-character code from your host.");
      return;
    }

    setIsCheckingRoom(true);
    setJoinRoomError(null);

    try {
      const result = await verifyMultiplayerRoomCode(cleaned);
      if (result.valid && result.gameView) {
        onViewChange(result.gameView, { roomCode: result.roomCode, isStudentJoin: true });
        return;
      }
      setJoinRoomError(
        result.error || `Incorrect room code "${cleaned}". No host is currently hosting a game with this code.`
      );
    } finally {
      setIsCheckingRoom(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      {/* Top Banner / Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white">
            {t("home.welcomeTitle")}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {t("home.welcomeSubtitle")}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Student Quick Join Multiplayer Lobby by 6-Digit Code */}
            <form
              onSubmit={handleQuickJoinRoom}
              className={`flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 p-1.5 pl-3.5 rounded-2xl border-2 shadow-sm transition-colors ${
                joinRoomError ? "border-rose-400" : "border-lime-400/70"
              }`}
            >
              <QrCode size={18} className="text-lime-600 dark:text-lime-400 shrink-0" />
              <input
                type="text"
                maxLength={6}
                value={joinRoomInput}
                onChange={(e) => {
                  setJoinRoomInput(e.target.value.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 6));
                  if (joinRoomError) setJoinRoomError(null);
                }}
                placeholder={t("home.roomCodePlaceholder")}
                className="w-40 sm:w-44 bg-transparent text-xs sm:text-sm font-black font-mono tracking-wider uppercase text-slate-800 dark:text-white placeholder:font-sans placeholder:font-semibold placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!joinRoomInput.trim() || isCheckingRoom}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer whitespace-nowrap shrink-0"
              >
                {isCheckingRoom ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                <span>{isCheckingRoom ? "..." : t("home.joinLobby")}</span>
              </button>
            </form>
          </div>
          {joinRoomError && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 px-1">
              <AlertCircle size={13} className="shrink-0" />
              <span>{joinRoomError}</span>
            </p>
          )}
        </div>
      </div>

      <FeaturedGamesSection
        onViewChange={onViewChange}
        searchQuery={searchQuery}
        onClearSearch={onClearSearch}
      />
    </div>
  );
}

function FeaturedGamesSection({
  onViewChange,
  searchQuery = "",
  onClearSearch,
}: {
  onViewChange?: (view: ViewState, data?: any) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = Boolean(user && !user.isAnonymous && user.email?.toLowerCase().trim() === "janrelbugtay03@gmail.com");
  const [selectedCategory, setSelectedCategory] = useState<"all" | GameCategoryId>("all");
  const [publishedGames, setPublishedGames] = useState<Record<string, boolean>>(() => {
    try {
      const cached = localStorage.getItem('publishedGamesV2');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {};
  });

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "general"), 
      (doc) => {
        if (doc.exists()) {
          const pub = doc.data().publishedGamesV2 || {};
          setPublishedGames(pub);
          try {
            localStorage.setItem('publishedGamesV2', JSON.stringify(pub));
          } catch (e) {}
        }
      },
      (err) => {
        console.warn("Notice in Home settings listener:", err?.message || err);
      }
    );
    return () => unsub();
  }, []);

  const games = STUDIO_GAMES.filter(
    (g) => g.id === "hamster-paintball" || isAdmin || publishedGames[g.id] !== false
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredGames = normalizedQuery
    ? games.filter((g) => {
        const hay = `${g.title} ${g.description} ${g.subject} ${g.players} ${g.category || ""}`.toLowerCase();
        return hay.includes(normalizedQuery);
      })
    : games;

  const visibleSections = GAME_CATEGORY_SECTIONS.map((section) => ({
    ...section,
    games: filteredGames.filter((g) => g.category === section.id),
  })).filter(
    (section) =>
      section.games.length > 0 &&
      (selectedCategory === "all" || selectedCategory === section.id)
  );

  const countByCategory = (catId: GameCategoryId) =>
    filteredGames.filter((g) => g.category === catId).length;

  return (
    <section className="py-2 flex flex-col gap-7">

      {/* Active Search Indicator */}
      {normalizedQuery && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/70 px-4 py-3 rounded-2xl">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Showing <span className="font-black tabular-nums">{filteredGames.length}</span>{" "}
            {filteredGames.length === 1 ? "game" : "games"} matching{" "}
            <span className="font-bold text-brand-purple dark:text-purple-300">
              "{searchQuery.trim()}"
            </span>
          </p>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple"
            >
              <X size={13} />
              <span>Clear search</span>
            </button>
          )}
        </div>
      )}

      {/* Interactive Top Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm w-fit max-w-full">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple",
            selectedCategory === "all"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-700/50"
          )}
        >
          <LayoutGrid size={16} />
          <span>{t("home.allGames")}</span>
          <span className="text-xs opacity-75 tabular-nums">({filteredGames.length})</span>
        </button>

        {GAME_CATEGORY_SECTIONS.map((cat) => {
          const Icon = cat.icon;
          const count = countByCategory(cat.id);
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple",
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-700/50"
              )}
            >
              <Icon size={16} className={isActive ? "text-current" : cat.accentText} />
              <span>{t(`home.cat.${cat.id}`, cat.title)}</span>
              <span className="text-xs opacity-75 tabular-nums">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Category Sections with Bold Minimalist Headers & Accessible 3D Cards */}
      {visibleSections.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-10 text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400">
            <SearchX size={28} />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            No games match your current filter
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
            Try clearing your search query or switching back to All Games to browse the full classroom catalog.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {normalizedQuery && onClearSearch && (
              <button
                type="button"
                onClick={onClearSearch}
                className="px-4 py-2 rounded-xl bg-brand-purple text-white text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Clear search
              </button>
            )}
            {selectedCategory !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                Show all categories
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          {visibleSections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <div key={section.id} className="flex flex-col gap-5">
                <div className="flex items-center gap-2.5">
                  <SectionIcon size={24} className={section.accentText} />
                  <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    {t(`home.cat.${section.id}`, section.title)}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {section.games.map((game, idx) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      delay={idx * 0.06}
                      onViewChange={onViewChange}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GameCard({
  game,
  onViewChange,
}: {
  key?: string;
  game: Game & { icon?: string };
  delay?: number;
  onViewChange?: (view: ViewState, data?: any) => void;
}) {
  const [imgSrc, setImgSrc] = useState(game.imageUrl || "");
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgSrc(game.imageUrl || "");
    setImgFailed(false);
  }, [game.imageUrl]);

  const handleImgError = () => {
    if (game.id === "hamster-paintball" && imgSrc !== "/images/hamster-paintball-card.png") {
      setImgSrc("/images/hamster-paintball-card.png");
      return;
    }
    setImgFailed(true);
  };

  return (
    <button
      type="button"
      onClick={() => onViewChange && onViewChange(game.id as ViewState)}
      aria-label={`Launch ${game.title}`}
      className="w-full relative aspect-[4/3] bg-transparent rounded-[2.25rem] overflow-hidden shadow-lg hover:shadow-2xl group hover:-translate-y-1.5 transition-transform duration-200 cursor-pointer select-none text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-purple/70"
    >
      {imgSrc && !imgFailed ? (
        <>
          <img
            src={imgSrc}
            alt={game.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={handleImgError}
            className="w-full h-full object-cover scale-[1.01] group-hover:scale-[1.05] transition-transform duration-200"
          />
          <div className="pointer-events-none absolute inset-0 rounded-[2.25rem] ring-1 ring-inset ring-white/25" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 flex flex-col justify-between p-5">
            <div className="flex-1 flex items-center justify-center">
              <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-950 transform scale-90 group-hover:scale-100 group-focus-visible:scale-100 transition-transform duration-150">
                <svg className="w-8 h-8 ml-1 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 text-white">
              <div className="min-w-0">
                <p className="text-base font-black leading-tight truncate">{game.title}</p>
                <p className="text-xs font-semibold text-white/80 truncate">
                  {game.subject} · {game.players}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div
          className={cn(
            "w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center bg-gradient-to-br text-white",
            game.color || "from-indigo-600 to-purple-700"
          )}
        >
          <span className="text-6xl group-hover:scale-110 transition-transform duration-200">
            {game.icon || "🎮"}
          </span>
          <div>
            <p className="text-xl font-black tracking-tight">{game.title}</p>
            <p className="text-xs font-semibold text-white/85 mt-0.5">{game.subject}</p>
          </div>
        </div>
      )}
    </button>
  );
}

export default Home;
