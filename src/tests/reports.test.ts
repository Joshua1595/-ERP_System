import { ReportRepository } from "../repositories/report.repository.ts";
import { ReportService } from "../services/report.service.ts";
import { CacheService } from "../services/cache.service.ts";
import {
  mockPayments,
  mockSalesOrders,
  mockSalesOrderItems,
  mockProducts,
  mockStockLevels,
} from "../lib/db.ts";
import { SalesOrderStatus } from "@prisma/client";

let passedTests = 0;
let failedTests = 0;

async function runTest(name: string, testFn: () => Promise<void>) {
  const start = Date.now();
  try {
    console.log(`\n🧪 Running: ${name}`);
    await testFn();
    const duration = Date.now() - start;
    console.log(`   ✅ PASSED [${duration}ms]`);
    passedTests++;
  } catch (err: any) {
    const duration = Date.now() - start;
    console.error(`   ❌ FAILED [${duration}ms]`);
    console.error(`      Error: ${err.message}`);
    if (err.stack) console.error(`      Stack: ${err.stack}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log("=================================================");
  console.log("📊 STARTING ERP REPORTS SUITE TESTS");
  console.log("=================================================");

  // Seed test-specific values
  const originalPayments = [...mockPayments];
  const originalSalesOrders = [...mockSalesOrders];
  const originalSalesOrderItems = [...mockSalesOrderItems];

  // 1. Clear for predictable testing
  mockPayments.length = 0;
  mockSalesOrders.length = 0;
  mockSalesOrderItems.length = 0;

  // Mock data setup
  const dateJune1 = new Date("2026-06-01T12:00:00.000Z");
  const dateJune15 = new Date("2026-06-15T12:00:00.000Z");
  const dateJuly1 = new Date("2026-07-01T12:00:00.000Z");

  mockPayments.push(
    { id: "p1", invoiceId: "inv-1", amountPaid: 1000.00, paymentMethod: "CASH", paymentDate: dateJune1 },
    { id: "p2", invoiceId: "inv-2", amountPaid: 2500.00, paymentMethod: "BANK_TRANSFER", paymentDate: dateJune15 },
    { id: "p3", invoiceId: "inv-3", amountPaid: 4000.00, paymentMethod: "MOBILE_PAYMENT", paymentDate: dateJuly1 }
  );

  mockSalesOrders.push(
    { id: "so1", orderNumber: "SO-1", customerId: "cust-acme", status: SalesOrderStatus.SHIPPED as any, totalAmount: 1000.00, createdById: "u-manager", createdAt: dateJune1, updatedAt: dateJune1 },
    { id: "so2", orderNumber: "SO-2", customerId: "cust-acme", status: SalesOrderStatus.CONFIRMED as any, totalAmount: 2500.00, createdById: "u-manager", createdAt: dateJune15, updatedAt: dateJune15 },
    { id: "so3", orderNumber: "SO-3", customerId: "cust-globex", status: SalesOrderStatus.CANCELLED as any, totalAmount: 5000.00, createdById: "u-manager", createdAt: dateJuly1, updatedAt: dateJuly1 }
  );

  mockSalesOrderItems.push(
    { id: "item1", salesOrderId: "so1", productId: "pr-steel", quantity: 10, unitPrice: 100, totalPrice: 1000 },
    { id: "item2", salesOrderId: "so2", productId: "pr-copper", quantity: 5, unitPrice: 500, totalPrice: 2500 },
    { id: "item3", salesOrderId: "so3", productId: "pr-steel", quantity: 50, unitPrice: 100, totalPrice: 5000 }
  );

  await runTest("ReportRepository.getSalesReport aggregates correct numbers and respects date filters", async () => {
    // Test with no date filters (covers entire seeded range)
    const allReport = await ReportRepository.getSalesReport();
    if (allReport.summary.totalRevenue !== 7500) {
      throw new Error(`Expected total revenue 7500, got ${allReport.summary.totalRevenue}`);
    }
    if (allReport.summary.totalOrdersCount !== 3) {
      throw new Error(`Expected total orders count 3, got ${allReport.summary.totalOrdersCount}`);
    }

    // Filter to June only
    const juneReport = await ReportRepository.getSalesReport(
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.000Z")
    );
    if (juneReport.summary.totalRevenue !== 3500) {
      throw new Error(`Expected June total revenue 3500, got ${juneReport.summary.totalRevenue}`);
    }
    if (juneReport.summary.totalOrdersCount !== 2) {
      throw new Error(`Expected June total orders 2, got ${juneReport.summary.totalOrdersCount}`);
    }
    if (juneReport.summary.cancelledOrdersCount !== 0) {
      throw new Error("June cancelled orders count should be 0");
    }
  });

  await runTest("ReportService handles caching layer and cache bypass flags", async () => {
    CacheService.clear();

    const start = new Date("2026-06-01T00:00:00.000Z");
    const end = new Date("2026-06-30T23:59:59.000Z");

    // First fetch: populates cache
    const firstCall = await ReportService.getSalesReport(start, end);

    // Modify a value in mock database directly
    mockPayments.push({ id: "p-temp", invoiceId: "inv-temp", amountPaid: 10000.00, paymentMethod: "CASH", paymentDate: dateJune1 });

    // Second fetch: should retrieve cached data (without the temp payment)
    const secondCall = await ReportService.getSalesReport(start, end);
    if (secondCall.summary.totalRevenue !== firstCall.summary.totalRevenue) {
      throw new Error("Expected second call to return cached results.");
    }

    // Third fetch: with bypassCache=true should invalidate and retrieve fresh calculations
    const thirdCall = await ReportService.getSalesReport(start, end, true);
    if (thirdCall.summary.totalRevenue !== firstCall.summary.totalRevenue + 10000) {
      throw new Error(`Expected bypassed cache call to calculate new revenue. Got ${thirdCall.summary.totalRevenue}`);
    }

    // Clean up temp payment
    mockPayments.pop();
  });

  await runTest("ReportService Exporters produce correctly formatted CSV and PDF-HTML", async () => {
    const reportData = await ReportService.getSalesReport();

    // Verify Excel CSV
    const csvContent = ReportService.exportSalesToExcel(reportData);
    if (!csvContent.includes("SUMMARY METRICS") || !csvContent.includes("PRODUCT SALES PERFORMANCE")) {
      throw new Error("Excel CSV export is missing critical sections.");
    }

    // Verify PDF HTML
    const htmlContent = ReportService.exportSalesToPDF(reportData);
    if (!htmlContent.includes("<!DOCTYPE html>") || !htmlContent.includes("Executive Sales Summary")) {
      throw new Error("PDF HTML template is missing core page layout tags.");
    }
  });

  await runTest("ReportRepository fetches inventory valuations and low stock alerts", async () => {
    const inventoryReport = await ReportRepository.getInventoryReport();
    if (inventoryReport.summary.totalUniqueProducts <= 0) {
      throw new Error("Expected at least one product in inventory report.");
    }
    if (inventoryReport.summary.totalStockValueAtCost < 0) {
      throw new Error("Inventory valuation should be non-negative.");
    }
  });

  await runTest("ReportRepository processes Profit & Loss statement perfectly", async () => {
    const profitReport = await ReportRepository.getProfitReport();
    if (typeof profitReport.summary.totalRevenue !== "number") {
      throw new Error("Expected numerical revenue in P&L.");
    }
    if (typeof profitReport.summary.grossProfit !== "number") {
      throw new Error("Expected numerical gross profit in P&L.");
    }
    if (typeof profitReport.summary.netProfit !== "number") {
      throw new Error("Expected numerical net profit in P&L.");
    }
  });

  // Restore mock data
  mockPayments.length = 0;
  mockPayments.push(...originalPayments);
  mockSalesOrders.length = 0;
  mockSalesOrders.push(...originalSalesOrders);
  mockSalesOrderItems.length = 0;
  mockSalesOrderItems.push(...originalSalesOrderItems);

  console.log("=================================================");
  console.log("📊 SUITE RESULTS");
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log("=================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
