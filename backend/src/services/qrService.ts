import path from "path";
import { promises as fs } from "fs";
import QRCode from "qrcode";
import { config } from "../config";
import { ensureDirectory } from "../utils/fs";
import { slugify } from "../utils/slug";

export interface QrGenerationInput {
  fullName: string;
  token: string;
}

export interface QrGenerationResult {
  filename: string;
  filePath: string;
  mimeType: string;
}

export const generateQrCode = async ({ fullName, token }: QrGenerationInput): Promise<QrGenerationResult> => {
  const baseDir = config.qrOutputDir;
  await ensureDirectory(baseDir);

  const safeName = slugify(fullName) || "ospite";
  const filename = `${safeName}-${token.split(".")[0]}.png`;
  const filePath = path.join(baseDir, filename);

  const qrPayload = JSON.stringify({
    token,
    v: 1,
  });

  await QRCode.toFile(filePath, qrPayload, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 1,
    scale: 10,
  });

  return {
    filename,
    filePath,
    mimeType: "image/png",
  };
};

export const readQrFile = async (filePath: string) => {
  return fs.readFile(filePath);
};
