import { db } from "../lib/db.ts";
import { NotFoundError, BadRequestError } from "../utils/errors.ts";

export class CustomerService {
  /**
   * Get paginated customers with optional search filtering
   */
  static async getCustomersPaged(params: { page: number; limit: number; search?: string }) {
    if (params.page <= 0) {
      throw new BadRequestError("Page must be greater than zero.");
    }
    if (params.limit <= 0) {
      throw new BadRequestError("Limit must be greater than zero.");
    }
    return await db.getCustomersPaged(params);
  }

  /**
   * Get detailed customer profile with purchase history
   */
  static async getCustomerById(id: string) {
    const customer = await db.getCustomerById(id);
    if (!customer || customer.isDeleted) {
      throw new NotFoundError(`Customer with ID "${id}" not found.`);
    }
    return customer;
  }

  /**
   * Create a new customer record
   */
  static async createCustomer(data: {
    companyName?: string | null;
    contactName: string;
    email: string;
    phone?: string | null;
    address?: string | null;
  }) {
    // Check if customer email already exists
    const existing = await db.getCustomerByEmail(data.email);
    if (existing) {
      throw new BadRequestError(`Customer with email "${data.email}" already exists.`);
    }

    try {
      return await db.createCustomer(data);
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to create customer.");
    }
  }

  /**
   * Update an existing customer record
   */
  static async updateCustomer(
    id: string,
    data: {
      companyName?: string | null;
      contactName: string;
      email: string;
      phone?: string | null;
      address?: string | null;
    }
  ) {
    const existingCustomer = await db.getCustomerById(id);
    if (!existingCustomer || existingCustomer.isDeleted) {
      throw new NotFoundError(`Customer with ID "${id}" does not exist.`);
    }

    // Email collision check
    const emailCollision = await db.getCustomerByEmail(data.email);
    if (emailCollision && emailCollision.id !== id) {
      throw new BadRequestError(`Customer with email "${data.email}" already exists.`);
    }

    try {
      return await db.updateCustomer(id, data);
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to update customer.");
    }
  }

  /**
   * Soft-delete a customer
   */
  static async deleteCustomer(id: string) {
    const existingCustomer = await db.getCustomerById(id);
    if (!existingCustomer || existingCustomer.isDeleted) {
      throw new NotFoundError(`Customer with ID "${id}" does not exist.`);
    }

    try {
      return await db.deleteCustomer(id);
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to delete customer.");
    }
  }
}
