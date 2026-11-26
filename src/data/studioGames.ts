import React from "react";
import { Wrench, Camera, Gamepad2, Users } from "lucide-react";
import { Game, GameCategoryId } from "../types";
import noiseControlCardImg from "../assets/images/noise_control_card_1795022921714.jpg";

const mosquitoSlapCardImg = "/images/mosquito-slap-card.jpg?v=3";
const hamsterPaintballCardImg = "/images/hamster-paintball-card.jpg?v=3";

export const GAME_CATEGORY_SECTIONS: {
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

export const STUDIO_GAMES: Game[] = [
  // 1. Classroom Tools (5)
  {
    id: "squid-game-picker",
    title: "NAME PICKER",
    description:
      "Pick students randomly with Mingle Game, Tag, or Red Light, Green Light using a Squid Game theme.",
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
    description: "Interactive video checkpoints and live pop-up quizzes.",
    difficulty: "Medium",
    players: "1 Player",
    time: "10-15 mins",
    subject: "Video Comprehension",
    grade: "All",
    imageUrl: "/images/video-quiz-card-v3.jpg?v=3",
    isAI: true,
    color: "from-amber-400 via-pink-500 to-purple-600",
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
    title: "Noise Control",
    description:
      "Smart classroom noise monitor with Sleeping Hamster & Hamster Cage modes! Keep your class quiet to keep hamsters happy.",
    difficulty: "Easy",
    players: "Classroom",
    time: "3-30m",
    subject: "Classroom Management",
    grade: "All",
    imageUrl: noiseControlCardImg,
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
    description: "Use your finger on camera to pop the correct bubble!",
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
      "Answer trivia questions with 1-hand and 2-hand AR camera poses!",
    difficulty: "Medium",
    players: "1-2 Players",
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
    imageUrl: "/images/shark-attack-card.jpg?v=4",
    isAI: false,
    color: "from-cyan-500 to-blue-900",
    icon: "🦈",
    category: "board-trivia",
  },
  {
    id: "family-feud",
    title: "Family Feud",
    description:
      "Survey says! Compete to find the most popular answers to fun questions.",
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
    description:
      "Battle it out in a tug-of-war style question tags showdown!",
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
    description:
      "Classic Tic Tac Toe with a multiplayer twist! Play locally or host a match.",
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

const RECENT_GAMES_KEY = "hamster_recent_games_v1";

export function getRecentGameIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_GAMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const validIds = new Set(STUDIO_GAMES.map((g) => g.id));
    return parsed.filter((id): id is string => typeof id === "string" && validIds.has(id)).slice(0, 4);
  } catch {
    return [];
  }
}

export function recordRecentGame(gameId: string): void {
  try {
    if (!STUDIO_GAMES.some((g) => g.id === gameId)) return;
    const prev = getRecentGameIds().filter((id) => id !== gameId);
    const next = [gameId, ...prev].slice(0, 4);
    localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(next));
  } catch {}
}
