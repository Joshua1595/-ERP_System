import { Request, Response, NextFunction } from "express";
import { ReportService } from "../services/report.service.ts";

export class ReportController {
  /**
   * Safe helper to parse query dates
   */
  private static parseDates(req: Request) {
    const startDateQuery = req.query.startDate as string | undefined;
    const endDateQuery = req.query.endDate as string | undefined;

    const startDate = startDateQuery ? new Date(startDateQuery) : undefined;
    const endDate = endDateQuery ? new Date(endDateQuery) : undefined;
    const bypassCache = req.query.bypassCache === "true";
    const format = req.query.format as string | undefined;

    return { startDate, endDate, bypassCache, format };
  }

  /**
   * Shared helper to stream Excel or PDF content, or return JSON
   */
  private static handleExportOrJson<T>(
    res: Response,
    data: T,
    excelExporter: (d: T) => string,
    pdfExporter: (d: T) => string,
    filenamePrefix: string,
    format?: string
  ) {
    if (format === "excel") {
      const csvContent = excelExporter(data);
      const filename = `${filenamePrefix}_${new Date().toISOString().split("T")[0]}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    }

    if (format === "pdf") {
      const htmlContent = pdfExporter(data);
      // For PDF, we send premium HTML set for page printing.
      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(htmlContent);
    }

    // Default: JSON response
    return res.status(200).json({
      status: "success",
      data,
    });
  }

  /**
   * GET /api/reports/sales
   * Sales Report (with Date Filters & PDF/Excel Exporter support)
   */
  static async getSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, bypassCache, format } = ReportController.parseDates(req);
      const reportData = await ReportService.getSalesReport(startDate, endDate, bypassCache);

      return ReportController.handleExportOrJson(
        res,
        reportData,
        (d) => ReportService.exportSalesToExcel(d),
        (d) => ReportService.exportSalesToPDF(d, startDate, endDate),
        "sales_report",
        format
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/purchase
   * Purchase Report (with Date Filters & PDF/Excel Exporter support)
   */
  static async getPurchaseReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, bypassCache, format } = ReportController.parseDates(req);
      const reportData = await ReportService.getPurchaseReport(startDate, endDate, bypassCache);

      return ReportController.handleExportOrJson(
        res,
        reportData,
        (d) => ReportService.exportPurchaseToExcel(d),
        (d) => ReportService.exportPurchaseToPDF(d, startDate, endDate),
        "purchase_report",
        format
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/inventory
   * Inventory Valuation and Alerts Report
   */
  static async getInventoryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const bypassCache = req.query.bypassCache === "true";
      const format = req.query.format as string | undefined;
      const reportData = await ReportService.getInventoryReport(bypassCache);

      return ReportController.handleExportOrJson(
        res,
        reportData,
        (d) => ReportService.exportInventoryToExcel(d),
        (d) => ReportService.exportInventoryToPDF(d),
        "inventory_report",
        format
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/customer
   * Customer Spent & Purchasing Volume Report
   */
  static async getCustomerReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, bypassCache, format } = ReportController.parseDates(req);
      const reportData = await ReportService.getCustomerReport(startDate, endDate, bypassCache);

      return ReportController.handleExportOrJson(
        res,
        reportData,
        (d) => ReportService.exportCustomerToExcel(d),
        (d) => ReportService.exportCustomerToPDF(d, startDate, endDate),
        "customer_report",
        format
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/employee
   * Employee Payroll & Attendance Report
   */
  static async getEmployeeReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, bypassCache, format } = ReportController.parseDates(req);
      const reportData = await ReportService.getEmployeeReport(startDate, endDate, bypassCache);

      return ReportController.handleExportOrJson(
        res,
        reportData,
        (d) => ReportService.exportEmployeeToExcel(d),
        (d) => ReportService.exportEmployeeToPDF(d, startDate, endDate),
        "employee_report",
        format
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/profit
   * Profit & Loss Financial Statement
   */
  static async getProfitReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, bypassCache, format } = ReportController.parseDates(req);
      const reportData = await ReportService.getProfitReport(startDate, endDate, bypassCache);

      return ReportController.handleExportOrJson(
        res,
        reportData,
        (d) => ReportService.exportProfitToExcel(d),
        (d) => ReportService.exportProfitToPDF(d, startDate, endDate),
        "profit_report",
        format
      );
    } catch (error) {
      next(error);
    }
  }
}
