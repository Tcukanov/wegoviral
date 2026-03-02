-- AlterTable
ALTER TABLE "UserPostAnalysis" ADD COLUMN     "nicheComparison" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "optimizedProbability" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "probabilityBoosts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "viralProbability" DOUBLE PRECISION NOT NULL DEFAULT 0;
