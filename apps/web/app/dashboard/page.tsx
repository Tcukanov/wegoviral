"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Navbar from "../components/Navbar";
import {
  fetchDashboardMe,
  fetchDashboardMedia,
  fetchDashboardInsights,
  generateContentIdeas,
  disconnectInstagram,
  getConnectUrl,
  formatNumber,
} from "../../lib/api";
import type { IGProfile, IGMedia, IGAccountInsights, ContentIdea } from "../../lib/api";
import { clsx } from "clsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function engagementRate(m: IGMedia): number {
  const base = m.impressions || m.reach || 1;
  return ((m.like_count + m.comments_count + (m.saved ?? 0)) / base) * 100;
}

function postScore(m: IGMedia): number {
  const er = engagementRate(m);
  if (er >= 8)  return 90;
  if (er >= 5)  return 75;
  if (er >= 3)  return 60;
  if (er >= 1)  return 40;
  return 20;
}

function scoreColor(s: number) {
  if (s >= 75) return { text: "text-green-400",  bg: "bg-green-500/15",  border: "border-green-500/20" };
  if (s >= 50) return { text: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/20" };
  return       { text: "text-red-400",    bg: "bg-red-500/15",    border: "border-red-500/20" };
}

function typeTag(t: IGMedia["media_type"]) {
  if (t === "VIDEO")          return { label: "Reel",      color: "bg-purple/15 text-purple" };
  if (t === "CAROUSEL_ALBUM") return { label: "Carousel",  color: "bg-blue-500/15 text-blue-400" };
  return                             { label: "Photo",     color: "bg-ink-4 text-t3" };
}

function timeSince(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-ink-3 px-4 py-3 min-w-[80px]">
      <span className="font-mono text-lg font-bold text-t1">{value}</span>
      <span className="text-[10px] text-t3 mt-0.5">{label}</span>
      {sub && <span className="text-[9px] text-t3 opacity-50">{sub}</span>}
    </div>
  );
}

function IdeaCard({ idea, idx }: { idea: ContentIdea; idx: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-ink-2 overflow-hidden transition-all hover:border-purple/25">
      <button className="w-full text-left px-5 py-4 flex items-start gap-3" onClick={() => setOpen(o => !o)}>
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-purple/15 flex items-center justify-center">
          <span className="font-mono text-xs font-bold text-purple">{idx + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-t1">{idea.title}</p>
          <p className="text-sm text-t3 mt-0.5">{idea.format}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-green-400">{idea.estimatedBoost}</span>
          <span className="text-t3 text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[rgba(255,255,255,0.07)] px-5 py-4 space-y-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-t3 mb-1.5">Concept</p>
            <p className="text-sm leading-relaxed text-t2">{idea.concept}</p>
          </div>
          <div className="rounded-lg border border-purple/20 bg-purple/5 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-widest text-purple mb-1.5">Hook line (say this first)</p>
            <p className="text-sm font-semibold text-t1 italic">&ldquo;{idea.hookLine}&rdquo;</p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-t3 mb-1.5">Shoot Brief</p>
            <p className="text-sm leading-relaxed text-t2">{idea.shootBrief}</p>
          </div>
          <div className="rounded-lg bg-green-500/5 border border-green-500/10 px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-widest text-green-400 mb-1.5">Why it&apos;ll work</p>
            <p className="text-sm leading-relaxed text-t2">{idea.whyItWillWork}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ post }: { post: IGMedia }) {
  const score = postScore(post);
  const sc    = scoreColor(score);
  const tag   = typeTag(post.media_type);
  const thumb = post.thumbnail_url || post.media_url;
  const er    = engagementRate(post);

  return (
    <a href={post.permalink} target="_blank" rel="noopener noreferrer"
      className="group rounded-xl border border-[rgba(255,255,255,0.07)] bg-ink-2 overflow-hidden transition-all hover:border-purple/25 flex flex-col">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-ink-3 overflow-hidden">
        {thumb ? (
          <Image src={thumb} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-2xl opacity-20">{post.media_type === "VIDEO" ? "▶" : "🖼"}</span>
          </div>
        )}
        {/* Type badge */}
        <div className={clsx("absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-bold", tag.color)}>{tag.label}</div>
        {/* Score badge */}
        <div className={clsx("absolute top-2 right-2 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold border", sc.bg, sc.text, sc.border)}>
          {score}
        </div>
      </div>

      {/* Metrics */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        {post.caption && (
          <p className="text-[11px] text-t3 line-clamp-2 leading-relaxed">{post.caption}</p>
        )}
        <div className="grid grid-cols-2 gap-1.5 mt-auto">
          <div className="rounded-lg bg-ink-3 px-2 py-1.5 text-center">
            <p className="font-mono text-xs font-bold text-t1">❤️ {formatNumber(post.like_count)}</p>
          </div>
          <div className="rounded-lg bg-ink-3 px-2 py-1.5 text-center">
            <p className="font-mono text-xs font-bold text-t1">💬 {formatNumber(post.comments_count)}</p>
          </div>
          {post.impressions != null && (
            <div className="rounded-lg bg-ink-3 px-2 py-1.5 text-center">
              <p className="font-mono text-xs font-bold text-t1">👁 {formatNumber(post.impressions)}</p>
              <p className="text-[8px] text-t3">impressions</p>
            </div>
          )}
          {post.saved != null && (
            <div className="rounded-lg bg-ink-3 px-2 py-1.5 text-center">
              <p className="font-mono text-xs font-bold text-t1">🔖 {formatNumber(post.saved)}</p>
              <p className="text-[8px] text-t3">saves</p>
            </div>
          )}
          {post.reach != null && (
            <div className="rounded-lg bg-ink-3 px-2 py-1.5 text-center">
              <p className="font-mono text-xs font-bold text-t1">📡 {formatNumber(post.reach)}</p>
              <p className="text-[8px] text-t3">reach</p>
            </div>
          )}
          {post.video_views != null && (
            <div className="rounded-lg bg-ink-3 px-2 py-1.5 text-center">
              <p className="font-mono text-xs font-bold text-t1">▶ {formatNumber(post.video_views)}</p>
              <p className="text-[8px] text-t3">plays</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-t3">{timeSince(post.timestamp)}</span>
          <span className={clsx("font-mono text-[10px] font-bold", sc.text)}>{er.toFixed(1)}% ER</span>
        </div>
      </div>
    </a>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type PageState = "checking" | "disconnected" | "loading" | "ready" | "error";

export default function DashboardPage() {
  const [state,         setState]         = useState<PageState>("checking");
  const [errorMsg,      setErrorMsg]      = useState("");
  const [profile,       setProfile]       = useState<IGProfile | null>(null);
  const [media,         setMedia]         = useState<IGMedia[]>([]);
  const [insights,      setInsights]      = useState<IGAccountInsights | null>(null);
  const [ideas,         setIdeas]         = useState<ContentIdea[]>([]);
  const [genStatus,     setGenStatus]     = useState<"idle" | "loading" | "done">("idle");
  const [sortBy,        setSortBy]        = useState<"date" | "engagement" | "saves" | "impressions">("date");
  const [filterType,    setFilterType]    = useState<"all" | "VIDEO" | "IMAGE" | "CAROUSEL_ALBUM">("all");

  const load = useCallback(async () => {
    try {
      setState("loading");
      const [meRes, mediaRes, insightsRes] = await Promise.all([
        fetchDashboardMe(),
        fetchDashboardMedia(24),
        fetchDashboardInsights(),
      ]);
      setProfile(meRes.profile);
      setMedia(mediaRes.media);
      setInsights(insightsRes.insights);
      setState("ready");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string }; status?: number } };
      if (e?.response?.status === 401 || e?.response?.data?.error === "not_connected") {
        setState("disconnected");
      } else {
        setErrorMsg(e?.response?.data?.error || "Failed to load dashboard");
        setState("error");
      }
    }
  }, []);

  useEffect(() => {
    // Check URL params for OAuth result
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      setErrorMsg(decodeURIComponent(params.get("error") || "OAuth failed"));
      setState("error");
      window.history.replaceState({}, "", "/dashboard");
      return;
    }
    load();
  }, [load]);

  async function handleGenerateIdeas() {
    if (!media.length) return;
    setGenStatus("loading");
    try {
      const res = await generateContentIdeas(media);
      setIdeas(res.ideas);
      setGenStatus("done");
      setTimeout(() => {
        document.getElementById("ideas-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch {
      setGenStatus("idle");
    }
  }

  async function handleDisconnect() {
    await disconnectInstagram();
    setState("disconnected");
    setProfile(null); setMedia([]); setInsights(null); setIdeas([]);
  }

  // Sorted + filtered media
  const displayMedia = [...media]
    .filter(m => filterType === "all" || m.media_type === filterType)
    .sort((a, b) => {
      if (sortBy === "engagement")  return engagementRate(b) - engagementRate(a);
      if (sortBy === "saves")       return (b.saved ?? 0) - (a.saved ?? 0);
      if (sortBy === "impressions") return (b.impressions ?? 0) - (a.impressions ?? 0);
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const topPost = [...media].sort((a, b) => engagementRate(b) - engagementRate(a))[0];

  // ── Checking / Loading states ────────────────────────────────────────────

  if (state === "checking" || state === "loading") {
    return (
      <div className="min-h-screen bg-ink">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 rounded-full border-2 border-purple/30 border-t-purple animate-spin" />
            <p className="text-sm text-t3">{state === "checking" ? "Checking connection…" : "Loading your dashboard…"}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (state === "error") {
    return (
      <div className="min-h-screen bg-ink">
        <Navbar />
        <div className="mx-auto max-w-xl px-5 py-20 text-center">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
            <span className="text-3xl">⚠️</span>
            <p className="mt-4 font-semibold text-red-400">Connection error</p>
            <p className="mt-2 text-sm text-red-300/70">{errorMsg}</p>
            <button onClick={() => setState("disconnected")}
              className="mt-6 rounded-xl bg-ink-3 px-6 py-2.5 text-sm text-t2 hover:text-t1 transition-colors">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Disconnected / Connect screen ────────────────────────────────────────

  if (state === "disconnected") {
    return (
      <div className="min-h-screen bg-ink">
        <Navbar />

        <div className="relative border-b border-[rgba(255,255,255,0.07)]">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-80 w-80 rounded-full bg-purple/6 blur-[120px]" />
          </div>
          <div className="relative mx-auto max-w-2xl px-5 py-20 text-center">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-purple">Creator Dashboard</p>
            <h1 className="text-4xl font-bold text-t1 leading-tight">
              Your content strategy,<br /><span className="text-gradient">powered by AI</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-t2">
              Connect your Instagram Business or Creator account to unlock full metrics, spot patterns in your content, and get AI-generated ideas tailored to what already works for you.
            </p>

            <button
              onClick={() => { window.location.href = getConnectUrl(); }}
              className="mt-8 inline-flex items-center gap-3 rounded-xl bg-purple px-8 py-3.5 text-sm font-semibold text-white shadow-purple-sm transition-all hover:shadow-purple-md hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              Connect Instagram
            </button>
            <p className="mt-3 text-xs text-t3">Requires a Business or Creator account · No password shared</p>

            {/* Feature list */}
            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3 text-left">
              {[
                { icon: "📊", title: "Hidden metrics", desc: "Saves, reach, impressions — data Instagram Insights buries" },
                { icon: "🧠", title: "Pattern analysis", desc: "AI spots what your top posts have in common vs what flops" },
                { icon: "💡", title: "Content ideas", desc: "5 briefs generated from your own winning content patterns" },
              ].map(f => (
                <div key={f.title} className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-4">
                  <span className="text-xl">{f.icon}</span>
                  <p className="mt-2 font-semibold text-t1 text-sm">{f.title}</p>
                  <p className="mt-1 text-xs text-t3 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Connected / Full Dashboard ───────────────────────────────────────────

  return (
    <div className="min-h-screen bg-ink">
      <Navbar />

      <div className="mx-auto max-w-6xl px-5 py-8 space-y-6">

        {/* ── Account header ──────────────────────────────────── */}
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-5 p-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile?.profile_picture_url ? (
                <div className="relative h-20 w-20 rounded-full overflow-hidden ring-2 ring-purple/30">
                  <Image src={profile.profile_picture_url} alt="" fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-full bg-purple/20 flex items-center justify-center text-2xl font-bold text-purple">
                  {profile?.username?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-t1">@{profile?.username}</h1>
                <span className="rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] font-mono text-green-400">Connected</span>
              </div>
              {profile?.name && <p className="text-sm text-t2 mt-0.5">{profile.name}</p>}
              {profile?.biography && <p className="mt-1.5 text-sm text-t3 leading-relaxed line-clamp-2">{profile.biography}</p>}
              <div className="mt-3 flex flex-wrap gap-3">
                <StatPill label="Followers"   value={formatNumber(profile?.followers_count ?? 0)} />
                <StatPill label="Following"   value={formatNumber(profile?.follows_count ?? 0)} />
                <StatPill label="Posts"       value={String(profile?.media_count ?? 0)} />
              </div>
            </div>

            {/* Disconnect */}
            <button onClick={handleDisconnect}
              className="self-start text-xs text-t3 hover:text-red-400 transition-colors rounded-lg px-3 py-1.5 border border-[rgba(255,255,255,0.07)] hover:border-red-500/20">
              Disconnect
            </button>
          </div>

          {/* 7-day account insights */}
          {insights && (
            <div className="border-t border-[rgba(255,255,255,0.07)] px-6 py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-t3 mb-3">Last 7 days</p>
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="font-mono text-base font-bold text-t1">{formatNumber(insights.impressions7d)}</p>
                  <p className="text-[10px] text-t3">Impressions</p>
                </div>
                <div>
                  <p className="font-mono text-base font-bold text-t1">{formatNumber(insights.reach7d)}</p>
                  <p className="text-[10px] text-t3">Reach</p>
                </div>
                <div>
                  <p className="font-mono text-base font-bold text-t1">{formatNumber(insights.profileViews7d)}</p>
                  <p className="text-[10px] text-t3">Profile views</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Top post highlight ──────────────────────────────── */}
        {topPost && (
          <div className="rounded-2xl border border-purple/20 bg-purple/5 p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-purple mb-3">Your best post</p>
            <div className="flex gap-4 items-start">
              {(topPost.thumbnail_url || topPost.media_url) && (
                <div className="relative h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden">
                  <Image src={topPost.thumbnail_url || topPost.media_url!} alt="" fill className="object-cover" unoptimized />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-t2 line-clamp-2 leading-relaxed">{topPost.caption || "No caption"}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                  <span className="text-purple font-mono font-bold">{engagementRate(topPost).toFixed(1)}% ER</span>
                  {topPost.impressions != null && <span className="text-t3">👁 {formatNumber(topPost.impressions)} impressions</span>}
                  {topPost.saved != null && <span className="text-t3">🔖 {formatNumber(topPost.saved)} saves</span>}
                  <span className="text-t3">❤️ {formatNumber(topPost.like_count)} likes</span>
                </div>
              </div>
              <a href={topPost.permalink} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 text-xs text-purple hover:underline">View →</a>
            </div>
          </div>
        )}

        {/* ── Generate ideas CTA ──────────────────────────────── */}
        {genStatus === "idle" && (
          <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-6 flex flex-col sm:flex-row items-center gap-5">
            <div className="flex-1">
              <p className="font-semibold text-t1">Generate content ideas from your data</p>
              <p className="mt-1 text-sm text-t3">
                Claude analyzes your top {media.length} posts, finds the patterns, and writes 5 shoot-ready briefs.
              </p>
            </div>
            <button onClick={handleGenerateIdeas} disabled={!media.length}
              className="flex-shrink-0 flex items-center gap-2 rounded-xl bg-purple px-6 py-3 text-sm font-semibold text-white shadow-purple-sm transition-all hover:shadow-purple-md hover:scale-[1.02] disabled:opacity-40">
              <span>✨</span> Generate Ideas
            </button>
          </div>
        )}

        {genStatus === "loading" && (
          <div className="rounded-2xl border border-purple/20 bg-purple/5 p-6 flex items-center gap-4">
            <div className="h-6 w-6 rounded-full border-2 border-purple/30 border-t-purple animate-spin flex-shrink-0" />
            <div>
              <p className="font-semibold text-t1">Claude is analyzing your content…</p>
              <p className="text-sm text-t3 mt-0.5">Reading your top posts, spotting patterns, writing briefs</p>
            </div>
          </div>
        )}

        {/* ── Content ideas section ───────────────────────────── */}
        {genStatus === "done" && ideas.length > 0 && (
          <div id="ideas-section" className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">✨</span>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-purple">Content Ideas</p>
            </div>
            <p className="text-xs text-t3 mb-5">Based on patterns in your top-performing posts</p>
            <div className="space-y-3">
              {ideas.map((idea, i) => <IdeaCard key={i} idea={idea} idx={i} />)}
            </div>
            <button onClick={() => { setGenStatus("idle"); setIdeas([]); }}
              className="mt-4 text-xs text-t3 hover:text-t2 transition-colors underline underline-offset-2">
              Regenerate ideas
            </button>
          </div>
        )}

        {/* ── Media grid ──────────────────────────────────────── */}
        <div>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-t3 mr-auto">
              {displayMedia.length} post{displayMedia.length !== 1 ? "s" : ""}
            </p>
            {/* Filter */}
            <div className="flex gap-1.5 rounded-xl bg-ink-3 p-1">
              {(["all", "VIDEO", "IMAGE", "CAROUSEL_ALBUM"] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={clsx("rounded-lg px-3 py-1 text-[11px] font-medium transition-colors",
                    filterType === t ? "bg-ink-2 text-t1" : "text-t3 hover:text-t2")}>
                  {t === "all" ? "All" : t === "VIDEO" ? "Reels" : t === "IMAGE" ? "Photos" : "Carousels"}
                </button>
              ))}
            </div>
            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-xl bg-ink-3 border border-[rgba(255,255,255,0.07)] px-3 py-1.5 text-[11px] text-t2 outline-none">
              <option value="date">Newest first</option>
              <option value="engagement">Best engagement</option>
              <option value="saves">Most saves</option>
              <option value="impressions">Most impressions</option>
            </select>
          </div>

          {displayMedia.length === 0 ? (
            <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-ink-2 p-10 text-center">
              <p className="text-sm text-t3">No posts match this filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {displayMedia.map(post => <PostCard key={post.id} post={post} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
