import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import * as ctrl from "../controllers/admin.controller.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/metrics", ctrl.metrics);
adminRouter.get("/users", ctrl.listUsers);
adminRouter.patch("/users/:id/ban", ctrl.setBan);
adminRouter.patch("/users/:id/plan", ctrl.setPlan);
adminRouter.get("/payments", ctrl.listPayments);
adminRouter.get("/logs", ctrl.listLogs);
