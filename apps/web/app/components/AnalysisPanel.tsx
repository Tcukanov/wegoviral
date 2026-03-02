"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { clsx } from "clsx";
import { fetchReelAnalysis, formatNumber } from "../../lib/api";
import CopyButton from "./CopyButton";
import ViralScoreBadge from "./ViralScoreBadge";
import type { TrendingReel, TrendingAnalysis } from "@wegoviral/shared";

interface Props {
  reel: TrendingReel;
  onClose: () => void;
}

type Tab = "why" | "signals" | "formula" | "stats";

const TABS: { id: Tab; label: string }[] = [
  { id: "why",     label: "Why" },
  { id: "signals", label: "Signals" },
  { id: "formula", label: "Formula" },
  { id: "stats",   label: "Stats" },
];

const WINDOW_LABEL: Record<string, { text: string; color: string }> = {
  "peaking-now":     { text: "Peaking Now",      color: "text-red-400" },
  "rising":          { text: "Rising",            color: "text-green-400" },
  "peaked-recently": { text: "Peaked Recently",   color: "text-yellow-400" },
  "fading":          { text: "Fading",            color: "text-t3" },
};

export default function AnalysisPanel({ reel, onClose }: Props) {
  const [analysis, setAnalysis] = useState<TrendingAnalysis | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Tab>("why");

  const poll = useCallback(async () => {
    try {
      const data = await fetchReelAnalysis(reel.id);
      if ("pending" in data) {
        setTimeout(poll, 2000);
      } else {
        setAnalysis(data);
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [reel.id]);

  useEffect(() => {
    setLoading(true);
    setAnalysis(null);
    setTab("why");
    poll();
  }, [reel.id, poll]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const win = analysis?.viralWindow ? WINDOW_LABEL[analysis.viralWindow] : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={clsx(
        "fixed z-50 flex flex-col bg-ink-2 overflow-hidden",
        "border-l border-[rgba(255,255,255,0.07)]",
        // Mobile: bottom sheet
        "bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl",
        // Desktop: right side panel
        "md:bottom-0 md:top-0 md:left-auto md:right-0 md:max-h-full md:w-[460px] md:rounded-none",
        "animate-slide-in-bottom md:animate-slide-in-right"
      )}>

        {/* Header */}
        <div className="flex items-start gap-3 border-b border-[rgba(255,255,255,0.07)] p-4">
          {reel.thumbnailUrl && (
            <div className="relative h-12 w-9 flex-shrink-0 overflow-hidden rounded-lg">
              <Image src={reel.thumbnailUrl} alt={reel.username} fill className="object-cover" unoptimized />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-t1">@{reel.username}</p>
              {win && (
                <span className={clsx("font-mono text-[10px] uppercase tracking-wider", win.color)}>
                  {win.text}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-t3">{reel.caption}</p>
            <div className="mt-1.5 flex gap-3 font-mono text-[10px] text-t3">
              <span>{formatNumber(reel.views)}v</span>
              <span>{formatNumber(reel.likes)}l</span>
              <span>{formatNumber(reel.comments)}c</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ViralScoreBadge score={reel.viralScore} size="sm" />
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-t3 hover:bg-ink-4 hover:text-t1 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-purple/20 bg-purple/5 p-3">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-purple/30 border-t-purple animate-spin flex-shrink-0" />
              <p className="text-xs text-purple/80">Claude is analyzing this Reel...</p>
            </div>
            <div className="space-y-3">
              {[75, 55, 88, 45, 67, 38, 80].map((w, i) => (
                <div key={i} className="skeleton h-2.5 rounded-full" style={{ width: `${w}%` }} />
              ))}
              <div className="mt-6 space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton h-14 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        ) : analysis ? (
          <>
            {/* TLDR */}
            <div className="border-b border-[rgba(255,255,255,0.07)] bg-purple/5 px-4 py-3">
              <p className="text-xs font-medium text-purple/90">
                ⚡ {analysis.tldr}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[rgba(255,255,255,0.07)]">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={clsx(
                    "flex-1 py-3 text-xs font-semibold transition-colors border-b-2",
                    tab === t.id
                      ? "border-purple text-purple"
                      : "border-transparent text-t3 hover:text-t2"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Why */}
              {tab === "why" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-3">
                    {analysis.whyItWentViral.split("\n\n").map((p, i) => (
                      <p key={i} className="text-sm leading-relaxed text-t1">{p}</p>
                    ))}
                  </div>
                  {analysis.emotionTriggers.length > 0 && (
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
                        Emotion Triggers
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.emotionTriggers.map(e => (
                          <span key={e} className="rounded-full border border-purple/25 bg-purple/10 px-2.5 py-0.5 text-xs font-medium text-purple/90 capitalize">
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Signals */}
              {tab === "signals" && (
                <div className="space-y-2 animate-fade-in">
                  {[
                    { k: "Hook",       v: analysis.hookAnalysis },
                    { k: "Retention",  v: analysis.retentionDevice },
                    { k: "Send Trigger", v: analysis.sendTrigger },
                    { k: "Save Trigger", v: analysis.saveTrigger },
                    { k: "Audio",      v: analysis.audioStrategy },
                    { k: "Caption",    v: analysis.captionStrategy },
                  ].map(item => (
                    <div key={item.k} className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-ink-3 p-3.5">
                      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">{item.k}</p>
                      <p className="text-xs leading-relaxed text-t1">{item.v}</p>
                    </div>
                  ))}
                  <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-ink-3 p-3.5">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">Format</p>
                    <div className="space-y-1.5">
                      {Object.entries(analysis.formatBreakdown).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <span className="font-medium capitalize text-t3 min-w-12">{k}</span>
                          <span className="text-t1">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Formula */}
              {tab === "formula" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="rounded-xl border border-purple/20 bg-purple/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-purple">
                        Replication Prompt
                      </p>
                      <CopyButton text={analysis.replicationPrompt} label="Copy" variant="premium" />
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-t1">
                      {analysis.replicationPrompt}
                    </p>
                  </div>
                  {analysis.adaptationTips.length > 0 && (
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
                        Adaptation Tips
                      </p>
                      <div className="space-y-2">
                        {analysis.adaptationTips.map((tip, i) => (
                          <div key={i} className="flex gap-2.5 rounded-xl bg-ink-3 p-3">
                            <span className="text-purple text-xs flex-shrink-0">→</span>
                            <p className="text-xs leading-relaxed text-t1">{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.nicheFitCategories.length > 0 && (
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-t3">
                        Works For
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.nicheFitCategories.map(n => (
                          <span key={n} className="rounded-full border border-[rgba(255,255,255,0.1)] bg-ink-4 px-2.5 py-0.5 text-xs text-t2 capitalize">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Stats */}
              {tab === "stats" && (
                <div className="space-y-2 animate-fade-in">
                  {[
                    { label: "Views",    value: formatNumber(reel.views),    mono: true },
                    { label: "Likes",    value: formatNumber(reel.likes),    mono: true },
                    { label: "Comments", value: formatNumber(reel.comments), mono: true },
                    { label: "Duration", value: `${reel.duration}s`,         mono: true },
                    { label: "Score",    value: `${reel.viralScore}/100`,    mono: true },
                    { label: "Category", value: reel.category,               mono: false },
                    { label: "Audio",    value: reel.audioName || "Original",mono: false },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between rounded-xl border border-[rgba(255,255,255,0.07)] bg-ink-3 px-4 py-2.5">
                      <span className="text-xs text-t3">{s.label}</span>
                      <span className={clsx("text-xs font-semibold text-t1 capitalize", s.mono && "font-mono")}>
                        {s.value}
                      </span>
                    </div>
                  ))}
                  <a
                    href={reel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.1)] py-2.5 text-xs font-medium text-t2 hover:text-t1 hover:border-[rgba(255,255,255,0.18)] transition-colors"
                  >
                    View on Instagram ↗
                  </a>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <p className="text-sm text-t3">No analysis available yet.</p>
          </div>
        )}
      </div>
    </>
  );
}
