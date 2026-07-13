import { z } from "zod";

export const getInvoiceByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Invoice ID is required"),
  }),
});

export const getInvoicesPagedSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    search: z.string().optional(),
  }),
});

export const createSalesInvoiceSchema = z.object({
  body: z.object({
    customerId: z.string().min(1, "Customer ID is required"),
    items: z
      .array(
        z.object({
          productId: z.string().min(1, "Product ID is required"),
          quantity: z.number().gt(0, "Quantity must be greater than zero"),
        })
      )
      .min(1, "At least one item is required in the sales invoice"),
    taxRate: z.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%").optional(),
    discountRate: z.number().min(0, "Discount rate cannot be negative").max(100, "Discount rate cannot exceed 100%").optional(),
  }),
});

export const getDailySalesSchema = z.object({
  query: z.object({
    startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
    endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  }),
});

export const getMonthlySalesSchema = z.object({
  query: z.object({
    year: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  }),
});
