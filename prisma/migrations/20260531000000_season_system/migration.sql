CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonPlayerSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "seasonName" TEXT NOT NULL,
    "ladderTier" TEXT,
    "ladderScore" INTEGER,
    "ladderHighestTier" TEXT,
    "ladderGamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "ladderTotalWins" INTEGER NOT NULL DEFAULT 0,
    "ladderTotalLosses" INTEGER NOT NULL DEFAULT 0,
    "dogKingRank" INTEGER,
    "apexRank" INTEGER,
    "apexDogType" TEXT,
    "apexWins" INTEGER,
    "apexLosses" INTEGER,
    "apexRound" INTEGER,
    "apexChallengeWins" INTEGER,
    "apexSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonPlayerSummary_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Season" ("id", "name", "status", "startedAt", "updatedAt")
VALUES ('season-1', '赛季 1', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Run" ADD COLUMN "seasonId" TEXT NOT NULL DEFAULT 'season-1';
ALTER TABLE "GhostSnapshot" ADD COLUMN "seasonId" TEXT NOT NULL DEFAULT 'season-1';
ALTER TABLE "ApexEntry" ADD COLUMN "seasonId" TEXT NOT NULL DEFAULT 'season-1';

DROP INDEX IF EXISTS "ApexEntry_sourceRunId_boardType_key";
DROP INDEX IF EXISTS "ApexEntry_boardType_boardKey_rank_key";
DROP INDEX IF EXISTS "ApexEntry_boardType_boardKey_rank_idx";

CREATE INDEX "Season_status_idx" ON "Season"("status");
CREATE UNIQUE INDEX "SeasonPlayerSummary_userId_seasonId_key" ON "SeasonPlayerSummary"("userId", "seasonId");
CREATE INDEX "SeasonPlayerSummary_seasonId_apexRank_idx" ON "SeasonPlayerSummary"("seasonId", "apexRank");
CREATE INDEX "SeasonPlayerSummary_userId_createdAt_idx" ON "SeasonPlayerSummary"("userId", "createdAt");
CREATE UNIQUE INDEX "ApexEntry_seasonId_sourceRunId_boardType_key" ON "ApexEntry"("seasonId", "sourceRunId", "boardType");
CREATE UNIQUE INDEX "ApexEntry_seasonId_boardType_boardKey_rank_key" ON "ApexEntry"("seasonId", "boardType", "boardKey", "rank");
CREATE INDEX "ApexEntry_seasonId_boardType_boardKey_rank_idx" ON "ApexEntry"("seasonId", "boardType", "boardKey", "rank");

ALTER TABLE "SeasonPlayerSummary" ADD CONSTRAINT "SeasonPlayerSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonPlayerSummary" ADD CONSTRAINT "SeasonPlayerSummary_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
