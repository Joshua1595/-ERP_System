import { CacheService } from "./cache.service.ts";
import {
  ReportRepository,
  SalesReportData,
  PurchaseReportData,
  InventoryReportData,
  CustomerReportData,
  EmployeeReportData,
  ProfitReportData,
} from "../repositories/report.repository.ts";

export class ReportService {
  /**
   * Generates cache key based on dates and report type
   */
  private static makeCacheKey(type: string, start?: Date, end?: Date): string {
    const sStr = start ? start.toISOString().split("T")[0] : "all";
    const eStr = end ? end.toISOString().split("T")[0] : "all";
    return `report_${type}_${sStr}_${eStr}`;
  }

  // ==========================================
  // CORE REPORT RETRIEVAL (WITH CACHE)
  // ==========================================

  static async getSalesReport(start?: Date, end?: Date, bypassCache = false): Promise<SalesReportData> {
    const key = this.makeCacheKey("sales", start, end);
    if (bypassCache) {
      CacheService.invalidate(key);
    }
    return await CacheService.getOrSet(key, () => ReportRepository.getSalesReport(start, end), 30 * 1000); // 30s cache
  }

  static async getPurchaseReport(start?: Date, end?: Date, bypassCache = false): Promise<PurchaseReportData> {
    const key = this.makeCacheKey("purchase", start, end);
    if (bypassCache) {
      CacheService.invalidate(key);
    }
    return await CacheService.getOrSet(key, () => ReportRepository.getPurchaseReport(start, end), 30 * 1000);
  }

  static async getInventoryReport(bypassCache = false): Promise<InventoryReportData> {
    const key = "report_inventory";
    if (bypassCache) {
      CacheService.invalidate(key);
    }
    return await CacheService.getOrSet(key, () => ReportRepository.getInventoryReport(), 30 * 1000);
  }

  static async getCustomerReport(start?: Date, end?: Date, bypassCache = false): Promise<CustomerReportData> {
    const key = this.makeCacheKey("customer", start, end);
    if (bypassCache) {
      CacheService.invalidate(key);
    }
    return await CacheService.getOrSet(key, () => ReportRepository.getCustomerReport(start, end), 30 * 1000);
  }

  static async getEmployeeReport(start?: Date, end?: Date, bypassCache = false): Promise<EmployeeReportData> {
    const key = this.makeCacheKey("employee", start, end);
    if (bypassCache) {
      CacheService.invalidate(key);
    }
    return await CacheService.getOrSet(key, () => ReportRepository.getEmployeeReport(start, end), 30 * 1000);
  }

  static async getProfitReport(start?: Date, end?: Date, bypassCache = false): Promise<ProfitReportData> {
    const key = this.makeCacheKey("profit", start, end);
    if (bypassCache) {
      CacheService.invalidate(key);
    }
    return await CacheService.getOrSet(key, () => ReportRepository.getProfitReport(start, end), 30 * 1000);
  }

  // ==========================================
  // EXCEL / CSV GENERATION ENGINE
  // ==========================================

  private static csvEscape(val: any): string {
    if (val === null || val === undefined) return "";
    let str = typeof val === "object" && val instanceof Date ? val.toISOString() : String(val);
    str = str.replace(/"/g, '""');
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  }

  static exportSalesToExcel(data: SalesReportData): string {
    const lines: string[] = [];

    // Title Block
    lines.push("ERP SYSTEM - SALES REPORT");
    lines.push(`Generated On,${new Date().toISOString()}`);
    lines.push("");

    // Summary Section
    lines.push("SUMMARY METRICS");
    lines.push(`Total Revenue Received,${data.summary.totalRevenue}`);
    lines.push(`Total Invoice Amount,${data.summary.totalInvoiceAmount}`);
    lines.push(`Total Orders Count,${data.summary.totalOrdersCount}`);
    lines.push(`Confirmed Orders,${data.summary.confirmedOrdersCount}`);
    lines.push(`Shipped Orders,${data.summary.shippedOrdersCount}`);
    lines.push(`Cancelled Orders,${data.summary.cancelledOrdersCount}`);
    lines.push("");

    // Trend Section
    lines.push("DAILY SALES TREND");
    lines.push("Date,Total Amount,Orders Count");
    data.trend.forEach((t) => {
      lines.push(`${this.csvEscape(t.date)},${t.amount},${t.count}`);
    });
    lines.push("");

    // Product breakdown
    lines.push("PRODUCT SALES PERFORMANCE");
    lines.push("Product ID,Product Name,SKU,Quantity Sold,Revenue Generated");
    data.productSales.forEach((p) => {
      lines.push(
        `${this.csvEscape(p.productId)},${this.csvEscape(p.productName)},${this.csvEscape(p.sku)},${p.quantitySold},${p.revenue}`
      );
    });
    lines.push("");

    // Sales Orders details
    lines.push("SALES ORDERS LIST");
    lines.push("Order ID,Order Number,Customer Name,Total Amount,Status,Created At");
    data.orders.forEach((o) => {
      lines.push(
        `${this.csvEscape(o.id)},${this.csvEscape(o.orderNumber)},${this.csvEscape(o.customerName)},${o.totalAmount},${this.csvEscape(o.status)},${o.createdAt.toISOString()}`
      );
    });

    return lines.join("\n");
  }

  static exportPurchaseToExcel(data: PurchaseReportData): string {
    const lines: string[] = [];

    lines.push("ERP SYSTEM - PURCHASE REPORT");
    lines.push(`Generated On,${new Date().toISOString()}`);
    lines.push("");

    lines.push("SUMMARY METRICS");
    lines.push(`Total Purchase Cost,${data.summary.totalPurchaseAmount}`);
    lines.push(`Total PO Count,${data.summary.totalOrdersCount}`);
    lines.push(`Pending POs,${data.summary.pendingOrdersCount}`);
    lines.push(`Approved POs,${data.summary.approvedOrdersCount}`);
    lines.push(`Received POs,${data.summary.receivedOrdersCount}`);
    lines.push(`Cancelled POs,${data.summary.cancelledOrdersCount}`);
    lines.push("");

    lines.push("DAILY PURCHASING TREND");
    lines.push("Date,Total Purchase Cost,PO Count");
    data.trend.forEach((t) => {
      lines.push(`${this.csvEscape(t.date)},${t.amount},${t.count}`);
    });
    lines.push("");

    lines.push("SUPPLIER PURCHASES SUMMARY");
    lines.push("Supplier ID,Supplier Name,Total Spent,PO Count");
    data.supplierPurchases.forEach((s) => {
      lines.push(
        `${this.csvEscape(s.supplierId)},${this.csvEscape(s.supplierName)},${s.totalAmount},${s.orderCount}`
      );
    });
    lines.push("");

    lines.push("PURCHASE ORDERS LIST");
    lines.push("PO ID,PO Number,Supplier Name,Total Amount,Status,Created At");
    data.orders.forEach((o) => {
      lines.push(
        `${this.csvEscape(o.id)},${this.csvEscape(o.poNumber)},${this.csvEscape(o.supplierName)},${o.totalAmount},${this.csvEscape(o.status)},${o.createdAt.toISOString()}`
      );
    });

    return lines.join("\n");
  }

  static exportInventoryToExcel(data: InventoryReportData): string {
    const lines: string[] = [];

    lines.push("ERP SYSTEM - INVENTORY REPORT");
    lines.push(`Generated On,${new Date().toISOString()}`);
    lines.push("");

    lines.push("SUMMARY METRICS");
    lines.push(`Total Unique Products,${data.summary.totalUniqueProducts}`);
    lines.push(`Total Stock Quantity,${data.summary.totalStockQuantity}`);
    lines.push(`Valuation at Cost,${data.summary.totalStockValueAtCost}`);
    lines.push(`Valuation at Retail Price,${data.summary.totalStockValueAtPrice}`);
    lines.push(`Low Stock Alert Count,${data.summary.lowStockCount}`);
    lines.push("");

    lines.push("WAREHOUSE STOCK VALUATION");
    lines.push("Warehouse ID,Warehouse Name,Unique Products,Total Stock,Valuation at Cost");
    data.warehouseBreakdown.forEach((w) => {
      lines.push(
        `${this.csvEscape(w.warehouseId)},${this.csvEscape(w.warehouseName)},${w.totalUniqueProducts},${w.totalStockQuantity},${w.stockValueAtCost}`
      );
    });
    lines.push("");

    lines.push("CATEGORY STOCK LEVELS");
    lines.push("Category ID,Category Name,Product SKU Count,Total Physical Stock");
    data.categoryBreakdown.forEach((c) => {
      lines.push(
        `${this.csvEscape(c.categoryId)},${this.csvEscape(c.categoryName)},${c.productCount},${c.totalQuantity}`
      );
    });
    lines.push("");

    lines.push("LOW STOCK REORDER ALERTS");
    lines.push("Product ID,Product Name,SKU,Current Stock,Reorder Point,Min Stock,Warehouse");
    data.lowStockItems.forEach((item) => {
      lines.push(
        `${this.csvEscape(item.productId)},${this.csvEscape(item.productName)},${this.csvEscape(item.sku)},${item.quantity},${item.reorderPoint},${item.minStock},${this.csvEscape(item.warehouseName)}`
      );
    });

    return lines.join("\n");
  }

  static exportCustomerToExcel(data: CustomerReportData): string {
    const lines: string[] = [];

    lines.push("ERP SYSTEM - CUSTOMER SPENDING REPORT");
    lines.push(`Generated On,${new Date().toISOString()}`);
    lines.push("");

    lines.push("SUMMARY METRICS");
    lines.push(`Total Customer Accounts,${data.summary.totalCustomersCount}`);
    lines.push(`Active Customer Accounts,${data.summary.activeCustomersCount}`);
    lines.push(`Total Customer Revenue,${data.summary.totalCustomerSpend}`);
    lines.push(`Average Spend Per Account,${data.summary.averageCustomerSpend}`);
    lines.push("");

    lines.push("CUSTOMER SALES DETAILS");
    lines.push("Customer ID,Company Name,Contact Name,Email,Total Spent,Orders Count,Average Order Value,Last Order Date");
    data.customerMetrics.forEach((cm) => {
      const dateStr = cm.lastOrderDate ? cm.lastOrderDate.toISOString() : "No Orders";
      lines.push(
        `${this.csvEscape(cm.customerId)},${this.csvEscape(cm.companyName)},${this.csvEscape(cm.contactName)},${this.csvEscape(cm.email)},${cm.totalSpent},${cm.orderCount},${cm.averageOrderValue},${dateStr}`
      );
    });

    return lines.join("\n");
  }

  static exportEmployeeToExcel(data: EmployeeReportData): string {
    const lines: string[] = [];

    lines.push("ERP SYSTEM - HR & EMPLOYEE METRICS REPORT");
    lines.push(`Generated On,${new Date().toISOString()}`);
    lines.push("");

    lines.push("SUMMARY METRICS");
    lines.push(`Total Employee Count,${data.summary.totalEmployeesCount}`);
    lines.push(`Active Employees,${data.summary.activeEmployeesCount}`);
    lines.push(`Average Yearly Salary,${data.summary.averageSalary}`);
    lines.push(`Total Payroll Paid in Range,${data.summary.totalPayrollPaid}`);
    lines.push(`Average Attendance Rate,${data.summary.averageAttendanceRate}%`);
    lines.push("");

    lines.push("DEPARTMENT BREAKDOWN");
    lines.push("Department ID,Department Name,Employee Count,Total Monthly Salaries");
    data.departmentBreakdown.forEach((d) => {
      lines.push(
        `${this.csvEscape(d.departmentId)},${this.csvEscape(d.departmentName)},${d.employeeCount},${d.totalMonthlySalaries}`
      );
    });
    lines.push("");

    lines.push("INDIVIDUAL ATTENDANCE METRICS");
    lines.push("Employee ID,Employee Name,Days Present,Days Absent,Days Late,Days On Leave,Attendance Rate %");
    data.attendanceStats.forEach((a) => {
      lines.push(
        `${this.csvEscape(a.employeeId)},${this.csvEscape(a.employeeName)},${a.daysPresent},${a.daysAbsent},${a.daysLate},${a.daysOnLeave},${a.attendanceRate}`
      );
    });
    lines.push("");

    lines.push("PAYROLL DISBURSEMENT HISTORY");
    lines.push("Payment ID,Employee Name,Amount Paid,Payment Date,Payment Method,Status");
    data.payrollHistory.forEach((p) => {
      lines.push(
        `${this.csvEscape(p.id)},${this.csvEscape(p.employeeName)},${p.amount},${p.payDate.toISOString()},${this.csvEscape(p.paymentMethod)},${this.csvEscape(p.status)}`
      );
    });

    return lines.join("\n");
  }

  static exportProfitToExcel(data: ProfitReportData): string {
    const lines: string[] = [];

    lines.push("ERP SYSTEM - PROFIT & LOSS STATEMENT");
    lines.push(`Generated On,${new Date().toISOString()}`);
    lines.push("");

    lines.push("FINANCIAL STATEMENT SUMMARY");
    lines.push(`Total Sales Revenue,${data.summary.totalRevenue}`);
    lines.push(`Cost of Goods Sold (COGS),${data.summary.totalCostOfGoodsSold}`);
    lines.push(`Operating Payroll Expense,${data.summary.totalOperatingPayroll}`);
    lines.push(`Inventory Purchases Expense,${data.summary.totalSupplierPurchases}`);
    lines.push(`Gross Operating Profit,${data.summary.grossProfit}`);
    lines.push(`Net Operating Profit,${data.summary.netProfit}`);
    lines.push("");

    lines.push("MONTHLY BREAKDOWN");
    lines.push("Month,Sales Revenue,COGS,Payroll Expense,Purchasing Expense,Gross Profit,Net Profit");
    data.monthlyBreakdown.forEach((m) => {
      lines.push(
        `${this.csvEscape(m.month)},${m.revenue},${m.cogs},${m.payroll},${m.purchases},${m.grossProfit},${m.netProfit}`
      );
    });

    return lines.join("\n");
  }

  // ==========================================
  // PDF / PRINTABLE HTML EXPORT ENGINE
  // ==========================================

  private static wrapHtmlTemplate(title: string, bodyContent: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {
      font-family: 'Inter', sans-serif;
    }
    @media print {
      body {
        background: white;
        color: black;
      }
      .no-print {
        display: none !important;
      }
      .print-page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 p-8 print:p-0 print:bg-white">
  <div class="max-w-4xl mx-auto bg-white p-12 shadow-sm rounded-xl print:shadow-none print:p-0 print:max-w-full">
    <!-- Action Bar -->
    <div class="no-print flex justify-between items-center pb-6 mb-8 border-b border-slate-200">
      <div class="text-sm text-slate-500">📄 System Printable Document layout (Exported to PDF-Print layout)</div>
      <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition shadow-sm flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 1.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.07-1.227L6.34 18m11.318 0h1.491a2.25 2.25 0 002.25-2.25V9.75M6.34 18H4.849a2.25 2.25 0 01-2.25-2.25V9.75m19.122 0A2.25 2.25 0 0018 7.5H6A2.25 2.25 0 003.75 9.75m16.5 0V11.25m-16.5 0V11.25m13.5-5.25h-10.5M15 3.75h-6" />
        </svg>
        Print Report / Save as PDF
      </button>
    </div>

    <!-- Main Content -->
    ${bodyContent}

    <!-- Footer -->
    <div class="mt-16 pt-8 border-t border-slate-200 text-center text-xs text-slate-400 print:mt-8">
      ERP Master System Administration Report. Confidentially generated on ${new Date().toLocaleString()}. All rights reserved.
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  static exportSalesToPDF(data: SalesReportData, start?: Date, end?: Date): string {
    const startStr = start ? start.toLocaleDateString() : "Beginning";
    const endStr = end ? end.toLocaleDateString() : "Today";

    const body = `
      <div class="flex justify-between items-start mb-8">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">Sales Report</span>
          <h1 class="text-3xl font-bold text-slate-900 mt-2">Executive Sales Summary</h1>
          <p class="text-sm text-slate-500 mt-1">Date Range: ${startStr} &mdash; ${endStr}</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold text-slate-800">ERP Administration</p>
          <p class="text-xs text-slate-400">Generated: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <!-- Metrics Widgets -->
      <div class="grid grid-cols-3 gap-4 mb-8">
        <div class="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Total Revenue</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">$${data.summary.totalRevenue.toLocaleString()}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Invoiced Volume</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">$${data.summary.totalInvoiceAmount.toLocaleString()}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Total Orders</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">${data.summary.totalOrdersCount} <span class="text-xs text-slate-400 font-normal">(${data.summary.shippedOrdersCount} shipped)</span></p>
        </div>
      </div>

      <!-- Top Selling Products -->
      <div class="mb-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Product Performance Breakdown</h2>
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-semibold uppercase text-xs">
              <th class="py-2">Product Name</th>
              <th class="py-2">SKU</th>
              <th class="py-2 text-right">Units Sold</th>
              <th class="py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${data.productSales.slice(0, 8).map((p) => `
              <tr class="border-b border-slate-100">
                <td class="py-3 font-medium text-slate-800">${p.productName}</td>
                <td class="py-3 font-mono text-xs text-slate-500">${p.sku}</td>
                <td class="py-3 text-right text-slate-600">${p.quantitySold}</td>
                <td class="py-3 text-right font-semibold text-slate-900">$${p.revenue.toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <!-- Order History List -->
      <div class="print-page-break mt-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Sales Invoices & Orders</h2>
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-semibold uppercase text-xs">
              <th class="py-2">Order No.</th>
              <th class="py-2">Customer</th>
              <th class="py-2">Date</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.orders.slice(0, 15).map((o) => `
              <tr class="border-b border-slate-100 text-slate-600">
                <td class="py-3 font-mono text-slate-900 text-xs">${o.orderNumber}</td>
                <td class="py-3 text-slate-800 font-medium">${o.customerName}</td>
                <td class="py-3 text-xs">${new Date(o.createdAt).toLocaleDateString()}</td>
                <td class="py-3 text-xs">
                  <span class="px-2 py-0.5 rounded-full font-medium ${o.status === 'SHIPPED' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">${o.status}</span>
                </td>
                <td class="py-3 text-right font-semibold text-slate-900">$${o.totalAmount.toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    return this.wrapHtmlTemplate("Sales Executive Report", body);
  }

  static exportPurchaseToPDF(data: PurchaseReportData, start?: Date, end?: Date): string {
    const startStr = start ? start.toLocaleDateString() : "Beginning";
    const endStr = end ? end.toLocaleDateString() : "Today";

    const body = `
      <div class="flex justify-between items-start mb-8">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Procurement Report</span>
          <h1 class="text-3xl font-bold text-slate-900 mt-2">Purchase Orders & Expenses</h1>
          <p class="text-sm text-slate-500 mt-1">Date Range: ${startStr} &mdash; ${endStr}</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold text-slate-800">ERP Procurement</p>
          <p class="text-xs text-slate-400">Generated: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <!-- Metrics Widgets -->
      <div class="grid grid-cols-3 gap-4 mb-8">
        <div class="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Total Procurement Expense</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">$${data.summary.totalPurchaseAmount.toLocaleString()}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Purchase Orders Count</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">${data.summary.totalOrdersCount}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Received / Completed POs</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">${data.summary.receivedOrdersCount} <span class="text-xs text-slate-400">fulfilled</span></p>
        </div>
      </div>

      <!-- Supplier Spending Breakdown -->
      <div class="mb-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Supplier Purchases Breakdown</h2>
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-semibold uppercase text-xs">
              <th class="py-2">Supplier Name</th>
              <th class="py-2 text-right">Orders Handled</th>
              <th class="py-2 text-right">Amount Outlay</th>
            </tr>
          </thead>
          <tbody>
            ${data.supplierPurchases.map((s) => `
              <tr class="border-b border-slate-100">
                <td class="py-3 font-medium text-slate-800">${s.supplierName}</td>
                <td class="py-3 text-right text-slate-600">${s.orderCount}</td>
                <td class="py-3 text-right font-semibold text-slate-900">$${s.totalAmount.toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <!-- Purchase Orders List -->
      <div class="print-page-break mt-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Purchase Orders Log</h2>
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-semibold uppercase text-xs">
              <th class="py-2">PO Number</th>
              <th class="py-2">Supplier</th>
              <th class="py-2">Date</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Total Outlay</th>
            </tr>
          </thead>
          <tbody>
            ${data.orders.slice(0, 15).map((o) => `
              <tr class="border-b border-slate-100 text-slate-600">
                <td class="py-3 font-mono text-slate-900 text-xs">${o.poNumber}</td>
                <td class="py-3 text-slate-800 font-medium">${o.supplierName}</td>
                <td class="py-3 text-xs">${new Date(o.createdAt).toLocaleDateString()}</td>
                <td class="py-3 text-xs">
                  <span class="px-2 py-0.5 rounded-full font-medium ${o.status === 'RECEIVED' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}">${o.status}</span>
                </td>
                <td class="py-3 text-right font-semibold text-slate-900">$${o.totalAmount.toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    return this.wrapHtmlTemplate("Purchase Executive Report", body);
  }

  static exportInventoryToPDF(data: InventoryReportData): string {
    const body = `
      <div class="flex justify-between items-start mb-8">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Inventory Audit</span>
          <h1 class="text-3xl font-bold text-slate-900 mt-2">Stock Levels & Valuations</h1>
          <p class="text-sm text-slate-500 mt-1">Real-Time Physical Assets Report</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold text-slate-800">ERP Inventory Control</p>
          <p class="text-xs text-slate-400">Generated: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <!-- Metrics Widgets -->
      <div class="grid grid-cols-4 gap-4 mb-8">
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Unique SKUs</p>
          <p class="text-xl font-bold text-slate-900 mt-1">${data.summary.totalUniqueProducts}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Total Items</p>
          <p class="text-xl font-bold text-slate-900 mt-1">${data.summary.totalStockQuantity.toLocaleString()}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Value (Cost)</p>
          <p class="text-xl font-bold text-emerald-600 mt-1">$${data.summary.totalStockValueAtCost.toLocaleString()}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Low Stock Alerts</p>
          <p class="text-xl font-bold text-rose-600 mt-1">${data.summary.lowStockCount}</p>
        </div>
      </div>

      <!-- Warehouse-specific metrics -->
      <div class="mb-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Warehouse Breakdown</h2>
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-semibold uppercase text-xs">
              <th class="py-2">Warehouse Name</th>
              <th class="py-2 text-right">Unique Products</th>
              <th class="py-2 text-right">Total Physical Items</th>
              <th class="py-2 text-right">Valuation (Cost)</th>
            </tr>
          </thead>
          <tbody>
            ${data.warehouseBreakdown.map((w) => `
              <tr class="border-b border-slate-100">
                <td class="py-3 font-medium text-slate-800">${w.warehouseName}</td>
                <td class="py-3 text-right text-slate-600">${w.totalUniqueProducts}</td>
                <td class="py-3 text-right text-slate-600">${w.totalStockQuantity}</td>
                <td class="py-3 text-right font-semibold text-slate-900">$${w.stockValueAtCost.toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <!-- Low Stock Alerts -->
      <div class="print-page-break mt-10">
        <div class="flex justify-between items-center mb-4 border-b pb-2">
          <h2 class="text-lg font-bold text-slate-900">Low Stock Reorder Triggers</h2>
          <span class="text-xs bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full font-medium">Reorder Immediately</span>
        </div>
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-semibold uppercase text-xs">
              <th class="py-2">Product Name</th>
              <th class="py-2">SKU</th>
              <th class="py-2 text-right">Current Stock</th>
              <th class="py-2 text-right">Reorder Point</th>
              <th class="py-2">Warehouse Location</th>
            </tr>
          </thead>
          <tbody>
            ${data.lowStockItems.length === 0 ? '<tr><td colspan="5" class="py-4 text-center text-slate-400">All inventory items are healthy and above reorder thresholds.</td></tr>' : data.lowStockItems.map((item) => `
              <tr class="border-b border-slate-100 text-slate-600">
                <td class="py-3 font-medium text-slate-800">${item.productName}</td>
                <td class="py-3 font-mono text-xs text-slate-500">${item.sku}</td>
                <td class="py-3 text-right text-rose-600 font-semibold">${item.quantity}</td>
                <td class="py-3 text-right text-slate-500">${item.reorderPoint}</td>
                <td class="py-3 text-slate-700">${item.warehouseName}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    return this.wrapHtmlTemplate("Inventory Stock Audit", body);
  }

  static exportCustomerToPDF(data: CustomerReportData, start?: Date, end?: Date): string {
    const startStr = start ? start.toLocaleDateString() : "Beginning";
    const endStr = end ? end.toLocaleDateString() : "Today";

    const body = `
      <div class="flex justify-between items-start mb-8">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">Customer Analysis</span>
          <h1 class="text-3xl font-bold text-slate-900 mt-2">Account Revenue & Spending</h1>
          <p class="text-sm text-slate-500 mt-1">Date Range: ${startStr} &mdash; ${endStr}</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold text-slate-800">ERP CRM Analytics</p>
          <p class="text-xs text-slate-400">Generated: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <!-- Metrics Widgets -->
      <div class="grid grid-cols-3 gap-4 mb-8">
        <div class="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Customer Accounts</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">${data.summary.totalCustomersCount}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Active Buyers</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">${data.summary.activeCustomersCount}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Average Lifetime Spend</p>
          <p class="text-2xl font-bold text-slate-900 mt-1">$${data.summary.averageCustomerSpend.toLocaleString()}</p>
        </div>
      </div>

      <!-- Customer List -->
      <div class="mb-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Top Customers by Purchasing Volume</h2>
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-semibold uppercase text-xs">
              <th class="py-2">Company / Customer</th>
              <th class="py-2">Email</th>
              <th class="py-2 text-right">Orders</th>
              <th class="py-2 text-right">Average Order</th>
              <th class="py-2 text-right">Total Spent</th>
            </tr>
          </thead>
          <tbody>
            ${data.customerMetrics.slice(0, 15).map((cm) => `
              <tr class="border-b border-slate-100">
                <td class="py-3">
                  <p class="font-medium text-slate-800">${cm.companyName || cm.contactName}</p>
                  <p class="text-xs text-slate-400">${cm.companyName ? cm.contactName : ''}</p>
                </td>
                <td class="py-3 text-xs text-slate-500 font-mono">${cm.email}</td>
                <td class="py-3 text-right text-slate-600">${cm.orderCount}</td>
                <td class="py-3 text-right text-slate-600">$${cm.averageOrderValue.toLocaleString()}</td>
                <td class="py-3 text-right font-semibold text-indigo-600">$${cm.totalSpent.toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    return this.wrapHtmlTemplate("Customer Lifetime Report", body);
  }

  static exportEmployeeToPDF(data: EmployeeReportData, start?: Date, end?: Date): string {
    const startStr = start ? start.toLocaleDateString() : "Beginning";
    const endStr = end ? end.toLocaleDateString() : "Today";

    const body = `
      <div class="flex justify-between items-start mb-8">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">Human Resources</span>
          <h1 class="text-3xl font-bold text-slate-900 mt-2">Personnel Metrics & Payroll</h1>
          <p class="text-sm text-slate-500 mt-1">Date Range: ${startStr} &mdash; ${endStr}</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold text-slate-800">ERP HR Dept</p>
          <p class="text-xs text-slate-400">Generated: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <!-- Metrics Widgets -->
      <div class="grid grid-cols-4 gap-4 mb-8">
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Headcount</p>
          <p class="text-xl font-bold text-slate-900 mt-1">${data.summary.totalEmployeesCount}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Average Salary</p>
          <p class="text-xl font-bold text-slate-900 mt-1">$${data.summary.averageSalary.toLocaleString()}/yr</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Payroll Released</p>
          <p class="text-xl font-bold text-slate-900 mt-1">$${data.summary.totalPayrollPaid.toLocaleString()}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <p class="text-xs font-medium text-slate-400 uppercase">Attendance Rate</p>
          <p class="text-xl font-bold text-teal-600 mt-1">${data.summary.averageAttendanceRate}%</p>
        </div>
      </div>

      <!-- Department breakdown -->
      <div class="mb-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Department Allocations</h2>
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-semibold uppercase text-xs">
              <th class="py-2">Department</th>
              <th class="py-2 text-right">Headcount</th>
              <th class="py-2 text-right">Monthly Payroll Rate</th>
            </tr>
          </thead>
          <tbody>
            ${data.departmentBreakdown.map((dept) => `
              <tr class="border-b border-slate-100">
                <td class="py-3 font-medium text-slate-800">${dept.departmentName}</td>
                <td class="py-3 text-right text-slate-600">${dept.employeeCount}</td>
                <td class="py-3 text-right font-semibold text-slate-900">$${dept.totalMonthlySalaries.toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <!-- Individual Attendance -->
      <div class="print-page-break mt-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Individual Attendance logs</h2>
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-semibold uppercase text-xs">
              <th class="py-2">Employee Name</th>
              <th class="py-2 text-right">Present</th>
              <th class="py-2 text-right">Absent</th>
              <th class="py-2 text-right">Late</th>
              <th class="py-2 text-right">On Leave</th>
              <th class="py-2 text-right">Attendance Rate</th>
            </tr>
          </thead>
          <tbody>
            ${data.attendanceStats.map((stat) => `
              <tr class="border-b border-slate-100 text-slate-600">
                <td class="py-3 font-medium text-slate-800">${stat.employeeName}</td>
                <td class="py-3 text-right">${stat.daysPresent}</td>
                <td class="py-3 text-right">${stat.daysAbsent}</td>
                <td class="py-3 text-right">${stat.daysLate}</td>
                <td class="py-3 text-right">${stat.daysOnLeave}</td>
                <td class="py-3 text-right font-semibold text-slate-900">${stat.attendanceRate}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    return this.wrapHtmlTemplate("HR Administrative Report", body);
  }

  static exportProfitToPDF(data: ProfitReportData, start?: Date, end?: Date): string {
    const startStr = start ? start.toLocaleDateString() : "Beginning";
    const endStr = end ? end.toLocaleDateString() : "Today";

    const body = `
      <div class="flex justify-between items-start mb-8">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">Financial Audit</span>
          <h1 class="text-3xl font-bold text-slate-900 mt-2">Profit & Loss Statement</h1>
          <p class="text-sm text-slate-500 mt-1">Date Range: ${startStr} &mdash; ${endStr}</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-semibold text-slate-800">ERP Finance Control</p>
          <p class="text-xs text-slate-400">Generated: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <!-- P&L Structure Statement -->
      <div class="border border-slate-200 rounded-xl overflow-hidden mb-10">
        <div class="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h3 class="font-bold text-slate-800 text-sm">Operating Profit & Loss Summary</h3>
        </div>
        <div class="divide-y divide-slate-100 text-sm">
          <!-- Revenues -->
          <div class="px-6 py-3.5 flex justify-between">
            <span class="font-medium text-slate-700">Sales Operating Revenue (+)</span>
            <span class="font-semibold text-slate-900">$${data.summary.totalRevenue.toLocaleString()}</span>
          </div>
          <!-- COGS -->
          <div class="px-6 py-3.5 flex justify-between bg-slate-50/20">
            <span class="font-medium text-slate-500">Cost of Goods Sold (COGS) (-)</span>
            <span class="font-medium text-rose-600">-$${data.summary.totalCostOfGoodsSold.toLocaleString()}</span>
          </div>
          <!-- Gross Profit -->
          <div class="px-6 py-3.5 flex justify-between bg-slate-50/50 font-bold text-slate-800">
            <span>Gross Profit (=)</span>
            <span>$${data.summary.grossProfit.toLocaleString()}</span>
          </div>
          <!-- Payroll Expenses -->
          <div class="px-6 py-3.5 flex justify-between">
            <span class="font-medium text-slate-500">Personnel & Payroll Salaries (-)</span>
            <span class="font-medium text-rose-600">-$${data.summary.totalOperatingPayroll.toLocaleString()}</span>
          </div>
          <!-- Supplier Purchases -->
          <div class="px-6 py-3.5 flex justify-between">
            <span class="font-medium text-slate-500">Supplier Capital Acquisitions (-)</span>
            <span class="font-medium text-rose-600">-$${data.summary.totalSupplierPurchases.toLocaleString()}</span>
          </div>
          <!-- Net Profit -->
          <div class="px-6 py-4 flex justify-between bg-emerald-50/30 text-base font-bold text-emerald-800 border-t-2 border-slate-200">
            <span>Net Operating Profit (=)</span>
            <span class="text-emerald-600">$${data.summary.netProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <!-- Monthly Trend breakdown -->
      <div class="mb-10">
        <h2 class="text-lg font-bold text-slate-900 mb-4 border-b pb-2">Monthly Fiscal Breakdown</h2>
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400 font-semibold uppercase text-xs">
              <th class="py-2">Month</th>
              <th class="py-2 text-right">Revenue</th>
              <th class="py-2 text-right">COGS</th>
              <th class="py-2 text-right">Payroll</th>
              <th class="py-2 text-right">Supplier Exp</th>
              <th class="py-2 text-right">Net Profit</th>
            </tr>
          </thead>
          <tbody>
            ${data.monthlyBreakdown.map((m) => `
              <tr class="border-b border-slate-100">
                <td class="py-3 font-semibold text-slate-900">${m.month}</td>
                <td class="py-3 text-right text-slate-600">$${m.revenue.toLocaleString()}</td>
                <td class="py-3 text-right text-rose-600">-$${m.cogs.toLocaleString()}</td>
                <td class="py-3 text-right text-rose-600">-$${m.payroll.toLocaleString()}</td>
                <td class="py-3 text-right text-rose-600">-$${m.purchases.toLocaleString()}</td>
                <td class="py-3 text-right font-bold text-emerald-600">$${m.netProfit.toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    return this.wrapHtmlTemplate("Profit & Loss Administrative Statement", body);
  }
}
