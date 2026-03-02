"use client";

import { clsx } from "clsx";

interface Props {
  score: number;
  size?: "sm" | "md";
}

export default function ViralScoreBadge({ score, size = "md" }: Props) {
  const color =
    score >= 90 ? "text-red-400 border-red-500/30 bg-red-500/10" :
    score >= 70 ? "text-orange-400 border-orange-500/30 bg-orange-500/10" :
    score >= 50 ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" :
                  "text-t3 border-ink-5 bg-ink-4";

  const pulse = score >= 90 ? "animate-pulse-ring" : "";

  return (
    <div className={clsx(
      "flex items-center justify-center rounded-full border font-mono font-bold tabular-nums",
      size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs",
      color,
      pulse
    )}>
      {score}
    </div>
  );
}
