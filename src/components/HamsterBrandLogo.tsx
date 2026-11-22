import React from "react";
import { cn } from "../lib/utils";

export function HamsterMascotIcon({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses =
    size === "sm"
      ? "w-9 h-9 rounded-xl"
      : size === "lg"
      ? "w-14 h-14 rounded-2xl"
      : "w-11 h-11 rounded-2xl";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0 overflow-hidden bg-amber-100 dark:bg-amber-950/80 border-2 border-amber-300/90 dark:border-amber-500/50 shadow-md shadow-amber-500/15 group-hover:scale-105 transition-transform duration-200",
        sizeClasses,
        className
      )}
    >
      <img
        src="/images/flashcards-card-v3.jpg?v=3"
        alt="Hamsterenglish.online mascot"
        className="w-full h-full object-cover object-[50%_48%] scale-[2.45] origin-[50%_50%] select-none pointer-events-none"
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.includes("image_d6c7c8ee.png")) {
            target.src = "/assets/aistudio/image_d6c7c8ee.png";
          }
        }}
      />
    </div>
  );
}

export function HamsterBrandLogo({
  variant = "sidebar",
  className,
}: {
  variant?: "sidebar" | "footer" | "modal";
  className?: string;
}) {
  if (variant === "modal") {
    return (
      <div className={cn("flex flex-col items-center text-center", className)}>
        <HamsterMascotIcon size="lg" className="mb-3" />
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Hamsterenglish<span className="text-brand-purple">.online</span>
        </h2>
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <HamsterMascotIcon size="md" />
        <div className="flex flex-col">
          <span className="font-display font-black text-xl tracking-tight text-slate-900 dark:text-white leading-none">
            Hamsterenglish<span className="text-brand-purple">.online</span>
          </span>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
            Interactive ESL Classroom Games &amp; Tools
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <HamsterMascotIcon size="md" />
      <div className="flex flex-col min-w-0 leading-none">
        <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white truncate">
          Hamsterenglish
        </span>
        <span className="font-black text-xs text-brand-purple dark:text-purple-400 tracking-wide mt-0.5">
          .online
        </span>
      </div>
    </div>
  );
}
