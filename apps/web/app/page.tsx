"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Navbar from "./components/Navbar";
import ScoreRing from "./components/ScoreRing";
import CopyButton from "./components/CopyButton";
import ViralProbabilityWidget from "./components/ViralProbabilityWidget";
import NicheComparison from "./components/NicheComparison";
import { analyzeInstagramUrl, formatNumber, getVerdictMeta, fetchViralExamples } from "../lib/api";
import type { ViralExample, ViralExamplesResult } from "../lib/api";
import type { UserPostAnalysisResponse } from "@wegoviral/shared";
import { clsx } from "clsx";

const STEPS = [
  { text: "Fetching post data" },
  { text: "Reading metrics" },
  { text: "AI is analyzing" },
  { text: "Writing your brief" },
];

const SCORE_FIELDS = [
  { key: "hook",       label: "Hook",       icon: "🎣" },
  { key: "caption",    label: "Caption",    icon: "✍️" },
  { key: "audio",      label: "Audio",      icon: "🎵" },
  { key: "format",     label: "Format",     icon: "📐" },
  { key: "engagement", label: "Engagement", icon: "💬" },
] as const;

function scoreColor(s: number) {
  if (s >= 70) return { text: "text-green-400", bg: "bg-green-500/10", bar: "#22c55e" };
  if (s >= 45) return { text: "text-yellow-400", bg: "bg-yellow-500/10", bar: "#eab308" };
  if (s >= 25) return { text: "text-orange-400", bg: "bg-orange-500/10", bar: "#f97316" };
  return { text: "text-red-400", bg: "bg-red-500/10", bar: "#ef4444" };
}

function MiniGauge({ score, label, icon, delay = 0 }: { score: number; label: string; icon: string; delay?: number }) {
  const [w, setW] = useState(0);
  const ref = useRef(false);
  if (!ref.current) { ref.current = true; setTimeout(() => setW(score), delay + 100); }
  const c = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-ink-3 min-w-0">
      <span className="text-base">{icon}</span>
      <div className="w-full h-1 rounded-full bg-ink-4 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${w}%`, background: c.bar }} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className={clsx("font-mono text-sm font-bold", c.text)}>{score}</span>
        <span className="text-[9px] text-t3">/100</span>
      </div>
      <span className="text-[10px] text-t3 text-center leading-tight">{label}</span>
    </div>
  );
}

export default function AnalyzePage() {
  const [url,         setUrl]         = useState("");
  const [status,      setStatus]      = useState<"idle"|"loading"|"done"|"error">("idle");
  const [stepIdx,     setStepIdx]     = useState(0);
  const [visible,     setVisible]     = useState<number[]>([]);
  const [result,      setResult]      = useState<UserPostAnalysisResponse | null>(null);
  const [error,       setError]       = useState("");
  const [viralResult, setViralResult] = useState<ViralExamplesResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  async function handleAnalyze() {
    if (!url.trim() || status === "loading") return;
    setStatus("loading"); setStepIdx(0); setVisible([0]); setError(""); setResult(null);
    const timers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, i) => { if (i === 0) return; timers.push(setTimeout(() => { setStepIdx(i); setVisible(p => [...p, i]); }, i * 2000)); });
    try {
      const data = await analyzeInstagramUrl(url.trim());
      timers.forEach(clearTimeout); setVisible([0,1,2,3]); setResult(data); setStatus("done");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      fetchViralExamples((data as unknown as { category?: string }).category).then(setViralResult).catch(() => {});
    } catch (err: unknown) {
      timers.forEach(clearTimeout);
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to analyze. Check the URL and try again.");
      setStatus("error");
    }
  }

  const verdict = result ? getVerdictMeta(result.scores.overall) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ci = result ? (result as any).contentIntelligence : null;

  return (
    <div className="min-h-screen bg-ink">
      <Navbar />

      {/* ── Hero input ──────────────────────────────────────────── */}
      <section className="relative border-b border-[rgba(255,255,255,0.07)]">
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-10">
          <div className="h-72 w-72 rounded-full bg-purple/8 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-2xl px-5 py-16 text-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-purple">Post Analyzer</p>
          <h1 className="text-display-xl font-bold leading-tight text-t1">
            Why didn&apos;t it<br /><span className="text-gradient">go viral?</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-t2">
            Paste any public Instagram Reel or TikTok video. Get a complete breakdown in 30 seconds.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAnalyze()} disabled={status === "loading"}
              placeholder="https://instagram.com/reel/... or https://tiktok.com/@..."
              className="flex-1 rounded-xl border border-[rgba(255,255,255,0.08)] bg-ink-3 px-4 py-3 text-sm text-t1 placeholder-t3 outline-none transition focus:border-purple/60 focus:ring-2 focus:ring-purple/20 disabled:opacity-40" />
            <button onClick={handleAnalyze} disabled={!url.trim() || status === "loading"}
              className="flex items-center justify-center gap-2 rounded-xl bg-purple px-6 py-3 text-sm font-semibold text-white shadow-purple-sm transition-all hover:shadow-purple-md hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]">
              {status === "loading" ? <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : "Analyze →"}
            </button>
          </div>
          <p className="mt-3 text-xs text-t3">Free · No login · Instagram Reels & TikTok videos</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-10">

        {/* ── Loading ──────────────────────────────────────────── */}
        {status === "loading" && (
          <div className="max-w-lg mx-auto rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-8 animate-fade-in">
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-t3">Analyzing</p>
            <div className="space-y-4">
              {STEPS.map((step, i) => (
                <div key={i} className={clsx("flex items-center gap-4 transition-all duration-300", visible.includes(i) ? "opacity-100" : "opacity-0")}>
                  <div className={clsx("h-5 w-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all",
                    i < stepIdx ? "border-purple bg-purple/20" : i === stepIdx ? "border-purple/60 bg-purple/10 animate-pulse-ring" : "border-ink-4")}>
                    {i < stepIdx ? <span className="text-purple text-[10px]">✓</span> : i === stepIdx ? <span className="h-1.5 w-1.5 rounded-full bg-purple animate-pulse" /> : null}
                  </div>
                  <span className={clsx("text-sm", i === stepIdx ? "text-t1 font-medium" : i < stepIdx ? "text-t2 line-through" : "text-t3")}>{step.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────── */}
        {status === "error" && (
          <div className="max-w-lg mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-6 animate-fade-in">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-lg">⚠</span>
              <div><p className="font-semibold text-red-400">Analysis failed</p><p className="mt-1 text-sm text-red-300/70">{error}</p></div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            RESULTS — infographic layout
           ══════════════════════════════════════════════════════ */}
        {status === "done" && result && (
          <div ref={resultsRef} className="stagger-children space-y-6">

            {/* ── ROW 1: Hero score card ──────────────────────── */}
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {/* Left: post info */}
                <div className="flex-1 p-6 flex gap-4 min-w-0">
                  {result.post.thumbnailUrl && (
                    <div className="relative h-28 w-[60px] flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-[rgba(255,255,255,0.08)]">
                      <Image src={result.post.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-t1 truncate">@{result.post.username}</p>
                    <p className="mt-1 text-sm text-t2 line-clamp-2 leading-relaxed">{result.post.caption || "No caption"}</p>
                    {(() => {
                      const stats = [
                        ...(result.post.views > 0    ? [{ k: "Views",    v: formatNumber(result.post.views) }] : []),
                        ...(result.post.likes > 0    ? [{ k: "Likes",    v: formatNumber(result.post.likes) }] : []),
                        ...(result.post.comments > 0 ? [{ k: "Comments", v: formatNumber(result.post.comments) }] : []),
                        ...(result.post.duration     ? [{ k: "Duration", v: `${result.post.duration}s` }] : []),
                      ];
                      return stats.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-4">
                          {stats.map(s => (
                            <div key={s.k}>
                              <span className="font-mono text-sm font-bold text-t1">{s.v}</span>
                              <span className="ml-1 text-[10px] text-t3">{s.k}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="mt-3 text-xs text-t3 italic">Metrics unavailable for this post</p>;
                    })()}
                  </div>
                </div>

                {/* Right: big score */}
                <div className="flex items-center justify-center border-t sm:border-t-0 sm:border-l border-[rgba(255,255,255,0.07)] px-8 py-6 bg-ink-3/50">
                  <ScoreRing score={result.scores.overall} size={130} />
                </div>
              </div>

              {/* Verdict strip */}
              {verdict && (
                <div className="flex items-center gap-3 border-t border-[rgba(255,255,255,0.07)] px-6 py-3.5" style={{ background: `linear-gradient(90deg, ${scoreColor(result.scores.overall).bar}08, transparent)` }}>
                  <span className="text-xl">{verdict.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <span className={clsx("text-sm font-bold", verdict.text)}>{verdict.label}</span>
                    <span className="mx-2 text-t3">·</span>
                    <span className="text-sm text-t2">{result.verdict}</span>
                  </div>
                  {result.post.views > 0 && (
                    <div className="hidden md:flex gap-4 flex-shrink-0 pl-4 border-l border-[rgba(255,255,255,0.07)]">
                      <div className="text-center">
                        <p className="font-mono text-base font-bold text-t1">{result.actual.likeRate.toFixed(1)}%</p>
                        <p className="text-[9px] text-t3">Like rate <span className="opacity-50">(avg {result.benchmark.likeRate}%)</span></p>
                      </div>
                      <div className="text-center">
                        <p className="font-mono text-base font-bold text-t1">{result.actual.commentRate.toFixed(2)}%</p>
                        <p className="text-[9px] text-t3">Comment rate <span className="opacity-50">(avg {result.benchmark.commentRate}%)</span></p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── ROW 2: Score gauges (5 in a row) ─────────────── */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {SCORE_FIELDS.map((f, i) => (
                <MiniGauge key={f.key} score={result.scores[f.key]} label={f.label} icon={f.icon} delay={i * 60} />
              ))}
            </div>

            {/* ── ROW 3: Issues + Fixes side by side ──────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Issues */}
              <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-5 w-5 rounded-full bg-red-500/15 flex items-center justify-center">
                    <span className="text-red-400 text-[10px]">✕</span>
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400">What Went Wrong</p>
                </div>
                <div className="space-y-2">
                  {result.whatWentWrong.map((issue, i) => (
                    <div key={i} className="flex gap-3 rounded-lg bg-red-500/5 border border-red-500/10 p-3">
                      <span className="text-red-400/60 font-mono text-xs font-bold mt-0.5 flex-shrink-0">{i + 1}</span>
                      <p className="text-[13px] leading-relaxed text-t1">{issue}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Fixes */}
              <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-5 w-5 rounded-full bg-green-500/15 flex items-center justify-center">
                    <span className="text-green-400 text-[10px]">✓</span>
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-green-400">How to Fix It</p>
                </div>
                <div className="space-y-2">
                  {result.quickFixes.map((fix, i) => (
                    <div key={i} className="flex gap-3 rounded-lg bg-green-500/5 border border-green-500/10 p-3">
                      <span className="text-green-400/60 font-mono text-xs font-bold mt-0.5 flex-shrink-0">{i + 1}</span>
                      <p className="text-[13px] leading-relaxed text-t1">{fix}</p>
                    </div>
                  ))}
                </div>
                {/* Potential badge */}
                <div className="mt-3 flex items-center justify-between rounded-lg border border-purple/20 bg-purple/5 px-3.5 py-2.5">
                  <span className="text-xs text-t2">Score after fixes</span>
                  <span className="font-mono text-lg font-bold text-purple">{result.scores.potentialWithFixes}<span className="text-xs font-normal text-t3">/100</span></span>
                </div>
              </div>
            </div>

            {/* ── ROW 4: Deep-dive feedback (3 cols) ──────────── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Hook Feedback",   icon: "🎣", text: result.hookFeedback },
                { label: "Audio Feedback",   icon: "🎵", text: result.audioFeedback },
                { label: "Format Feedback",  icon: "📐", text: result.formatFeedback },
              ].map(item => (
                <div key={item.label} className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{item.icon}</span>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-t3">{item.label}</p>
                  </div>
                  <p className="text-[13px] leading-relaxed text-t2">{item.text}</p>
                </div>
              ))}
            </div>

            {/* ── ROW 5: Content Intelligence ─────────────────── */}
            {ci && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Posting time */}
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🕐</span>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-t3">Posting Time</p>
                    </div>
                    <span className={clsx("rounded-full px-2 py-0.5 font-mono text-[10px] font-bold", scoreColor(ci.postingTime.timingScore).bg, scoreColor(ci.postingTime.timingScore).text)}>
                      {ci.postingTime.timingScore}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-t2">{ci.postingTime.timingVerdict}</p>
                  {ci.postingTime.estimatedReachLoss > 0 && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-2">
                      <span className="text-red-400 font-mono text-sm font-bold">-{ci.postingTime.estimatedReachLoss}%</span>
                      <span className="text-[11px] text-red-300/70">reach lost from timing</span>
                    </div>
                  )}
                  {ci.postingTime.optimalWindows?.length > 0 && (
                    <p className="mt-2 text-[11px] text-t3">Peak: {ci.postingTime.optimalWindows.join(" & ")} UTC</p>
                  )}
                </div>

                {/* Hashtag audit */}
                <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">#️⃣</span>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-t3">Hashtags</p>
                    </div>
                    <span className={clsx("rounded-full px-2 py-0.5 font-mono text-[10px] font-bold", scoreColor(ci.hashtags.score).bg, scoreColor(ci.hashtags.score).text)}>
                      {ci.hashtags.score}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-t2">{ci.hashtags.verdict}</p>
                  {ci.hashtags.count > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="text-t3">{ci.hashtags.count} tags</span>
                      {ci.hashtags.broadTags?.length > 0 && <span className="text-orange-400">{ci.hashtags.broadTags.length} broad</span>}
                      {ci.hashtags.nicheTags?.length > 0 && <span className="text-green-400">{ci.hashtags.nicheTags.length} niche</span>}
                    </div>
                  )}
                  {ci.hashtags.missingCategoryTags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ci.hashtags.missingCategoryTags.map((tag: string) => (
                        <span key={tag} className="rounded bg-purple/10 px-1.5 py-0.5 text-[10px] text-purple font-mono">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Velocity */}
                {result.post.views > 0 ? (
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚡</span>
                        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-t3">Velocity</p>
                      </div>
                      <span className={clsx("rounded-full px-2 py-0.5 font-mono text-[10px] font-bold", scoreColor(ci.velocity.velocityScore).bg, scoreColor(ci.velocity.velocityScore).text)}>
                        {ci.velocity.velocityScore}
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-t2">{ci.velocity.velocityVerdict}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-ink-3 px-2.5 py-2 text-center">
                        <p className="font-mono text-sm font-bold text-t1">{ci.velocity.viewsPerHour.toLocaleString()}</p>
                        <p className="text-[9px] text-t3">views/hr</p>
                      </div>
                      <div className="rounded-lg bg-ink-3 px-2.5 py-2 text-center">
                        <p className="font-mono text-sm font-bold text-t1">{ci.velocity.benchmarkVph.toLocaleString()}</p>
                        <p className="text-[9px] text-t3">viral avg</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-4 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-lg">⚡</span>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-t3">Velocity</p>
                    <p className="text-[11px] text-t3">Metrics unavailable for this post</p>
                  </div>
                )}
              </div>
            )}

            {/* ── ROW 6: Viral probability ────────────────────── */}
            {(result.viralProbability > 0 || result.optimizedProbability > 0) && (
              <ViralProbabilityWidget viralProbability={result.viralProbability} optimizedProbability={result.optimizedProbability} probabilityBoosts={result.probabilityBoosts ?? []} />
            )}

            {/* ── ROW 7: Niche comparison ─────────────────────── */}
            {result.nicheComparison?.topInsight && <NicheComparison data={result.nicheComparison} />}

            {/* ── ROW 8: Caption rewrite (before/after) ───────── */}
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 overflow-hidden">
              <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.07)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">✍️</span>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-t3">Caption Rewrite</p>
                </div>
                <CopyButton text={result.rewrittenCaption} label="Copy" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[rgba(255,255,255,0.07)]">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-2 w-2 rounded-full bg-red-400/50" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-t3">Before</span>
                  </div>
                  <p className="text-sm leading-relaxed text-t3">{result.post.caption || "No caption"}</p>
                </div>
                <div className="p-5 bg-green-500/[0.02]">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-2 w-2 rounded-full bg-green-400/80" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-green-400">After</span>
                  </div>
                  <p className="text-sm leading-relaxed text-t1 font-medium">{result.rewrittenCaption}</p>
                </div>
              </div>
              {result.captionFeedback && (
                <div className="border-t border-[rgba(255,255,255,0.07)] px-6 py-3 flex items-start gap-2.5">
                  <span className="text-purple text-sm mt-0.5">💡</span>
                  <p className="text-[13px] leading-relaxed text-t2">{result.captionFeedback}</p>
                </div>
              )}
            </div>

            {/* ── ROW 9: Reshoot brief ────────────────────────── */}
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 overflow-hidden">
              <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.07)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎬</span>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-t3">Reshoot Brief</p>
                  <span className="text-[10px] text-t3 ml-1">— copy & send to your editor</span>
                </div>
                <CopyButton text={result.improvedPrompt} label="Copy Brief" variant="premium" />
              </div>
              <div className="p-6">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-t1">{result.improvedPrompt}</p>
              </div>
            </div>

            {/* ── ROW 10: Viral examples ──────────────────────── */}
            {viralResult && (
              <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🔥</span>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-t3">Viral in Your Niche</p>
                </div>
                <p className="mb-5 text-xs text-t3">
                  {viralResult.matched ? `Small creators in ${viralResult.category} who blew up` : `Collecting ${viralResult.category ?? "niche"} examples — check back soon`}
                </p>
                {viralResult.matched ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {viralResult.examples.map((ex: ViralExample) => (
                      <a key={ex.shortcode} href={ex.url} target="_blank" rel="noopener noreferrer"
                        className="group rounded-xl border border-[rgba(255,255,255,0.07)] bg-ink-3 overflow-hidden transition-all hover:border-purple/30">
                        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[rgba(255,255,255,0.05)]">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple/60 to-pink-500/60 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-white">{ex.username[0]?.toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-t1 truncate">@{ex.username}</p>
                            {ex.followerCount != null && <p className="text-[9px] text-t3">{formatNumber(ex.followerCount)} followers</p>}
                          </div>
                        </div>
                        <div className="px-3 py-3">
                          <p className="text-[11px] leading-relaxed text-t2 line-clamp-2">{ex.caption || "Instagram Reel"}</p>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between border-t border-[rgba(255,255,255,0.05)]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-t3">👁 {formatNumber(ex.views)}</span>
                            <span className="font-mono text-[10px] text-t3">❤️ {formatNumber(ex.likes)}</span>
                          </div>
                          <span className="rounded bg-purple/10 px-1.5 py-0.5 font-mono text-[10px] text-purple">{ex.viralScore}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <span className="text-xl">⏳</span>
                    <p className="text-sm text-t2">Examples loading for this niche</p>
                    <p className="text-xs text-t3 max-w-xs">Our scraper collects viral reels every few hours.</p>
                  </div>
                )}
              </div>
            )}

            {/* Reset */}
            <div className="text-center pt-2 pb-6">
              <button onClick={() => { setStatus("idle"); setResult(null); setUrl(""); setViralResult(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-xs text-t3 underline underline-offset-2 hover:text-t2 transition-colors">Analyze another post</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
