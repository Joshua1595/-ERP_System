import { ProductService } from "../services/product.service.ts";
import { db } from "../lib/db.ts";
import { ConflictError, NotFoundError, BadRequestError } from "../utils/errors.ts";

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
  console.log("🛠️  STARTING PRODUCT MODULE SECURITY & CRUD TESTS");
  console.log("=================================================");

  // Check database configuration state
  const isDbReachable = await db.getProductById("test-non-existent").catch(() => false);
  console.log(`Running in: ${isDbReachable !== false ? "SQL/Prisma Mode" : "Resilient In-Memory Mode"}`);

  // We need a category for testing. Let's list and grab an existing one or create a mock.
  const categories = await db.getCategories();
  if (categories.length === 0) {
    console.warn("⚠️ Warning: No product categories found in seed data! Creating dummy category.");
    // In actual app, we always have default categories like RAW (c-raw) or FIN (c-fin)
  }
  const testCategoryId = categories[0]?.id || "c-fin";

  await runTest("ProductService.getAllProducts() returns a list", async () => {
    const list = await ProductService.getAllProducts();
    if (!Array.isArray(list)) {
      throw new Error("Result is not an array");
    }
    console.log(`   (System currently has ${list.length} products cataloged)`);
  });

  let createdId = "";
  const uniqueSku = "TEST-SKU-" + Math.random().toString(36).substring(2, 7).toUpperCase();

  await runTest("ProductService.createProduct() inserts and catalogs a new product record", async () => {
    const payload = {
      name: "Ultra Precision Gearbox",
      sku: uniqueSku,
      description: "Automated test premium gearbox unit",
      categoryId: testCategoryId,
      price: 1200.0,
      cost: 750.0,
      unitOfMeasure: "PCS",
    };

    const newProd = await ProductService.createProduct(payload);
    if (!newProd || !newProd.id) {
      throw new Error("Created product does not contain a valid ID");
    }
    if (newProd.sku !== uniqueSku) {
      throw new Error(`Expected SKU to be ${uniqueSku}, got ${newProd.sku}`);
    }
    createdId = newProd.id;
  });

  await runTest("ProductService.createProduct() prevents duplicate SKUs", async () => {
    const payloadDuplicate = {
      name: "Another Gearbox",
      sku: uniqueSku, // Duplicate
      description: "Should fail validation",
      categoryId: testCategoryId,
      price: 1200.0,
      cost: 750.0,
      unitOfMeasure: "PCS",
    };

    await assertThrows(
      () => ProductService.createProduct(payloadDuplicate),
      ConflictError,
      "already registered"
    );
  });

  await runTest("ProductService.createProduct() prevents non-existent category IDs", async () => {
    const badCategoryPayload = {
      name: "Gearbox with missing category",
      sku: "ERR-CAT-999",
      description: "Should fail validation",
      categoryId: "c-missing-and-definitely-nonexistent-uuid",
      price: 1200.0,
      cost: 750.0,
      unitOfMeasure: "PCS",
    };

    await assertThrows(
      () => ProductService.createProduct(badCategoryPayload),
      BadRequestError,
      "does not exist"
    );
  });

  await runTest("ProductService.getProductById() fetches correct product and includes category context", async () => {
    if (!createdId) throw new Error("Skipped: Created product ID not captured.");
    
    const fetched = await ProductService.getProductById(createdId);
    if (fetched.id !== createdId) {
      throw new Error("Fetched product ID does not match the target ID");
    }
    if (fetched.name !== "Ultra Precision Gearbox") {
      throw new Error(`Fetched product name is mismatch. Got "${fetched.name}"`);
    }
  });

  await runTest("ProductService.getProductById() handles non-existent products gracefully", async () => {
    await assertThrows(
      () => ProductService.getProductById("non-existent-generic-id"),
      NotFoundError,
      "does not exist"
    );
  });

  await runTest("ProductService.updateProduct() updates product fields successfully", async () => {
    if (!createdId) throw new Error("Skipped: Created product ID not captured.");

    const updatePayload = {
      name: "Super Ultra Precision Gearbox V2",
      price: 1350.5,
    };

    const updated = await ProductService.updateProduct(createdId, updatePayload);
    if (updated.name !== "Super Ultra Precision Gearbox V2") {
      throw new Error(`Expected updated name to be updated, got "${updated.name}"`);
    }
    if (Number(updated.price) !== 1350.5) {
      throw new Error(`Expected updated price to be 1350.5, got ${updated.price}`);
    }
  });

  await runTest("ProductService.updateProduct() prevents duplicate SKUs upon editing", async () => {
    if (!createdId) throw new Error("Skipped: Created product ID not captured.");

    // Let's find another SKU that is already in use
    const all = await ProductService.getAllProducts();
    const otherProduct = all.find((p) => p.id !== createdId);
    if (!otherProduct) {
      console.log("   ⚠️ Skipped SKU collision update check (need at least 2 products in DB)");
      return;
    }

    await assertThrows(
      () => ProductService.updateProduct(createdId, { sku: otherProduct.sku }),
      ConflictError,
      "already exists"
    );
  });

  await runTest("ProductService.getProductsPaged() supports pagination, search, and category filtering", async () => {
    // 1. Test pagination limits
    const pagedResult = await ProductService.getProductsPaged({ page: 1, limit: 2 });
    if (!pagedResult || !Array.isArray(pagedResult.products)) {
      throw new Error("Paged result products is not an array");
    }
    if (pagedResult.products.length > 2) {
      throw new Error(`Expected at most 2 products, got ${pagedResult.products.length}`);
    }

    // 2. Test text search
    const searchResult = await ProductService.getProductsPaged({ page: 1, limit: 10, search: "Precision" });
    const matchName = searchResult.products.every(p => 
      p.name.toLowerCase().includes("precision") || 
      p.sku.toLowerCase().includes("precision") || 
      (p.description && p.description.toLowerCase().includes("precision"))
    );
    if (!matchName) {
      throw new Error("Search result contains products that do not match query 'Precision'");
    }

    // 3. Test category filtering
    const categoryResult = await ProductService.getProductsPaged({ page: 1, limit: 10, categoryId: testCategoryId });
    const matchCategory = categoryResult.products.every(p => p.categoryId === testCategoryId);
    if (!matchCategory) {
      throw new Error(`Category filtering failed. Expected categoryId to be ${testCategoryId}`);
    }
  });

  await runTest("ProductService.updateStock() registers stock movement and adjusts levels", async () => {
    if (!createdId) throw new Error("Skipped: Created product ID not captured.");

    const warehouses = await db.getWarehouses();
    if (warehouses.length === 0) {
      console.warn("⚠️ Warning: No warehouses configured in seeds! Skipping stock level testing.");
      return;
    }
    const testWarehouseId = warehouses[0].id;

    // Retrieve initial product details to look at stock
    const initialProduct = await ProductService.getProductById(createdId);
    const initialQty = initialProduct.stockLevels?.find(sl => sl.warehouseId === testWarehouseId)?.quantity || 0;

    // Log a new INCOMING stock adjustment
    const movement = await ProductService.updateStock(createdId, {
      warehouseId: testWarehouseId,
      quantityChange: 45,
      type: "INCOMING",
      referenceNumber: "TEST-MOVE-123",
      description: "Automated test stock adjustment entry",
    }, "u-admin");

    if (!movement || movement.productId !== createdId) {
      throw new Error("Failed to post stock movement correctly.");
    }

    // Verify updated stock levels
    const updatedProduct = await ProductService.getProductById(createdId);
    const updatedSL = updatedProduct.stockLevels?.find(sl => sl.warehouseId === testWarehouseId);
    if (!updatedSL) {
      throw new Error("StockLevel entry not created after posting stock movement.");
    }

    const expectedQty = Number(initialQty) + 45;
    if (Number(updatedSL.quantity) !== expectedQty) {
      throw new Error(`Expected stock level quantity to be ${expectedQty}, got ${updatedSL.quantity}`);
    }
  });

  await runTest("ProductService.deleteProduct() removes a product completely", async () => {
    if (!createdId) throw new Error("Skipped: Created product ID not captured.");

    const success = await ProductService.deleteProduct(createdId);
    if (!success) {
      throw new Error("deleteProduct returned false status");
    }

    // Attempting to fetch it should now trigger NotFoundError
    await assertThrows(
      () => ProductService.getProductById(createdId),
      NotFoundError,
      "does not exist"
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
  console.error("Fatal uncaught error during test suite execution:", err);
  process.exit(1);
});
