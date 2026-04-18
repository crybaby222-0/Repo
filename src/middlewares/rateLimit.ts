import rateLimit from "express-rate-limit";

/**
 * Rate limit no login para mitigar brute force.
 * 5 tentativas por IP a cada 5 minutos.
 */
export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { message: "Muitas tentativas. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limit geral mais frouxo para evitar abuso de API.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
