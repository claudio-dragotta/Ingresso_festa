-- Minimal migration to add Shuttle tables and indexes (SQLite)
PRAGMA foreign_keys=ON;

-- Shuttle machines
CREATE TABLE IF NOT EXISTS "ShuttleMachine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShuttleMachine_name_key" ON "ShuttleMachine"("name");

-- Shuttle slots (time windows)
CREATE TABLE IF NOT EXISTS "ShuttleSlot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "direction" TEXT NOT NULL,
  "time" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 12,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShuttleSlot_direction_time_key" ON "ShuttleSlot"("direction", "time");

-- Assignments
CREATE TABLE IF NOT EXISTS "ShuttleAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slotId" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "inviteeId" TEXT,
  "fullName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "markedById" TEXT,
  "markedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ShuttleAssignment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ShuttleSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShuttleAssignment_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "ShuttleMachine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShuttleAssignment_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "Invitee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ShuttleAssignment_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ShuttleAssignment_slotId_machineId_idx" ON "ShuttleAssignment"("slotId", "machineId");
CREATE INDEX IF NOT EXISTS "ShuttleAssignment_inviteeId_idx" ON "ShuttleAssignment"("inviteeId");
