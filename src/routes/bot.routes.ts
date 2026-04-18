import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as ctrl from "../controllers/bot.controller.js";

export const botRouter = Router();
botRouter.use(requireAuth);

botRouter.get("/", ctrl.getBot);
botRouter.post("/connect", ctrl.connectBot);
botRouter.post("/disconnect", ctrl.disconnectBot);
botRouter.post("/restart", ctrl.restartBot);
