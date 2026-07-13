import { ActivityLogRepository, ActivityLogFilters } from "../repositories/activity-log.repository.ts";
import { NotFoundError } from "../utils/errors.ts";

export class ActivityLogService {
  /**
   * Log a user or system action
   */
  static async log({
    userId,
    userEmail,
    action,
    entityType,
    entityId,
    ipAddress,
    userAgent,
    details,
  }: {
    userId?: string | null;
    userEmail?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    details?: string | null;
  }) {
    return await ActivityLogRepository.create({
      userId,
      userEmail,
      action: action.toUpperCase(),
      entityType: entityType ? entityType.toUpperCase() : null,
      entityId,
      ipAddress,
      userAgent,
      details,
    });
  }

  /**
   * Retrieve list of logs with filters
   */
  static async getLogs(filters: ActivityLogFilters) {
    return await ActivityLogRepository.findAllPaged(filters);
  }

  /**
   * Retrieve a single log by ID
   */
  static async getLogById(id: string) {
    const log = await ActivityLogRepository.findById(id);
    if (!log) {
      throw new NotFoundError(`Activity log with ID "${id}" was not found.`);
    }
    return log;
  }

  /**
   * Purge old logs
   */
  static async purgeOldLogs(days: number) {
    return await ActivityLogRepository.deleteOlderThanDays(days);
  }
}
