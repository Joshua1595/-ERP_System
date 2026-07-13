import { Router } from "express";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { multerUpload, FileValidators } from "../middleware/upload.ts";
import { StorageController } from "../controllers/storage.controller.ts";
import { uploadIdSchema, fileIdSchema } from "../validation/storage.validation.ts";
import { UserRole } from "@prisma/client";

const router = Router();

/**
 * @route   GET /api/storage/files/*
 * @desc    Retrieve and download/serve local storage uploaded files
 * @access  Public (so assets/images can load in UI, documents, or reports)
 */
router.get("/files/*", StorageController.serveLocalFile);

// Apply authentication middleware to all subsequent administrative/upload routes
router.use(requireAuth);

/**
 * @route   POST /api/storage/employees/:id/photo
 * @desc    Upload profile photo for a specific employee
 * @access  Restricted to ADMIN, MANAGER, and EMPLOYEE
 */
router.post(
  "/employees/:id/photo",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE),
  validate(uploadIdSchema),
  multerUpload.single("file"),
  FileValidators.employeePhoto,
  StorageController.uploadEmployeePhoto
);

/**
 * @route   POST /api/storage/products/:id/image
 * @desc    Upload a product showcase image
 * @access  Restricted to ADMIN and MANAGER
 */
router.post(
  "/products/:id/image",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(uploadIdSchema),
  multerUpload.single("file"),
  FileValidators.productImage,
  StorageController.uploadProductImage
);

/**
 * @route   POST /api/storage/invoices/:id/attachment
 * @desc    Upload an attachment (receipt, signed PO, contract pdf) to an Invoice
 * @access  Restricted to ADMIN, MANAGER, and ACCOUNTANT
 */
router.post(
  "/invoices/:id/attachment",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT),
  validate(uploadIdSchema),
  multerUpload.single("file"),
  FileValidators.invoiceAttachment,
  StorageController.uploadInvoiceAttachment
);

/**
 * @route   GET /api/storage/logs
 * @desc    List metadata files upload logs (for audit)
 * @access  Restricted to ADMIN and MANAGER
 */
router.get(
  "/logs",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  StorageController.listLogs
);

/**
 * @route   DELETE /api/storage/files/:id
 * @desc    Delete an uploaded file from storage and records
 * @access  Restricted to ADMIN and MANAGER
 */
router.delete(
  "/files/:id",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(fileIdSchema),
  StorageController.deleteFile
);

export default router;
