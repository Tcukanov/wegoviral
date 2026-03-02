"use client";

import { useEffect, useState } from "react";

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  animate?: boolean;
}

function getColor(score: number) {
  if (score >= 80) return { stroke: "#22c55e", text: "#22c55e", glow: "rgba(34,197,94,0.3)" };
  if (score >= 65) return { stroke: "#eab308", text: "#eab308", glow: "rgba(234,179,8,0.3)" };
  if (score >= 40) return { stroke: "#f97316", text: "#f97316", glow: "rgba(249,115,22,0.3)" };
  return           { stroke: "#ef4444", text: "#ef4444", glow: "rgba(239,68,68,0.3)" };
}

export default function ScoreRing({
  score,
  size = 160,
  strokeWidth = 6,
  label = "Overall Score",
  animate = true,
}: Props) {
  const [displayed, setDisplayed] = useState(animate ? 0 : score);
  const [progress,  setProgress]  = useState(animate ? 0 : score);

  const radius      = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const center      = size / 2;

  const colors = getColor(score);

  // Animate score number
  useEffect(() => {
    if (!animate) return;
    const duration = 1200;
    const start    = performance.now();

    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(eased * score));
      setProgress(eased * score);
      if (t < 1) requestAnimationFrame(step);
    }

    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score, animate]);

  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />
          {/* Glow layer */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth + 4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            opacity={0.15}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
          />
          {/* Main arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
          />
        </svg>

        {/* Center number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-bold leading-none tabular-nums"
            style={{
              fontSize: size * 0.26,
              color: colors.text,
              textShadow: `0 0 20px ${colors.glow}`,
            }}
          >
            {displayed}
          </span>
          <span className="mt-1 font-mono text-[10px] text-t3">/100</span>
        </div>
      </div>

      {label && (
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-t3">
          {label}
        </p>
      )}
    </div>
  );
}
