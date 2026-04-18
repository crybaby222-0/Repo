import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import * as ctrl from "../controllers/subscription.controller.js";

export const subscriptionRouter = Router();
subscriptionRouter.use(requireAuth);

subscriptionRouter.get("/", ctrl.getSubscription);
subscriptionRouter.post("/checkout", ctrl.createCheckout);
