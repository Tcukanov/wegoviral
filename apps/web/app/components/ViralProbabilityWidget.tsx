"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import type { ProbabilityBoost } from "@wegoviral/shared";

interface Props {
  viralProbability: number;
  optimizedProbability: number;
  probabilityBoosts: ProbabilityBoost[];
}

function AnimatedNumber({ target, suffix = "%" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const start = performance.now();
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target]);

  return <>{val}{suffix}</>;
}

export default function ViralProbabilityWidget({
  viralProbability,
  optimizedProbability,
  probabilityBoosts,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const gain = optimizedProbability - viralProbability;
  const boostTotal = probabilityBoosts.reduce((s, b) => s + b.boost, 0);

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 overflow-hidden">

      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.07)] px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-t3">
          Viral Probability
        </p>
        <p className="mt-0.5 text-xs text-t2">
          How likely is this post to go viral — and what changes the odds most
        </p>
      </div>

      {/* Main probability display */}
      <div className="grid grid-cols-2 divide-x divide-[rgba(255,255,255,0.07)]">

        {/* Current */}
        <div className="flex flex-col items-center justify-center px-5 py-6 gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
            As posted
          </p>
          <p className={clsx(
            "font-mono font-bold leading-none tabular-nums",
            viralProbability <= 5  ? "text-red-400"    :
            viralProbability <= 15 ? "text-orange-400" : "text-yellow-400"
          )}
            style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}
          >
            {visible ? <AnimatedNumber target={viralProbability} /> : "0%"}
          </p>
          <p className="text-[10px] text-t3">chance of going viral</p>
        </div>

        {/* Optimized */}
        <div className="flex flex-col items-center justify-center px-5 py-6 gap-1 bg-purple/5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-purple/70">
            If optimized
          </p>
          <p className="font-mono font-bold leading-none tabular-nums text-purple"
            style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}
          >
            {visible ? <AnimatedNumber target={optimizedProbability} /> : "0%"}
          </p>
          <p className="text-[10px] text-t3">
            +{gain}% uplift available
          </p>
        </div>
      </div>

      {/* Probability bar */}
      <div className="px-5 pb-1 pt-0">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-ink-4">
          {/* Base */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-red-500 transition-all duration-1000"
            style={{ width: visible ? `${viralProbability}%` : "0%" }}
          />
          {/* Potential */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-purple/40 transition-all duration-1000 delay-300"
            style={{ width: visible ? `${optimizedProbability}%` : "0%" }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-t3">
          <span>0%</span>
          <span>viral threshold ≈ 20%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Boosts */}
      {probabilityBoosts.length > 0 && (
        <div className="border-t border-[rgba(255,255,255,0.07)] px-5 py-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
            What moves the needle (+{boostTotal}% total available)
          </p>
          <div className="space-y-2">
            {probabilityBoosts.map((boost, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.05)] bg-ink-3 px-3.5 py-2.5 transition-colors hover:border-purple/20 hover:bg-purple/5"
              >
                <span className="text-base flex-shrink-0">{boost.icon}</span>
                <p className="flex-1 text-xs text-t1">{boost.action}</p>
                <div className="flex-shrink-0 flex items-center gap-1 rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5">
                  <span className="font-mono text-[11px] font-bold text-green-400">
                    +{boost.boost}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
