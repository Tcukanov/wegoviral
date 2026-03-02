"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import type { NicheComparison as NicheComparisonData } from "@wegoviral/shared";

interface Props {
  data: NicheComparisonData;
  category?: string;
}

interface CompareRowProps {
  label: string;
  yours: string | number;
  viral: string | number;
  yoursColor?: string;
  icon?: string;
  suffix?: string;
}

function CompareRow({ label, yours, viral, yoursColor = "text-orange-400", icon, suffix = "" }: CompareRowProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      <div className="flex items-center gap-2">
        {icon && <span className="text-sm">{icon}</span>}
        <p className="text-xs text-t2">{label}</p>
      </div>
      <div className="text-right">
        <p className={clsx("font-mono text-xs font-semibold", yoursColor)}>
          {yours}{suffix}
        </p>
        <p className="font-mono text-[9px] text-t3">yours</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-xs font-semibold text-green-400">
          {viral}{suffix}
        </p>
        <p className="font-mono text-[9px] text-t3">viral avg</p>
      </div>
    </div>
  );
}

interface PresenceBarProps {
  label: string;
  yours: boolean;
  viralPercent: number;
  icon?: string;
}

function PresenceBar({ label, yours, viralPercent, icon }: PresenceBarProps) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(viralPercent), 300);
    return () => clearTimeout(t);
  }, [viralPercent]);

  return (
    <div className="py-2.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <p className="text-xs text-t2">{label}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx(
            "font-mono text-[10px] px-2 py-0.5 rounded-full",
            yours
              ? "bg-green-500/15 text-green-400 border border-green-500/25"
              : "bg-red-500/15 text-red-400 border border-red-500/25"
          )}>
            {yours ? "✓ Detected" : "✗ Missing"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-ink-4 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500/60 rounded-full transition-all duration-1000"
            style={{ width: `${width}%` }}
          />
        </div>
        <p className="font-mono text-[10px] text-t3 w-28 text-right">
          {viralPercent}% of viral posts use this
        </p>
      </div>
    </div>
  );
}

export default function NicheComparison({ data, category }: Props) {
  if (!data || !data.topInsight) return null;

  const hookGap = data.viralHookRetention - data.hookRetentionEstimate;
  const hookColor = hookGap > 20 ? "text-red-400" : hookGap > 10 ? "text-orange-400" : "text-yellow-400";

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 overflow-hidden">

      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.07)] px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-t3">
          Niche Intelligence
        </p>
        <p className="mt-0.5 text-xs text-t2">
          Your post vs viral{category ? ` ${category}` : ""} content — based on 50+ trending posts
        </p>
      </div>

      {/* Top insight callout */}
      <div className="mx-5 mt-4 mb-1 flex gap-3 rounded-xl border border-purple/20 bg-purple/8 px-4 py-3">
        <span className="text-lg flex-shrink-0 mt-0.5">💡</span>
        <p className="text-sm text-t1 leading-relaxed">{data.topInsight}</p>
      </div>

      {/* Metrics comparison */}
      <div className="px-5 pb-1 pt-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
          Metric comparison
        </p>
        <CompareRow
          label="Hook retention (est.)"
          yours={`${data.hookRetentionEstimate}%`}
          viral={`${data.viralHookRetention}%`}
          yoursColor={hookColor}
          icon="👁"
        />
        <CompareRow
          label="Caption style"
          yours={data.captionStyle}
          viral={data.viralCaptionStyle}
          yoursColor="text-orange-400"
          icon="✍️"
        />
      </div>

      {/* Duration & audio insights */}
      {(data.durationVsViral || data.audioStrategyVsViral) && (
        <div className="mx-5 mb-3 mt-1 space-y-2">
          {data.durationVsViral && (
            <div className="flex gap-2.5 rounded-xl border border-[rgba(255,255,255,0.06)] bg-ink-3 px-3.5 py-2.5">
              <span className="text-sm flex-shrink-0">⏱</span>
              <p className="text-xs text-t2 leading-relaxed">{data.durationVsViral}</p>
            </div>
          )}
          {data.audioStrategyVsViral && (
            <div className="flex gap-2.5 rounded-xl border border-[rgba(255,255,255,0.06)] bg-ink-3 px-3.5 py-2.5">
              <span className="text-sm flex-shrink-0">🎵</span>
              <p className="text-xs text-t2 leading-relaxed">{data.audioStrategyVsViral}</p>
            </div>
          )}
        </div>
      )}

      {/* Presence signals */}
      <div className="border-t border-[rgba(255,255,255,0.07)] px-5 pt-4 pb-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
          Presence signals
        </p>
        <PresenceBar
          label="Face on camera"
          yours={data.faceOnCamera}
          viralPercent={data.viralFacePercent}
          icon="🎥"
        />
        <PresenceBar
          label="Pattern interrupt / hook"
          yours={data.hasPatternInterrupt}
          viralPercent={data.viralPatternInterruptPercent}
          icon="⚡"
        />
      </div>
    </div>
  );
}
