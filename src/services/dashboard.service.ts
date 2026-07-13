import { DashboardRepository, DashboardMetrics } from "../repositories/dashboard.repository.ts";
import { CacheService } from "./cache.service.ts";

export class DashboardService {
  private static CACHE_KEY = "dashboard_metrics_data";
  private static DEFAULT_TTL = 30 * 1000; // 30 seconds

  /**
   * Retrieves aggregated dashboard metrics using caching
   * @param bypassCache If true, bypass cache and fetch directly from DB/mock, updating the cache
   */
  static async getDashboardMetrics(bypassCache: boolean = false): Promise<DashboardMetrics> {
    if (bypassCache) {
      const data = await DashboardRepository.getDashboardMetrics();
      CacheService.set(this.CACHE_KEY, data, this.DEFAULT_TTL);
      return data;
    }

    return await CacheService.getOrSet(
      this.CACHE_KEY,
      () => DashboardRepository.getDashboardMetrics(),
      this.DEFAULT_TTL
    );
  }

  /**
   * Clears/Invalidates the dashboard cache
   */
  static clearDashboardCache(): void {
    CacheService.invalidate(this.CACHE_KEY);
  }
}
