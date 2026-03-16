-- Migration: multi_event
-- Aggiunge supporto multi-festa: tabella Event, UserEventAccess, eventId su tutte le tabelle
-- Nota: Expense non era in nessuna migration precedente (era stata aggiunta con db push),
--       quindi viene creata qui con IF NOT EXISTS prima di essere ricreata con eventId.

PRAGMA foreign_keys=OFF;

-- ===================== 1. CREA TABELLA Event =====================

CREATE TABLE IF NOT EXISTS "Event" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "name"          TEXT NOT NULL,
    "date"          DATETIME,
    "googleSheetId" TEXT,
    "modules"       TEXT NOT NULL DEFAULT '[]',
    "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inserisce la festa di default solo se non esiste già
INSERT OR IGNORE INTO "Event" ("id", "name", "modules", "status", "createdAt", "updatedAt")
VALUES (
    'cm0default0festa8novembre000',
    'Festa 8 Novembre',
    '["tshirts","expenses","shuttles"]',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ===================== 2. CREA TABELLA UserEventAccess =====================

CREATE TABLE IF NOT EXISTS "UserEventAccess" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "userId"    TEXT NOT NULL,
    "eventId"   TEXT NOT NULL,
    "role"      TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserEventAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserEventAccess_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserEventAccess_userId_eventId_key" ON "UserEventAccess"("userId", "eventId");

-- Crea accesso alla festa di default per tutti gli utenti non-ADMIN esistenti (se non già presenti)
INSERT OR IGNORE INTO "UserEventAccess" ("id", "userId", "eventId", "role", "createdAt")
SELECT
    'uea_' || "id",
    "id",
    'cm0default0festa8novembre000',
    "role",
    CURRENT_TIMESTAMP
FROM "User"
WHERE "role" != 'ADMIN';

-- ===================== 3. RICREA Invitee con eventId =====================

CREATE TABLE "Invitee_new" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "eventId"     TEXT NOT NULL DEFAULT 'cm0default0festa8novembre000',
    "firstName"   TEXT NOT NULL,
    "lastName"    TEXT NOT NULL,
    "listType"    TEXT NOT NULL DEFAULT 'PAGANTE',
    "paymentType" TEXT,
    "hasEntered"  BOOLEAN NOT NULL DEFAULT 0,
    "checkedInAt" DATETIME,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "Invitee_new" ("id", "eventId", "firstName", "lastName", "listType", "paymentType", "hasEntered", "checkedInAt", "createdAt", "updatedAt")
SELECT "id", 'cm0default0festa8novembre000', "firstName", "lastName", "listType", "paymentType", "hasEntered", "checkedInAt", "createdAt", "updatedAt"
FROM "Invitee";

DROP TABLE "Invitee";
ALTER TABLE "Invitee_new" RENAME TO "Invitee";

CREATE INDEX "Invitee_eventId_lastName_firstName_idx" ON "Invitee"("eventId", "lastName", "firstName");

-- ===================== 4. RICREA CheckInLog con eventId =====================

CREATE TABLE "CheckInLog_new" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "outcome"   TEXT NOT NULL,
    "message"   TEXT,
    "inviteeId" TEXT,
    "userId"    TEXT,
    "eventId"   TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckInLog_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "Invitee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CheckInLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CheckInLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "CheckInLog_new" ("id", "outcome", "message", "inviteeId", "userId", "eventId", "createdAt")
SELECT "id", "outcome", "message", "inviteeId", "userId", 'cm0default0festa8novembre000', "createdAt"
FROM "CheckInLog";

DROP TABLE "CheckInLog";
ALTER TABLE "CheckInLog_new" RENAME TO "CheckInLog";

CREATE INDEX "CheckInLog_userId_idx" ON "CheckInLog"("userId");

-- ===================== 5. RICREA Tshirt con eventId =====================

-- Crea la tabella Tshirt nel caso non esista (potrebbe mancare su db nuovi incompleti)
CREATE TABLE IF NOT EXISTS "Tshirt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hasReceived" BOOLEAN NOT NULL DEFAULT 0,
    "receivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Tshirt_new" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "eventId"     TEXT NOT NULL DEFAULT 'cm0default0festa8novembre000',
    "firstName"   TEXT NOT NULL,
    "lastName"    TEXT NOT NULL,
    "size"        TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "hasReceived" BOOLEAN NOT NULL DEFAULT 0,
    "receivedAt"  DATETIME,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tshirt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "Tshirt_new" ("id", "eventId", "firstName", "lastName", "size", "type", "hasReceived", "receivedAt", "createdAt", "updatedAt")
SELECT "id", 'cm0default0festa8novembre000', "firstName", "lastName", "size", "type", "hasReceived", "receivedAt", "createdAt", "updatedAt"
FROM "Tshirt";

DROP TABLE "Tshirt";
ALTER TABLE "Tshirt_new" RENAME TO "Tshirt";

CREATE INDEX "Tshirt_eventId_lastName_firstName_idx" ON "Tshirt"("eventId", "lastName", "firstName");
CREATE INDEX "Tshirt_type_idx" ON "Tshirt"("type");
CREATE INDEX "Tshirt_hasReceived_idx" ON "Tshirt"("hasReceived");

-- ===================== 6. CREA E RICREA Expense con eventId =====================

-- Crea Expense se non esiste (mancava dalle migration precedenti)
CREATE TABLE IF NOT EXISTS "Expense" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "description"   TEXT NOT NULL,
    "amount"        REAL NOT NULL,
    "category"      TEXT NOT NULL DEFAULT 'ALTRO',
    "paymentMethod" TEXT NOT NULL,
    "date"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"         TEXT,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Expense_new" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "eventId"       TEXT NOT NULL DEFAULT 'cm0default0festa8novembre000',
    "description"   TEXT NOT NULL,
    "amount"        REAL NOT NULL,
    "category"      TEXT NOT NULL DEFAULT 'ALTRO',
    "paymentMethod" TEXT NOT NULL,
    "date"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"         TEXT,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "Expense_new" ("id", "eventId", "description", "amount", "category", "paymentMethod", "date", "notes", "createdAt", "updatedAt")
SELECT "id", 'cm0default0festa8novembre000', "description", "amount", "category", "paymentMethod", "date", "notes", "createdAt", "updatedAt"
FROM "Expense";

DROP TABLE "Expense";
ALTER TABLE "Expense_new" RENAME TO "Expense";

CREATE INDEX "Expense_eventId_date_idx" ON "Expense"("eventId", "date");
CREATE INDEX "Expense_category_idx" ON "Expense"("category");
CREATE INDEX "Expense_paymentMethod_idx" ON "Expense"("paymentMethod");

-- ===================== 7. RICREA ShuttleMachine con eventId =====================

CREATE TABLE IF NOT EXISTS "ShuttleMachine" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "name"      TEXT NOT NULL,
    "color"     TEXT,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ShuttleMachine_new" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "eventId"   TEXT NOT NULL DEFAULT 'cm0default0festa8novembre000',
    "name"      TEXT NOT NULL,
    "color"     TEXT,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShuttleMachine_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "ShuttleMachine_new" ("id", "eventId", "name", "color", "active", "createdAt", "updatedAt")
SELECT "id", 'cm0default0festa8novembre000', "name", "color", "active", "createdAt", "updatedAt"
FROM "ShuttleMachine";

DROP TABLE "ShuttleMachine";
ALTER TABLE "ShuttleMachine_new" RENAME TO "ShuttleMachine";

CREATE UNIQUE INDEX "ShuttleMachine_name_eventId_key" ON "ShuttleMachine"("name", "eventId");

-- ===================== 8. RICREA ShuttleSlot con eventId =====================

CREATE TABLE IF NOT EXISTS "ShuttleSlot" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "direction" TEXT NOT NULL,
    "time"      TEXT NOT NULL,
    "capacity"  INTEGER NOT NULL DEFAULT 12,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ShuttleSlot_new" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "eventId"   TEXT NOT NULL DEFAULT 'cm0default0festa8novembre000',
    "direction" TEXT NOT NULL,
    "time"      TEXT NOT NULL,
    "capacity"  INTEGER NOT NULL DEFAULT 12,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShuttleSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "ShuttleSlot_new" ("id", "eventId", "direction", "time", "capacity", "createdAt", "updatedAt")
SELECT "id", 'cm0default0festa8novembre000', "direction", "time", "capacity", "createdAt", "updatedAt"
FROM "ShuttleSlot";

DROP TABLE "ShuttleSlot";
ALTER TABLE "ShuttleSlot_new" RENAME TO "ShuttleSlot";

CREATE UNIQUE INDEX "ShuttleSlot_direction_time_eventId_key" ON "ShuttleSlot"("direction", "time", "eventId");

-- ===================== 9. RICREA ShuttleAssignment (FK aggiornate) =====================

CREATE TABLE "ShuttleAssignment_new" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "slotId"     TEXT NOT NULL,
    "machineId"  TEXT NOT NULL,
    "inviteeId"  TEXT,
    "fullName"   TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'PENDING',
    "markedById" TEXT,
    "markedAt"   DATETIME,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShuttleAssignment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ShuttleSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShuttleAssignment_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "ShuttleMachine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShuttleAssignment_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "Invitee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ShuttleAssignment_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "ShuttleAssignment_new" ("id", "slotId", "machineId", "inviteeId", "fullName", "status", "markedById", "markedAt", "createdAt", "updatedAt")
SELECT "id", "slotId", "machineId", "inviteeId", "fullName", "status", "markedById", "markedAt", "createdAt", "updatedAt"
FROM "ShuttleAssignment";

DROP TABLE "ShuttleAssignment";
ALTER TABLE "ShuttleAssignment_new" RENAME TO "ShuttleAssignment";

CREATE INDEX "ShuttleAssignment_slotId_machineId_idx" ON "ShuttleAssignment"("slotId", "machineId");
CREATE INDEX "ShuttleAssignment_inviteeId_idx" ON "ShuttleAssignment"("inviteeId");

PRAGMA foreign_keys=ON;
