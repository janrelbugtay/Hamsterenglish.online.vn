import React, { useState } from "react";
import { cn } from "../lib/utils";
import { Gamepad2 } from "lucide-react";

interface GameThumbnailProps {
  gameType?: string;
  info?: {
    id?: string;
    title?: string;
    icon?: string;
    imageUrl?: string;
    color?: string;
    [key: string]: any;
  };
  game?: any;
  compact?: boolean;
  className?: string;
}

const DEFAULT_GAME_IMAGES: Record<string, string> = {
  "squid-game-picker": "/images/name-picker-card.png",
  "neon-chain": "https://drive.google.com/thumbnail?id=1kovfYZSlp6X8HTqQ9OF_gSpf3wgJgNYG&sz=w1000",
  "mystery-box": "https://drive.google.com/thumbnail?id=1ugM0rhtk40XdbSDrdDJja5QpLNkWebQn&sz=w1000",
  "bubble-pop": "https://drive.google.com/thumbnail?id=1AHwLQ7lCIsKt9fzMlWAJWMnRCfFE4mE-&sz=w1000",
  "shark-attack": "https://images.unsplash.com/photo-1560275619-4662e36fa65c?q=80&w=1000&auto=format&fit=crop",
  "flashcards-match": "https://drive.google.com/thumbnail?id=1UtaZtVX0onrqj3VorxedOxy1iVXdFAHk&sz=w1000",
  "bubble-sentence-pro": "https://drive.google.com/thumbnail?id=136UAXGhVDr4ZhJd3bRABHDKp40RJIQSJ&sz=w1000",
  "yoga-quiz": "https://drive.google.com/thumbnail?id=16viKskpD4hXygTg-0UaGSjfrWibNoqeQ&sz=w1000",
  "yoga": "https://drive.google.com/thumbnail?id=16viKskpD4hXygTg-0UaGSjfrWibNoqeQ&sz=w1000",
  "family-feud": "https://drive.google.com/thumbnail?id=1DDWdERo9zS6SEbpXA7J8FSh__1CNqxZN&sz=w1000",
  "sumo": "https://drive.google.com/thumbnail?id=19zB6Kpor6pry7TV3XvX3eIZdxpd3ys40&sz=w1000",
  "sumotags": "https://drive.google.com/thumbnail?id=19zB6Kpor6pry7TV3XvX3eIZdxpd3ys40&sz=w1000",
  "letter-lock": "https://images.unsplash.com/photo-1555448248-2571daf6344b?q=80&w=1000&auto=format&fit=crop",
  "hamster-pop-quiz": "https://images.unsplash.com/photo-1548767797-d8c844163c4c?q=80&w=1000&auto=format&fit=crop",
  "student-race": "https://images.unsplash.com/photo-1541604193435-22287d32c2c2?q=80&w=1000&auto=format&fit=crop",
  "tic-tac-toe": "https://images.unsplash.com/photo-1668901382969-8c73e450a1f5?q=80&w=1000&auto=format&fit=crop",
  "phonemic-master": "https://images.unsplash.com/photo-1546410531-bf4caa381ce6?q=80&w=1000&auto=format&fit=crop",
};

const DEFAULT_GAME_EMOJIS: Record<string, string> = {
  "squid-game-picker": "🦑",
  "neon-chain": "⚡",
  "mystery-box": "🎁",
  "bubble-pop": "🫧",
  "shark-attack": "🦈",
  "flashcards-match": "🎴",
  "bubble-sentence-pro": "🎈",
  "yoga-quiz": "🧘",
  "yoga": "🧘",
  "family-feud": "👨‍👩‍👧‍👦",
  "sumo": "🤼",
  "sumotags": "🤼",
  "letter-lock": "🔐",
  "hamster-pop-quiz": "🐹",
  "student-race": "🏁",
  "tic-tac-toe": "❌",
  "phonemic-master": "🗣️",
};

export function GameThumbnail({
  gameType,
  info,
  game,
  compact = false,
  className,
}: GameThumbnailProps) {
  const [imgError, setImgError] = useState(false);

  // Normalize gameType
  const typeKey = (gameType || game?.gameType || info?.id || "").toLowerCase().trim();

  // Determine image source priority
  const candidateImage =
    (!imgError && (
      game?.imageUrl ||
      game?.coverImage ||
      game?.thumbnailUrl ||
      (info?.icon && (info.icon.startsWith("http") || info.icon.startsWith("/"))) ? info?.icon : null
    )) ||
    (!imgError && (info?.imageUrl || DEFAULT_GAME_IMAGES[typeKey])) ||
    null;

  const fallbackEmoji =
    DEFAULT_GAME_EMOJIS[typeKey] ||
    (info?.icon && !info.icon.startsWith("http") && !info.icon.startsWith("/") ? info.icon : null) ||
    "🎮";

  const fallbackColor =
    info?.color ||
    game?.color ||
    "bg-gradient-to-br from-purple-500/10 to-indigo-500/10 text-brand-purple";

  if (candidateImage && !imgError) {
    return (
      <img
        src={candidateImage}
        alt={info?.title || game?.topic || game?.title || gameType || "Game"}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={cn(
          "w-full h-full object-cover select-none",
          compact
            ? "rounded-xl"
            : "transform group-hover:scale-105 transition-transform duration-500",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "w-full h-full flex items-center justify-center font-bold select-none",
        compact ? "text-2xl rounded-xl" : "text-5xl",
        fallbackColor,
        className
      )}
    >
      {fallbackEmoji ? (
        <span className="transform group-hover:scale-110 transition-transform duration-300">
          {fallbackEmoji}
        </span>
      ) : (
        <Gamepad2 className="w-1/2 h-1/2 opacity-70" />
      )}
    </div>
  );
}
