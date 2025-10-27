import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { markCheckIn } from "../inviteeService";
import { generateToken } from "../tokenService";
import { AppError } from "../../utils/errors";

describe("inviteeService.markCheckIn", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.checkInLog.deleteMany();
    await prisma.invitee.deleteMany();
    await prisma.systemConfig.deleteMany();

    await prisma.systemConfig.create({
      data: {
        eventName: "Test Event",
        eventStatus: "ACTIVE",
      },
    });
  });

  it("rejects tokens with invalid signatures and logs the attempt", async () => {
    const invalidToken = "invalid.signature";

    const attempt = markCheckIn(invalidToken);
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({
      message: "Codice non valido",
      statusCode: 400,
    });

    const log = await prisma.checkInLog.findFirst({
      where: { token: invalidToken },
    });

    expect(log).not.toBeNull();
    expect(log?.outcome).toBe("INVALID");
    expect(log?.message).toBe("Firma token non valida");
  });

  it("blocks access when the system configuration is locked", async () => {
    const token = generateToken();
    await prisma.systemConfig.updateMany({ data: { eventStatus: "LOCKED" } });

    const attempt = markCheckIn(token);
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({
      message: "Sistema bloccato",
      statusCode: 423,
    });

    const log = await prisma.checkInLog.findFirst({
      where: { token },
    });

    expect(log).not.toBeNull();
    expect(log?.outcome).toBe("BLOCKED");
  });

  it("pauses check-in when the event is momentarily suspended", async () => {
    const token = generateToken();
    await prisma.systemConfig.updateMany({ data: { eventStatus: "PAUSED" } });

    const attempt = markCheckIn(token);
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({
      message: "Registrazioni momentaneamente sospese",
      statusCode: 423,
    });

    const logCount = await prisma.checkInLog.count();
    expect(logCount).toBe(0);
  });

  it("prevents duplicate scans and records a duplicate log entry", async () => {
    const token = generateToken();
    const invitee = await prisma.invitee.create({
      data: {
        firstName: "Mario",
        lastName: "Rossi",
        email: "mario.rossi@example.com",
        token,
        qrFilename: "Mario-Rossi.png",
        status: "CHECKED_IN",
        checkedInAt: new Date("2025-01-01T10:00:00Z"),
        checkInCount: 1,
      },
    });

    const attempt = markCheckIn(token);
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toMatchObject({
      message: "Codice già utilizzato",
      statusCode: 409,
    });

    const log = await prisma.checkInLog.findFirst({
      where: { inviteeId: invitee.id },
      orderBy: { createdAt: "desc" },
    });

    expect(log).not.toBeNull();
    expect(log?.outcome).toBe("DUPLICATE");
    expect(log?.message).toBe("Già registrato");
  });
});
