import { db } from "../lib/db.ts";
import { PurchaseOrderStatus } from "@prisma/client";
import { NotFoundError, BadRequestError } from "../utils/errors.ts";

export class PurchasingService {
  /**
   * Get all purchase orders
   */
  static async getPurchaseOrders() {
    return await db.getPurchaseOrders();
  }

  /**
   * Get purchase order by ID
   */
  static async getPurchaseOrderById(id: string) {
    const order = await db.getPurchaseOrderById(id);
    if (!order) {
      throw new NotFoundError(`Purchase Order with ID "${id}" not found.`);
    }
    return order;
  }

  /**
   * Create a new purchase order
   */
  static async createPurchaseOrder(data: {
    supplierId: string;
    createdById: string;
    items: { productId: string; quantity: number }[];
  }) {
    if (!data.supplierId) {
      throw new BadRequestError("Supplier ID is required.");
    }
    if (!data.items || data.items.length === 0) {
      throw new BadRequestError("At least one purchase item is required.");
    }

    // Verify supplier exists
    const supplier = await db.getSupplierById(data.supplierId);
    if (!supplier) {
      throw new NotFoundError(`Supplier with ID "${data.supplierId}" does not exist.`);
    }

    // Verify all products exist and quantities are positive
    for (const item of data.items) {
      if (item.quantity <= 0) {
        throw new BadRequestError("Item quantity must be greater than zero.");
      }
      const product = await db.getProductById(item.productId);
      if (!product) {
        throw new NotFoundError(`Product with ID "${item.productId}" does not exist.`);
      }
    }

    try {
      return await db.createPurchaseOrder(data);
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to create purchase order.");
    }
  }

  /**
   * Update the status of a purchase order (e.g., Approve or Cancel)
   */
  static async updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus) {
    const existing = await db.getPurchaseOrderById(id);
    if (!existing) {
      throw new NotFoundError(`Purchase Order with ID "${id}" does not exist.`);
    }

    if (existing.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestError("Cannot change the status of a purchase order that has already been received.");
    }

    if (existing.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestError("Cannot change the status of a cancelled purchase order.");
    }

    // Direct transition rules (optional but recommended for robustness)
    if (status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestError("Please use the receive endpoint to receive products and update stock.");
    }

    try {
      return await db.updatePurchaseOrderStatus(id, status);
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to update purchase order status.");
    }
  }

  /**
   * Receive items of an approved purchase order and update stock
   */
  static async receivePurchaseOrder(id: string, data: { receivedById: string; warehouseId?: string }) {
    const existing = await db.getPurchaseOrderById(id);
    if (!existing) {
      throw new NotFoundError(`Purchase Order with ID "${id}" does not exist.`);
    }

    if (existing.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestError("This purchase order has already been received.");
    }

    if (existing.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestError("Cannot receive a cancelled purchase order.");
    }

    if (existing.status !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestError("Purchase order must be APPROVED before it can be received.");
    }

    const warehouseId = data.warehouseId || "w-main";

    try {
      return await db.receivePurchaseOrder(id, data.receivedById, warehouseId);
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to process purchase order receipt.");
    }
  }
}
