import { prisma, checkDatabaseConnection, mockActivityLogs } from "../lib/db.ts";

export interface ActivityLogFilters {
  userId?: string;
  userEmail?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class ActivityLogRepository {
  /**
   * Log an activity
   */
  static async create(data: {
    userId?: string | null;
    userEmail?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    details?: string | null;
  }) {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        return await prisma.activityLog.create({
          data: {
            userId: data.userId || null,
            userEmail: data.userEmail || null,
            action: data.action,
            entityType: data.entityType || null,
            entityId: data.entityId || null,
            ipAddress: data.ipAddress || null,
            userAgent: data.userAgent || null,
            details: data.details || null,
          },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        });
      } catch (err) {
        console.error("Prisma error in ActivityLogRepository.create, using mock fallback:", err);
      }
    }

    // Mock Fallback
    const id = "log-" + Math.random().toString(36).substring(2, 9);
    const newLog = {
      id,
      userId: data.userId || null,
      userEmail: data.userEmail || null,
      action: data.action,
      entityType: data.entityType || null,
      entityId: data.entityId || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      details: data.details || null,
      createdAt: new Date(),
    };
    mockActivityLogs.push(newLog);
    return newLog;
  }

  /**
   * List logs with filters, pagination and search
   */
  static async findAllPaged(filters: ActivityLogFilters = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const where: any = {};

        if (filters.userId) {
          where.userId = filters.userId;
        }
        if (filters.userEmail) {
          where.userEmail = { contains: filters.userEmail, mode: "insensitive" };
        }
        if (filters.action) {
          where.action = filters.action;
        }
        if (filters.entityType) {
          where.entityType = filters.entityType;
        }
        if (filters.entityId) {
          where.entityId = filters.entityId;
        }

        if (filters.search) {
          where.OR = [
            { userEmail: { contains: filters.search, mode: "insensitive" } },
            { action: { contains: filters.search, mode: "insensitive" } },
            { entityType: { contains: filters.search, mode: "insensitive" } },
            { details: { contains: filters.search, mode: "insensitive" } },
          ];
        }

        const [items, total] = await Promise.all([
          prisma.activityLog.findMany({
            where,
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.activityLog.count({ where }),
        ]);

        return { items, total, page, limit };
      } catch (err) {
        console.error("Prisma error in ActivityLogRepository.findAllPaged, using mock fallback:", err);
      }
    }

    // Mock Fallback
    let filtered = [...mockActivityLogs];

    if (filters.userId) {
      filtered = filtered.filter((log) => log.userId === filters.userId);
    }
    if (filters.userEmail) {
      filtered = filtered.filter(
        (log) => log.userEmail && log.userEmail.toLowerCase().includes(filters.userEmail!.toLowerCase())
      );
    }
    if (filters.action) {
      filtered = filtered.filter((log) => log.action === filters.action);
    }
    if (filters.entityType) {
      filtered = filtered.filter((log) => log.entityType === filters.entityType);
    }
    if (filters.entityId) {
      filtered = filtered.filter((log) => log.entityId === filters.entityId);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          (log.userEmail && log.userEmail.toLowerCase().includes(searchLower)) ||
          log.action.toLowerCase().includes(searchLower) ||
          (log.entityType && log.entityType.toLowerCase().includes(searchLower)) ||
          (log.details && log.details.toLowerCase().includes(searchLower))
      );
    }

    // Sort descending by createdAt
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const items = filtered.slice(skip, skip + limit);

    return { items, total, page, limit };
  }

  /**
   * Find a specific log by ID
   */
  static async findById(id: string) {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        return await prisma.activityLog.findUnique({
          where: { id },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        });
      } catch (err) {
        console.error("Prisma error in ActivityLogRepository.findById, using mock fallback:", err);
      }
    }

    // Mock Fallback
    return mockActivityLogs.find((log) => log.id === id) || null;
  }

  /**
   * Delete older logs for storage hygiene/maintenance (Admin feature)
   */
  static async deleteOlderThanDays(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const result = await prisma.activityLog.deleteMany({
          where: {
            createdAt: {
              lt: cutoff,
            },
          },
        });
        return result.count;
      } catch (err) {
        console.error("Prisma error in ActivityLogRepository.deleteOlderThanDays:", err);
      }
    }

    // Mock Fallback
    const initialCount = mockActivityLogs.length;
    const remaining = mockActivityLogs.filter((log) => log.createdAt.getTime() >= cutoff.getTime());
    mockActivityLogs.length = 0;
    mockActivityLogs.push(...remaining);
    return initialCount - remaining.length;
  }
}
