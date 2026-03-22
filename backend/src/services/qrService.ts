import crypto from "crypto";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma";

/**
 * Genera un token QR crittograficamente sicuro (64 char hex, 256 bit di entropia).
 * Il token è opaco: non contiene l'ID dell'invitato né altri dati deducibili.
 */
export function generateQrToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Valida che il token sia nel formato atteso (64 char hex).
 * Da chiamare PRIMA di qualsiasi query al DB per evitare input malevoli.
 */
export function isValidQrToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}

/**
 * Assegna un token QR univoco all'invitato (se non ne ha già uno).
 * Ritorna il token (nuovo o esistente).
 */
export async function ensureQrToken(inviteeId: string): Promise<string> {
  const invitee = await prisma.invitee.findUnique({
    where: { id: inviteeId },
    select: { qrToken: true },
  });

  if (!invitee) throw new Error("Invitato non trovato");

  if (invitee.qrToken) return invitee.qrToken;

  // Genera e salva un token nuovo.
  // Usa try/catch sul DB write per gestire le rarissime collisioni senza TOCTOU.
  for (let attempts = 0; attempts < 5; attempts++) {
    const token = generateQrToken();
    try {
      await prisma.invitee.update({
        where: { id: inviteeId },
        data: { qrToken: token },
      });
      return token;
    } catch (err: any) {
      // P2002 = unique constraint violation: token già usato, riprova
      if (err?.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("Impossibile generare token QR univoco dopo 5 tentativi");
}

/**
 * Genera l'immagine QR come Buffer PNG.
 * Il QR contiene solo il token — nessun URL, nessun dato personale.
 */
export async function generateQrImageBuffer(token: string): Promise<Buffer> {
  const buffer = await QRCode.toBuffer(token, {
    type: "png",
    width: 400,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
  return buffer;
}

/**
 * Genera l'immagine QR come stringa base64 (per embed in email HTML).
 */
export async function generateQrImageBase64(token: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
  });
  return dataUrl;
}
