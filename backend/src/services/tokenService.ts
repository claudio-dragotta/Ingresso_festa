import crypto from "crypto";
import { config } from "../config";

const TOKEN_RANDOM_BYTES = 10;
const SIGNATURE_LENGTH = 16;

export const generateToken = () => {
  const random = crypto.randomBytes(TOKEN_RANDOM_BYTES).toString("base64url");
  const signature = crypto
    .createHmac("sha256", config.jwtSecret)
    .update(random)
    .digest("base64url")
    .slice(0, SIGNATURE_LENGTH);

  return `${random}.${signature}`;
};

export const verifyTokenSignature = (token: string) => {
  const [random, signature] = token.split(".");
  if (!random || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", config.jwtSecret)
    .update(random)
    .digest("base64url")
    .slice(0, SIGNATURE_LENGTH);

  if (signature.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};
