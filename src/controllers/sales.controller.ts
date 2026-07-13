import { Request, Response, NextFunction } from "express";
import { SalesService } from "../services/sales.service.ts";

export class SalesController {
  /**
   * Get paginated invoices with search filtering
   */
  static async getInvoicesPaged(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const search = req.query.search as string | undefined;

      const result = await SalesService.getInvoicesPaged({ page, limit, search });

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a detailed sales invoice by ID
   */
  static async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const invoice = await SalesService.getInvoiceById(id);

      res.status(200).json({
        status: "success",
        data: { invoice },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new sales invoice with automatic transaction and inventory deduction
   */
  static async createSalesInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId, items, taxRate, discountRate } = req.body;
      const createdById = req.user!.userId; // From requireAuth middleware

      const invoice = await SalesService.createSalesInvoice({
        customerId,
        createdById,
        items,
        taxRate,
        discountRate,
      });

      res.status(201).json({
        status: "success",
        message: "Sales invoice and order created successfully.",
        data: { invoice },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get daily sales aggregates for analytics
   */
  static async getDailySales(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const dailyReport = await SalesService.getDailySales({ startDate, endDate });

      res.status(200).json({
        status: "success",
        data: { report: dailyReport },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get monthly sales aggregates for analytics
   */
  static async getMonthlySales(req: Request, res: Response, next: NextFunction) {
    try {
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

      const monthlyReport = await SalesService.getMonthlySales(year);

      res.status(200).json({
        status: "success",
        data: { report: monthlyReport },
      });
    } catch (error) {
      next(error);
    }
  }
}
