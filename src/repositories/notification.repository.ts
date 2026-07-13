import { prisma, isPrismaActive, checkDatabaseConnection } from "../lib/db.ts";
import {
  mockNotifications,
  mockStockLevels,
  mockProducts,
  mockWarehouses,
  mockPurchaseOrders,
  mockInvoices,
  mockSalesOrders,
} from "../lib/db.ts";
import { UserRole, SalesOrderStatus, InvoiceStatus, PurchaseOrderStatus } from "@prisma/client";

export interface NotificationFilters {
  userId?: string | null;
  role?: UserRole | null;
  isRead?: boolean;
  type?: string;
}

export class NotificationRepository {
  /**
   * Create a new notification
   */
  static async create(data: {
    userId?: string | null;
    role?: UserRole | null;
    type: string;
    title: string;
    message: string;
    referenceId?: string | null;
  }) {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        return await prisma.notification.create({
          data: {
            userId: data.userId || null,
            role: data.role || null,
            type: data.type,
            title: data.title,
            message: data.message,
            referenceId: data.referenceId || null,
            isRead: false,
          },
        });
      } catch (err) {
        console.error("Prisma error in NotificationRepository.create, using mock fallback:", err);
      }
    }

    // Mock Fallback
    const id = "notif-" + Math.random().toString(36).substring(2, 9);
    const newNotification = {
      id,
      userId: data.userId || null,
      role: data.role || null,
      type: data.type,
      title: data.title,
      message: data.message,
      referenceId: data.referenceId || null,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockNotifications.push(newNotification);
    return newNotification;
  }

  /**
   * Find notifications matching filters (e.g. for user, role, unread status)
   */
  static async findAll(filters: NotificationFilters = {}) {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const where: any = {};
        
        // Build OR query: user-specific notifications OR role-matching notifications OR broadcast (both null)
        const orConditions: any[] = [];
        
        if (filters.userId) {
          orConditions.push({ userId: filters.userId });
        }
        if (filters.role) {
          orConditions.push({ role: filters.role });
        }
        
        // If filters have user/role, also allow general broadcast notifications (where both userId and role are null)
        if (filters.userId || filters.role) {
          orConditions.push({ AND: [{ userId: null }, { role: null }] });
        }

        if (orConditions.length > 0) {
          where.OR = orConditions;
        }

        if (filters.isRead !== undefined) {
          where.isRead = filters.isRead;
        }

        if (filters.type) {
          where.type = filters.type;
        }

        return await prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });
      } catch (err) {
        console.error("Prisma error in NotificationRepository.findAll, using mock fallback:", err);
      }
    }

    // Mock Fallback
    let results = [...mockNotifications];

    if (filters.userId || filters.role) {
      results = results.filter((n) => {
        const isUserMatch = filters.userId && n.userId === filters.userId;
        const isRoleMatch = filters.role && n.role === filters.role;
        const isBroadcast = !n.userId && !n.role;
        return isUserMatch || isRoleMatch || isBroadcast;
      });
    }

    if (filters.isRead !== undefined) {
      results = results.filter((n) => n.isRead === filters.isRead);
    }

    if (filters.type) {
      results = results.filter((n) => n.type === filters.type);
    }

    // Sort by createdAt desc
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Find a notification by ID
   */
  static async findById(id: string) {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        return await prisma.notification.findUnique({
          where: { id },
        });
      } catch (err) {
        console.error("Prisma error in NotificationRepository.findById, using mock fallback:", err);
      }
    }

    // Mock Fallback
    const notif = mockNotifications.find((n) => n.id === id);
    return notif || null;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(id: string) {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        return await prisma.notification.update({
          where: { id },
          data: { isRead: true },
        });
      } catch (err) {
        console.error("Prisma error in NotificationRepository.markAsRead, using mock fallback:", err);
      }
    }

    // Mock Fallback
    const notif = mockNotifications.find((n) => n.id === id);
    if (notif) {
      notif.isRead = true;
      notif.updatedAt = new Date();
      return notif;
    }
    return null;
  }

  /**
   * Mark all notifications as read for a user/role
   */
  static async markAllAsRead(params: { userId?: string; role?: UserRole }) {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const where: any = { isRead: false };
        const orConditions: any[] = [];
        if (params.userId) {
          orConditions.push({ userId: params.userId });
        }
        if (params.role) {
          orConditions.push({ role: params.role });
        }
        if (orConditions.length > 0) {
          where.OR = orConditions;
        }

        await prisma.notification.updateMany({
          where,
          data: { isRead: true },
        });
        return { count: 1 }; // Return general success shape
      } catch (err) {
        console.error("Prisma error in NotificationRepository.markAllAsRead, using mock fallback:", err);
      }
    }

    // Mock Fallback
    let count = 0;
    mockNotifications.forEach((n) => {
      if (!n.isRead) {
        const userMatch = params.userId && n.userId === params.userId;
        const roleMatch = params.role && n.role === params.role;
        const generalMatch = !params.userId && !params.role;
        if (userMatch || roleMatch || generalMatch) {
          n.isRead = true;
          n.updatedAt = new Date();
          count++;
        }
      }
    });

    return { count };
  }

  /**
   * Delete a notification
   */
  static async delete(id: string) {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        return await prisma.notification.delete({
          where: { id },
        });
      } catch (err) {
        console.error("Prisma error in NotificationRepository.delete, using mock fallback:", err);
      }
    }

    // Mock Fallback
    const index = mockNotifications.findIndex((n) => n.id === id);
    if (index !== -1) {
      const deleted = mockNotifications[index];
      mockNotifications.splice(index, 1);
      return deleted;
    }
    return null;
  }

  /**
   * Scan and generate low stock notifications
   */
  static async scanLowStock(): Promise<number> {
    const isDbReachable = await checkDatabaseConnection();
    let lowStockProducts: any[] = [];

    if (isDbReachable && prisma) {
      try {
        lowStockProducts = await prisma.stockLevel.findMany({
          where: {
            quantity: {
              lte: prisma.stockLevel.fields.reorderPoint,
            },
          },
          include: {
            product: true,
            warehouse: true,
          },
        });
      } catch (err) {
        console.error("Prisma low stock scan error:", err);
      }
    } else {
      // Mock Fallback scan
      lowStockProducts = mockStockLevels
        .filter((sl) => Number(sl.quantity) <= Number(sl.reorderPoint))
        .map((sl) => {
          const product = mockProducts.find((p) => p.id === sl.productId);
          const warehouse = mockWarehouses.find((wh) => wh.id === sl.warehouseId);
          return { ...sl, product, warehouse };
        });
    }

    let createdCount = 0;
    for (const ls of lowStockProducts) {
      if (!ls.product || !ls.warehouse) continue;

      // Check if unread notification already exists for this specific low stock combination
      const existingNotifs = await this.findAll({
        isRead: false,
        type: "LOW_STOCK",
      });

      const alreadyNotified = existingNotifs.some(
        (n) => n.referenceId === ls.productId && n.message.includes(ls.warehouse.name)
      );

      if (!alreadyNotified) {
        await this.create({
          role: UserRole.MANAGER,
          type: "LOW_STOCK",
          title: `Low Stock Alert: ${ls.product.name}`,
          message: `Product '${ls.product.name}' (SKU: ${ls.product.sku}) has fallen below its reorder point in '${ls.warehouse.name}'. Current stock: ${ls.quantity}, Reorder point: ${ls.reorderPoint}.`,
          referenceId: ls.productId,
        });
        createdCount++;
      }
    }

    return createdCount;
  }

  /**
   * Scan and generate pending purchase order approval notifications
   */
  static async scanPurchaseApprovals(): Promise<number> {
    const isDbReachable = await checkDatabaseConnection();
    let pendingPOs: any[] = [];

    if (isDbReachable && prisma) {
      try {
        pendingPOs = await prisma.purchaseOrder.findMany({
          where: { status: PurchaseOrderStatus.PENDING },
        });
      } catch (err) {
        console.error("Prisma purchase approvals scan error:", err);
      }
    } else {
      pendingPOs = mockPurchaseOrders.filter((po) => po.status === PurchaseOrderStatus.PENDING);
    }

    let createdCount = 0;
    for (const po of pendingPOs) {
      // Check if unread notification already exists for this purchase order
      const existingNotifs = await this.findAll({
        isRead: false,
        type: "PURCHASE_APPROVAL",
      });

      const alreadyNotified = existingNotifs.some((n) => n.referenceId === po.id);

      if (!alreadyNotified) {
        await this.create({
          role: UserRole.MANAGER,
          type: "PURCHASE_APPROVAL",
          title: `Purchase Order Awaiting Approval: ${po.poNumber}`,
          message: `Purchase order '${po.poNumber}' totaling $${Number(po.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })} requires manager approval.`,
          referenceId: po.id,
        });
        createdCount++;
      }
    }

    return createdCount;
  }

  /**
   * Scan and generate payment reminder notifications for unpaid/overdue invoices
   */
  static async scanPaymentReminders(): Promise<number> {
    const isDbReachable = await checkDatabaseConnection();
    let unpaidInvoices: any[] = [];

    if (isDbReachable && prisma) {
      try {
        unpaidInvoices = await prisma.invoice.findMany({
          where: {
            status: {
              in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE],
            },
          },
        });
      } catch (err) {
        console.error("Prisma payment reminders scan error:", err);
      }
    } else {
      unpaidInvoices = mockInvoices.filter(
        (inv) => inv.status === InvoiceStatus.UNPAID || inv.status === InvoiceStatus.OVERDUE
      );
    }

    let createdCount = 0;
    for (const inv of unpaidInvoices) {
      // Check if unread notification already exists for this invoice
      const existingNotifs = await this.findAll({
        isRead: false,
        type: "PAYMENT_REMINDER",
      });

      const alreadyNotified = existingNotifs.some((n) => n.referenceId === inv.id);

      if (!alreadyNotified) {
        const isOverdue = inv.status === InvoiceStatus.OVERDUE || new Date(inv.dueDate) < new Date();
        const statusText = isOverdue ? "OVERDUE" : "Pending";
        const title = isOverdue
          ? `⚠️ URGENT: Overdue Payment Reminder (${inv.invoiceNumber})`
          : `Payment Reminder: Invoice ${inv.invoiceNumber}`;

        await this.create({
          role: UserRole.ACCOUNTANT,
          type: "PAYMENT_REMINDER",
          title,
          message: `Invoice '${inv.invoiceNumber}' has status '${statusText}' with a total amount of $${Number(inv.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}. Due Date: ${new Date(inv.dueDate).toISOString().split("T")[0]}.`,
          referenceId: inv.id,
        });
        createdCount++;
      }
    }

    return createdCount;
  }

  /**
   * Scan and generate notifications for sales order status changes
   */
  static async scanOrderStatuses(): Promise<number> {
    const isDbReachable = await checkDatabaseConnection();
    let salesOrders: any[] = [];

    if (isDbReachable && prisma) {
      try {
        salesOrders = await prisma.salesOrder.findMany({
          where: {
            status: {
              in: [SalesOrderStatus.SHIPPED, SalesOrderStatus.CANCELLED],
            },
          },
        });
      } catch (err) {
        console.error("Prisma order status scan error:", err);
      }
    } else {
      salesOrders = mockSalesOrders.filter(
        (so) => (so.status as any) === SalesOrderStatus.SHIPPED || (so.status as any) === SalesOrderStatus.CANCELLED
      );
    }

    let createdCount = 0;
    for (const so of salesOrders) {
      // Check if unread notification already exists for this sales order status
      const existingNotifs = await this.findAll({
        isRead: false,
        type: "ORDER_STATUS",
      });

      const alreadyNotified = existingNotifs.some(
        (n) => n.referenceId === so.id && n.message.includes(so.status)
      );

      if (!alreadyNotified) {
        const actionText = so.status === SalesOrderStatus.SHIPPED ? "SHIPPED and dispatched" : "CANCELLED";
        const title = `Sales Order ${so.orderNumber} ${so.status}`;
        await this.create({
          userId: so.createdById || null,
          type: "ORDER_STATUS",
          title,
          message: `Sales Order '${so.orderNumber}' has been ${actionText}. Total Amount: $${Number(so.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}.`,
          referenceId: so.id,
        });
        createdCount++;
      }
    }

    return createdCount;
  }
}
