import nodemailer from "nodemailer";
import { logger } from "../logger";
import { ensureQrToken, generateQrImageBase64 } from "./qrService";
import { prisma } from "../lib/prisma";

const GMAIL_USER = process.env.GMAIL_USER || "sesaorganizers@gmail.com";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";

function createTransporter() {
  if (!GMAIL_APP_PASSWORD) {
    throw new Error("GMAIL_APP_PASSWORD non configurata nelle variabili d'ambiente");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
}

export interface QrEmailResult {
  success: boolean;
  inviteeId: string;
  email: string;
  error?: string;
}

/**
 * Invia il QR code via email a un singolo invitato.
 * Genera il token se non esiste, crea l'immagine QR, invia la mail.
 */
export async function sendQrEmail(inviteeId: string): Promise<QrEmailResult> {
  const invitee = await prisma.invitee.findUnique({
    where: { id: inviteeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      listType: true,
      event: { select: { name: true } },
    },
  });

  if (!invitee) {
    return { success: false, inviteeId, email: "", error: "Invitato non trovato" };
  }

  if (!invitee.email) {
    return { success: false, inviteeId, email: "", error: "Nessuna email configurata per questo invitato" };
  }

  try {
    const token = await ensureQrToken(inviteeId);
    const qrBase64 = await generateQrImageBase64(token);
    // Estrai solo la parte base64 dalla data URL
    const base64Data = qrBase64.split(",")[1];

    const transporter = createTransporter();
    const fullName = `${invitee.firstName} ${invitee.lastName}`;
    const eventName = invitee.event?.name || "Festa";
    const listLabel = invitee.listType === "PAGANTE" ? "Pagante" : "Green";

    await transporter.sendMail({
      from: `"SESA Organizers" <${GMAIL_USER}>`,
      to: invitee.email,
      subject: `Il tuo QR Code per ${eventName}`,
      html: buildEmailHtml(fullName, eventName, listLabel),
      attachments: [
        {
          filename: `qr-${invitee.lastName.toLowerCase()}-${invitee.firstName.toLowerCase()}.png`,
          content: base64Data,
          encoding: "base64",
          contentType: "image/png",
          cid: "qrcode",
        },
      ],
    });

    // Aggiorna qrSentAt
    await prisma.invitee.update({
      where: { id: inviteeId },
      data: { qrSentAt: new Date() },
    });

    logger.info(`QR inviato a ${invitee.email} per ${fullName}`);
    return { success: true, inviteeId, email: invitee.email };
  } catch (error: any) {
    logger.error(`Errore invio QR a ${invitee.email}:`, error.message);
    return { success: false, inviteeId, email: invitee.email, error: error.message };
  }
}

/**
 * Invia QR a tutti gli invitati di un evento che hanno un'email.
 */
export async function sendQrEmailBulk(eventId: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  results: QrEmailResult[];
}> {
  const invitees = await prisma.invitee.findMany({
    where: { eventId },
    select: { id: true, email: true },
  });

  const withEmail = invitees.filter(inv => inv.email);
  const skipped = invitees.length - withEmail.length;

  const results: QrEmailResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const inv of withEmail) {
    const result = await sendQrEmail(inv.id);
    results.push(result);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
    // Piccola pausa per non saturare il rate limit Gmail (500 email/giorno)
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  logger.info(`Bulk QR completato: ${sent} inviati, ${failed} falliti, ${skipped} senza email`);
  return { sent, failed, skipped, results };
}

function buildEmailHtml(fullName: string, eventName: string, listLabel: string): string {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Il tuo QR Code</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a1a2e; color: #ffffff; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0; opacity: 0.8; font-size: 14px; }
    .body { padding: 28px 24px; text-align: center; }
    .greeting { font-size: 18px; font-weight: bold; color: #1a1a2e; margin-bottom: 8px; }
    .info { font-size: 14px; color: #555; margin-bottom: 24px; line-height: 1.5; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: bold; margin-bottom: 20px; }
    .qr-box { background: #f9f9f9; border-radius: 10px; padding: 20px; display: inline-block; }
    .qr-box img { display: block; width: 250px; height: 250px; }
    .warning { margin-top: 24px; background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #e65100; text-align: left; }
    .footer { background: #f0f0f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${eventName}</h1>
      <p>Il tuo biglietto d'ingresso digitale</p>
    </div>
    <div class="body">
      <div class="greeting">Ciao, ${fullName}!</div>
      <p class="info">
        Mostra il QR code qui sotto all'ingresso per accedere all'evento.
      </p>
      <div class="badge">${listLabel}</div>
      <div class="qr-box">
        <img src="cid:qrcode" alt="QR Code ingresso" />
      </div>
      <div class="warning">
        <strong>Attenzione:</strong> questo QR code è personale e può essere scansionato
        una sola volta. Non condividerlo con altri.
      </div>
    </div>
    <div class="footer">
      Questa email è stata inviata automaticamente da SESA Organizers.<br>
      Non rispondere a questa email.
    </div>
  </div>
</body>
</html>
  `.trim();
}
