-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "narrative_boards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narrative_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "narrative_cards" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narrative_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "narrative_placements" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 280,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "zIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "narrative_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "narrative_links" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "directed" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL DEFAULT '',
    "signature" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narrative_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "narrative_operations" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "narrative_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "narrative_placements_cardId_idx" ON "narrative_placements"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "narrative_placements_boardId_cardId_key" ON "narrative_placements"("boardId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "narrative_links_signature_key" ON "narrative_links"("signature");

-- CreateIndex
CREATE INDEX "narrative_links_sourceId_idx" ON "narrative_links"("sourceId");

-- CreateIndex
CREATE INDEX "narrative_links_targetId_idx" ON "narrative_links"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "narrative_operations_actorId_operationId_key" ON "narrative_operations"("actorId", "operationId");

-- AddForeignKey
ALTER TABLE "narrative_placements" ADD CONSTRAINT "narrative_placements_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "narrative_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narrative_placements" ADD CONSTRAINT "narrative_placements_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "narrative_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narrative_links" ADD CONSTRAINT "narrative_links_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "narrative_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "narrative_links" ADD CONSTRAINT "narrative_links_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "narrative_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
