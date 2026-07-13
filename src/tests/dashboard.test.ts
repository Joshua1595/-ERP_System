import { DashboardService } from "../services/dashboard.service.ts";
import { DashboardRepository } from "../repositories/dashboard.repository.ts";
import { CacheService } from "../services/cache.service.ts";
import {
  mockPayments,
  mockSalesOrders,
  mockSalesOrderItems,
  mockCustomers,
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
  console.log("📊 STARTING DASHBOARD APIS SUITE TESTS");
  console.log("=================================================");

  // Seed some temporary mock data for dashboard calculation
  const originalPaymentsLength = mockPayments.length;
  const originalSalesOrdersLength = mockSalesOrders.length;
  const originalSalesOrderItemsLength = mockSalesOrderItems.length;

  // Insert test mock payment
  mockPayments.push({
    id: "pay-test-dash-1",
    invoiceId: "inv-1",
    amountPaid: 1500.00,
    paymentMethod: "BANK_TRANSFER",
    paymentDate: new Date(),
  });

  // Insert a mock sales order
  mockSalesOrders.push({
    id: "so-test-dash-1",
    orderNumber: "SO-TEST-DASH-1",
    customerId: "cust-acme",
    status: SalesOrderStatus.CONFIRMED,
    totalAmount: 1200.00,
    createdById: "u-employee",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Insert items
  mockSalesOrderItems.push({
    id: "soi-test-dash-1",
    salesOrderId: "so-test-dash-1",
    productId: "pr-motor",
    quantity: 2.00,
    unitPrice: 600.00,
    totalPrice: 1200.00,
  });

  // 1. Repository metric extraction
  await runTest("DashboardRepository.getDashboardMetrics() extracts aggregated metrics correctly", async () => {
    const metrics = await DashboardRepository.getDashboardMetrics();

    if (!metrics || !metrics.cards) {
      throw new Error("Repository returned empty metrics object.");
    }

    // Verify card values
    if (metrics.cards.revenue <= 0) {
      throw new Error(`Expected positive revenue, got: ${metrics.cards.revenue}`);
    }
    if (metrics.cards.salesCount < 1) {
      throw new Error(`Expected at least 1 active sales order, got: ${metrics.cards.salesCount}`);
    }

    // Recent Sales
    if (metrics.recentSales.length === 0) {
      throw new Error("Recent sales array was empty.");
    }

    // Top Customers
    if (metrics.topCustomers.length === 0) {
      throw new Error("Top customers list was empty.");
    }
    const acmeCustomer = metrics.topCustomers.find((c) => c.id === "cust-acme");
    if (!acmeCustomer) {
      throw new Error("ACME customer was expected to be a top customer.");
    }

    // Top Products
    if (metrics.topProducts.length === 0) {
      throw new Error("Top products list was empty.");
    }
    const motorProduct = metrics.topProducts.find((p) => p.id === "pr-motor");
    if (!motorProduct) {
      throw new Error("pr-motor was expected to be a top product.");
    }
  });

  // 2. Service Caching strategy
  await runTest("DashboardService manages the in-memory cache and respects cache bypass directives", async () => {
    // Ensure cache is clear initially
    DashboardService.clearDashboardCache();

    // First fetch: should miss cache and retrieve fresh data
    const firstResult = await DashboardService.getDashboardMetrics();

    // Modify in-memory state to prove caching is working
    mockPayments.push({
      id: "pay-test-dash-cache-test",
      invoiceId: "inv-1",
      amountPaid: 99999.00, // Large payment
      paymentMethod: "BANK_TRANSFER",
      paymentDate: new Date(),
    });

    // Second fetch: should hit cache and NOT see the new payment
    const secondResult = await DashboardService.getDashboardMetrics();
    if (secondResult.cards.revenue === firstResult.cards.revenue + 99999.00) {
      throw new Error("Cache was bypassed; expected identical cached metrics.");
    }

    // Third fetch with bypassCache=true: should see the new payment
    const thirdResult = await DashboardService.getDashboardMetrics(true);
    if (thirdResult.cards.revenue !== firstResult.cards.revenue + 99999.00) {
      throw new Error(`Bypass cache directive failed to return fresh metrics. Got ${thirdResult.cards.revenue}, expected ${firstResult.cards.revenue + 99999.00}`);
    }

    // Fourth fetch: should cache the updated value
    const fourthResult = await DashboardService.getDashboardMetrics();
    if (fourthResult.cards.revenue !== thirdResult.cards.revenue) {
      throw new Error("Expected cached value to match the updated bypassed value.");
    }

    // Clean up cache-test payment
    mockPayments.pop();
  });

  // 3. CacheService explicit TTL and invalidation
  await runTest("CacheService implements type-safe getOrSet with invalidation and TTL checks", async () => {
    const cacheKey = "temp_test_key";
    let computeCount = 0;
    interface TestVal {
      val: number;
    }
    const fetchFn = async (): Promise<TestVal> => {
      computeCount++;
      return { val: computeCount };
    };

    // First call: computes
    const res1 = await CacheService.getOrSet<TestVal>(cacheKey, fetchFn, 1000);
    if (res1.val !== 1 || computeCount !== 1) {
      throw new Error("Expected initial compute.");
    }

    // Second call within TTL: cached
    const res2 = await CacheService.getOrSet<TestVal>(cacheKey, fetchFn, 1000);
    if (res2.val !== 1 || computeCount !== 1) {
      throw new Error("Expected cached result.");
    }

    // Manually invalidate
    CacheService.invalidate(cacheKey);

    // Third call after invalidation: computes again
    const res3 = await CacheService.getOrSet<TestVal>(cacheKey, fetchFn, 1000);
    if (res3.val !== 2 || (computeCount as number) !== 2) {
      throw new Error("Expected compute after manual invalidation.");
    }

    // Clean up
    CacheService.invalidate(cacheKey);
  });

  // Clean up all seeded test metrics to avoid leaking to other tests
  mockPayments.splice(originalPaymentsLength);
  mockSalesOrders.splice(originalSalesOrdersLength);
  mockSalesOrderItems.splice(originalSalesOrderItemsLength);

  console.log("\n=================================================");
  console.log("📊 SUITE RESULTS");
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log("=================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Dashboard tests failed to run:", err);
  process.exit(1);
});
