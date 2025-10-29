-- Add active flag to User table
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT 1;

