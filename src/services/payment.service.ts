import { db } from "../lib/db.ts";
import { NotFoundError, BadRequestError } from "../utils/errors.ts";

export class PaymentService {
  /**
   * Get detailed payment by ID
   */
  static async getPaymentById(id: string) {
    const payment = await db.getPaymentById(id);
    if (!payment) {
      throw new NotFoundError(`Payment with ID "${id}" not found.`);
    }
    return payment;
  }

  /**
   * Get paginated payment list
   */
  static async getPaymentsPaged(params: { page: number; limit: number; search?: string }) {
    if (params.page <= 0) {
      throw new BadRequestError("Page must be greater than zero.");
    }
    if (params.limit <= 0) {
      throw new BadRequestError("Limit must be greater than zero.");
    }
    return await db.getPaymentsPaged(params);
  }

  /**
   * Create a new payment record (validates against outstanding balance)
   */
  static async createPayment(data: {
    invoiceId: string;
    amountPaid: number;
    paymentMethod: string;
    referenceNo?: string | null;
  }) {
    // 1. Fetch detailed invoice
    const invoice = await db.getInvoiceById(data.invoiceId);
    if (!invoice) {
      throw new NotFoundError(`Invoice with ID "${data.invoiceId}" not found.`);
    }

    // 2. Calculate current outstanding balance
    const totalAmount = Number(invoice.amount);
    const totalPaid = (invoice.payments || []).reduce((sum: number, p: any) => sum + Number(p.amountPaid), 0);
    const outstanding = totalAmount - totalPaid;

    if (outstanding <= 0) {
      throw new BadRequestError(`Invoice "${invoice.invoiceNumber}" is already fully paid.`);
    }

    // Add tiny float tolerance for comparison
    if (data.amountPaid > outstanding + 0.01) {
      throw new BadRequestError(
        `Payment amount $${data.amountPaid.toFixed(2)} exceeds the outstanding balance of $${outstanding.toFixed(2)}.`
      );
    }

    try {
      // 3. Delegate to repository
      return await db.createPayment(data);
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to process payment.");
    }
  }

  /**
   * Fetch outstanding details for any invoice
   */
  static async getInvoiceOutstandingDetails(invoiceId: string) {
    const invoice = await db.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundError(`Invoice with ID "${invoiceId}" not found.`);
    }

    const totalAmount = Number(invoice.amount);
    const totalPaid = (invoice.payments || []).reduce((sum: number, p: any) => sum + Number(p.amountPaid), 0);
    const outstanding = Math.max(0, totalAmount - totalPaid);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount,
      totalPaid,
      outstanding,
      status: invoice.status,
    };
  }
}
