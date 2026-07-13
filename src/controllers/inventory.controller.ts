import { Request, Response, NextFunction } from "express";
import { InventoryService } from "../services/inventory.service.ts";

export class InventoryController {
  /**
   * Get all stock levels across warehouses (paginated, searchable, filterable)
   */
  static async getStockLevels(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, warehouseId, categoryId, alert } = req.query as any;
      const { stockLevels, total } = await InventoryService.getStockLevelsPaged({
        page,
        limit,
        search,
        warehouseId,
        categoryId,
        alert,
      });

      res.status(200).json({
        status: "success",
        total,
        page,
        limit,
        data: { stockLevels },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific stock level record by product ID and warehouse ID
   */
  static async getStockLevel(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, warehouseId } = req.params;
      const stockLevel = await InventoryService.getStockLevel(productId, warehouseId);

      res.status(200).json({
        status: "success",
        data: { stockLevel },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set minimum, maximum, and reorder levels for a specific product and warehouse
   */
  static async updateStockLevelBounds(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, warehouseId } = req.params;
      const updatedStockLevel = await InventoryService.updateStockLevelBounds(
        productId,
        warehouseId,
        req.body
      );

      res.status(200).json({
        status: "success",
        message: "Stock level thresholds updated successfully.",
        data: { stockLevel: updatedStockLevel },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch all inventory history ledger/movements (paginated, filterable)
   */
  static async getStockHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, productId, warehouseId, type } = req.query as any;
      const { movements, total } = await InventoryService.getStockHistoryPaged({
        page,
        limit,
        productId,
        warehouseId,
        type,
      });

      res.status(200).json({
        status: "success",
        total,
        page,
        limit,
        data: { movements },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate an aggregate status report of current inventory holdings
   */
  static async getInventoryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await InventoryService.getInventoryReport();

      res.status(200).json({
        status: "success",
        data: { report },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Log a new Stock-In transaction (purchase or return receipt)
   */
  static async stockIn(req: Request, res: Response, next: NextFunction) {
    try {
      const createdById = req.user!.userId;
      const movement = await InventoryService.stockIn(req.body, createdById);

      res.status(201).json({
        status: "success",
        message: "Stock receipt processed and ledger updated successfully.",
        data: { movement },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Log a new Stock-Out transaction (sale or manual adjustment deduction)
   */
  static async stockOut(req: Request, res: Response, next: NextFunction) {
    try {
      const createdById = req.user!.userId;
      const movement = await InventoryService.stockOut(req.body, createdById);

      res.status(201).json({
        status: "success",
        message: "Stock withdrawal processed and ledger updated successfully.",
        data: { movement },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process a warehouse-to-warehouse inventory transfer
   */
  static async transferStock(req: Request, res: Response, next: NextFunction) {
    try {
      const createdById = req.user!.userId;
      const result = await InventoryService.transferStock(req.body, createdById);

      res.status(201).json({
        status: "success",
        message: "Stock transfer complete and dual ledger lines written.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
