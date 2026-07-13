import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { autoLogMutation } from "../middleware/activityLogger.ts";
import { CustomerController } from "../controllers/customer.controller.ts";
import {
  createCustomerSchema,
  getCustomerByIdSchema,
  updateCustomerSchema,
  deleteCustomerSchema,
  getCustomersPagedSchema,
} from "../validation/customer.validation.ts";

const router = Router();

// Apply authentication and activity logging middleware to all customer routes
router.use(requireAuth);
router.use(autoLogMutation("CUSTOMER"));

// 1. Query routes (Available to all authenticated roles)
router.get(
  "/",
  validate(getCustomersPagedSchema),
  CustomerController.getCustomersPaged
);

router.get(
  "/:id",
  validate(getCustomerByIdSchema),
  CustomerController.getCustomerById
);

// 2. Command routes (Restricted to ADMIN and MANAGER roles)
router.post(
  "/",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(createCustomerSchema),
  CustomerController.createCustomer
);

router.put(
  "/:id",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(updateCustomerSchema),
  CustomerController.updateCustomer
);

router.delete(
  "/:id",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(deleteCustomerSchema),
  CustomerController.deleteCustomer
);

export default router;
