-- CreateTable
CREATE TABLE "Invitee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "token" TEXT NOT NULL,
    "qrFilename" TEXT NOT NULL,
    "qrMimeType" TEXT NOT NULL DEFAULT 'image/png',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "checkInCount" INTEGER NOT NULL DEFAULT 0,
    "checkedInAt" DATETIME,
    "lastSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CheckInLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "message" TEXT,
    "inviteeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckInLog_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "Invitee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventName" TEXT NOT NULL DEFAULT 'Ingresso Festa',
    "eventStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitee_email_key" ON "Invitee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invitee_token_key" ON "Invitee"("token");

-- CreateIndex
CREATE INDEX "Invitee_lastName_firstName_idx" ON "Invitee"("lastName", "firstName");
