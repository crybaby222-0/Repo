import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { loginLimiter } from "../middlewares/rateLimit.js";

export const authRouter = Router();

authRouter.post("/register", loginLimiter, ctrl.register);
authRouter.post("/login", loginLimiter, ctrl.login);
authRouter.post("/forgot-password", loginLimiter, ctrl.forgotPassword);
authRouter.post("/reset-password", loginLimiter, ctrl.resetPassword);
authRouter.get("/me", requireAuth, ctrl.me);
