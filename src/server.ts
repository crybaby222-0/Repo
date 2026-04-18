/**
 * Kira Bot — Backend Express
 *
 * Stack: Express + Prisma + PostgreSQL + JWT (argon2) + Baileys + Stripe
 *
 * Arquitetura:
 *  - src/routes      : roteamento (express.Router)
 *  - src/controllers : handlers HTTP + validação Zod
 *  - src/services    : lógica de domínio (Baileys, Subscription)
 *  - src/middlewares : auth, error, rate limit
 *  - src/lib         : prisma, env, jwt, mailer, logger
 *
 * Segurança:
 *  - Senhas com argon2 (mais forte que bcrypt)
 *  - JWT com expiração configurável
 *  - Helmet (headers HTTP seguros)
 *  - CORS restrito por origem
 *  - Rate limit no login (anti brute-force)
 *  - Validação Zod em TODAS as rotas
 *  - Erro centralizado, sem vazar stack
 */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middlewares/error.js";
import { generalLimiter } from "./middlewares/rateLimit.js";
import { authRouter } from "./routes/auth.routes.js";
import { botRouter } from "./routes/bot.routes.js";
import { subscriptionRouter } from "./routes/subscription.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { stripeWebhook } from "./controllers/subscription.controller.js";

const app = express();

app.use(helmet());

// CORS — aceita uma ou várias origens separadas por vírgula
const origins = env.CORS_ORIGIN.split(",").map((s) => s.trim());
app.use(
  cors({
    origin: origins.includes("*") ? true : origins,
    credentials: true,
  }),
);

// Webhook Stripe precisa do body RAW para validar assinatura.
// Esta rota DEVE vir antes do express.json().
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

app.use(express.json({ limit: "1mb" }));
app.use(generalLimiter);

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/auth", authRouter);
app.use("/bot", botRouter);
app.use("/subscription", subscriptionRouter);
app.use("/admin", adminRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`🚀 Kira Bot API rodando em http://localhost:${env.PORT}`);
});
