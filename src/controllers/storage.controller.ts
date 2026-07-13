import { Request, Response, NextFunction } from "express";
import { StorageService } from "../services/storage/storage.service.ts";
import { db } from "../lib/db.ts";
import { NotFoundError, BadRequestError, ForbiddenError } from "../utils/errors.ts";
import * as path from "path";
import { existsSync } from "fs";

export class StorageController {
  /**
   * POST /api/storage/employees/:id/photo
   * Upload an employee's photo, store in folder "employees", and associate it with the employee
   */
  static async uploadEmployeePhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        throw new BadRequestError("No file was uploaded.");
      }

      // Check if employee exists
      const employee = await db.getEmployeeById(id);
      if (!employee) {
        throw new NotFoundError(`Employee with ID "${id}" was not found.`);
      }

      // Upload file to active storage provider
      const record = await StorageService.uploadFile(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        "employees"
      );

      // Update Employee profilePhotoUrl
      const updatedEmployee = await db.updateEmployee(id, {
        profilePhotoUrl: record.url,
      });

      return res.status(200).json({
        status: "success",
        message: "Employee profile photo uploaded successfully.",
        data: {
          file: record,
          employee: updatedEmployee,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/storage/products/:id/image
   * Upload a product's image, store in folder "products", and associate it with the product
   */
  static async uploadProductImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        throw new BadRequestError("No file was uploaded.");
      }

      // Check if product exists
      const product = await db.getProductById(id);
      if (!product) {
        throw new NotFoundError(`Product with ID "${id}" was not found.`);
      }

      // Upload file to active storage provider
      const record = await StorageService.uploadFile(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        "products"
      );

      // Update Product imageUrl
      const updatedProduct = await db.updateProduct(id, {
        imageUrl: record.url,
      });

      return res.status(200).json({
        status: "success",
        message: "Product image uploaded successfully.",
        data: {
          file: record,
          product: updatedProduct,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/storage/invoices/:id/attachment
   * Upload an invoice attachment, store in folder "invoices", and associate it with the invoice
   */
  static async uploadInvoiceAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        throw new BadRequestError("No file was uploaded.");
      }

      // Check if invoice exists
      const invoice = await db.getInvoiceById(id);
      if (!invoice) {
        throw new NotFoundError(`Invoice with ID "${id}" was not found.`);
      }

      // Upload file to active storage provider
      const record = await StorageService.uploadFile(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        "invoices"
      );

      // Update Invoice attachmentUrl
      const updatedInvoice = await db.updateInvoiceAttachment(id, record.url);

      return res.status(200).json({
        status: "success",
        message: "Invoice attachment uploaded successfully.",
        data: {
          file: record,
          invoice: updatedInvoice,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/storage/files/*
   * Serve local files securely if stored on disk via LocalStorageProvider
   */
  static serveLocalFile(req: Request, res: Response, next: NextFunction) {
    try {
      const fileRelativePath = req.params[0];
      if (!fileRelativePath) {
        throw new BadRequestError("File path is required.");
      }

      const uploadsDir = path.resolve(process.cwd(), "uploads");
      const resolvedPath = path.resolve(uploadsDir, fileRelativePath);

      // Prevent Directory Traversal Attack
      if (!resolvedPath.startsWith(uploadsDir)) {
        throw new ForbiddenError("Access denied. You cannot read outside the uploads directory.");
      }

      if (!existsSync(resolvedPath)) {
        throw new NotFoundError("The requested file does not exist.");
      }

      // Send file content (Express auto-detects content-type based on extension!)
      return res.sendFile(resolvedPath);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/storage/logs
   * Retrieve list of all uploaded files (audit log)
   */
  static async listLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await StorageService.listAllFiles();
      return res.status(200).json({
        status: "success",
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/storage/files/:id
   * Remove file from storage and database registry
   */
  static async deleteFile(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await StorageService.deleteFile(id);

      return res.status(200).json({
        status: "success",
        message: "File deleted successfully from storage and records.",
      });
    } catch (error) {
      next(error);
    }
  }
}
