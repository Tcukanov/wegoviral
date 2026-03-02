-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "igUsername" TEXT NOT NULL,
    "igName" TEXT,
    "igBio" TEXT,
    "igFollowers" INTEGER NOT NULL DEFAULT 0,
    "igFollowing" INTEGER NOT NULL DEFAULT 0,
    "igMediaCount" INTEGER NOT NULL DEFAULT 0,
    "igProfilePic" TEXT,
    "pageAccessToken" TEXT NOT NULL,
    "userAccessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_sessionId_key" ON "ConnectedAccount"("sessionId");

-- CreateIndex
CREATE INDEX "ConnectedAccount_sessionId_idx" ON "ConnectedAccount"("sessionId");
