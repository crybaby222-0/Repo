import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import * as bail from "../services/baileys.service.js";
import { HttpError } from "../middlewares/error.js";
import { requireActiveSubscription } from "../services/subscription.service.js";

async function getOrCreateBot(userId: string) {
  const existing = await prisma.botInstance.findFirst({ where: { userId } });
  if (existing) return existing;
  return prisma.botInstance.create({ data: { userId } });
}

export async function getBot(req: Request, res: Response) {
  const bot = await getOrCreateBot(req.user!.id);
  const inst = bail.getInstance(bot.id);
  return res.json({
    id: bot.id,
    status: inst.status.toLowerCase(),
    phoneNumber: bot.phoneNumber ?? undefined,
    qrCode: inst.qr ?? undefined,
    lastSeen: bot.lastSeen?.toISOString(),
  });
}

export async function connectBot(req: Request, res: Response) {
  await requireActiveSubscription(req.user!.id); // bloqueia se não pago

  const bot = await getOrCreateBot(req.user!.id);
  const inst = await bail.connect(bot.id, req.user!.id);
  return res.json({
    id: bot.id,
    status: inst.status.toLowerCase(),
    qrCode: inst.qr ?? undefined,
  });
}

export async function disconnectBot(req: Request, res: Response) {
  const bot = await prisma.botInstance.findFirst({ where: { userId: req.user!.id } });
  if (!bot) throw new HttpError(404, "Bot não encontrado");
  await bail.disconnect(bot.id);
  return res.json({ ok: true });
}

export async function restartBot(req: Request, res: Response) {
  const bot = await prisma.botInstance.findFirst({ where: { userId: req.user!.id } });
  if (!bot) throw new HttpError(404, "Bot não encontrado");
  await bail.restart(bot.id, req.user!.id);
  return res.json({ ok: true });
}
