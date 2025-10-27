import { createWriteStream } from "fs";

type LogLevel = "debug" | "info" | "warn" | "error";

const logFile = process.env.LOG_FILE
  ? createWriteStream(process.env.LOG_FILE, { flags: "a" })
  : null;

const format = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  return JSON.stringify(payload);
};

const write = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const line = format(level, message, meta);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
  logFile?.write(`${line}\n`);
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
