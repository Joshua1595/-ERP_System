import { ActivityLogRepository } from "../repositories/activity-log.repository.ts";
import { ActivityLogService } from "../services/activity-log.service.ts";
import { mockActivityLogs } from "../lib/db.ts";

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
  console.log("📝 STARTING ERP ACTIVITY LOGGING SUITE TESTS");
  console.log("=================================================");

  // Reset arrays for predictable test environment
  mockActivityLogs.length = 0;

  await runTest("ActivityLogRepository can create a login activity log", async () => {
    const log = await ActivityLogRepository.create({
      userId: "u-123456",
      userEmail: "admin@erp-company.com",
      action: "LOGIN",
      details: "User logged in from corporate IP",
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0 Chrome",
    });

    if (!log.id) throw new Error("Expected log to have a generated ID");
    if (log.action !== "LOGIN") throw new Error(`Expected action to be LOGIN, got: ${log.action}`);
    if (log.userEmail !== "admin@erp-company.com") throw new Error("Incorrect userEmail logged");
    if (log.ipAddress !== "192.168.1.100") throw new Error("Incorrect ipAddress logged");
    if (mockActivityLogs.length !== 1) throw new Error("Expected 1 log in the mock database");
  });

  await runTest("ActivityLogRepository can query logs with filters & search", async () => {
    // Add additional logs for querying
    await ActivityLogRepository.create({
      userId: "u-789",
      userEmail: "manager@erp-company.com",
      action: "CREATE",
      entityType: "PRODUCT",
      entityId: "prod-abc",
      details: "Created a luxury Widget item",
    });

    await ActivityLogRepository.create({
      userId: "u-123456",
      userEmail: "admin@erp-company.com",
      action: "FAILED_LOGIN",
      details: "Password mismatch during attempt",
    });

    // 1. Filter by Action
    const resultByAction = await ActivityLogRepository.findAllPaged({ action: "LOGIN" });
    if (resultByAction.total !== 1) throw new Error(`Expected 1 LOGIN log, got: ${resultByAction.total}`);

    // 2. Filter by User ID
    const resultByUser = await ActivityLogRepository.findAllPaged({ userId: "u-123456" });
    if (resultByUser.total !== 2) throw new Error(`Expected 2 logs for u-123456, got: ${resultByUser.total}`);

    // 3. Search text
    const resultSearch = await ActivityLogRepository.findAllPaged({ search: "luxury" });
    if (resultSearch.total !== 1) throw new Error(`Expected 1 result for search 'luxury', got: ${resultSearch.total}`);
  });

  await runTest("ActivityLogService handles structured logs and details", async () => {
    const originalCount = mockActivityLogs.length;

    const log = await ActivityLogService.log({
      userId: "u-888",
      userEmail: "accountant@erp-company.com",
      action: "update",
      entityType: "invoice",
      entityId: "inv-500",
      details: "Updated billing and terms options.",
    });

    if (log.action !== "UPDATE") throw new Error(`Expected UPPERCASE action 'UPDATE', got ${log.action}`);
    if (log.entityType !== "INVOICE") throw new Error(`Expected UPPERCASE entityType 'INVOICE', got ${log.entityType}`);
    if (mockActivityLogs.length !== originalCount + 1) throw new Error("Expected mock array count to increment by 1");
  });

  await runTest("ActivityLogService can fetch a specific log entry by ID or throw Error", async () => {
    const logs = await ActivityLogService.getLogs({});
    const firstLogId = logs.items[0].id;

    const matched = await ActivityLogService.getLogById(firstLogId);
    if (!matched || matched.id !== firstLogId) throw new Error("Failed to retrieve matching log entry");

    try {
      await ActivityLogService.getLogById("non-existent-id-xyz");
      throw new Error("Expected error for non-existent log, but it passed");
    } catch (err: any) {
      if (!err.message.includes("not found")) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  await runTest("ActivityLogService can purge logs older than a given day threshold", async () => {
    // Modify one of the logs in our mock array to have a creation date 40 days ago
    const olderDate = new Date();
    olderDate.setDate(olderDate.getDate() - 40);
    mockActivityLogs[0].createdAt = olderDate;

    const beforeCount = mockActivityLogs.length;

    // Purge logs older than 30 days
    const purgedCount = await ActivityLogService.purgeOldLogs(30);

    if (purgedCount !== 1) throw new Error(`Expected 1 log purged, got: ${purgedCount}`);
    if (mockActivityLogs.length !== beforeCount - 1) throw new Error("Mock database length did not decrease correctly");
  });

  console.log("\n=================================================");
  console.log(`📝 FILE UPLOAD SUITE RESULTS`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log("=================================================");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal error executing ERP Activity Logging test suite:", err);
  process.exit(1);
});
