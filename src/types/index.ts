import { UserRole } from "@prisma/client";

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// Extend global Express namespace to include the decoded JWT payload and logging helper
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      logActivity?: (
        action: string,
        entityType?: string | null,
        entityId?: string | null,
        details?: string | null
      ) => Promise<any>;
    }
  }
}
