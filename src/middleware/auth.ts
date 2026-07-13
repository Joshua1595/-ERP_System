import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.ts";
import { JWTPayload } from "../types/index.ts";
import { db } from "../lib/db.ts";

const JWT_SECRET = process.env.JWT_SECRET || "super-secure-default-erp-secret-key-2026";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Authentication token is missing. Please log in."));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Check if the user is still active in the database
    const dbUser = await db.findUserById(decoded.userId);
    if (!dbUser) {
      return next(new UnauthorizedError("Your user account was not found."));
    }
    if (!dbUser.isActive) {
      return next(new UnauthorizedError("This account has been suspended/blocked. Access denied."));
    }

    req.user = decoded;
    next();
  } catch (error) {
    return next(new UnauthorizedError("Invalid or expired authentication token."));
  }
};

export const restrictTo = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("User is not authenticated."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access Denied: Your role (${req.user.role}) does not have permissions to perform this action.`
        )
      );
    }

    next();
  };
};
