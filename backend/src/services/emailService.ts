import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "../logger";

const buildTransport = () => {
  if (!config.email.transportUrl) {
    logger.warn("EMAIL_TRANSPORT_URL not set, email sending disabled");
    return null;
  }

  return nodemailer.createTransport(config.email.transportUrl);
};

const transport = buildTransport();

export interface SendQrEmailParams {
  to: string;
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

export const sendQrEmail = async (params: SendQrEmailParams) => {
  if (!transport) {
    logger.warn("Skipping email send because no transport is configured", { to: params.to });
    return;
  }

  await transport.sendMail({
    from: config.email.from,
    to: params.to,
    subject: params.subject ?? "QRCode per il tuo ingresso",
    text: params.textBody ?? "In allegato trovi il QR code personale per accedere alla festa.",
    html:
      params.htmlBody ??
      `<p>Ciao!</p><p>In allegato trovi il QR code personale per accedere alla festa. Mostralo all'ingresso.</p>`,
    attachments: params.attachments,
  });
};
