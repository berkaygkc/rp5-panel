"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/**
 * Koyu/açık tema anahtarı — 48px yuvarlak, cam dokulu, basışta anında tepki.
 * İkon geçişte "pop" yapar (yalnızca transform).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
      className={`flex h-12 w-12 items-center justify-center rounded-full text-dim transition-[transform,background-color] duration-100 [transition-timing-function:var(--ease-out-strong)] active:scale-90 active:bg-pressed ${className}`}
      style={{
        background: "linear-gradient(180deg, var(--card-top), var(--card-bottom))",
        boxShadow: "inset 0 2px 0 var(--card-highlight), inset 0 0 0 1px var(--card-ring)",
      }}
    >
      <span key={theme} className="animate-icon-pop flex">
        <Icon size={21} strokeWidth={2} />
      </span>
    </button>
  );
}
