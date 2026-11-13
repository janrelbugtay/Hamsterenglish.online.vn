import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { PlusCircle, QrCode, LogIn, Camera, Gamepad2, Wrench, Users, LayoutGrid } from "lucide-react";
import { Game, GameCategoryId, ViewState } from "../types";
import { cn } from "../lib/utils";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

const mosquitoSlapCardImg = "/images/mosquito-slap-card.jpg?v=3";
const hamsterPaintballCardImg = "/images/hamster-paintball-card.jpg?v=3";

const GAME_CATEGORY_SECTIONS: {
  id: GameCategoryId;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentText: string;
}[] = [
  {
    id: "classroom-tools",
    title: "Classroom Tools",
    icon: Wrench,
    accentText: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "ar-camera",
    title: "AR Camera Games",
    icon: Camera,
    accentText: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "board-trivia",
    title: "Board Trivia & Team Games",
    icon: Gamepad2,
    accentText: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "multiplayer-games",
    title: "Multiplayer Games",
    icon: Users,
    accentText: "text-purple-600 dark:text-purple-400",
  },
];

export function Home({
  onViewChange,
}: {
  onViewChange?: (view: ViewState, data?: any) => void;
  openAuthModal?: () => void;
  openGoogleAuthModal?: (feature?: string) => void;
}) {
  const [joinRoomInput, setJoinRoomInput] = useState("");

  const handleQuickJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinRoomInput.replace(/[^0-9A-Za-z]/g, "").trim();
    if (!cleaned || !onViewChange) return;
    onViewChange("hamster-paintball", { roomCode: cleaned, isStudentJoin: true });
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      {/* Top Banner / Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white">
            Welcome to the Studio
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Play, create, and share amazing learning games
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Student Quick Join Multiplayer Lobby by 6-Digit Code */}
          <form
            onSubmit={handleQuickJoinRoom}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 p-1.5 pl-3.5 rounded-2xl border-2 border-lime-400/70 shadow-sm"
          >
            <QrCode size={18} className="text-lime-600 dark:text-lime-400 shrink-0" />
            <input
              type="text"
              maxLength={6}
              value={joinRoomInput}
              onChange={(e) => setJoinRoomInput(e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 6))}
              placeholder="Enter 6-Digit Room Code..."
              className="w-40 sm:w-44 bg-transparent text-xs sm:text-sm font-black font-mono tracking-wider text-slate-800 dark:text-white placeholder:font-sans placeholder:font-semibold placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!joinRoomInput.trim()}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogIn size={14} />
              <span>Join Lobby</span>
            </button>
          </form>

          <button 
            type="button"
            onClick={() => {
              if (onViewChange) {
                onViewChange("generator");
              }
            }}
            className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-brand-purple to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-[0.98] text-white rounded-2xl font-bold shadow-xl shadow-brand-purple/20 dark:shadow-none transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <PlusCircle size={22} />
            <span>Create a Game</span>
          </button>
        </div>
      </div>

      <FeaturedGamesSection onViewChange={onViewChange} />
    </div>
  );
}

function FeaturedGamesSection({
  onViewChange,
}: {
  onViewChange?: (view: ViewState, data?: any) => void;
}) {
  const { user } = useAuth();
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

  const allGames: Game[] = [
    // 1. Classroom Tools (4)
    {
      id: "squid-game-picker",
      title: "NAME PICKER",
      description: "Pick students randomly with Mingle Game, Tag, or Red Light, Green Light using a Squid Game theme.",
      difficulty: "Medium",
      players: "Classroom",
      time: "5m",
      subject: "Classroom Management",
      grade: "All",
      imageUrl: "/images/name-picker-card-v3.png?v=3",
      isAI: false,
      color: "from-rose-600 to-rose-400",
      icon: "🎯",
      category: "classroom-tools",
    },
    {
      id: "flashcards-match",
      title: "Flashcard",
      description:
        "Interactive 3D flashcards with 1-sided and 2-sided flip modes, media picker, audio reader, and card dealer stage!",
      difficulty: "Easy",
      players: "1 Player / Class",
      time: "5-10m",
      subject: "Vocabulary",
      grade: "All",
      imageUrl: "/images/flashcards-card-v3.jpg?v=3",
      isAI: false,
      color: "from-indigo-400 to-purple-500",
      icon: "🎴",
      category: "classroom-tools",
    },
    {
      id: "hamster-pop-quiz",
      title: "Video Quiz",
      description: "Turn any video into a sunny ESL adventure with interactive video quizzes!",
      difficulty: "Medium",
      players: "1 Player",
      time: "10-15 mins",
      subject: "Video Comprehension",
      grade: "All",
      imageUrl: "/images/video-quiz-card-v3.jpg?v=3",
      isAI: true,
      color: "from-sky-400 to-yellow-400",
      icon: "🎬",
      category: "classroom-tools",
    },
    {
      id: "phonemic-master",
      title: "Phonemic Master",
      description: "Listen, speak, and master the 44 sounds of English.",
      difficulty: "Hard",
      players: "1 Player",
      time: "10m",
      subject: "ESL",
      grade: "All",
      imageUrl: "/images/phonemic-master-card-v3.jpg?v=3",
      isAI: false,
      color: "from-emerald-700 to-emerald-900",
      icon: "🗣️",
      category: "classroom-tools",
    },
    {
      id: "sleeping-hamster",
      title: "Sleeping Hamster",
      description: "Smart classroom noise monitor! Keep your class quiet so the cozy hamster stays fast asleep.",
      difficulty: "Easy",
      players: "Classroom",
      time: "3-30m",
      subject: "Classroom Management",
      grade: "All",
      imageUrl: "/images/sleeping-hamster-card.jpg?v=1",
      isNew: true,
      isAI: false,
      color: "from-purple-700 to-indigo-900",
      icon: "🐹",
      category: "classroom-tools",
    },

    // 2. AR Camera Games (4)
    {
      id: "slap-and-chop",
      title: "Mosquito Slap",
      description:
        "3D Motion AR game! Track both hands on camera and clap your 3D gloves together to slap buzzing mosquitoes!",
      difficulty: "Easy",
      players: "1-2 Players",
      time: "5-10m",
      subject: "ESL & Science",
      grade: "All",
      imageUrl: mosquitoSlapCardImg,
      isAI: false,
      color: "from-purple-500 to-indigo-600",
      icon: "🦟",
      category: "ar-camera",
    },
    {
      id: "bubble-pop",
      title: "Bubble Pop",
      description:
        "Use your finger on camera to pop the correct bubble!",
      difficulty: "Easy",
      players: "1-2 Players",
      time: "5m",
      subject: "Grammar",
      grade: "A1-B1",
      imageUrl: "/images/bubble-pop-card.jpg?v=3",
      isAI: false,
      color: "from-blue-400 to-cyan-400",
      icon: "🫧",
      category: "ar-camera",
    },
    {
      id: "roller-coaster-quiz",
      title: "Roller Coaster Quiz",
      description:
        "Ride a 3D theme park roller coaster with Captain Hammy! Lean or tap Left/Right at each 2-option track split!",
      difficulty: "Medium",
      players: "1 Player / Class",
      time: "5-10m",
      subject: "All Subjects",
      grade: "All",
      imageUrl: "/images/roller-coaster-quiz-card.jpg?v=3",
      isNew: true,
      isAI: false,
      color: "from-red-500 to-amber-500",
      icon: "🎢",
      category: "ar-camera",
    },
    {
      id: "yoga-quiz",
      title: "Yoga Quiz",
      description:
        "Test your grammar with this relaxing yet challenging vocabulary quiz!",
      difficulty: "Medium",
      players: "1 Player",
      time: "10m",
      subject: "Grammar",
      grade: "All",
      imageUrl: "/images/yoga-quiz-card.jpg?v=3",
      isAI: false,
      color: "from-teal-400 to-emerald-500",
      icon: "🧘‍♀️",
      category: "ar-camera",
    },

    // 3. Board Trivia & Team Games (6)
    {
      id: "mystery-box",
      title: "Mystery Box",
      description:
        "Answer questions to open mystery boxes containing points or penalties!",
      difficulty: "Medium",
      players: "2-4 Teams",
      time: "15m",
      subject: "Trivia",
      grade: "A2-B1",
      imageUrl: "/images/mystery-box-card.jpg?v=3",
      isAI: false,
      color: "from-orange-400 to-yellow-500",
      icon: "🎁",
      category: "board-trivia",
    },
    {
      id: "neon-chain",
      title: "Neon Chain",
      description: "A fast-paced category word game with glowing visuals.",
      difficulty: "Hard",
      players: "2 Teams",
      time: "10-15m",
      subject: "Vocabulary",
      grade: "B1-B2",
      imageUrl: "/images/neon-chain-card.jpg?v=3",
      isAI: false,
      color: "from-cyan-400 to-blue-600",
      icon: "⚡",
      category: "board-trivia",
    },
    {
      id: "bubble-sentence-pro",
      title: "Bubble Island",
      description:
        "Pop bubbles in the correct order to form sentences. Includes a Teacher Studio!",
      difficulty: "Medium",
      players: "1 Player / Class",
      time: "10m",
      subject: "Grammar",
      grade: "A1-B1",
      imageUrl: "/images/bubble-island-card.jpg?v=3",
      isAI: false,
      color: "from-blue-500 to-sky-300",
      icon: "🎈",
      category: "board-trivia",
    },
    {
      id: "shark-attack",
      title: "Shark Attack",
      description:
        "2-player or vs AI staircase showdown! Answer right to stay safe or climb closer to the Megalodon jaws!",
      difficulty: "Medium",
      players: "1-2 Players",
      time: "10m",
      subject: "Trivia & ESL",
      grade: "All",
      imageUrl: "/images/shark-attack-card.jpg?v=3",
      isAI: false,
      color: "from-cyan-500 to-blue-900",
      icon: "🦈",
      category: "board-trivia",
    },
    {
      id: "family-feud",
      title: "Family Feud",
      description: "Survey says! Compete to find the most popular answers to fun questions.",
      difficulty: "Medium",
      players: "2 Teams",
      time: "15m",
      subject: "Vocabulary",
      grade: "All",
      imageUrl: "/images/family-feud-card.jpg?v=3",
      isAI: false,
      color: "from-yellow-400 to-orange-500",
      icon: "👨‍👩‍👧‍👦",
      category: "board-trivia",
    },
    {
      id: "sumo",
      title: "Sumo Tags",
      description: "Battle it out in a tug-of-war style question tags showdown!",
      difficulty: "Medium",
      players: "2 Teams",
      time: "10m",
      subject: "Grammar",
      grade: "All",
      imageUrl: "/images/sumo-tags-card.jpg?v=3",
      isAI: false,
      color: "from-indigo-600 to-red-600",
      icon: "🤼",
      category: "board-trivia",
    },

    // 4. Multiplayer Games (2)
    {
      id: "hamster-paintball",
      title: "Hamster Paintball",
      description:
        "3D Outdoor Tactical Speedball Park Arena! Fire glossy paintballs, slide across the duck pond, deploy inflatable air bunkers, and earn ammo through trivia!",
      difficulty: "Medium",
      players: "Multiplayer Lobby (QR & Code)",
      time: "5-15m",
      subject: "ESL & Science Trivia",
      grade: "All",
      imageUrl: hamsterPaintballCardImg,
      isNew: true,
      isAI: false,
      color: "from-lime-500 to-emerald-600",
      icon: "🎯",
      category: "multiplayer-games",
    },
    {
      id: "tic-tac-toe",
      title: "Tic Tac Toe Battle",
      description: "Classic Tic Tac Toe with a multiplayer twist! Play locally or host a match.",
      difficulty: "Medium",
      players: "2 Players",
      time: "5m",
      subject: "Logic",
      grade: "All",
      imageUrl: "/images/tic-tac-toe-card.jpg?v=3",
      isAI: false,
      color: "from-gray-700 to-gray-900",
      icon: "❌",
      category: "multiplayer-games",
    },
  ];

  const games = allGames.filter(
    (g) => g.id === "hamster-paintball" || isAdmin || publishedGames[g.id] !== false
  );

  const visibleSections = GAME_CATEGORY_SECTIONS.map((section) => ({
    ...section,
    games: games.filter((g) => g.category === section.id),
  })).filter(
    (section) =>
      section.games.length > 0 &&
      (selectedCategory === "all" || selectedCategory === section.id)
  );

  const countByCategory = (catId: GameCategoryId) =>
    games.filter((g) => g.category === catId).length;

  return (
    <section className="py-2 flex flex-col gap-8">
      {/* Interactive Top Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm w-fit max-w-full">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0",
            selectedCategory === "all"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-700/50"
          )}
        >
          <LayoutGrid size={16} />
          <span>All Games</span>
          <span className="text-xs opacity-75 tabular-nums">({games.length})</span>
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
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0",
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-700/50"
              )}
            >
              <Icon size={16} className={isActive ? "text-current" : cat.accentText} />
              <span>{cat.title}</span>
              <span className="text-xs opacity-75 tabular-nums">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Category Sections with Bold Minimalist Headers & 100% Clean 3D Model Cards */}
      <div className="flex flex-col gap-12">
        {visibleSections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.id} className="flex flex-col gap-5">
              <div className="flex items-center gap-2.5">
                <SectionIcon size={24} className={section.accentText} />
                <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {section.title}
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
  return (
    <div
      onClick={() => onViewChange && onViewChange(game.id as ViewState)}
      className="w-full relative aspect-[4/3] bg-transparent rounded-[2.25rem] overflow-hidden shadow-lg hover:shadow-2xl group hover:-translate-y-2 transition-transform duration-200 cursor-pointer select-none"
    >
      {game.imageUrl ? (
        <>
          <img
            src={game.imageUrl}
            alt={game.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e: any) => {
              if (game.id === 'hamster-paintball') {
                e.currentTarget.src = '/images/hamster-paintball-card.png';
              }
            }}
            className="w-full h-full object-cover scale-[1.01] group-hover:scale-[1.05] transition-transform duration-200"
          />
          <div className="pointer-events-none absolute inset-0 rounded-[2.25rem] ring-1 ring-inset ring-white/25" />
          <div className="absolute inset-0 bg-slate-950/25 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
            <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-950 transform scale-90 group-hover:scale-100 transition-transform duration-150">
              <svg className="w-8 h-8 ml-1 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        </>
      ) : (
        <div
          className={cn(
            "w-full h-full flex items-center justify-center bg-gradient-to-br",
            game.color,
          )}
        >
          {game.icon?.startsWith("http") ? (
            <img src={game.icon} loading="lazy" decoding="async" referrerPolicy="no-referrer" alt={game.title} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-200" />
          ) : (
            <span className="text-7xl group-hover:scale-110 transition-transform duration-200">
              {game.icon}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default Home;
