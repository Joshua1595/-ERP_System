import { Request, Response, NextFunction } from "express";
import { ActivityLogService } from "../services/activity-log.service.ts";

/**
 * Middleware to attach the `logActivity` helper to the request object.
 * This makes audit logging inside controller actions extremely easy and robust.
 */
export const activityLogger = (req: Request, res: Response, next: NextFunction) => {
  const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null;
  const userAgent = req.headers["user-agent"] || null;

  // Attach dynamic logActivity helper function
  req.logActivity = async (
    action: string,
    entityType?: string | null,
    entityId?: string | null,
    details?: string | null
  ) => {
    try {
      const userId = req.user?.userId || null;
      const userEmail = req.user?.email || null;

      return await ActivityLogService.log({
        userId,
        userEmail,
        action,
        entityType,
        entityId,
        ipAddress,
        userAgent,
        details,
      });
    } catch (err) {
      console.error("Failed to write activity log:", err);
    }
  };

  next();
};

/**
 * Router middleware to automatically log modification actions (POST, PUT, DELETE).
 * Infers entityType from the API path if not provided.
 */
export const autoLogMutation = (entityType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // We only log after the request has been processed successfully (using finish event)
    res.on("finish", async () => {
      // Only log successful/accepted mutations (2xx statuses)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const method = req.method;
        let action = "";

        if (method === "POST") {
          action = "CREATE";
        } else if (method === "PUT" || method === "PATCH") {
          action = "UPDATE";
        } else if (method === "DELETE") {
          action = "DELETE";
        }

        if (action && req.logActivity) {
          // Attempt to extract entityId from params, or response body (if sent)
          const entityId = req.params.id || null;
          
          let details = `Auto-logged ${action.toLowerCase()} action on ${entityType}`;
          if (method !== "DELETE" && req.body) {
            // Include safe, non-sensitive request body payload details
            const safePayload = { ...req.body };
            // Strip sensitive fields
            delete safePayload.password;
            delete safePayload.passwordHash;
            delete safePayload.token;
            details += ` with payload: ${JSON.stringify(safePayload)}`;
          }

          await req.logActivity(action, entityType, entityId, details);
        }
      }
    });

    next();
  };
};
