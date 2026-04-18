import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Dados inválidos",
      errors: err.flatten().fieldErrors,
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  logger.error({ err }, "Erro não tratado");
  return res.status(500).json({ message: "Erro interno" });
}
