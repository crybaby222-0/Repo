import jwt from "jsonwebtoken";
import { env } from "./env.js";

export type JwtPayload = {
  sub: string; // user id
  role: "USER" | "ADMIN";
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
