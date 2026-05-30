CREATE TABLE "AccountWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "dailyEarned" INTEGER NOT NULL DEFAULT 0,
    "dailyKey" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurrencyLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "refId" TEXT,
    "dailyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AchievementProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyTaskSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "refreshUsed" BOOLEAN NOT NULL DEFAULT false,
    "tasks" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTaskSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CosmeticInventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CosmeticInventory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CosmeticEquip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CosmeticEquip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopCatalogOverride" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "listed" BOOLEAN NOT NULL DEFAULT true,
    "price" INTEGER,
    "section" TEXT,
    "limitPerUser" INTEGER,
    "rotationKey" TEXT,
    "sku" TEXT,
    "purchaseType" TEXT,
    "source" TEXT NOT NULL DEFAULT 'DB_OVERRIDE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCatalogOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountWallet_userId_key" ON "AccountWallet"("userId");
CREATE INDEX "CurrencyLedger_userId_createdAt_idx" ON "CurrencyLedger"("userId", "createdAt");
CREATE INDEX "CurrencyLedger_userId_dailyKey_idx" ON "CurrencyLedger"("userId", "dailyKey");
CREATE UNIQUE INDEX "AchievementProgress_userId_achievementId_key" ON "AchievementProgress"("userId", "achievementId");
CREATE INDEX "AchievementProgress_userId_completedAt_claimedAt_idx" ON "AchievementProgress"("userId", "completedAt", "claimedAt");
CREATE UNIQUE INDEX "DailyTaskSet_userId_dateKey_key" ON "DailyTaskSet"("userId", "dateKey");
CREATE UNIQUE INDEX "CosmeticInventory_userId_catalogItemId_key" ON "CosmeticInventory"("userId", "catalogItemId");
CREATE INDEX "CosmeticInventory_userId_idx" ON "CosmeticInventory"("userId");
CREATE UNIQUE INDEX "CosmeticEquip_userId_slot_key" ON "CosmeticEquip"("userId", "slot");
CREATE UNIQUE INDEX "ShopCatalogOverride_catalogItemId_key" ON "ShopCatalogOverride"("catalogItemId");

ALTER TABLE "AccountWallet" ADD CONSTRAINT "AccountWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurrencyLedger" ADD CONSTRAINT "CurrencyLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AchievementProgress" ADD CONSTRAINT "AchievementProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyTaskSet" ADD CONSTRAINT "DailyTaskSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CosmeticInventory" ADD CONSTRAINT "CosmeticInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CosmeticEquip" ADD CONSTRAINT "CosmeticEquip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
