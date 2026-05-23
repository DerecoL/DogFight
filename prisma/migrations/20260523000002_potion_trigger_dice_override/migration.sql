ALTER TABLE "Run" ADD COLUMN "potionChoices" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "ItemInstance" ADD COLUMN "triggerDiceOverride" TEXT;
