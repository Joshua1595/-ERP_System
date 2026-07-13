import { Request, Response, NextFunction } from "express";
import { ActivityLogService } from "../services/activity-log.service.ts";

export class ActivityLogController {
  /**
   * GET /api/activity-logs
   * Retrieve paginated activity logs with search & filters
   */
  static async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        userId,
        userEmail,
        action,
        entityType,
        entityId,
        search,
        page: pageStr,
        limit: limitStr,
      } = req.query as {
        userId?: string;
        userEmail?: string;
        action?: string;
        entityType?: string;
        entityId?: string;
        search?: string;
        page?: string;
        limit?: string;
      };

      const page = pageStr ? parseInt(pageStr, 10) : 1;
      const limit = limitStr ? parseInt(limitStr, 10) : 20;

      const result = await ActivityLogService.getLogs({
        userId,
        userEmail,
        action,
        entityType,
        entityId,
        search,
        page,
        limit,
      });

      return res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/activity-logs/:id
   * Retrieve details of a specific log by ID
   */
  static async getLogById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const log = await ActivityLogService.getLogById(id);

      return res.status(200).json({
        status: "success",
        data: log,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/activity-logs/purge
   * Admin-only: Purge activity logs older than specified number of days
   */
  static async purgeLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { days } = req.body;
      const daysToKeep = days !== undefined ? parseInt(days, 10) : 30;

      if (isNaN(daysToKeep) || daysToKeep < 0) {
        return res.status(400).json({
          status: "fail",
          message: "Please provide a valid non-negative number of days.",
        });
      }

      const count = await ActivityLogService.purgeOldLogs(daysToKeep);

      // Log the purging action itself!
      if (req.logActivity) {
        await req.logActivity(
          "DELETE",
          "SYSTEM_MAINTENANCE",
          null,
          `Purged ${count} activity logs older than ${daysToKeep} days.`
        );
      }

      return res.status(200).json({
        status: "success",
        message: `Successfully purged ${count} activity logs older than ${daysToKeep} days.`,
        data: {
          purgedCount: count,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/activity-logs/custom
   * Create a manual activity log entry
   */
  static async createCustomLog(req: Request, res: Response, next: NextFunction) {
    try {
      const { action, entityType, entityId, details } = req.body;

      if (!action) {
        return res.status(400).json({
          status: "fail",
          message: "The 'action' field is required.",
        });
      }

      let log;
      if (req.logActivity) {
        log = await req.logActivity(action, entityType, entityId, details);
      } else {
        const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null;
        const userAgent = req.headers["user-agent"] || null;
        log = await ActivityLogService.log({
          userId: req.user?.userId || null,
          userEmail: req.user?.email || null,
          action,
          entityType,
          entityId,
          ipAddress,
          userAgent,
          details,
        });
      }

      return res.status(201).json({
        status: "success",
        data: log,
      });
    } catch (error) {
      next(error);
    }
  }
}
