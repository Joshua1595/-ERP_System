import { Router } from "express";
import { ProductController } from "../controllers/product.controller.ts";
import { validate } from "../middleware/validate.ts";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { autoLogMutation } from "../middleware/activityLogger.ts";
import { 
  createProductSchema, 
  updateProductSchema, 
  getProductByIdSchema,
  getProductsQuerySchema,
  updateStockSchema
} from "../validation/product.validation.ts";
import { UserRole } from "@prisma/client";

const router = Router();

// Apply global authentication and activity logging to all Product APIs
router.use(requireAuth);
router.use(autoLogMutation("PRODUCT"));

router.route("/")
  .get(
    validate(getProductsQuerySchema),
    ProductController.getAll
  )
  .post(
    restrictTo(UserRole.ADMIN, UserRole.MANAGER),
    validate(createProductSchema),
    ProductController.create
  );

router.route("/:id/stock")
  .post(
    restrictTo(UserRole.ADMIN, UserRole.MANAGER),
    validate(updateStockSchema),
    ProductController.updateStock
  );

router.route("/:id")
  .get(
    validate(getProductByIdSchema),
    ProductController.getById
  )
  .put(
    restrictTo(UserRole.ADMIN, UserRole.MANAGER),
    validate(getProductByIdSchema),
    validate(updateProductSchema),
    ProductController.update
  )
  .delete(
    restrictTo(UserRole.ADMIN, UserRole.MANAGER),
    validate(getProductByIdSchema),
    ProductController.delete
  );

export default router;
