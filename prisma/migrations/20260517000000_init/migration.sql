CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dogType" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "round" INTEGER NOT NULL DEFAULT 0,
    "luckyNumber" INTEGER,
    "gold" INTEGER NOT NULL DEFAULT 5,
    "phase" TEXT NOT NULL DEFAULT 'SHOP',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "shopType" TEXT NOT NULL DEFAULT 'GENERAL',
    "shopItems" TEXT NOT NULL DEFAULT '[]',
    "choices" TEXT NOT NULL DEFAULT '[]',
    "refreshCost" INTEGER NOT NULL DEFAULT 1,
    "matchedGhost" TEXT,
    "lastBattle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItemInstance" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "defId" TEXT NOT NULL,
    "quality" TEXT NOT NULL DEFAULT 'BRONZE',
    "area" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemInstance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GhostSnapshot" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "dogType" TEXT NOT NULL,
    "luckyNumber" INTEGER,
    "round" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "gold" INTEGER NOT NULL,
    "items" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GhostSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BattleLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ghostId" TEXT,
    "result" TEXT NOT NULL,
    "log" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE INDEX "GhostSnapshot_round_wins_losses_idx" ON "GhostSnapshot"("round", "wins", "losses");

ALTER TABLE "Run" ADD CONSTRAINT "Run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ItemInstance" ADD CONSTRAINT "ItemInstance_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BattleLog" ADD CONSTRAINT "BattleLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
