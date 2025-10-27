import { mkdir } from "fs/promises";
import { existsSync } from "fs";

export const ensureDirectory = async (dir: string) => {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
};
