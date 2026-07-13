import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../services/notification.service.ts";
import { UserRole } from "@prisma/client";

export class NotificationController {
  /**
   * GET /api/notifications
   * Get notification history filtered for the current authenticated user/role
   */
  static async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { isRead: isReadStr, type } = req.query as { isRead?: string; type?: string };

      const isRead = isReadStr === "true" ? true : isReadStr === "false" ? false : undefined;

      const notifications = await NotificationService.getNotifications({
        userId: user.userId,
        role: user.role,
        isRead,
        type,
      });

      return res.status(200).json({
        status: "success",
        data: notifications,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/notifications/:id/read
   * Mark a single notification as read
   */
  static async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const notification = await NotificationService.markAsRead(id);

      return res.status(200).json({
        status: "success",
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/notifications/mark-all-read
   * Mark all unread notifications matching current user/role as read
   */
  static async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const result = await NotificationService.markAllAsRead({
        userId: user.userId,
        role: user.role,
      });

      return res.status(200).json({
        status: "success",
        message: "All matching notifications marked as read.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Delete a single notification
   */
  static async deleteNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await NotificationService.deleteNotification(id);

      return res.status(200).json({
        status: "success",
        message: "Notification deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/notifications/generate
   * Scan systems (inventory, purchase, payments, orders) and generate active alerts/notifications
   */
  static async triggerScanAndGeneration(req: Request, res: Response, next: NextFunction) {
    try {
      const scanResult = await NotificationService.triggerScanAndGeneration();
      return res.status(200).json(scanResult);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/notifications
   * Create a manual notification (e.g. custom admin announcement)
   */
  static async createManual(req: Request, res: Response, next: NextFunction) {
    try {
      const notification = await NotificationService.createNotification(req.body);
      return res.status(201).json({
        status: "success",
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  }
}
