import nodemailer from "nodemailer";
import { env } from "./env.js";
import { logger } from "./logger.js";

const transporter =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 587,
        secure: false,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null;

export async function sendMail(to: string, subject: string, html: string) {
  if (!transporter) {
    logger.warn({ to, subject }, "SMTP não configurado — e-mail simulado");
    logger.info({ to, subject, html }, "[MAIL]");
    return;
  }
  await transporter.sendMail({
    from: env.SMTP_FROM ?? "no-reply@kirabot.com",
    to,
    subject,
    html,
  });
}
