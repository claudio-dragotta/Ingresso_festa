-- CreateTable Tshirt
CREATE TABLE "Tshirt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hasReceived" BOOLEAN NOT NULL DEFAULT 0,
    "receivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Indexes for Tshirt
CREATE INDEX "Tshirt_lastName_firstName_idx" ON "Tshirt"("lastName", "firstName");
CREATE INDEX "Tshirt_type_idx" ON "Tshirt"("type");
CREATE INDEX "Tshirt_hasReceived_idx" ON "Tshirt"("hasReceived");

