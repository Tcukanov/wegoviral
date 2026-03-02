"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

interface Props {
  label: string;
  score: number;
  delay?: number;
}

export default function ScoreBar({ label, score, delay = 0 }: Props) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(score), delay + 80);
    return () => clearTimeout(t);
  }, [score, delay]);

  const color =
    score >= 65 ? "#22c55e" :
    score >= 40 ? "#f97316" :
    "#ef4444";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-t2">{label}</span>
        <span className={clsx("font-mono text-xs font-semibold tabular-nums")} style={{ color }}>
          {score}
        </span>
      </div>
      <div className="h-px w-full bg-ink-4 relative">
        <div
          className="absolute inset-y-0 left-0 h-px transition-all duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
