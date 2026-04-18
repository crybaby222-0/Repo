import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: "USER" | "ADMIN"; email: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token ausente" });
    }
    const token = header.slice("Bearer ".length);
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.banned) {
      return res.status(401).json({ message: "Usuário inválido ou banido" });
    }

    req.user = { id: user.id, role: user.role, email: user.email };
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Acesso restrito a administradores" });
  }
  next();
}
