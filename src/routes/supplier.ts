import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { autoLogMutation } from "../middleware/activityLogger.ts";
import { SupplierController } from "../controllers/supplier.controller.ts";
import {
  getSuppliersQuerySchema,
  getSupplierByIdSchema,
  createSupplierSchema,
  updateSupplierSchema,
  addSupplierProductSchema,
  removeSupplierProductSchema,
  getSupplierHistoryQuerySchema,
} from "../validation/supplier.validation.ts";

const router = Router();

// Require authenticated user and log mutations for all supplier routes
router.use(requireAuth);
router.use(autoLogMutation("SUPPLIER"));

// 1. Core Supplier CRUD routes
router.get(
  "/",
  validate(getSuppliersQuerySchema),
  SupplierController.getSuppliers
);

router.get(
  "/:id",
  validate(getSupplierByIdSchema),
  SupplierController.getSupplierById
);

router.post(
  "/",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(createSupplierSchema),
  SupplierController.createSupplier
);

router.put(
  "/:id",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(updateSupplierSchema),
  SupplierController.updateSupplier
);

router.delete(
  "/:id",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(getSupplierByIdSchema),
  SupplierController.deleteSupplier
);

// 2. Supplier Product catalog mapping routes
router.get(
  "/:id/products",
  validate(getSupplierByIdSchema),
  SupplierController.getSupplierProducts
);

router.post(
  "/:id/products",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(addSupplierProductSchema),
  SupplierController.addSupplierProduct
);

router.delete(
  "/:id/products/:productId",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(removeSupplierProductSchema),
  SupplierController.removeSupplierProduct
);

// 3. Purchase History route
router.get(
  "/:id/purchase-history",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT),
  validate(getSupplierHistoryQuerySchema),
  SupplierController.getSupplierPurchaseHistory
);

export default router;
