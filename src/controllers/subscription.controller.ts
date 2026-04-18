import type { Request, Response } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { HttpError } from "../middlewares/error.js";

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro", "business"]),
});

function priceFor(plan: string) {
  switch (plan) {
    case "starter":
      return env.STRIPE_PRICE_STARTER;
    case "pro":
      return env.STRIPE_PRICE_PRO;
    case "business":
      return env.STRIPE_PRICE_BUSINESS;
    default:
      return null;
  }
}

export async function getSubscription(req: Request, res: Response) {
  const sub = await prisma.subscription.findUnique({ where: { userId: req.user!.id } });
  if (!sub) return res.json(null);
  return res.json({
    id: sub.id,
    plan: sub.plan,
    status: sub.status.toLowerCase(),
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
  });
}

export async function createCheckout(req: Request, res: Response) {
  if (!stripe) throw new HttpError(500, "Stripe não configurado no servidor");

  const { plan } = checkoutSchema.parse(req.body);
  const priceId = priceFor(plan);
  if (!priceId) throw new HttpError(400, "Plano sem preço Stripe configurado");

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw new HttpError(404, "Usuário não encontrado");

  let sub = await prisma.subscription.findUnique({ where: { userId: user.id } });

  // Cria customer Stripe se ainda não tem
  if (!sub?.stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id },
    });
    sub = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan,
        status: "PENDING",
        stripeCustomerId: customer.id,
      },
      update: { stripeCustomerId: customer.id, plan },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: sub!.stripeCustomerId!,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.FRONTEND_URL}/app/assinatura?success=1`,
    cancel_url: `${env.FRONTEND_URL}/app/assinatura?canceled=1`,
    metadata: { userId: user.id, plan },
  });

  return res.json({ url: session.url });
}

/**
 * Webhook do Stripe — atualiza status da assinatura e registra pagamentos.
 * Lembre-se: a rota usa express.raw() (NÃO json) para validar a assinatura.
 */
export async function stripeWebhook(req: Request, res: Response) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send("Stripe não configurado");
  }

  const signature = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook inválido: ${(err as Error).message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.metadata?.userId;
      const plan = s.metadata?.plan;
      if (userId && plan) {
        await prisma.subscription.update({
          where: { userId },
          data: {
            status: "ACTIVE",
            plan,
            stripeSubscriptionId: s.subscription as string,
          },
        });
      }
      break;
    }
    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = inv.customer as string;
      const sub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: "ACTIVE",
            currentPeriodEnd: new Date((inv.lines.data[0]?.period?.end ?? 0) * 1000),
          },
        });
        await prisma.payment.create({
          data: {
            userId: sub.userId,
            stripePaymentIntentId: inv.payment_intent as string | undefined,
            amount: inv.amount_paid,
            currency: inv.currency,
            status: "SUCCEEDED",
            plan: sub.plan,
          },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const s = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: s.id },
        data: { status: "CANCELED" },
      });
      break;
    }
  }

  return res.json({ received: true });
}
