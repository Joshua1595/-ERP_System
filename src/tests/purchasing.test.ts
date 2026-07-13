import { PurchasingService } from "../services/purchasing.service.ts";
import { db } from "../lib/db.ts";
import { PurchaseOrderStatus } from "@prisma/client";
import { NotFoundError, BadRequestError } from "../utils/errors.ts";

let passedTests = 0;
let failedTests = 0;

async function assertThrows(
  fn: () => Promise<any>,
  expectedErrorClass: any,
  errorMessageSnippet?: string
) {
  try {
    await fn();
    throw new Error(`Expected error of type ${expectedErrorClass.name} but function succeeded.`);
  } catch (err: any) {
    if (err instanceof expectedErrorClass) {
      if (errorMessageSnippet && !err.message.includes(errorMessageSnippet)) {
        throw new Error(
          `Expected error message to contain "${errorMessageSnippet}" but got: "${err.message}"`
        );
      }
      return; // Succeeded
    }
    throw new Error(
      `Expected error of type ${expectedErrorClass.name} but got ${err.constructor.name}: "${err.message}"`
    );
  }
}

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
  console.log("🛠️  STARTING PURCHASING MANAGEMENT SUITE TESTS");
  console.log("=================================================");

  // Fetch initial test context (requires a seed supplier & product)
  const products = await db.getProducts();
  const suppliers = await db.getSuppliers();

  if (products.length === 0 || suppliers.length === 0) {
    throw new Error("Testing requires at least one product and one supplier in the system.");
  }

  const testProduct = products[0];
  const testSupplier = suppliers[0];
  let testPOId = "";

  // 1. Create Purchase Order (Draft/Pending Stage)
  await runTest("PurchasingService.createPurchaseOrder() creates a valid PO in PENDING status", async () => {
    const order = await PurchasingService.createPurchaseOrder({
      supplierId: testSupplier.id,
      createdById: "u-manager",
      items: [
        { productId: testProduct.id, quantity: 50.00 },
      ],
    });

    if (!order) {
      throw new Error("Created order came back null/undefined.");
    }
    if (order.status !== PurchaseOrderStatus.PENDING) {
      throw new Error(`Expected initial status to be PENDING, but got: ${order.status}`);
    }
    if (order.items.length !== 1 || Number(order.items[0].quantity) !== 50.00) {
      throw new Error("Order items count or quantity did not match inputs.");
    }

    testPOId = order.id;
  });

  // 2. Validate input constraints on PO Creation
  await runTest("PurchasingService.createPurchaseOrder() validates non-empty items checklist", async () => {
    await assertThrows(
      async () => {
        await PurchasingService.createPurchaseOrder({
          supplierId: testSupplier.id,
          createdById: "u-manager",
          items: [],
        });
      },
      BadRequestError,
      "At least one purchase item is required"
    );
  });

  await runTest("PurchasingService.createPurchaseOrder() blocks negative item quantities", async () => {
    await assertThrows(
      async () => {
        await PurchasingService.createPurchaseOrder({
          supplierId: testSupplier.id,
          createdById: "u-manager",
          items: [{ productId: testProduct.id, quantity: -10 }],
        });
      },
      BadRequestError,
      "quantity must be greater than zero"
    );
  });

  await runTest("PurchasingService.createPurchaseOrder() blocks non-existent supplier", async () => {
    await assertThrows(
      async () => {
        await PurchasingService.createPurchaseOrder({
          supplierId: "00000000-0000-0000-0000-000000000000",
          createdById: "u-manager",
          items: [{ productId: testProduct.id, quantity: 10 }],
        });
      },
      NotFoundError,
      "does not exist"
    );
  });

  // 3. Receive Products fails when PENDING
  await runTest("PurchasingService.receivePurchaseOrder() blocks receiving a PO that is still PENDING", async () => {
    await assertThrows(
      async () => {
        await PurchasingService.receivePurchaseOrder(testPOId, {
          receivedById: "u-manager",
          warehouseId: "w-main",
        });
      },
      BadRequestError,
      "must be APPROVED before it can be received"
    );
  });

  // 4. Update Status to APPROVED
  await runTest("PurchasingService.updatePurchaseOrderStatus() successfully approves a PENDING order", async () => {
    const updated = await PurchasingService.updatePurchaseOrderStatus(testPOId, PurchaseOrderStatus.APPROVED);
    if (!updated || updated.status !== PurchaseOrderStatus.APPROVED) {
      throw new Error("PO status was not correctly transitioned to APPROVED.");
    }
  });

  // 5. Receive Products works when APPROVED
  await runTest("PurchasingService.receivePurchaseOrder() receives goods and increments stock in warehouse", async () => {
    // Check initial stock
    const initialStocks = await db.getStockLevels();
    const targetStock = initialStocks.find(
      (sl) => sl.productId === testProduct.id && sl.warehouseId === "w-main"
    );
    const initialQty = targetStock ? Number(targetStock.quantity) : 0;

    // Receive the PO
    const received = await PurchasingService.receivePurchaseOrder(testPOId, {
      receivedById: "u-manager",
      warehouseId: "w-main",
    });

    if (!received || received.status !== PurchaseOrderStatus.RECEIVED) {
      throw new Error("PO status was not correctly set to RECEIVED.");
    }

    // Verify stock increment
    const updatedStocks = await db.getStockLevels();
    const updatedStock = updatedStocks.find(
      (sl) => sl.productId === testProduct.id && sl.warehouseId === "w-main"
    );
    const newQty = updatedStock ? Number(updatedStock.quantity) : 0;

    if (newQty !== initialQty + 50.00) {
      throw new Error(`Stock level was not incremented correctly. Expected ${initialQty + 50.00}, got ${newQty}`);
    }

    // Verify Stock movement log exists
    const movements = await db.getStockMovements();
    const incomingMovement = movements.find(
      (m) => m.productId === testProduct.id && m.referenceNumber === received.poNumber && m.type === "INCOMING"
    );

    if (!incomingMovement || Number(incomingMovement.quantityChange) !== 50.00) {
      throw new Error("Proper INCOMING stock movement was not recorded.");
    }
  });

  // 6. Block receiving already RECEIVED POs
  await runTest("PurchasingService.receivePurchaseOrder() blocks receiving an already RECEIVED PO", async () => {
    await assertThrows(
      async () => {
        await PurchasingService.receivePurchaseOrder(testPOId, {
          receivedById: "u-manager",
          warehouseId: "w-main",
        });
      },
      BadRequestError,
      "already been received"
    );
  });

  // 7. Test PO Cancellation
  await runTest("PurchasingService.updatePurchaseOrderStatus() cancels an order and blocks receiving", async () => {
    // Create new PO
    const order = await PurchasingService.createPurchaseOrder({
      supplierId: testSupplier.id,
      createdById: "u-manager",
      items: [{ productId: testProduct.id, quantity: 100.00 }],
    });

    // Cancel PO
    const cancelled = await PurchasingService.updatePurchaseOrderStatus(order.id, PurchaseOrderStatus.CANCELLED);
    if (!cancelled || cancelled.status !== PurchaseOrderStatus.CANCELLED) {
      throw new Error("PO status was not transitioned to CANCELLED.");
    }

    // Try to receive cancelled PO
    await assertThrows(
      async () => {
        await PurchasingService.receivePurchaseOrder(order.id, {
          receivedById: "u-manager",
          warehouseId: "w-main",
        });
      },
      BadRequestError,
      "Cannot receive a cancelled purchase order"
    );
  });

  console.log("\n=================================================");
  console.log("📊 SUMMARY OF TESTING MODULE RESULTS");
  console.log("=================================================");
  console.log(`   🟩 Total Passed Tests: ${passedTests}`);
  console.log(`   🟥 Total Failed Tests: ${failedTests}`);
  console.log("=================================================");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal uncaught error during purchasing testing:", err);
  process.exit(1);
});
