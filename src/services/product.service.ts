import { db } from "../lib/db.ts";
import { NotFoundError, ConflictError, BadRequestError } from "../utils/errors.ts";

export class ProductService {
  /**
   * Fetch all product records from the dual-mode repository
   */
  static async getAllProducts() {
    return await db.getProducts();
  }

  /**
   * Fetch a paginated, searchable, and filterable list of products
   */
  static async getProductsPaged(params: { page?: any; limit?: any; search?: string; categoryId?: string }) {
    return await db.getProductsPaged(params);
  }

  /**
   * Update stock level by creating a new stock movement ledger transaction
   * @throws NotFoundError if the product doesn't exist
   * @throws BadRequestError if the warehouse doesn't exist
   */
  static async updateStock(
    productId: string,
    data: {
      warehouseId: string;
      quantityChange: number;
      type: any;
      referenceNumber?: string;
      description?: string;
    },
    createdById: string
  ) {
    const product = await db.getProductById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID "${productId}" does not exist.`);
    }

    const warehouses = await db.getWarehouses();
    const warehouseExists = warehouses.some((wh) => wh.id === data.warehouseId);
    if (!warehouseExists) {
      throw new BadRequestError(`Warehouse with ID "${data.warehouseId}" does not exist.`);
    }

    return await db.createStockMovement({
      productId,
      warehouseId: data.warehouseId,
      quantityChange: data.quantityChange,
      type: data.type,
      referenceNumber: data.referenceNumber,
      description: data.description,
      createdById,
    });
  }

  /**
   * Fetch a single product by ID
   * @throws NotFoundError if product not found
   */
  static async getProductById(id: string) {
    const product = await db.getProductById(id);
    if (!product) {
      throw new NotFoundError(`Product with ID "${id}" does not exist.`);
    }
    return product;
  }

  /**
   * Register/catalog a new product in the system
   * @throws ConflictError if the SKU is already registered
   * @throws BadRequestError if the referenced category does not exist
   */
  static async createProduct(data: {
    name: string;
    sku: string;
    description?: string;
    categoryId: string;
    price: number;
    cost: number;
    unitOfMeasure: string;
  }) {
    // 1. Verify Category existence
    const categories = await db.getCategories();
    const categoryExists = categories.some((c) => c.id === data.categoryId);
    if (!categoryExists) {
      throw new BadRequestError(`Referenced category with ID "${data.categoryId}" does not exist.`);
    }

    // 2. Enforce unique SKU constraints across the product database
    const existingProducts = await db.getProducts();
    const skuConflict = existingProducts.some(
      (p) => p.sku.toLowerCase() === data.sku.toLowerCase()
    );
    if (skuConflict) {
      throw new ConflictError(`A product with SKU "${data.sku}" is already registered.`);
    }

    // 3. Create and return product record
    return await db.createProduct(data);
  }

  /**
   * Update an existing product record
   * @throws NotFoundError if product not found
   * @throws ConflictError if updated SKU is taken by another product
   * @throws BadRequestError if updated category ID does not exist
   */
  static async updateProduct(
    id: string,
    data: Partial<{
      name: string;
      sku: string;
      description?: string;
      categoryId: string;
      price: number;
      cost: number;
      unitOfMeasure: string;
    }>
  ) {
    // 1. Check if the product exists
    const existingProduct = await db.getProductById(id);
    if (!existingProduct) {
      throw new NotFoundError(`Product with ID "${id}" does not exist.`);
    }

    // 2. Validate category if updating categoryId
    if (data.categoryId) {
      const categories = await db.getCategories();
      const categoryExists = categories.some((c) => c.id === data.categoryId);
      if (!categoryExists) {
        throw new BadRequestError(`Referenced category with ID "${data.categoryId}" does not exist.`);
      }
    }

    // 3. Check SKU uniqueness if updating SKU
    if (data.sku && data.sku.toLowerCase() !== existingProduct.sku.toLowerCase()) {
      const allProducts = await db.getProducts();
      const skuConflict = allProducts.some(
        (p) => p.id !== id && p.sku.toLowerCase() === data.sku!.toLowerCase()
      );
      if (skuConflict) {
        throw new ConflictError(`Another product with SKU "${data.sku}" already exists.`);
      }
    }

    // 4. Update and return
    const updated = await db.updateProduct(id, data);
    if (!updated) {
      throw new NotFoundError(`Failed to update product with ID "${id}".`);
    }
    return updated;
  }

  /**
   * Delete a product record from the system
   * @throws NotFoundError if product not found
   */
  static async deleteProduct(id: string) {
    const existingProduct = await db.getProductById(id);
    if (!existingProduct) {
      throw new NotFoundError(`Product with ID "${id}" does not exist.`);
    }

    const success = await db.deleteProduct(id);
    if (!success) {
      throw new NotFoundError(`Failed to delete product with ID "${id}".`);
    }
    return true;
  }
}
