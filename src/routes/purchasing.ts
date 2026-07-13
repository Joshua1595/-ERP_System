import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { PurchasingController } from "../controllers/purchasing.controller.ts";
import {
  createPurchaseOrderSchema,
  getPurchaseOrderByIdSchema,
  updatePurchaseOrderStatusSchema,
  receivePurchaseOrderSchema,
} from "../validation/purchasing.validation.ts";

const router = Router();

// Apply authentication middleware to all purchasing routes
router.use(requireAuth);

// 1. Core Purchase Order Queries
router.get(
  "/orders",
  PurchasingController.getPurchaseOrders
);

router.get(
  "/orders/:id",
  validate(getPurchaseOrderByIdSchema),
  PurchasingController.getPurchaseOrderById
);

// 2. Create Purchase Order
router.post(
  "/orders",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(createPurchaseOrderSchema),
  PurchasingController.createPurchaseOrder
);

// 3. Approve or Cancel Purchase Order
router.put(
  "/orders/:id/status",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(updatePurchaseOrderStatusSchema),
  PurchasingController.updatePurchaseOrderStatus
);

// 4. Receive Purchase Order Goods (Inventory restocking)
router.post(
  "/orders/:id/receive",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(receivePurchaseOrderSchema),
  PurchasingController.receivePurchaseOrder
);

export default router;
