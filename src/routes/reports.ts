import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { ReportController } from "../controllers/report.controller.ts";
import { getReportSchema } from "../validation/report.validation.ts";

const router = Router();

// Secure all reporting endpoints: require login, restrict to ADMIN & MANAGER roles
router.use(requireAuth);
router.use(restrictTo(UserRole.ADMIN, UserRole.MANAGER));

/**
 * @route   GET /api/reports/sales
 * @desc    Generate Sales Report (JSON, Excel, or printable PDF)
 */
router.get("/sales", validate(getReportSchema), ReportController.getSalesReport);

/**
 * @route   GET /api/reports/purchase
 * @desc    Generate Purchase Report (JSON, Excel, or printable PDF)
 */
router.get("/purchase", validate(getReportSchema), ReportController.getPurchaseReport);

/**
 * @route   GET /api/reports/inventory
 * @desc    Generate Inventory Report (JSON, Excel, or printable PDF)
 */
router.get("/inventory", validate(getReportSchema), ReportController.getInventoryReport);

/**
 * @route   GET /api/reports/customer
 * @desc    Generate Customer Spent Report (JSON, Excel, or printable PDF)
 */
router.get("/customer", validate(getReportSchema), ReportController.getCustomerReport);

/**
 * @route   GET /api/reports/employee
 * @desc    Generate Employee Performance Report (JSON, Excel, or printable PDF)
 */
router.get("/employee", validate(getReportSchema), ReportController.getEmployeeReport);

/**
 * @route   GET /api/reports/profit
 * @desc    Generate Profit & Loss Statement (JSON, Excel, or printable PDF)
 */
router.get("/profit", validate(getReportSchema), ReportController.getProfitReport);

export default router;
