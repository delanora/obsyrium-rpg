-- Apenas domínio narrativo. Não altera nulabilidades ou WIPs de geografia/log.
CREATE TABLE "narrative_groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "narrative_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "narrative_groups_name_check" CHECK (char_length("name") BETWEEN 1 AND 80 AND "name" ~ '[^[:space:]]'),
  CONSTRAINT "narrative_groups_description_check" CHECK (char_length("description") <= 500),
  CONSTRAINT "narrative_groups_color_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT "narrative_groups_version_check" CHECK ("version" >= 0)
);
CREATE UNIQUE INDEX "narrative_groups_nameKey_key" ON "narrative_groups"("nameKey");
CREATE TABLE "narrative_card_groups" (
  "cardId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "narrative_card_groups_pkey" PRIMARY KEY ("cardId", "groupId"),
  CONSTRAINT "narrative_card_groups_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "narrative_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "narrative_card_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "narrative_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "narrative_card_groups_groupId_idx" ON "narrative_card_groups"("groupId");
