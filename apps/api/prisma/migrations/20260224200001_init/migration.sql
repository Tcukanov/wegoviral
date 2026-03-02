-- CreateTable
CREATE TABLE "TrendingReel" (
    "id" TEXT NOT NULL,
    "instagramId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "thumbnailUrl" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[],
    "audioName" TEXT,
    "isAudioTrending" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "postedAt" TIMESTAMP(3),
    "viralScore" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendingReel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendingAnalysis" (
    "id" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "tldr" TEXT NOT NULL,
    "whyItWentViral" TEXT NOT NULL,
    "hookAnalysis" TEXT NOT NULL,
    "retentionDevice" TEXT NOT NULL,
    "sendTrigger" TEXT NOT NULL,
    "saveTrigger" TEXT NOT NULL,
    "audioStrategy" TEXT NOT NULL,
    "captionStrategy" TEXT NOT NULL,
    "formatBreakdown" JSONB NOT NULL,
    "emotionTriggers" TEXT[],
    "replicationPrompt" TEXT NOT NULL,
    "adaptationTips" TEXT[],
    "nicheFitCategories" TEXT[],
    "viralWindow" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendingAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPostAnalysis" (
    "id" TEXT NOT NULL,
    "instagramUrl" TEXT NOT NULL,
    "instagramId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[],
    "audioName" TEXT,
    "views" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "hookScore" INTEGER NOT NULL,
    "captionScore" INTEGER NOT NULL,
    "audioScore" INTEGER NOT NULL,
    "formatScore" INTEGER NOT NULL,
    "engagementScore" INTEGER NOT NULL,
    "likeRate" DOUBLE PRECISION NOT NULL,
    "commentRate" DOUBLE PRECISION NOT NULL,
    "benchmarkLikeRate" DOUBLE PRECISION NOT NULL,
    "benchmarkCommentRate" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL,
    "whatWentWrong" TEXT[],
    "quickFixes" TEXT[],
    "hookFeedback" TEXT NOT NULL,
    "captionFeedback" TEXT NOT NULL,
    "audioFeedback" TEXT NOT NULL,
    "formatFeedback" TEXT NOT NULL,
    "rewrittenCaption" TEXT NOT NULL,
    "improvedPrompt" TEXT NOT NULL,
    "potentialWithFixes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPostAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "reelsFound" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "ScraperRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrendingReel_instagramId_key" ON "TrendingReel"("instagramId");

-- CreateIndex
CREATE UNIQUE INDEX "TrendingAnalysis_reelId_key" ON "TrendingAnalysis"("reelId");

-- AddForeignKey
ALTER TABLE "TrendingAnalysis" ADD CONSTRAINT "TrendingAnalysis_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "TrendingReel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
