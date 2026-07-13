import { Request, Response, NextFunction } from "express";
import { PurchasingService } from "../services/purchasing.service.ts";

export class PurchasingController {
  /**
   * Get all purchase orders
   */
  static async getPurchaseOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const orders = await PurchasingService.getPurchaseOrders();
      res.status(200).json({
        status: "success",
        data: { orders },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get detail of a specific purchase order
   */
  static async getPurchaseOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await PurchasingService.getPurchaseOrderById(id);
      res.status(200).json({
        status: "success",
        data: { order },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new purchase order
   */
  static async createPurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const createdById = req.user!.userId;
      const { supplierId, items } = req.body;

      const order = await PurchasingService.createPurchaseOrder({
        supplierId,
        createdById,
        items,
      });

      res.status(201).json({
        status: "success",
        message: "Purchase order created successfully in PENDING status.",
        data: { order },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update status of a purchase order (APPROVE or CANCEL)
   */
  static async updatePurchaseOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const order = await PurchasingService.updatePurchaseOrderStatus(id, status);

      res.status(200).json({
        status: "success",
        message: `Purchase order status updated to ${status} successfully.`,
        data: { order },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Receive goods for an approved purchase order (updates stock levels)
   */
  static async receivePurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { warehouseId } = req.body;
      const receivedById = req.user!.userId;

      const order = await PurchasingService.receivePurchaseOrder(id, {
        receivedById,
        warehouseId,
      });

      res.status(200).json({
        status: "success",
        message: "Purchase order received successfully and inventory stocks updated.",
        data: { order },
      });
    } catch (error) {
      next(error);
    }
  }
}
