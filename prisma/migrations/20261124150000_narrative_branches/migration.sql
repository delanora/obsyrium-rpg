-- Pertencimento é próprio da representação no quadro. Registros antigos ficam independentes.
ALTER TABLE "narrative_placements" ADD COLUMN "parentPlacementId" TEXT;
CREATE UNIQUE INDEX "narrative_placements_boardId_id_key" ON "narrative_placements"("boardId", "id");
CREATE INDEX "narrative_placements_boardId_parentPlacementId_idx" ON "narrative_placements"("boardId", "parentPlacementId");
ALTER TABLE "narrative_placements" ADD CONSTRAINT "narrative_placements_boardId_parentPlacementId_fkey"
  FOREIGN KEY ("boardId", "parentPlacementId") REFERENCES "narrative_placements"("boardId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "narrative_placements" ADD CONSTRAINT "narrative_placements_not_own_parent"
  CHECK ("parentPlacementId" IS DISTINCT FROM "id");
