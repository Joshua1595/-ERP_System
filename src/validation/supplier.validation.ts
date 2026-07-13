import { z } from "zod";

export const getSuppliersQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    search: z.string().optional(),
  }),
});

export const getSupplierByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Supplier ID is required"),
  }),
});

export const createSupplierSchema = z.object({
  body: z.object({
    companyName: z.string().min(1, "Company name is required"),
    contactName: z.string().optional(),
    email: z.string().email("A valid email is required"),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
});

export const updateSupplierSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Supplier ID is required"),
  }),
  body: z.object({
    companyName: z.string().min(1, "Company name cannot be blank").optional(),
    contactName: z.string().optional(),
    email: z.string().email("A valid email is required").optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
});

export const addSupplierProductSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Supplier ID is required"),
  }),
  body: z.object({
    productId: z.string().min(1, "Product ID is required"),
    price: z.number().positive("Unit price must be a positive number"),
    leadTimeDays: z.number().int().min(0, "Lead time days cannot be negative").optional(),
  }),
});

export const removeSupplierProductSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Supplier ID is required"),
    productId: z.string().min(1, "Product ID is required"),
  }),
});

export const getSupplierHistoryQuerySchema = z.object({
  params: z.object({
    id: z.string().min(1, "Supplier ID is required"),
  }),
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  }),
});
