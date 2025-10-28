import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { logger } from "../logger";
import { generateToken, verifyTokenSignature } from "./tokenService";
import { generateQrCode, QrGenerationResult, readQrFile } from "./qrService";
import { sendQrEmail } from "./emailService";
import { writeToGoogleSheet } from "./googleSheetsService";
import { config } from "../config";

export interface InviteeInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  paymentType?: string; // bonifico, paypal, contanti, p2p
}

export interface InviteeWithQr {
  invitee: Prisma.InviteeGetPayload<{
    include: {
      checkInLogs: false;
    };
  }>;
  qr: QrGenerationResult;
}

const normalize = (value: string) => value.trim();

const buildFullName = (firstName: string, lastName: string) =>
  `${normalize(firstName)} ${normalize(lastName)}`.trim();

export const createInvitee = async (input: InviteeInput): Promise<InviteeWithQr> => {
  // Controllo duplicati PRIMA di creare
  const allInvitees = await prisma.invitee.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  const existing = allInvitees.find(
    (inv) =>
      inv.firstName.toLowerCase() === normalize(input.firstName).toLowerCase() &&
      inv.lastName.toLowerCase() === normalize(input.lastName).toLowerCase()
  );

  if (existing) {
    throw new AppError(
      `Invitato già presente: ${normalize(input.lastName)} ${normalize(input.firstName)}`,
      409 // Conflict
    );
  }

  const token = generateToken();
  const fullName = buildFullName(input.firstName, input.lastName);
  const qr = await generateQrCode({ fullName, token });

  const invitee = await prisma.invitee.create({
    data: {
      firstName: normalize(input.firstName),
      lastName: normalize(input.lastName),
      email: input.email?.trim().toLowerCase(),
      phone: input.phone?.trim(),
      paymentType: input.paymentType?.trim().toLowerCase(),
      token,
      qrFilename: qr.filename,
      qrMimeType: qr.mimeType,
    },
  });

  // Sincronizzazione bidirezionale: scrivi su Google Sheets
  try {
    await writeToGoogleSheet(fullName, input.paymentType);
    logger.info(`Invitato sincronizzato su Google Sheets: ${fullName}`);
  } catch (error: any) {
    // Non bloccare la creazione se Google Sheets fallisce, solo logga
    logger.error(`Errore sincronizzazione Google Sheets: ${error.message}`);
  }

  return { invitee, qr };
};

export const createInviteesBulk = async (inputs: InviteeInput[]) => {
  const results: InviteeWithQr[] = [];
  for (const input of inputs) {
    const existing = await prisma.invitee.findFirst({
      where: {
        firstName: normalize(input.firstName),
        lastName: normalize(input.lastName),
      },
    });

    if (existing) {
      logger.warn("Invitee already exists, skipping", { inviteeId: existing.id });
      continue;
    }

    const created = await createInvitee(input);
    results.push(created);
  }

  return results;
};

export const listInvitees = async () => {
  const invitees = await prisma.invitee.findMany({
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });
  return invitees;
};

export const getInviteeByToken = async (token: string) => {
  const invitee = await prisma.invitee.findUnique({ where: { token } });
  return invitee;
};

export const markCheckIn = async (token: string) => {
  if (!verifyTokenSignature(token)) {
    await prisma.checkInLog.create({
      data: {
        token,
        outcome: "INVALID",
        message: "Firma token non valida",
      },
    });
    throw new AppError("Codice non valido", 400);
  }

  const systemConfig = await prisma.systemConfig.findFirst();
  if (!systemConfig || systemConfig.eventStatus === "LOCKED") {
    await prisma.checkInLog.create({
      data: {
        token,
        outcome: "BLOCKED",
        message: "Sistema bloccato",
      },
    });
    throw new AppError("Sistema bloccato", 423, { status: systemConfig?.eventStatus ?? "LOCKED" });
  }

  if (systemConfig.eventStatus === "PAUSED") {
    throw new AppError("Registrazioni momentaneamente sospese", 423, { status: systemConfig.eventStatus });
  }

  const invitee = await prisma.invitee.findUnique({ where: { token } });
  if (!invitee) {
    await prisma.checkInLog.create({
      data: {
        token,
        outcome: "INVALID",
        message: "Token inesistente",
      },
    });
    throw new AppError("Codice non valido", 404);
  }

  if (invitee.status === "CANCELLED") {
    await prisma.checkInLog.create({
      data: {
        invitee: { connect: { id: invitee.id } },
        token,
        outcome: "INVALID",
        message: "Invitato annullato",
      },
    });
    throw new AppError("Codice annullato", 403, {
      invitee,
    });
  }

  if (invitee.status === "CHECKED_IN") {
    await prisma.checkInLog.create({
      data: {
        invitee: { connect: { id: invitee.id } },
        token,
        outcome: "DUPLICATE",
        message: "Già registrato",
      },
    });
    throw new AppError("Codice già utilizzato", 409, {
      checkedInAt: invitee.checkedInAt,
      invitee,
    });
  }

  const updated = await prisma.invitee.update({
    where: { id: invitee.id },
    data: {
      status: "CHECKED_IN",
      checkedInAt: new Date(),
      checkInCount: { increment: 1 },
    },
  });

  await prisma.checkInLog.create({
    data: {
      invitee: { connect: { id: invitee.id } },
      token,
      outcome: "SUCCESS",
      message: "Ingresso autorizzato",
    },
  });

  return updated;
};

export const resetCheckIn = async (inviteeId: string) => {
  const invitee = await prisma.invitee.update({
    where: { id: inviteeId },
    data: {
      status: "PENDING",
      checkedInAt: null,
    },
  });
  return invitee;
};

export const deleteInvitee = async (inviteeId: string) => {
  await prisma.invitee.delete({ where: { id: inviteeId } });
};

export const sendInviteeQr = async (inviteeId: string) => {
  const invitee = await prisma.invitee.findUnique({ where: { id: inviteeId } });
  if (!invitee?.email) {
    throw new AppError("Nessuna email associata all'invitato", 400);
  }

  const qrPath = path.join(config.qrOutputDir, invitee.qrFilename);

  const buffer = await readQrFile(qrPath);
  await sendQrEmail({
    to: invitee.email,
    attachments: [
      {
        filename: invitee.qrFilename,
        content: buffer,
        contentType: invitee.qrMimeType ?? "image/png",
      },
    ],
  });

  await prisma.invitee.update({
    where: { id: invitee.id },
    data: {
      lastSentAt: new Date(),
    },
  });
};

export const getInviteeQr = async (inviteeId: string) => {
  const invitee = await prisma.invitee.findUnique({ where: { id: inviteeId } });
  if (!invitee) {
    throw new AppError("Invitato non trovato", 404);
  }

  const qrPath = path.join(config.qrOutputDir, invitee.qrFilename);
  const buffer = await readQrFile(qrPath);

  return {
    filename: invitee.qrFilename,
    mimeType: invitee.qrMimeType ?? "image/png",
    buffer,
  };
};
