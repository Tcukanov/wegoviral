-- AlterTable
ALTER TABLE "TrendingReel" ADD COLUMN     "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "peakVelocity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'creator',
ADD COLUMN     "velocityPerHour" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReelSnapshot" (
    "id" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReelSnapshot_reelId_capturedAt_idx" ON "ReelSnapshot"("reelId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "TrendingReel_viralScore_idx" ON "TrendingReel"("viralScore" DESC);

-- CreateIndex
CREATE INDEX "TrendingReel_category_viralScore_idx" ON "TrendingReel"("category", "viralScore" DESC);

-- CreateIndex
CREATE INDEX "TrendingReel_source_idx" ON "TrendingReel"("source");

-- AddForeignKey
ALTER TABLE "ReelSnapshot" ADD CONSTRAINT "ReelSnapshot_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "TrendingReel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
