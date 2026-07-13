import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboard.service.ts";

export class DashboardController {
  /**
   * Retrieves aggregated KPI cards, top products, top customers, and recent sales
   */
  static async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const bypassCache = req.query.bypassCache === "true" || req.query.refresh === "true";

      const metrics = await DashboardService.getDashboardMetrics(bypassCache);

      res.status(200).json({
        status: "success",
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Forces invalidation of cached dashboard data
   */
  static clearCache(req: Request, res: Response, next: NextFunction) {
    try {
      DashboardService.clearDashboardCache();
      res.status(200).json({
        status: "success",
        message: "Dashboard metrics cache invalidated successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
}
