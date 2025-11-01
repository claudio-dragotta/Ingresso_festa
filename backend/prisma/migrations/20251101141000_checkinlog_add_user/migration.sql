-- Redefine table CheckInLog to add userId and FK to User
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CheckInLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "outcome" TEXT NOT NULL,
  "message" TEXT,
  "inviteeId" TEXT,
  "userId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckInLog_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "Invitee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CheckInLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Copy existing data
INSERT INTO "new_CheckInLog" ("id", "outcome", "message", "inviteeId", "createdAt")
SELECT "id", "outcome", "message", "inviteeId", "createdAt" FROM "CheckInLog";

DROP TABLE "CheckInLog";
ALTER TABLE "new_CheckInLog" RENAME TO "CheckInLog";

-- Index to query by user
CREATE INDEX "CheckInLog_userId_idx" ON "CheckInLog"("userId");

PRAGMA foreign_keys=ON;

