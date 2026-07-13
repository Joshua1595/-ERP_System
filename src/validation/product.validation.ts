import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Product name is required (minimum 2 characters)"),
    sku: z.string().min(3, "SKU code is required (minimum 3 characters)"),
    description: z.string().nullable().optional(),
    categoryId: z.string().min(1, "Category ID is required"),
    price: z.number().nonnegative("Selling price must be 0 or greater"),
    cost: z.number().nonnegative("Manufacturing/purchase cost must be 0 or greater"),
    unitOfMeasure: z.string().min(1, "Unit of measure is required (e.g., PCS, KG)"),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Product name must be at least 2 characters").optional(),
    sku: z.string().min(3, "SKU must be at least 3 characters").optional(),
    description: z.string().nullable().optional(),
    categoryId: z.string().min(1).optional(),
    price: z.number().nonnegative("Price must be 0 or greater").optional(),
    cost: z.number().nonnegative("Cost must be 0 or greater").optional(),
    unitOfMeasure: z.string().min(1).optional(),
  }),
});

export const getProductByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Product ID is required"),
  }),
});

export const getProductsQuerySchema = z.object({
  query: z.object({
    page: z.any().optional().transform((val) => (val ? parseInt(String(val), 10) : 1)),
    limit: z.any().optional().transform((val) => (val ? parseInt(String(val), 10) : 10)),
    search: z.string().optional(),
    categoryId: z.string().optional(),
  }),
});

export const updateStockSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Product ID is required"),
  }),
  body: z.object({
    warehouseId: z.string().min(1, "Warehouse ID is required"),
    quantityChange: z.number(),
    type: z.enum(["INCOMING", "OUTGOING", "TRANSFER", "ADJUSTMENT"]),
    referenceNumber: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  }),
});

