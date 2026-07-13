import { NotificationRepository, NotificationFilters } from "../repositories/notification.repository.ts";
import { NotFoundError } from "../utils/errors.ts";
import { UserRole } from "@prisma/client";

export class NotificationService {
  /**
   * Fetch notification history with support for filters
   */
  static async getNotifications(filters: NotificationFilters) {
    return await NotificationRepository.findAll(filters);
  }

  /**
   * Fetch a single notification by ID
   */
  static async getNotificationById(id: string) {
    const notification = await NotificationRepository.findById(id);
    if (!notification) {
      throw new NotFoundError(`Notification with ID "${id}" was not found.`);
    }
    return notification;
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(id: string) {
    await this.getNotificationById(id); // Throws NotFoundError if missing
    return await NotificationRepository.markAsRead(id);
  }

  /**
   * Mark all notifications as read for a user or role
   */
  static async markAllAsRead(params: { userId?: string; role?: UserRole }) {
    return await NotificationRepository.markAllAsRead(params);
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(id: string) {
    await this.getNotificationById(id); // Throws NotFoundError if missing
    return await NotificationRepository.delete(id);
  }

  /**
   * Create a manual notification
   */
  static async createNotification(data: {
    userId?: string | null;
    role?: UserRole | null;
    type: string;
    title: string;
    message: string;
    referenceId?: string | null;
  }) {
    return await NotificationRepository.create(data);
  }

  /**
   * Scan all systems and dynamically generate notifications
   */
  static async triggerScanAndGeneration() {
    const lowStockGenerated = await NotificationRepository.scanLowStock();
    const purchaseApprovalsGenerated = await NotificationRepository.scanPurchaseApprovals();
    const paymentRemindersGenerated = await NotificationRepository.scanPaymentReminders();
    const orderStatusesGenerated = await NotificationRepository.scanOrderStatuses();

    const totalGenerated =
      lowStockGenerated +
      purchaseApprovalsGenerated +
      paymentRemindersGenerated +
      orderStatusesGenerated;

    return {
      status: "success",
      totalGenerated,
      breakdown: {
        lowStock: lowStockGenerated,
        purchaseApproval: purchaseApprovalsGenerated,
        paymentReminder: paymentRemindersGenerated,
        orderStatus: orderStatusesGenerated,
      },
    };
  }
}
