CREATE TABLE "ApexEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sourceRunId" TEXT,
    "name" TEXT NOT NULL,
    "dogType" TEXT NOT NULL,
    "luckyNumber" INTEGER,
    "round" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "items" TEXT NOT NULL,
    "relics" TEXT NOT NULL DEFAULT '[]',
    "rank" INTEGER NOT NULL,
    "challengeWins" INTEGER NOT NULL DEFAULT 0,
    "isSeed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApexEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApexEntry_sourceRunId_key" ON "ApexEntry"("sourceRunId");
CREATE UNIQUE INDEX "ApexEntry_rank_key" ON "ApexEntry"("rank");
CREATE INDEX "ApexEntry_userId_idx" ON "ApexEntry"("userId");
CREATE INDEX "ApexEntry_rank_idx" ON "ApexEntry"("rank");
