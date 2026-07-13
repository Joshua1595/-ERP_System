import { z } from "zod";
import { PurchaseOrderStatus } from "@prisma/client";

export const getPurchaseOrderByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Purchase Order ID is required"),
  }),
});

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    supplierId: z.string().min(1, "Supplier ID is required"),
    items: z
      .array(
        z.object({
          productId: z.string().min(1, "Product ID is required"),
          quantity: z.number().positive("Quantity must be greater than zero"),
        })
      )
      .min(1, "At least one item is required in the purchase order"),
  }),
});

export const updatePurchaseOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Purchase Order ID is required"),
  }),
  body: z.object({
    status: z.nativeEnum(PurchaseOrderStatus, {
      message: "Invalid status. Must be APPROVED or CANCELLED.",
    }),
  }),
});

export const receivePurchaseOrderSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Purchase Order ID is required"),
  }),
  body: z.object({
    warehouseId: z.string().optional(),
  }),
});
