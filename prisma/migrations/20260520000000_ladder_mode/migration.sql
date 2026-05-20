ALTER TABLE "Run" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'CASUAL';

ALTER TABLE "GhostSnapshot" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'CASUAL';
CREATE INDEX "GhostSnapshot_mode_round_wins_losses_idx" ON "GhostSnapshot"("mode", "round", "wins", "losses");

CREATE TABLE "LadderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'BRONZE',
    "score" INTEGER NOT NULL DEFAULT 0,
    "highestTier" TEXT NOT NULL DEFAULT 'BRONZE',
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalLosses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LadderProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LadderSettlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "beforeTier" TEXT NOT NULL,
    "beforeScore" INTEGER NOT NULL,
    "afterTier" TEXT NOT NULL,
    "afterScore" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "rawDelta" INTEGER NOT NULL,
    "baseScore" INTEGER NOT NULL,
    "tierTax" INTEGER NOT NULL,
    "lossPenalty" INTEGER NOT NULL,
    "perfectBonus" INTEGER NOT NULL,
    "newbieProtection" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LadderSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LadderProfile_userId_seasonId_key" ON "LadderProfile"("userId", "seasonId");
CREATE INDEX "LadderProfile_seasonId_tier_score_idx" ON "LadderProfile"("seasonId", "tier", "score");
CREATE UNIQUE INDEX "LadderSettlement_runId_key" ON "LadderSettlement"("runId");
CREATE INDEX "LadderSettlement_seasonId_afterTier_afterScore_idx" ON "LadderSettlement"("seasonId", "afterTier", "afterScore");
CREATE INDEX "LadderSettlement_userId_seasonId_idx" ON "LadderSettlement"("userId", "seasonId");

ALTER TABLE "LadderProfile" ADD CONSTRAINT "LadderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LadderSettlement" ADD CONSTRAINT "LadderSettlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LadderSettlement" ADD CONSTRAINT "LadderSettlement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LadderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LadderSettlement" ADD CONSTRAINT "LadderSettlement_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
