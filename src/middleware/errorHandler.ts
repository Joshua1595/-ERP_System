import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.ts";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If the error is a known custom operational error
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: "error",
      statusCode: err.statusCode,
      message: err.message,
    });
  }

  // Handle Prisma-specific database errors (e.g., duplicate unique keys, connection issues)
  if (err.name === "PrismaClientKnownRequestError") {
    // e.g., unique constraint failed
    if ((err as any).code === "P2002") {
      return res.status(409).json({
        status: "error",
        statusCode: 409,
        message: "Unique constraint failed: A record with this value already exists.",
        details: (err as any).meta,
      });
    }
    // Record not found
    if ((err as any).code === "P2025") {
      return res.status(404).json({
        status: "error",
        statusCode: 404,
        message: "Record not found.",
      });
    }
  }

  // Handle standard JSON parsing syntax errors
  if (err instanceof SyntaxError && "status" in err && (err as any).status === 400) {
    return res.status(400).json({
      status: "error",
      statusCode: 400,
      message: "Malformed JSON payload: Check syntax.",
    });
  }

  // Log unhandled non-operational (system/unexpected) bugs for developer visibility
  console.error("❌ UNHANDLED INTERNAL ERROR:", err);

  return res.status(500).json({
    status: "error",
    statusCode: 500,
    message: "An unexpected error occurred on the server. Please try again later.",
    // Only include stack/raw message in non-production environments
    ...(process.env.NODE_ENV !== "production" ? { error: err.message, stack: err.stack } : {}),
  });
};
