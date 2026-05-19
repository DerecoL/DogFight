-- CreateTable
CREATE TABLE "DogfightRoom" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "maxPlayers" INTEGER NOT NULL DEFAULT 8,
    "readyDeadline" TIMESTAMP(3),
    "winnerParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DogfightRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DogfightParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "eliminated" BOOLEAN NOT NULL DEFAULT false,
    "eliminatedRound" INTEGER,
    "placement" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DogfightParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DogfightBattle" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "participantAId" TEXT NOT NULL,
    "participantBId" TEXT,
    "opponentKind" TEXT NOT NULL,
    "winnerSide" TEXT NOT NULL,
    "winnerParticipantId" TEXT,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DogfightBattle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DogfightRoom_status_idx" ON "DogfightRoom"("status");

-- CreateIndex
CREATE INDEX "DogfightRoom_hostUserId_idx" ON "DogfightRoom"("hostUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DogfightParticipant_runId_key" ON "DogfightParticipant"("runId");

-- CreateIndex
CREATE INDEX "DogfightParticipant_roomId_idx" ON "DogfightParticipant"("roomId");

-- CreateIndex
CREATE INDEX "DogfightParticipant_userId_idx" ON "DogfightParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DogfightParticipant_roomId_userId_key" ON "DogfightParticipant"("roomId", "userId");

-- CreateIndex
CREATE INDEX "DogfightBattle_roomId_round_idx" ON "DogfightBattle"("roomId", "round");

-- CreateIndex
CREATE INDEX "DogfightBattle_participantAId_idx" ON "DogfightBattle"("participantAId");

-- CreateIndex
CREATE INDEX "DogfightBattle_participantBId_idx" ON "DogfightBattle"("participantBId");

-- AddForeignKey
ALTER TABLE "DogfightParticipant" ADD CONSTRAINT "DogfightParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "DogfightRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogfightParticipant" ADD CONSTRAINT "DogfightParticipant_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogfightBattle" ADD CONSTRAINT "DogfightBattle_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "DogfightRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
