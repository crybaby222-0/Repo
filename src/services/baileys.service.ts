/**
 * Serviço de integração com WhatsApp via Baileys.
 *
 * Cada usuário tem uma instância isolada com sua própria pasta de auth.
 * Em produção, considere processo separado (worker) por instância e armazenar
 * a sessão em banco/S3 em vez de filesystem.
 */
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

type Instance = {
  sock: WASocket | null;
  qr: string | null; // data URL
  status: "CONNECTED" | "DISCONNECTED" | "QR" | "LOADING";
};

const instances = new Map<string, Instance>();

function authPath(botId: string) {
  return path.join(env.BAILEYS_AUTH_DIR, botId);
}

export function getInstance(botId: string): Instance {
  return instances.get(botId) ?? { sock: null, qr: null, status: "DISCONNECTED" };
}

export async function connect(botId: string, userId: string): Promise<Instance> {
  const existing = instances.get(botId);
  if (existing?.status === "CONNECTED") return existing;

  fs.mkdirSync(authPath(botId), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authPath(botId));

  const sock = makeWASocket({ auth: state, printQRInTerminal: false });
  const inst: Instance = { sock, qr: null, status: "LOADING" };
  instances.set(botId, inst);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      inst.qr = await QRCode.toDataURL(qr);
      inst.status = "QR";
      await prisma.botInstance.update({
        where: { id: botId },
        data: { status: "QR" },
      });
    }

    if (connection === "open") {
      inst.qr = null;
      inst.status = "CONNECTED";
      const phone = sock.user?.id?.split("@")[0] ?? null;
      await prisma.botInstance.update({
        where: { id: botId },
        data: { status: "CONNECTED", phoneNumber: phone, lastSeen: new Date() },
      });
      logger.info({ botId, phone }, "Bot conectado");
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      inst.status = "DISCONNECTED";
      await prisma.botInstance.update({
        where: { id: botId },
        data: { status: "DISCONNECTED", lastSeen: new Date() },
      });
      logger.warn({ botId, code, shouldReconnect }, "Bot desconectado");
      if (shouldReconnect) {
        setTimeout(() => connect(botId, userId).catch(() => {}), 2000);
      }
    }
  });

  // Listener simples de mensagens — você pode plugar aqui o roteamento de comandos.
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;
      // TODO: matchear com CustomCommand e responder
      // Exemplo de log:
      logger.debug({ from: m.key.remoteJid }, "msg recebida");
    }
  });

  return inst;
}

export async function disconnect(botId: string) {
  const inst = instances.get(botId);
  if (inst?.sock) {
    await inst.sock.logout().catch(() => {});
  }
  instances.delete(botId);
  // Apaga sessão para forçar novo QR no próximo connect
  fs.rmSync(authPath(botId), { recursive: true, force: true });
  await prisma.botInstance.update({
    where: { id: botId },
    data: { status: "DISCONNECTED", phoneNumber: null },
  });
}

export async function restart(botId: string, userId: string) {
  const inst = instances.get(botId);
  if (inst?.sock) await inst.sock.end(undefined);
  instances.delete(botId);
  return connect(botId, userId);
}
