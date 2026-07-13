import { db } from "../lib/db.ts";
import { NotFoundError, BadRequestError } from "../utils/errors.ts";

export class SalesService {
  /**
   * Get detailed invoice by ID (includes sales order, customer, items, and payments)
   */
  static async getInvoiceById(id: string) {
    const invoice = await db.getInvoiceById(id);
    if (!invoice) {
      throw new NotFoundError(`Invoice with ID "${id}" not found.`);
    }
    return invoice;
  }

  /**
   * Get paginated invoice list with optional searching
   */
  static async getInvoicesPaged(params: { page: number; limit: number; search?: string }) {
    if (params.page <= 0) {
      throw new BadRequestError("Page must be greater than zero.");
    }
    if (params.limit <= 0) {
      throw new BadRequestError("Limit must be greater than zero.");
    }
    return await db.getInvoicesPaged(params);
  }

  /**
   * Create a new sales invoice (performs transaction and inventory updates)
   */
  static async createSalesInvoice(data: {
    customerId: string;
    createdById: string;
    items: { productId: string; quantity: number }[];
    taxRate?: number;
    discountRate?: number;
  }) {
    // 1. Verify Customer exists and is not soft-deleted
    const customer = await db.getCustomerById(data.customerId);
    if (!customer || customer.isDeleted) {
      throw new NotFoundError(`Customer with ID "${data.customerId}" does not exist or has been deleted.`);
    }

    // 2. Validate products and verify stock levels in main warehouse ("w-main")
    for (const item of data.items) {
      const product = await db.getProductById(item.productId);
      if (!product) {
        throw new NotFoundError(`Product with ID "${item.productId}" not found.`);
      }

      // Check current stock level in main warehouse "w-main"
      const stockLevel = await db.getStockLevel(item.productId, "w-main");
      const availableQty = stockLevel ? Number(stockLevel.quantity) : 0;

      if (availableQty < item.quantity) {
        throw new BadRequestError(
          `Insufficient stock for product "${product.name}" in Main Warehouse (w-main). Requested: ${item.quantity}, Available: ${availableQty}.`
        );
      }
    }

    try {
      // 3. Delegate to repository to execute the transactional creation & inventory deduction
      return await db.createSalesInvoice(data);
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to create sales invoice.");
    }
  }

  /**
   * Get Daily Sales Reporting analytics
   */
  static async getDailySales(params: { startDate?: Date; endDate?: Date }) {
    if (params.startDate && params.endDate && params.startDate > params.endDate) {
      throw new BadRequestError("Start date cannot be after end date.");
    }
    return await db.getDailySales(params);
  }

  /**
   * Get Monthly Sales Reporting analytics
   */
  static async getMonthlySales(year?: number) {
    const targetYear = year || new Date().getFullYear();
    if (targetYear < 2000 || targetYear > 2100) {
      throw new BadRequestError("Year must be between 2000 and 2100.");
    }
    return await db.getMonthlySales(targetYear);
  }
}
