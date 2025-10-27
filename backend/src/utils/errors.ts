export class AppError extends Error {
  public readonly statusCode: number;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, statusCode = 400, context?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.context = context;
  }
}

export const assert = (condition: unknown, message: string, statusCode = 400) => {
  if (!condition) {
    throw new AppError(message, statusCode);
  }
};
