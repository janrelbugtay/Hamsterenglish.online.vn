export type ViewState =
  | "home"
  | "games"
  | "public-dashboard"
  | "generator"
  | "dashboard"
  | "admin-dashboard"
  | "user-dashboard"
  | "leaderboard"
  | "media-studio"
  | "mystery-box"
  | "neon-chain"
  | "bubble-pop"
  | "flashcards-match"
  | "yoga-quiz"
  | "bubble-sentence-pro"
  | "family-feud"
  | "sumo"
  | "hamster-pop-quiz"
  | "student-race"
  | "letter-lock"
  | "tic-tac-toe"
  | "homework"
  | "class-record"
  | "class-rewards"
  | "phonemic-master"
  | "squid-game-picker"
  | "shark-attack"
  | "slap-and-chop"
  | "roller-coaster-quiz"
  | "hamster-paintball"
  | "sleeping-hamster"
  | "my-slides";

export type GameCategoryId =
  | "classroom-tools"
  | "ar-camera"
  | "board-trivia"
  | "multiplayer-games";

export interface Game {
  id: string;
  title: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
  players: string;
  time: string;
  subject: string;
  grade: string;
  imageUrl: string;
  isPopular?: boolean;
  isNew?: boolean;
  isAI?: boolean;
  color: string;
  icon?: string;
  category?: GameCategoryId;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
  color: string;
}
