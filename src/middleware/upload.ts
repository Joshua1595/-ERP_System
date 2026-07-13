import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../utils/errors.ts";

// Set up memory storage so files are handled in-buffer before uploading to local or cloud storage.
const storage = multer.memoryStorage();

// Multer setup
export const multerUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Default hard limit: 10MB
  },
});

export interface FileValidationOptions {
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  errorMessage?: string;
}

/**
 * Express middleware to validate an uploaded file after Multer parses it
 */
export function validateUploadedFile(options: FileValidationOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;

    if (!file) {
      return next(new BadRequestError("No file was uploaded. Please attach a file and try again."));
    }

    // Validate size
    if (file.size > options.maxSizeBytes) {
      const maxMb = (options.maxSizeBytes / (1024 * 1024)).toFixed(1);
      return next(
        new BadRequestError(
          options.errorMessage || `File size exceeds the maximum allowed limit of ${maxMb}MB.`
        )
      );
    }

    // Validate MIME type
    if (!options.allowedMimeTypes.includes(file.mimetype)) {
      return next(
        new BadRequestError(
          options.errorMessage ||
            `Invalid file type '${file.mimetype}'. Allowed formats: ${options.allowedMimeTypes
              .map((type) => type.split("/")[1]?.toUpperCase() || type)
              .join(", ")}.`
        )
      );
    }

    next();
  };
}

/**
 * Standard pre-configured file validators
 */
export const FileValidators = {
  // Employee Photos: JPEG/PNG/WEBP, Max 5MB
  employeePhoto: validateUploadedFile({
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 5 * 1024 * 1024,
    errorMessage: "Employee photo must be a valid image (JPEG, PNG, or WEBP) and under 5MB.",
  }),

  // Product Images: JPEG/PNG/WEBP/GIF, Max 5MB
  productImage: validateUploadedFile({
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxSizeBytes: 5 * 1024 * 1024,
    errorMessage: "Product image must be a valid image (JPEG, PNG, WEBP, or GIF) and under 5MB.",
  }),

  // Invoice Attachments: PDF/Word/Excel/Images, Max 10MB
  invoiceAttachment: validateUploadedFile({
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "text/csv",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    maxSizeBytes: 10 * 1024 * 1024,
    errorMessage: "Attachment must be a valid invoice document (PDF, Word, Excel, CSV, Text or image) and under 10MB.",
  }),
};
