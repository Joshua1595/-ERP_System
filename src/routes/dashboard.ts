import { Router } from "express";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { DashboardController } from "../controllers/dashboard.controller.ts";
import { getDashboardMetricsSchema } from "../validation/dashboard.validation.ts";
import { UserRole } from "@prisma/client";

const router = Router();

// Require authentication for all dashboard routes
router.use(requireAuth);

// GET /api/dashboard/metrics
router.get(
  "/metrics",
  validate(getDashboardMetricsSchema),
  DashboardController.getMetrics
);

// POST /api/dashboard/cache/clear (Restricted to Admin and Manager)
router.post(
  "/cache/clear",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  DashboardController.clearCache
);

export default router;
