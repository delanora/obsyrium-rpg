CREATE TABLE "combat_test_requests" (
  "id" TEXT NOT NULL, "combatId" TEXT NOT NULL, "combatantId" TEXT NOT NULL,
  "kind" TEXT NOT NULL, "key" TEXT NOT NULL, "dc" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending', "version" INTEGER NOT NULL DEFAULT 0,
  "resolutionFingerprint" TEXT, "result" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "combat_test_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "combat_test_requests_combatId_fkey" FOREIGN KEY ("combatId") REFERENCES "combats"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "combat_test_requests_combatantId_fkey" FOREIGN KEY ("combatantId") REFERENCES "combatants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "combat_test_requests_combatId_status_idx" ON "combat_test_requests"("combatId", "status");
