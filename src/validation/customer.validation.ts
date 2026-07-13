import { z } from "zod";

export const getCustomerByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Customer ID is required"),
  }),
});

export const getCustomersPagedSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    search: z.string().optional(),
  }),
});

export const createCustomerSchema = z.object({
  body: z.object({
    companyName: z.string().nullable().optional(),
    contactName: z.string().min(1, "Contact name is required"),
    email: z.string().email("Invalid email format"),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
  }),
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Customer ID is required"),
  }),
  body: z.object({
    companyName: z.string().nullable().optional(),
    contactName: z.string().min(1, "Contact name is required"),
    email: z.string().email("Invalid email format"),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
  }),
});

export const deleteCustomerSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Customer ID is required"),
  }),
});
