import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { ActivityLogController } from "../controllers/activity-log.controller.ts";
import { activityLogger } from "../middleware/activityLogger.ts";

const router = Router();

// Require authentication for all activity logging endpoints
router.use(requireAuth);
router.use(activityLogger);

/**
 * @route   GET /api/activity-logs
 * @desc    Retrieve activity logs (ADMIN and MANAGER only)
 * @access  Private (ADMIN, MANAGER)
 */
router.get("/", restrictTo(UserRole.ADMIN, UserRole.MANAGER), ActivityLogController.getLogs);

/**
 * @route   GET /api/activity-logs/:id
 * @desc    Retrieve a single log entry (ADMIN and MANAGER only)
 * @access  Private (ADMIN, MANAGER)
 */
router.get("/:id", restrictTo(UserRole.ADMIN, UserRole.MANAGER), ActivityLogController.getLogById);

/**
 * @route   POST /api/activity-logs/purge
 * @desc    Purge activity logs older than a specified number of days (ADMIN only)
 * @access  Private (ADMIN)
 */
router.post("/purge", restrictTo(UserRole.ADMIN), ActivityLogController.purgeLogs);

/**
 * @route   POST /api/activity-logs/custom
 * @desc    Log a manual/custom activity event (ADMIN, MANAGER)
 * @access  Private (ADMIN, MANAGER)
 */
router.post("/custom", restrictTo(UserRole.ADMIN, UserRole.MANAGER), ActivityLogController.createCustomLog);

export default router;
