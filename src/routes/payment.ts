import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { PaymentController } from "../controllers/payment.controller.ts";
import {
  createPaymentSchema,
  getPaymentByIdSchema,
  getPaymentsPagedSchema,
} from "../validation/payment.validation.ts";

const router = Router();

// Require authentication for all Payment Management routes
router.use(requireAuth);

// 1. Query routes (Available to all authenticated roles for general lookup / Payment History)
router.get(
  "/",
  validate(getPaymentsPagedSchema),
  PaymentController.getPaymentsPaged
);

router.get(
  "/:id",
  validate(getPaymentByIdSchema),
  PaymentController.getPaymentById
);

router.get(
  "/invoice/:invoiceId/outstanding",
  PaymentController.getOutstandingDetails
);

// 2. Command routes (Restricted to ADMIN, MANAGER, and ACCOUNTANT roles)
router.post(
  "/",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT),
  validate(createPaymentSchema),
  PaymentController.createPayment
);

export default router;
