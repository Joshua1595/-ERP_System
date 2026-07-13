import { z } from "zod";

export const getPaymentByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Payment ID is required"),
  }),
});

export const getPaymentsPagedSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
    search: z.string().optional(),
  }),
});

export const createPaymentSchema = z.object({
  body: z.object({
    invoiceId: z.string().min(1, "Invoice ID is required"),
    amountPaid: z.number().gt(0, "Amount paid must be greater than zero"),
    paymentMethod: z.string().refine(
      (val) => ["CASH", "BANK_TRANSFER", "MOBILE_PAYMENT"].includes(val),
      { message: "Payment method must be CASH, BANK_TRANSFER, or MOBILE_PAYMENT" }
    ),
    referenceNo: z.string().trim().nullable().optional(),
  }),
});
