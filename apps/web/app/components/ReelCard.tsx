"use client";

import Image from "next/image";
import { clsx } from "clsx";
import { formatNumber } from "../../lib/api";
import ViralScoreBadge from "./ViralScoreBadge";
import type { TrendingReel } from "@wegoviral/shared";

interface Props {
  reel: TrendingReel;
  onClick: () => void;
  isActive?: boolean;
}

const CAT_COLORS: Record<string, string> = {
  fitness:    "text-emerald-400 bg-emerald-400/10",
  finance:    "text-blue-400 bg-blue-400/10",
  food:       "text-orange-400 bg-orange-400/10",
  beauty:     "text-pink-400 bg-pink-400/10",
  motivation: "text-yellow-400 bg-yellow-400/10",
  comedy:     "text-purple-400 bg-purple-400/10",
  other:      "text-t3 bg-ink-4",
};

export default function ReelCard({ reel, onClick, isActive }: Props) {
  const catColor = CAT_COLORS[reel.category] ?? CAT_COLORS.other;

  return (
    <article
      onClick={onClick}
      className={clsx(
        "group relative cursor-pointer overflow-hidden rounded-2xl border transition-all duration-150",
        isActive
          ? "border-purple shadow-purple-sm scale-[1.01]"
          : "border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.14)] hover:scale-[1.02]"
      )}
      style={{ aspectRatio: "9/16" }}
    >
      {/* Thumbnail */}
      <div className="absolute inset-0 bg-ink-3">
        {reel.thumbnailUrl ? (
          <Image
            src={reel.thumbnailUrl}
            alt={reel.caption.slice(0, 40)}
            fill
            className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            unoptimized
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-ink-4 to-ink-3" />
        )}
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[rgba(8,8,8,0.2)] to-transparent" />
      </div>

      {/* Top row */}
      <div className="relative flex items-start justify-between p-3">
        <span className={clsx("rounded-lg px-2 py-0.5 text-[10px] font-semibold capitalize", catColor)}>
          {reel.category}
        </span>
        <ViralScoreBadge score={reel.viralScore} size="sm" />
      </div>

      {/* Bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {reel.audioName && (
          <div className="mb-2 flex items-center gap-1.5 overflow-hidden">
            <span className="text-[10px] text-t3">♪</span>
            <span className="truncate text-[10px] text-t3">{reel.audioName}</span>
            {reel.isAudioTrending && (
              <span className="ml-auto flex-shrink-0 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                TRENDING
              </span>
            )}
          </div>
        )}
        <p className="font-medium text-xs text-t1 leading-snug">@{reel.username}</p>
        <p className="mt-0.5 truncate text-[11px] text-t3">{reel.caption}</p>
        <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-t3">
          <span>{formatNumber(reel.views)} views</span>
          <span>·</span>
          <span>{formatNumber(reel.likes)} likes</span>
        </div>

        {/* Hover overlay CTA */}
        <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="rounded-xl bg-purple/90 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            See Why It&apos;s Viral →
          </div>
        </div>
      </div>
    </article>
  );
}
