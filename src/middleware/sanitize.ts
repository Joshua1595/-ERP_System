import { Request, Response, NextFunction } from "express";

/**
 * Escapes common HTML special characters to prevent HTML/script injection (XSS).
 * Skips base64 data URLs or fields holding photos/images/urls/attachments to prevent data corruption.
 */
export function sanitizeString(value: string, key?: string): string {
  if (
    value.startsWith("data:image/") ||
    (key && (
      key.toLowerCase().includes("photo") ||
      key.toLowerCase().includes("image") ||
      key.toLowerCase().includes("url") ||
      key.toLowerCase().includes("attachment") ||
      key.toLowerCase().includes("file")
    ))
  ) {
    return value;
  }
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Recursively traverses and sanitizes strings in an object/array.
 */
export function sanitizeData(data: any, key?: string): any {
  if (typeof data === "string") {
    return sanitizeString(data, key);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  if (data !== null && typeof data === "object") {
    const sanitized: Record<string, any> = {};
    for (const k of Object.keys(data)) {
      sanitized[k] = sanitizeData(data[k], k);
    }
    return sanitized;
  }

  return data;
}

/**
 * Express middleware to sanitize incoming request bodies, queries, and params.
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeData(req.body);
  }
  if (req.query) {
    req.query = sanitizeData(req.query);
  }
  if (req.params) {
    req.params = sanitizeData(req.params);
  }
  next();
};
