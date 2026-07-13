import { Request, Response, NextFunction } from "express";
import { ProductService } from "../services/product.service.ts";

export class ProductController {
  /**
   * Get all products cataloged in the system (paginated, searchable, and filterable)
   */
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, categoryId } = req.query as any;
      const { products, total } = await ProductService.getProductsPaged({
        page,
        limit,
        search,
        categoryId,
      });

      res.status(200).json({
        status: "success",
        results: products.length,
        total,
        page,
        limit,
        data: { products },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update stock level by logging a stock movement
   */
  static async updateStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const createdById = req.user!.userId; // Injected by requireAuth middleware
      const movement = await ProductService.updateStock(id, req.body, createdById);

      res.status(200).json({
        status: "success",
        message: "Stock level adjusted successfully and ledger updated.",
        data: { movement },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific product by its ID
   */
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await ProductService.getProductById(id);
      res.status(200).json({
        status: "success",
        data: { product },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Catalog a new product
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.createProduct(req.body);
      res.status(201).json({
        status: "success",
        message: "Product cataloged successfully.",
        data: { product },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update details of an existing product
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await ProductService.updateProduct(id, req.body);
      res.status(200).json({
        status: "success",
        message: "Product record updated successfully.",
        data: { product },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a product record
   */
  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await ProductService.deleteProduct(id);
      res.status(200).json({
        status: "success",
        message: `Product with ID "${id}" deleted successfully.`,
      });
    } catch (error) {
      next(error);
    }
  }
}
