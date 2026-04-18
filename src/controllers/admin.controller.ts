import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/error.js";

export async function listUsers(req: Request, res: Response) {
  const q = (req.query.q as string | undefined)?.toLowerCase() ?? "";
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { subscription: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role.toLowerCase(),
      banned: u.banned,
      plan: u.subscription?.plan ?? null,
      subscriptionStatus: u.subscription?.status.toLowerCase() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  );
}

const banSchema = z.object({ banned: z.boolean() });

export async function setBan(req: Request, res: Response) {
  const { banned } = banSchema.parse(req.body);
  await prisma.user.update({ where: { id: req.params.id }, data: { banned } });
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: banned ? "user.banned" : "user.unbanned",
      details: `target=${req.params.id}`,
    },
  });
  return res.json({ ok: true });
}

const planSchema = z.object({
  plan: z.enum(["starter", "pro", "business"]),
  status: z.enum(["active", "expired", "canceled", "pending"]).default("active"),
});

export async function setPlan(req: Request, res: Response) {
  const { plan, status } = planSchema.parse(req.body);
  await prisma.subscription.upsert({
    where: { userId: req.params.id },
    create: { userId: req.params.id, plan, status: status.toUpperCase() as any },
    update: { plan, status: status.toUpperCase() as any },
  });
  return res.json({ ok: true });
}

export async function listPayments(_req: Request, res: Response) {
  const list = await prisma.payment.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return res.json(list);
}

export async function listLogs(_req: Request, res: Response) {
  const list = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return res.json(list);
}

export async function metrics(_req: Request, res: Response) {
  const [users, bots, activeSubs, payments] = await Promise.all([
    prisma.user.count(),
    prisma.botInstance.count({ where: { status: "CONNECTED" } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "SUCCEEDED",
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      },
    }),
  ]);
  return res.json({
    users,
    bots,
    activeSubs,
    revenueLast30dCents: payments._sum.amount ?? 0,
  });
}
