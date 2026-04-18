import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middlewares/error.js";

/**
 * Lança 402 (Payment Required) se o usuário não tem assinatura ativa.
 * Usado para proteger rotas que dependem de plano pago.
 */
export async function requireActiveSubscription(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (
    !sub ||
    sub.status !== "ACTIVE" ||
    (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date())
  ) {
    throw new HttpError(402, "Assinatura ativa necessária");
  }
  return sub;
}
