import { InventoryService } from "../services/inventory.service.ts";
import { db } from "../lib/db.ts";
import { NotFoundError, BadRequestError } from "../utils/errors.ts";

// Minimal testing framework utilities
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
  console.log("🛠️  STARTING INVENTORY MANAGEMENT SUITE TESTS");
  console.log("=================================================");

  // Ensure mock or DB records exist
  const warehouses = await db.getWarehouses();
  if (warehouses.length < 2) {
    throw new Error("Testing requires at least two warehouses configured.");
  }
  const sourceWH = warehouses[0].id;
  const destWH = warehouses[1].id;

  const products = await db.getProducts();
  if (products.length === 0) {
    throw new Error("Testing requires at least one product configured.");
  }
  const testProduct = products[0];
  const testProductId = testProduct.id;

  // 1. Test Fetching Paginated Stock Levels
  await runTest("InventoryService.getStockLevelsPaged() retrieves paginated levels", async () => {
    const result = await InventoryService.getStockLevelsPaged({ page: 1, limit: 5 });
    if (!result || !Array.isArray(result.stockLevels)) {
      throw new Error("Result is not properly formatted");
    }
    if (result.stockLevels.length > 5) {
      throw new Error(`Expected at most 5 records, got ${result.stockLevels.length}`);
    }
  });

  // 2. Test Fetching Single Stock Level Record
  await runTest("InventoryService.getStockLevel() returns details of a single record", async () => {
    // Upsert a test stock level first to guarantee existence
    await InventoryService.updateStockLevelBounds(testProductId, sourceWH, { minStock: 10, maxStock: 500, reorderPoint: 20 });
    const sl = await InventoryService.getStockLevel(testProductId, sourceWH);
    if (!sl || sl.productId !== testProductId || sl.warehouseId !== sourceWH) {
      throw new Error("Failed to fetch correct stock level record");
    }
  });

  // 3. Test Invalid Threshold Bounds
  await runTest("InventoryService.updateStockLevelBounds() prevents min exceeding max", async () => {
    await assertThrows(
      async () => {
        await InventoryService.updateStockLevelBounds(testProductId, sourceWH, {
          minStock: 200,
          maxStock: 50,
        });
      },
      BadRequestError,
      "Minimum stock limit cannot exceed maximum stock"
    );
  });

  // 4. Test Stock In (Deposit)
  await runTest("InventoryService.stockIn() updates warehouse balance with valid input", async () => {
    const initialSL = await db.getStockLevel(testProductId, sourceWH);
    const initialQty = initialSL ? Number(initialSL.quantity) : 0;

    const movement = await InventoryService.stockIn(
      {
        productId: testProductId,
        warehouseId: sourceWH,
        quantity: 100,
        referenceNumber: "TEST-IN-01",
        description: "Test product replenishment",
      },
      "u-manager"
    );

    if (!movement || movement.type !== "INCOMING" || Number(movement.quantityChange) !== 100) {
      throw new Error("Stock movement not posted correctly");
    }

    const updatedSL = await db.getStockLevel(testProductId, sourceWH);
    const expectedQty = initialQty + 100;
    if (!updatedSL || Number(updatedSL.quantity) !== expectedQty) {
      throw new Error(`Expected warehouse quantity to be ${expectedQty}, got ${updatedSL ? updatedSL.quantity : 'null'}`);
    }
  });

  // 5. Test Stock Out (Withdrawal & Overdraft Protection)
  await runTest("InventoryService.stockOut() blocks transactions exceeding current balance", async () => {
    const currentSL = await db.getStockLevel(testProductId, sourceWH);
    const available = currentSL ? Number(currentSL.quantity) : 0;

    // Attempt to withdraw more than available
    await assertThrows(
      async () => {
        await InventoryService.stockOut(
          {
            productId: testProductId,
            warehouseId: sourceWH,
            quantity: available + 50,
            referenceNumber: "TEST-OUT-ERR",
          },
          "u-manager"
        );
      },
      BadRequestError,
      "Insufficient stock"
    );
  });

  await runTest("InventoryService.stockOut() subtracts balance correctly for valid withdrawals", async () => {
    const initialSL = await db.getStockLevel(testProductId, sourceWH);
    const initialQty = initialSL ? Number(initialSL.quantity) : 0;
    if (initialQty < 30) {
      // replenish to have enough for tests
      await InventoryService.stockIn({ productId: testProductId, warehouseId: sourceWH, quantity: 50 }, "u-manager");
    }

    const currentSL = await db.getStockLevel(testProductId, sourceWH);
    const currentQty = Number(currentSL!.quantity);

    const movement = await InventoryService.stockOut(
      {
        productId: testProductId,
        warehouseId: sourceWH,
        quantity: 20,
        referenceNumber: "TEST-OUT-01",
      },
      "u-manager"
    );

    if (!movement || movement.type !== "OUTGOING" || Number(movement.quantityChange) !== -20) {
      throw new Error("Negative movement not written to ledger correctly");
    }

    const finalSL = await db.getStockLevel(testProductId, sourceWH);
    const expectedQty = currentQty - 20;
    if (!finalSL || Number(finalSL.quantity) !== expectedQty) {
      throw new Error(`Expected post-deduction quantity to be ${expectedQty}, got ${finalSL ? finalSL.quantity : 'null'}`);
    }
  });

  // 6. Test Stock Transfers
  await runTest("InventoryService.transferStock() executes atomic transfer across warehouses", async () => {
    // Replenish source to be absolutely sure we have enough
    await InventoryService.stockIn({ productId: testProductId, warehouseId: sourceWH, quantity: 50 }, "u-manager");

    const srcBefore = await db.getStockLevel(testProductId, sourceWH);
    const destBefore = await db.getStockLevel(testProductId, destWH);

    const srcQtyBefore = srcBefore ? Number(srcBefore.quantity) : 0;
    const destQtyBefore = destBefore ? Number(destBefore.quantity) : 0;

    const result = await InventoryService.transferStock(
      {
        productId: testProductId,
        fromWarehouseId: sourceWH,
        toWarehouseId: destWH,
        quantity: 15,
        referenceNumber: "TEST-TRF-01",
        description: "Moving parts to East Hub",
      },
      "u-manager"
    );

    if (!result || !result.outMovement || !result.inMovement) {
      throw new Error("Dual ledger lines not returned by transfer processor");
    }

    const srcAfter = await db.getStockLevel(testProductId, sourceWH);
    const destAfter = await db.getStockLevel(testProductId, destWH);

    if (!srcAfter || Number(srcAfter.quantity) !== srcQtyBefore - 15) {
      throw new Error("Source warehouse quantity not decremented correctly.");
    }

    if (!destAfter || Number(destAfter.quantity) !== destQtyBefore + 15) {
      throw new Error("Destination warehouse quantity not incremented correctly.");
    }
  });

  // 7. Test History log
  await runTest("InventoryService.getStockHistoryPaged() returns paginated list of movements", async () => {
    const history = await InventoryService.getStockHistoryPaged({ page: 1, limit: 10 });
    if (!history || !Array.isArray(history.movements)) {
      throw new Error("History movements is not an array");
    }
    if (history.movements.length === 0) {
      throw new Error("Expected some stock movements in the ledger log");
    }
  });

  // 8. Test Aggregations & Reporting
  await runTest("InventoryService.getInventoryReport() yields key metrics and distributions", async () => {
    const report = await InventoryService.getInventoryReport();
    if (!report) {
      throw new Error("Failed to compile inventory health report");
    }
    if (typeof report.totalItemsInStock !== "number" || report.totalItemsInStock < 0) {
      throw new Error("Invalid aggregate in-stock item count");
    }
    if (typeof report.totalValuationPrice !== "number" || report.totalValuationPrice < 0) {
      throw new Error("Invalid inventory valuations");
    }
    if (!Array.isArray(report.categoryDistribution)) {
      throw new Error("Category distribution breakdown is missing");
    }
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
  console.error("Fatal uncaught error during inventory testing:", err);
  process.exit(1);
});
