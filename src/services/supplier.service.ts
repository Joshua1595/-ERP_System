import { db } from "../lib/db.ts";
import { NotFoundError, BadRequestError } from "../utils/errors.ts";

export class SupplierService {
  /**
   * Get paginated, searchable suppliers
   */
  static async getSuppliersPaged(params: { page: number; limit: number; search?: string }) {
    if (params.page <= 0) {
      throw new BadRequestError("Page number must be greater than zero.");
    }
    if (params.limit <= 0) {
      throw new BadRequestError("Limit must be greater than zero.");
    }
    return await db.getSuppliersPaged(params);
  }

  /**
   * Get a supplier by ID
   */
  static async getSupplierById(id: string) {
    const supplier = await db.getSupplierById(id);
    if (!supplier) {
      throw new NotFoundError(`Supplier with ID "${id}" not found.`);
    }
    return supplier;
  }

  /**
   * Create a new supplier
   */
  static async createSupplier(data: {
    companyName: string;
    contactName?: string;
    email: string;
    phone?: string;
    address?: string;
  }) {
    if (!data.companyName || data.companyName.trim().length === 0) {
      throw new BadRequestError("Company name is required.");
    }
    if (!data.email || data.email.trim().length === 0) {
      throw new BadRequestError("Supplier email is required.");
    }

    try {
      return await db.createSupplier({
        companyName: data.companyName.trim(),
        contactName: data.contactName?.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim(),
        address: data.address?.trim(),
      });
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to create supplier.");
    }
  }

  /**
   * Update an existing supplier
   */
  static async updateSupplier(
    id: string,
    data: {
      companyName?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
    }
  ) {
    // Verify existence
    const existing = await db.getSupplierById(id);
    if (!existing) {
      throw new NotFoundError(`Supplier with ID "${id}" does not exist.`);
    }

    if (data.companyName !== undefined && data.companyName.trim().length === 0) {
      throw new BadRequestError("Company name cannot be blank.");
    }
    if (data.email !== undefined && data.email.trim().length === 0) {
      throw new BadRequestError("Supplier email cannot be blank.");
    }

    const payload: typeof data = {};
    if (data.companyName !== undefined) payload.companyName = data.companyName.trim();
    if (data.contactName !== undefined) payload.contactName = data.contactName.trim();
    if (data.email !== undefined) payload.email = data.email.trim().toLowerCase();
    if (data.phone !== undefined) payload.phone = data.phone.trim();
    if (data.address !== undefined) payload.address = data.address.trim();

    try {
      return await db.updateSupplier(id, payload);
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to update supplier.");
    }
  }

  /**
   * Soft delete a supplier
   */
  static async deleteSupplier(id: string) {
    const existing = await db.getSupplierById(id);
    if (!existing) {
      throw new NotFoundError(`Supplier with ID "${id}" does not exist.`);
    }
    return await db.deleteSupplier(id);
  }

  /**
   * Retrieve products supplied by this supplier
   */
  static async getSupplierProducts(supplierId: string) {
    const existing = await db.getSupplierById(supplierId);
    if (!existing) {
      throw new NotFoundError(`Supplier with ID "${supplierId}" does not exist.`);
    }
    return await db.getSupplierProducts(supplierId);
  }

  /**
   * Map/link a product to a supplier with custom price and lead time
   */
  static async addSupplierProduct(data: {
    supplierId: string;
    productId: string;
    price: number;
    leadTimeDays?: number;
  }) {
    // Verify supplier exists
    const supplier = await db.getSupplierById(data.supplierId);
    if (!supplier) {
      throw new NotFoundError(`Supplier with ID "${data.supplierId}" does not exist.`);
    }

    // Verify product exists
    const product = await db.getProductById(data.productId);
    if (!product) {
      throw new NotFoundError(`Product with ID "${data.productId}" does not exist.`);
    }

    if (data.price <= 0) {
      throw new BadRequestError("Supplier unit price must be greater than zero.");
    }

    if (data.leadTimeDays !== undefined && data.leadTimeDays < 0) {
      throw new BadRequestError("Lead time days cannot be negative.");
    }

    return await db.addSupplierProduct(data);
  }

  /**
   * Remove a product from a supplier's catalog
   */
  static async removeSupplierProduct(supplierId: string, productId: string) {
    const supplier = await db.getSupplierById(supplierId);
    if (!supplier) {
      throw new NotFoundError(`Supplier with ID "${supplierId}" does not exist.`);
    }

    const product = await db.getProductById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID "${productId}" does not exist.`);
    }

    try {
      return await db.removeSupplierProduct(supplierId, productId);
    } catch (error: any) {
      throw new BadRequestError(error.message || "Failed to remove product from supplier catalog.");
    }
  }

  /**
   * Get purchase history of a supplier
   */
  static async getSupplierPurchaseHistory(supplierId: string, params: { page: number; limit: number }) {
    const supplier = await db.getSupplierById(supplierId);
    if (!supplier) {
      throw new NotFoundError(`Supplier with ID "${supplierId}" does not exist.`);
    }

    if (params.page <= 0) {
      throw new BadRequestError("Page number must be greater than zero.");
    }
    if (params.limit <= 0) {
      throw new BadRequestError("Limit must be greater than zero.");
    }

    return await db.getSupplierPurchaseHistory(supplierId, params);
  }
}
