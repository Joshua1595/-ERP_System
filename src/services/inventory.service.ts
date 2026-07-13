import { db } from "../lib/db.ts";
import { NotFoundError, BadRequestError } from "../utils/errors.ts";

export class InventoryService {
  /**
   * Fetch paginated, filterable, and searchable stock levels
   */
  static async getStockLevelsPaged(params: {
    page: number;
    limit: number;
    search?: string;
    warehouseId?: string;
    categoryId?: string;
    alert?: string;
  }) {
    return await db.getStockLevelsPaged(params);
  }

  /**
   * Fetch a single stock level record
   */
  static async getStockLevel(productId: string, warehouseId: string) {
    const sl = await db.getStockLevel(productId, warehouseId);
    if (!sl) {
      throw new NotFoundError(`Stock level for product "${productId}" in warehouse "${warehouseId}" not found.`);
    }
    return sl;
  }

  /**
   * Update Minimum Stock, Maximum Stock, and Reorder Point/Level
   */
  static async updateStockLevelBounds(
    productId: string,
    warehouseId: string,
    bounds: { reorderPoint?: number; minStock?: number; maxStock?: number }
  ) {
    // Verify product exists
    const product = await db.getProductById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID "${productId}" does not exist.`);
    }

    // Verify warehouse exists
    const warehouses = await db.getWarehouses();
    const warehouseExists = warehouses.some((w) => w.id === warehouseId);
    if (!warehouseExists) {
      throw new BadRequestError(`Warehouse with ID "${warehouseId}" does not exist.`);
    }

    // Business rule validation
    if (bounds.minStock !== undefined && bounds.maxStock !== undefined) {
      if (bounds.minStock > bounds.maxStock) {
        throw new BadRequestError("Minimum stock limit cannot exceed maximum stock limit.");
      }
    }
    if (bounds.reorderPoint !== undefined && bounds.minStock !== undefined) {
      if (bounds.reorderPoint < bounds.minStock) {
        throw new BadRequestError("Reorder level should normally be greater than or equal to minimum stock.");
      }
    }

    return await db.updateStockLevelBounds(productId, warehouseId, bounds);
  }

  /**
   * Fetch paginated, filterable stock history movements
   */
  static async getStockHistoryPaged(params: {
    page: number;
    limit: number;
    productId?: string;
    warehouseId?: string;
    type?: string;
  }) {
    return await db.getStockHistoryPaged(params);
  }

  /**
   * Generate stock health and valuation reports
   */
  static async getInventoryReport() {
    return await db.getInventoryReport();
  }

  /**
   * Process Stock In (Incoming shipment, purchase, return)
   */
  static async stockIn(
    data: {
      productId: string;
      warehouseId: string;
      quantity: number;
      referenceNumber?: string;
      description?: string;
    },
    createdById: string
  ) {
    if (data.quantity <= 0) {
      throw new BadRequestError("Stock-in quantity must be greater than zero.");
    }

    // Verify product exists
    const product = await db.getProductById(data.productId);
    if (!product) {
      throw new NotFoundError(`Product with ID "${data.productId}" does not exist.`);
    }

    // Verify warehouse exists
    const warehouses = await db.getWarehouses();
    const warehouseExists = warehouses.some((w) => w.id === data.warehouseId);
    if (!warehouseExists) {
      throw new BadRequestError(`Warehouse with ID "${data.warehouseId}" does not exist.`);
    }

    // Perform incoming movement
    return await db.createStockMovement({
      productId: data.productId,
      warehouseId: data.warehouseId,
      quantityChange: data.quantity,
      type: "INCOMING",
      referenceNumber: data.referenceNumber,
      description: data.description || "Manual Stock In",
      createdById,
    });
  }

  /**
   * Process Stock Out (Outgoing sale, write-off, disposal)
   */
  static async stockOut(
    data: {
      productId: string;
      warehouseId: string;
      quantity: number;
      referenceNumber?: string;
      description?: string;
    },
    createdById: string
  ) {
    if (data.quantity <= 0) {
      throw new BadRequestError("Stock-out quantity must be greater than zero.");
    }

    // Verify product exists
    const product = await db.getProductById(data.productId);
    if (!product) {
      throw new NotFoundError(`Product with ID "${data.productId}" does not exist.`);
    }

    // Verify warehouse exists
    const warehouses = await db.getWarehouses();
    const warehouseExists = warehouses.some((w) => w.id === data.warehouseId);
    if (!warehouseExists) {
      throw new BadRequestError(`Warehouse with ID "${data.warehouseId}" does not exist.`);
    }

    // Retrieve current stock level
    const sl = await db.getStockLevel(data.productId, data.warehouseId);
    const availableQty = sl ? Number(sl.quantity) : 0;

    if (availableQty < data.quantity) {
      throw new BadRequestError(
        `Insufficient stock. Attempted to withdraw ${data.quantity} units, but only ${availableQty} units are available.`
      );
    }

    // Perform outgoing movement
    return await db.createStockMovement({
      productId: data.productId,
      warehouseId: data.warehouseId,
      quantityChange: -data.quantity,
      type: "OUTGOING",
      referenceNumber: data.referenceNumber,
      description: data.description || "Manual Stock Out",
      createdById,
    });
  }

  /**
   * Process Warehouse-to-Warehouse Stock Transfer
   */
  static async transferStock(
    data: {
      productId: string;
      fromWarehouseId: string;
      toWarehouseId: string;
      quantity: number;
      referenceNumber?: string;
      description?: string;
    },
    createdById: string
  ) {
    if (data.quantity <= 0) {
      throw new BadRequestError("Transfer quantity must be greater than zero.");
    }

    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new BadRequestError("Source and destination warehouses cannot be the same.");
    }

    // Verify product exists
    const product = await db.getProductById(data.productId);
    if (!product) {
      throw new NotFoundError(`Product with ID "${data.productId}" does not exist.`);
    }

    // Verify warehouses exist
    const warehouses = await db.getWarehouses();
    const fromExists = warehouses.some((w) => w.id === data.fromWarehouseId);
    const toExists = warehouses.some((w) => w.id === data.toWarehouseId);

    if (!fromExists) {
      throw new BadRequestError(`Source warehouse with ID "${data.fromWarehouseId}" does not exist.`);
    }
    if (!toExists) {
      throw new BadRequestError(`Destination warehouse with ID "${data.toWarehouseId}" does not exist.`);
    }

    // Verify source warehouse has sufficient quantity
    const sl = await db.getStockLevel(data.productId, data.fromWarehouseId);
    const availableQty = sl ? Number(sl.quantity) : 0;

    if (availableQty < data.quantity) {
      throw new BadRequestError(
        `Insufficient stock in source warehouse. Attempted to transfer ${data.quantity} units, but only ${availableQty} units are available.`
      );
    }

    // Perform transfer transaction
    return await db.transferStock({
      productId: data.productId,
      fromWarehouseId: data.fromWarehouseId,
      toWarehouseId: data.toWarehouseId,
      quantity: data.quantity,
      referenceNumber: data.referenceNumber,
      description: data.description || "Warehouse stock transfer",
      createdById,
    });
  }
}
