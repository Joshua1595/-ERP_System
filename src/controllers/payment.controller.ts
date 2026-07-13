import { Request, Response, NextFunction } from "express";
import { PaymentService } from "../services/payment.service.ts";

export class PaymentController {
  /**
   * Get paginated list of payments (Payment History)
   */
  static async getPaymentsPaged(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const search = req.query.search as string | undefined;

      const result = await PaymentService.getPaymentsPaged({ page, limit, search });

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific payment details by ID
   */
  static async getPaymentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payment = await PaymentService.getPaymentById(id);

      res.status(200).json({
        status: "success",
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process a payment for an invoice (Partial Payment / Full Payment)
   */
  static async createPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { invoiceId, amountPaid, paymentMethod, referenceNo } = req.body;

      const payment = await PaymentService.createPayment({
        invoiceId,
        amountPaid,
        paymentMethod,
        referenceNo,
      });

      res.status(201).json({
        status: "success",
        message: "Payment processed successfully.",
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get outstanding balance details for an invoice
   */
  static async getOutstandingDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { invoiceId } = req.params;
      const details = await PaymentService.getInvoiceOutstandingDetails(invoiceId);

      res.status(200).json({
        status: "success",
        data: { details },
      });
    } catch (error) {
      next(error);
    }
  }
}
