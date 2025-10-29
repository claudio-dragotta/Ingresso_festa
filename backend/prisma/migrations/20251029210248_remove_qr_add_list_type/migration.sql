-- CreateEnum for ListType
CREATE TABLE "new_ListType" (
    "value" TEXT NOT NULL PRIMARY KEY
);
INSERT INTO "new_ListType" ("value") VALUES ('PAGANTE'), ('GREEN');

-- CreateEnum for UserRole
CREATE TABLE "new_UserRole" (
    "value" TEXT NOT NULL PRIMARY KEY
);
INSERT INTO "new_UserRole" ("value") VALUES ('ADMIN'), ('ENTRANCE');

-- CreateTable User
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ENTRANCE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AlterTable Invitee: create new table with new schema
CREATE TABLE "new_Invitee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "listType" TEXT NOT NULL DEFAULT 'PAGANTE',
    "paymentType" TEXT,
    "hasEntered" BOOLEAN NOT NULL DEFAULT 0,
    "checkedInAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Copy data from old Invitee to new Invitee
INSERT INTO "new_Invitee" ("id", "firstName", "lastName", "email", "phone", "paymentType", "checkedInAt", "createdAt", "updatedAt", "listType", "hasEntered")
SELECT "id", "firstName", "lastName", "email", "phone", "paymentType", "checkedInAt", "createdAt", "updatedAt",
       'PAGANTE' as "listType",
       CASE WHEN "status" = 'CHECKED_IN' THEN 1 ELSE 0 END as "hasEntered"
FROM "Invitee";

-- Drop old Invitee table
DROP TABLE "Invitee";

-- Rename new table to Invitee
ALTER TABLE "new_Invitee" RENAME TO "Invitee";

-- CreateIndex
CREATE UNIQUE INDEX "Invitee_email_key" ON "Invitee"("email");
CREATE INDEX "Invitee_lastName_firstName_idx" ON "Invitee"("lastName", "firstName");

-- AlterTable CheckInLog: remove token column
CREATE TABLE "new_CheckInLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outcome" TEXT NOT NULL,
    "message" TEXT,
    "inviteeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckInLog_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "Invitee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Copy data from old CheckInLog to new CheckInLog
INSERT INTO "new_CheckInLog" ("id", "outcome", "message", "inviteeId", "createdAt")
SELECT "id", "outcome", "message", "inviteeId", "createdAt"
FROM "CheckInLog";

-- Drop old CheckInLog table
DROP TABLE "CheckInLog";

-- Rename new table to CheckInLog
ALTER TABLE "new_CheckInLog" RENAME TO "CheckInLog";
