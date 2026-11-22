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
      ? "w-10 h-10"
      : size === "lg"
      ? "w-16 h-16"
      : "w-12 h-12";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0 bg-transparent group-hover:scale-105 transition-transform duration-200",
        sizeClasses,
        className
      )}
    >
      <img
        src="/images/hamster-logo-transparent.png?v=4"
        alt="Hamsterenglish.online mascot"
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain drop-shadow-sm select-none pointer-events-none"
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.includes("hamster_mascot_fullbody_1795367067754.jpg")) {
            target.src = "/src/assets/images/hamster_mascot_fullbody_1795367067754.jpg";
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
