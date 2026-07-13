import { Request, Response, NextFunction } from "express";
import { SupplierService } from "../services/supplier.service.ts";

export class SupplierController {
  /**
   * Get all suppliers (paginated, searchable)
   */
  static async getSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search } = req.query as any;
      const { suppliers, total } = await SupplierService.getSuppliersPaged({
        page,
        limit,
        search,
      });

      res.status(200).json({
        status: "success",
        total,
        page,
        limit,
        data: { suppliers },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get details of a single supplier
   */
  static async getSupplierById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const supplier = await SupplierService.getSupplierById(id);

      res.status(200).json({
        status: "success",
        data: { supplier },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new supplier
   */
  static async createSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await SupplierService.createSupplier(req.body);

      res.status(201).json({
        status: "success",
        message: "Supplier profile registered successfully.",
        data: { supplier },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an existing supplier's details
   */
  static async updateSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const supplier = await SupplierService.updateSupplier(id, req.body);

      res.status(200).json({
        status: "success",
        message: "Supplier details modified successfully.",
        data: { supplier },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Soft delete a supplier from active list
   */
  static async deleteSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const supplier = await SupplierService.deleteSupplier(id);

      res.status(200).json({
        status: "success",
        message: "Supplier soft-deleted successfully.",
        data: { supplier },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieve catalog products of a supplier
   */
  static async getSupplierProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const supplierProducts = await SupplierService.getSupplierProducts(id);

      res.status(200).json({
        status: "success",
        data: { supplierProducts },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Map/link a product to a supplier
   */
  static async addSupplierProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { productId, price, leadTimeDays } = req.body;
      const supplierProduct = await SupplierService.addSupplierProduct({
        supplierId: id,
        productId,
        price,
        leadTimeDays,
      });

      res.status(201).json({
        status: "success",
        message: "Product cataloged to supplier successfully.",
        data: { supplierProduct },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unlink a product from a supplier
   */
  static async removeSupplierProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, productId } = req.params;
      const result = await SupplierService.removeSupplierProduct(id, productId);

      res.status(200).json({
        status: "success",
        message: "Product unlinked from supplier catalog successfully.",
        data: { supplierProduct: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieve purchase order history of a supplier (paginated)
   */
  static async getSupplierPurchaseHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query as any;
      const { purchaseOrders, total } = await SupplierService.getSupplierPurchaseHistory(id, {
        page,
        limit,
      });

      res.status(200).json({
        status: "success",
        total,
        page,
        limit,
        data: { purchaseOrders },
      });
    } catch (error) {
      next(error);
    }
  }
}
