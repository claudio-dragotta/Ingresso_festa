-- AddColumn email to Invitee
ALTER TABLE "Invitee" ADD COLUMN "email" TEXT;

-- AddColumn qrToken to Invitee (unique)
ALTER TABLE "Invitee" ADD COLUMN "qrToken" TEXT;

-- AddColumn qrSentAt to Invitee
ALTER TABLE "Invitee" ADD COLUMN "qrSentAt" DATETIME;

-- CreateIndex for qrToken uniqueness
CREATE UNIQUE INDEX "Invitee_qrToken_key" ON "Invitee"("qrToken");
