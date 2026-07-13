import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { NotificationController } from "../controllers/notification.controller.ts";
import {
  getNotificationsSchema,
  createNotificationSchema,
  notificationIdSchema,
} from "../validation/notification.validation.ts";

const router = Router();

// Ensure all notification endpoints require authentication
router.use(requireAuth);

/**
 * @route   GET /api/notifications
 * @desc    Get notification history filtered for the current authenticated user/role
 */
router.get("/", validate(getNotificationsSchema), NotificationController.getNotifications);

/**
 * @route   POST /api/notifications/mark-all-read
 * @desc    Mark all unread notifications matching current user/role as read
 */
router.post("/mark-all-read", NotificationController.markAllAsRead);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a single notification as read
 */
router.put("/:id/read", validate(notificationIdSchema), NotificationController.markAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 */
router.delete("/:id", validate(notificationIdSchema), NotificationController.deleteNotification);

/**
 * @route   POST /api/notifications/generate
 * @desc    Scan ERP systems and dynamically generate notifications (Low Stock, Purchase Approvals, Payment Reminders, Order Statuses)
 * @access  Restricted to ADMIN and MANAGER roles
 */
router.post(
  "/generate",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  NotificationController.triggerScanAndGeneration
);

/**
 * @route   POST /api/notifications
 * @desc    Create a custom notification manually (e.g. system announcements)
 * @access  Restricted to ADMIN
 */
router.post(
  "/",
  restrictTo(UserRole.ADMIN),
  validate(createNotificationSchema),
  NotificationController.createManual
);

export default router;
