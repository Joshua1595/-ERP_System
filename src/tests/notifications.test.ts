import { NotificationRepository } from "../repositories/notification.repository.ts";
import { NotificationService } from "../services/notification.service.ts";
import {
  mockNotifications,
  mockStockLevels,
  mockProducts,
  mockPurchaseOrders,
  mockInvoices,
  mockSalesOrders,
} from "../lib/db.ts";
import { UserRole, SalesOrderStatus, InvoiceStatus, PurchaseOrderStatus } from "@prisma/client";

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
  console.log("🔔 STARTING ERP NOTIFICATION SUITE TESTS");
  console.log("=================================================");

  // Backup existing mocks
  const backupNotifications = [...mockNotifications];
  const backupStockLevels = [...mockStockLevels];
  const backupPurchaseOrders = [...mockPurchaseOrders];
  const backupInvoices = [...mockInvoices];
  const backupSalesOrders = [...mockSalesOrders];

  // Reset arrays for predictable test environment
  mockNotifications.length = 0;
  mockStockLevels.length = 0;
  mockPurchaseOrders.length = 0;
  mockInvoices.length = 0;
  mockSalesOrders.length = 0;

  await runTest("NotificationRepository can create manual notification", async () => {
    const notif = await NotificationRepository.create({
      userId: "u-admin",
      role: UserRole.ADMIN,
      type: "SYSTEM_ANNOUNCEMENT",
      title: "Maintenance Notice",
      message: "The ERP system will undergo scheduled maintenance.",
      referenceId: null,
    });

    if (!notif.id) throw new Error("Expected notification to have an ID");
    if (notif.title !== "Maintenance Notice") throw new Error("Incorrect title");
    if (notif.isRead !== false) throw new Error("Notification should default to unread");
    if (mockNotifications.length !== 1) throw new Error("Notification was not saved to database/mock array");
  });

  await runTest("NotificationRepository filtering works for specific users, roles, and broadcasts", async () => {
    // Current database holds 1 notification for (u-admin, ADMIN)
    // Add another for general broadcast (null user, null role)
    await NotificationRepository.create({
      userId: null,
      role: null,
      type: "BROADCAST",
      title: "Welcome!",
      message: "Welcome to the new ERP notification hub.",
    });

    // Add another for (u-employee, EMPLOYEE)
    await NotificationRepository.create({
      userId: "u-employee",
      role: UserRole.EMPLOYEE,
      type: "TASK",
      title: "Review Hours",
      message: "Please review your hours.",
    });

    // Search for u-admin with role ADMIN: should get u-admin direct + general broadcast, but NOT employee tasks
    const adminFeed = await NotificationRepository.findAll({
      userId: "u-admin",
      role: UserRole.ADMIN,
    });

    if (adminFeed.length !== 2) {
      throw new Error(`Expected admin feed to have 2 notifications, got ${adminFeed.length}`);
    }

    const hasWelcome = adminFeed.some((n) => n.title === "Welcome!");
    const hasMaintenance = adminFeed.some((n) => n.title === "Maintenance Notice");
    const hasReviewHours = adminFeed.some((n) => n.title === "Review Hours");

    if (!hasWelcome || !hasMaintenance) {
      throw new Error("Admin feed is missing expected notifications.");
    }
    if (hasReviewHours) {
      throw new Error("Admin feed contains employee-restricted notification!");
    }
  });

  await runTest("NotificationService can mark single notification as read", async () => {
    const notifs = await NotificationService.getNotifications({});
    const target = notifs[0];

    const updated = await NotificationService.markAsRead(target.id);
    if (!updated || updated.isRead !== true) {
      throw new Error("Notification was not marked as read");
    }

    // Confirm in store
    const retrieved = await NotificationService.getNotificationById(target.id);
    if (retrieved.isRead !== true) {
      throw new Error("IsRead status did not persist in the database/mock");
    }
  });

  await runTest("NotificationService can mark all notifications as read for a specific user feed", async () => {
    // Clear notifications and create two fresh unread ones
    mockNotifications.length = 0;
    
    await NotificationRepository.create({ userId: "u-manager", role: UserRole.MANAGER, type: "TEST", title: "T1", message: "M1" });
    await NotificationRepository.create({ userId: "u-manager", role: UserRole.MANAGER, type: "TEST", title: "T2", message: "M2" });

    let unreadCount = (await NotificationService.getNotifications({ userId: "u-manager", role: UserRole.MANAGER, isRead: false })).length;
    if (unreadCount !== 2) {
      throw new Error(`Expected 2 unread notifications, got ${unreadCount}`);
    }

    await NotificationService.markAllAsRead({ userId: "u-manager", role: UserRole.MANAGER });

    unreadCount = (await NotificationService.getNotifications({ userId: "u-manager", role: UserRole.MANAGER, isRead: false })).length;
    if (unreadCount !== 0) {
      throw new Error(`Expected 0 unread notifications after markAllAsRead, got ${unreadCount}`);
    }
  });

  await runTest("NotificationService low stock scan automatically triggers and creates notifications", async () => {
    mockNotifications.length = 0;
    
    // Seed low stock condition
    mockStockLevels.push({
      id: "sl-test",
      productId: "pr-steel",
      warehouseId: "w-main",
      quantity: 5, // Below reorder point of 40
      reorderPoint: 40,
      minStock: 10,
      maxStock: 100,
      updatedAt: new Date(),
    });

    const scanResult = await NotificationService.triggerScanAndGeneration();
    
    if (scanResult.breakdown.lowStock !== 1) {
      throw new Error(`Expected 1 low stock notification generated, got ${scanResult.breakdown.lowStock}`);
    }

    const currentNotifs = await NotificationService.getNotifications({ role: UserRole.MANAGER });
    const lowStockAlert = currentNotifs.find((n) => n.type === "LOW_STOCK");
    
    if (!lowStockAlert) {
      throw new Error("Low stock notification was not found in Manager history.");
    }
    if (!lowStockAlert.message.includes("Structural Steel Girders")) {
      throw new Error(`Message does not mention the product name: ${lowStockAlert.message}`);
    }
  });

  await runTest("NotificationService does not generate duplicate unread notifications for low stock", async () => {
    // Triggering scan a second time with the exact same condition should generate 0 new notifications
    const scanResult = await NotificationService.triggerScanAndGeneration();
    if (scanResult.breakdown.lowStock !== 0) {
      throw new Error(`Expected 0 new low stock notifications, but generated ${scanResult.breakdown.lowStock}`);
    }
  });

  await runTest("NotificationService purchase order approvals scan triggers properly", async () => {
    // Seed purchase order pending approval
    mockPurchaseOrders.push({
      id: "po-test",
      poNumber: "PO-TEST-001",
      supplierId: "supp-1",
      status: PurchaseOrderStatus.PENDING,
      totalAmount: 18450.00,
      createdById: "u-employee",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const scanResult = await NotificationService.triggerScanAndGeneration();
    if (scanResult.breakdown.purchaseApproval !== 1) {
      throw new Error(`Expected 1 purchase approval notification, got ${scanResult.breakdown.purchaseApproval}`);
    }

    const managerNotifs = await NotificationService.getNotifications({ role: UserRole.MANAGER });
    const approvalNotif = managerNotifs.find((n) => n.type === "PURCHASE_APPROVAL" && n.referenceId === "po-test");
    if (!approvalNotif) {
      throw new Error("Purchase order approval notification was not found");
    }
  });

  await runTest("NotificationService payment reminders scan triggers for unpaid/overdue invoices", async () => {
    mockInvoices.push({
      id: "inv-test",
      invoiceNumber: "INV-TEST-999",
      salesOrderId: "so-test",
      subtotal: 500,
      taxRate: 0,
      taxAmount: 0,
      discountRate: 0,
      discountAmount: 0,
      amount: 500,
      status: InvoiceStatus.UNPAID,
      dueDate: new Date("2026-05-01"), // Past due
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const scanResult = await NotificationService.triggerScanAndGeneration();
    if (scanResult.breakdown.paymentReminder !== 1) {
      throw new Error(`Expected 1 payment reminder notification, got ${scanResult.breakdown.paymentReminder}`);
    }

    const accountantsNotifs = await NotificationService.getNotifications({ role: UserRole.ACCOUNTANT });
    const reminderNotif = accountantsNotifs.find((n) => n.type === "PAYMENT_REMINDER" && n.referenceId === "inv-test");
    if (!reminderNotif) {
      throw new Error("Payment reminder notification was not found for accountants");
    }
    if (!reminderNotif.title.includes("URGENT")) {
      throw new Error("Reminder for past-due invoice should be labeled URGENT");
    }
  });

  await runTest("NotificationService order status notifications trigger on status changes", async () => {
    mockSalesOrders.push({
      id: "so-shipped",
      orderNumber: "SO-SHIPPED-001",
      customerId: "cust-1",
      status: SalesOrderStatus.SHIPPED as any,
      totalAmount: 1200,
      createdById: "u-employee",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const scanResult = await NotificationService.triggerScanAndGeneration();
    if (scanResult.breakdown.orderStatus !== 1) {
      throw new Error(`Expected 1 order status notification, got ${scanResult.breakdown.orderStatus}`);
    }

    const employeeNotifs = await NotificationService.getNotifications({ userId: "u-employee" });
    const statusNotif = employeeNotifs.find((n) => n.type === "ORDER_STATUS" && n.referenceId === "so-shipped");
    if (!statusNotif) {
      throw new Error("Order status notification not found for the sales order creator");
    }
  });

  // Restore backups
  mockNotifications.length = 0;
  mockNotifications.push(...backupNotifications);
  mockStockLevels.length = 0;
  mockStockLevels.push(...backupStockLevels);
  mockPurchaseOrders.length = 0;
  mockPurchaseOrders.push(...backupPurchaseOrders);
  mockInvoices.length = 0;
  mockInvoices.push(...backupInvoices);
  mockSalesOrders.length = 0;
  mockSalesOrders.push(...backupSalesOrders);

  console.log("=================================================");
  console.log("🔔 SUITE RESULTS");
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log("=================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
