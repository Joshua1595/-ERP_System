import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { SalesController } from "../controllers/sales.controller.ts";
import {
  createSalesInvoiceSchema,
  getInvoiceByIdSchema,
  getInvoicesPagedSchema,
  getDailySalesSchema,
  getMonthlySalesSchema,
} from "../validation/sales.validation.ts";

const router = Router();

// Require authentication for all Sales Management routes
router.use(requireAuth);

// 1. Analytics & Reporting (Available to ADMIN, MANAGER)
router.get(
  "/daily",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(getDailySalesSchema),
  SalesController.getDailySales
);

router.get(
  "/monthly",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(getMonthlySalesSchema),
  SalesController.getMonthlySales
);

// 2. Query routes (Available to all authenticated roles for general lookup / Sales History)
router.get(
  "/invoices",
  validate(getInvoicesPagedSchema),
  SalesController.getInvoicesPaged
);

router.get(
  "/invoices/:id",
  validate(getInvoiceByIdSchema),
  SalesController.getInvoiceById
);

// 3. Command routes (Restricted to ADMIN, MANAGER, and ACCOUNTANT roles)
router.post(
  "/invoices",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT),
  validate(createSalesInvoiceSchema),
  SalesController.createSalesInvoice
);

export default router;
