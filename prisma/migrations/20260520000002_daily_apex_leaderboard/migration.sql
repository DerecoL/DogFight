ALTER TABLE "ApexEntry" ADD COLUMN "boardType" TEXT NOT NULL DEFAULT 'OVERALL';
ALTER TABLE "ApexEntry" ADD COLUMN "boardKey" TEXT NOT NULL DEFAULT 'default';

DROP INDEX "ApexEntry_sourceRunId_key";
DROP INDEX "ApexEntry_rank_key";
DROP INDEX "ApexEntry_rank_idx";

CREATE UNIQUE INDEX "ApexEntry_sourceRunId_boardType_key" ON "ApexEntry"("sourceRunId", "boardType");
CREATE UNIQUE INDEX "ApexEntry_boardType_boardKey_rank_key" ON "ApexEntry"("boardType", "boardKey", "rank");
CREATE INDEX "ApexEntry_boardType_boardKey_rank_idx" ON "ApexEntry"("boardType", "boardKey", "rank");
