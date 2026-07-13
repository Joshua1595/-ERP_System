import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../lib/db.ts";
import { validate } from "../middleware/validate.ts";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { UserRole, StockMovementType } from "@prisma/client";
import { InventoryController } from "../controllers/inventory.controller.ts";
import {
  getStockLevelsQuerySchema,
  getStockLevelSchema,
  updateBoundsSchema,
  stockInSchema,
  stockOutSchema,
  transferSchema,
  getStockHistoryQuerySchema,
} from "../validation/inventory.validation.ts";

const router = Router();

// Apply auth to all inventory routes
router.use(requireAuth);

// ==========================================
// CORE INVENTORY MANAGEMENT ROUTES
// ==========================================

// Get stock health and valuation reports
router.get("/report", InventoryController.getInventoryReport);

// Get paginated, filterable, searchable stock history log
router.get(
  "/history",
  validate(getStockHistoryQuerySchema),
  InventoryController.getStockHistory
);

// Process Stock-In (Receipt of inventory)
router.post(
  "/stock-in",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(stockInSchema),
  InventoryController.stockIn
);

// Process Stock-Out (Withdrawal of inventory)
router.post(
  "/stock-out",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(stockOutSchema),
  InventoryController.stockOut
);

// Process Stock Transfer between Warehouses
router.post(
  "/transfer",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(transferSchema),
  InventoryController.transferStock
);

// Get paginated, filterable, searchable stock levels
router.get(
  "/levels",
  validate(getStockLevelsQuerySchema),
  InventoryController.getStockLevels
);

// Get single stock level
router.get(
  "/levels/:productId/:warehouseId",
  validate(getStockLevelSchema),
  InventoryController.getStockLevel
);

// Set Stock bounds (Minimum, Maximum, Reorder Level)
router.put(
  "/levels/:productId/:warehouseId/bounds",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(updateBoundsSchema),
  InventoryController.updateStockLevelBounds
);

// ==========================================
// BASE CONFIGURATION & LEGACY COMPATIBILITY ROUTES
// ==========================================

// Get all categories
router.get("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await db.getCategories();
    res.status(200).json({ status: "success", data: { categories } });
  } catch (error) {
    next(error);
  }
});

// Get all products (with categories & warehouse stocks nested)
router.get("/products", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await db.getProducts();
    res.status(200).json({ status: "success", data: { products } });
  } catch (error) {
    next(error);
  }
});

// Create product (Admin / Manager only)
const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Product name is required"),
    sku: z.string().min(3, "SKU code is required (min 3 chars)"),
    description: z.string().optional(),
    categoryId: z.string().min(1, "Category ID is required"),
    price: z.number().positive("Selling price must be positive"),
    cost: z.number().positive("Manufacturing/purchase cost must be positive"),
    unitOfMeasure: z.string().min(1, "Unit of measure is required (e.g., PCS, KG)"),
  }),
});

router.post(
  "/products",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(createProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await db.createProduct(req.body);
      res.status(201).json({ status: "success", message: "Product record cataloged successfully", data: { product } });
    } catch (error) {
      next(error);
    }
  }
);

// Get all warehouses
router.get("/warehouses", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouses = await db.getWarehouses();
    res.status(200).json({ status: "success", data: { warehouses } });
  } catch (error) {
    next(error);
  }
});

// Get stock movement history log (unpaginated)
router.get("/movements", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const movements = await db.getStockMovements();
    res.status(200).json({ status: "success", data: { movements } });
  } catch (error) {
    next(error);
  }
});

// Post stock movement (INCOMING, OUTGOING, ADJUSTMENT, TRANSFER) (Admin / Manager only)
const createMovementSchema = z.object({
  body: z.object({
    productId: z.string().min(1, "Product ID is required"),
    warehouseId: z.string().min(1, "Warehouse ID is required"),
    quantityChange: z.number(),
    type: z.nativeEnum(StockMovementType),
    referenceNumber: z.string().optional(),
    description: z.string().optional(),
  }),
});

router.post(
  "/movements",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(createMovementSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, warehouseId, quantityChange, type, referenceNumber, description } = req.body;
      const createdById = req.user!.userId;

      const movement = await db.createStockMovement({
        productId,
        warehouseId,
        quantityChange,
        type,
        referenceNumber,
        description,
        createdById,
      });

      res.status(201).json({
        status: "success",
        message: "Inventory movement transactions posted and warehouse balances updated.",
        data: { movement },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
