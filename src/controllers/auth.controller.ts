import type { Request, Response } from "express";
import { z } from "zod";
import argon2 from "argon2";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { sendMail } from "../lib/mailer.js";
import { env } from "../lib/env.js";
import { HttpError } from "../middlewares/error.js";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).toLowerCase(),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(200),
});

const forgotSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(200),
});

function userPublic(u: {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  createdAt: Date;
  banned: boolean;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role.toLowerCase() as "user" | "admin",
    createdAt: u.createdAt.toISOString(),
    banned: u.banned,
  };
}

export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new HttpError(409, "E-mail já cadastrado");

  // argon2: hash forte, recomendado em vez de bcrypt
  const passwordHash = await argon2.hash(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
    },
  });

  const token = signToken({ sub: user.id, role: user.role });
  return res.status(201).json({ token, user: userPublic(user) });
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new HttpError(401, "E-mail ou senha inválidos");
  if (user.banned) throw new HttpError(403, "Conta banida");

  const ok = await argon2.verify(user.passwordHash, data.password);
  if (!ok) throw new HttpError(401, "E-mail ou senha inválidos");

  const token = signToken({ sub: user.id, role: user.role });
  return res.json({ token, user: userPublic(user) });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw new HttpError(404, "Usuário não encontrado");
  return res.json(userPublic(user));
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = forgotSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });

  // Sempre responde 200 para não vazar quais e-mails existem
  if (!user) return res.json({ ok: true });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1h
    },
  });

  const url = `${env.FRONTEND_URL}/redefinir-senha?token=${rawToken}`;
  await sendMail(
    user.email,
    "Recuperação de senha — Kira Bot",
    `<p>Olá ${user.name},</p>
     <p>Para redefinir sua senha, clique no link abaixo (válido por 1 hora):</p>
     <p><a href="${url}">${url}</a></p>
     <p>Se você não pediu isso, ignore este e-mail.</p>`,
  );

  return res.json({ ok: true });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = resetSchema.parse(req.body);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw new HttpError(400, "Token inválido ou expirado");
  }

  const passwordHash = await argon2.hash(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return res.json({ ok: true });
}
