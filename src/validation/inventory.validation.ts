import { z } from "zod";

export const getStockLevelsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    search: z.string().optional(),
    warehouseId: z.string().optional(),
    categoryId: z.string().optional(),
    alert: z.enum(["low", "excess", "minimum", "all"]).optional(),
  }),
});

export const getStockLevelSchema = z.object({
  params: z.object({
    productId: z.string().min(1, "Product ID is required"),
    warehouseId: z.string().min(1, "Warehouse ID is required"),
  }),
});

export const updateBoundsSchema = z.object({
  params: z.object({
    productId: z.string().min(1, "Product ID is required"),
    warehouseId: z.string().min(1, "Warehouse ID is required"),
  }),
  body: z.object({
    reorderPoint: z.number().min(0, "Reorder point must be 0 or greater").optional(),
    minStock: z.number().min(0, "Minimum stock must be 0 or greater").optional(),
    maxStock: z.number().min(0, "Maximum stock must be 0 or greater").optional(),
  }),
});

export const stockInSchema = z.object({
  body: z.object({
    productId: z.string().min(1, "Product ID is required"),
    warehouseId: z.string().min(1, "Warehouse ID is required"),
    quantity: z.number().positive("Quantity must be a positive number"),
    referenceNumber: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  }),
});

export const stockOutSchema = z.object({
  body: z.object({
    productId: z.string().min(1, "Product ID is required"),
    warehouseId: z.string().min(1, "Warehouse ID is required"),
    quantity: z.number().positive("Quantity must be a positive number"),
    referenceNumber: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  }),
});

export const transferSchema = z.object({
  body: z.object({
    productId: z.string().min(1, "Product ID is required"),
    fromWarehouseId: z.string().min(1, "Source warehouse ID is required"),
    toWarehouseId: z.string().min(1, "Destination warehouse ID is required"),
    quantity: z.number().positive("Quantity must be a positive number"),
    referenceNumber: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  }),
});

export const getStockHistoryQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    productId: z.string().optional(),
    warehouseId: z.string().optional(),
    type: z.enum(["INCOMING", "OUTGOING", "TRANSFER", "ADJUSTMENT"]).optional(),
  }),
});
