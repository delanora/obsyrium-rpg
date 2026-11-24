-- Preferências novas são opcionais, nenhuma posição ou conteúdo existente muda.
ALTER TABLE narrative_placements ADD COLUMN "branchOffsetX" DOUBLE PRECISION,
ADD COLUMN "branchOffsetY" DOUBLE PRECISION;
ALTER TABLE narrative_placements ADD CONSTRAINT narrative_relative_pair CHECK (
  ("branchOffsetX" IS NULL AND "branchOffsetY" IS NULL) OR
  ("parentPlacementId" IS NOT NULL AND "branchOffsetX" IS NOT NULL AND "branchOffsetY" IS NOT NULL
   AND "branchOffsetX" BETWEEN -2002000 AND 2002000
   AND "branchOffsetY" BETWEEN -2002000 AND 2002000)
);
