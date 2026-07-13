import { SupplierService } from "../services/supplier.service.ts";
import { db } from "../lib/db.ts";
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
  console.log("🛠️  STARTING SUPPLIER MANAGEMENT SUITE TESTS");
  console.log("=================================================");

  // Seed data assertions
  const products = await db.getProducts();
  if (products.length === 0) {
    throw new Error("Testing requires at least one product in the system.");
  }
  const testProduct = products[0];

  let testSupplierId = "";

  // 1. Create a Supplier (Valid Input)
  await runTest("SupplierService.createSupplier() registers a valid supplier with contact and address", async () => {
    const supplier = await SupplierService.createSupplier({
      companyName: "Global Fab Corp",
      contactName: "John Steel",
      email: "procurement@globalfab.com",
      phone: "+1-234-567-8900",
      address: "123 industrial Pkwy, Cleveland, OH",
    });

    if (!supplier || supplier.companyName !== "Global Fab Corp" || supplier.email !== "procurement@globalfab.com") {
      throw new Error("Created supplier did not match input payload.");
    }
    if (supplier.address !== "123 industrial Pkwy, Cleveland, OH" || supplier.phone !== "+1-234-567-8900") {
      throw new Error("Contact and address info not saved correctly.");
    }

    testSupplierId = supplier.id;
  });

  // 2. Prevent Duplicate Emails
  await runTest("SupplierService.createSupplier() blocks duplicate supplier email creation", async () => {
    await assertThrows(
      async () => {
        await SupplierService.createSupplier({
          companyName: "Another Name Inc",
          email: "procurement@globalfab.com", // Duplicate
        });
      },
      BadRequestError,
      "email already exists"
    );
  });

  // 3. Fetch Supplier details by ID
  await runTest("SupplierService.getSupplierById() retrieves full supplier record details", async () => {
    const s = await SupplierService.getSupplierById(testSupplierId);
    if (!s || s.id !== testSupplierId || s.companyName !== "Global Fab Corp") {
      throw new Error("Failed to fetch correct supplier by ID");
    }
  });

  // 4. Update Supplier record (Valid & Blank constraint validation)
  await runTest("SupplierService.updateSupplier() modifies fields successfully", async () => {
    const updated = await SupplierService.updateSupplier(testSupplierId, {
      contactName: "Johnathan Steel",
      phone: "+1-999-888-7777",
    });

    if (!updated || updated.contactName !== "Johnathan Steel" || updated.phone !== "+1-999-888-7777") {
      throw new Error("Update did not reflect expected field modifications.");
    }
  });

  await runTest("SupplierService.updateSupplier() blocks setting invalid blank name", async () => {
    await assertThrows(
      async () => {
        await SupplierService.updateSupplier(testSupplierId, {
          companyName: "   ",
        });
      },
      BadRequestError,
      "cannot be blank"
    );
  });

  // 5. Paginated, Searchable Querying
  await runTest("SupplierService.getSuppliersPaged() retrieves lists matching page/limit", async () => {
    const result = await SupplierService.getSuppliersPaged({ page: 1, limit: 1 });
    if (!result || !Array.isArray(result.suppliers) || typeof result.total !== "number") {
      throw new Error("Paged query result was not formatted properly.");
    }
    if (result.suppliers.length > 1) {
      throw new Error("Result count exceeded limit page threshold.");
    }
  });

  await runTest("SupplierService.getSuppliersPaged() respects search strings accurately", async () => {
    const result = await SupplierService.getSuppliersPaged({ page: 1, limit: 10, search: "Cleveland" });
    const match = result.suppliers.find((s) => s.id === testSupplierId);
    if (!match) {
      throw new Error("Failed to search and locate Cleveland-based supplier.");
    }
  });

  // 6. Supplier Products Management (Catalog linking)
  await runTest("SupplierService.addSupplierProduct() maps a product with price/leadTime", async () => {
    const mapping = await SupplierService.addSupplierProduct({
      supplierId: testSupplierId,
      productId: testProduct.id,
      price: 25.50,
      leadTimeDays: 4,
    });

    if (!mapping || Number(mapping.price) !== 25.50 || mapping.leadTimeDays !== 4) {
      throw new Error("Failed to assign product mapping to supplier with pricing and lead times.");
    }
  });

  await runTest("SupplierService.getSupplierProducts() retrieves mapped products nested details", async () => {
    const productsList = await SupplierService.getSupplierProducts(testSupplierId);
    if (!productsList || productsList.length === 0) {
      throw new Error("Mapped product did not appear in supplier product catalog lists.");
    }
    const mapping = productsList.find((sp) => sp.productId === testProduct.id);
    if (!mapping || !mapping.product || mapping.product.id !== testProduct.id) {
      throw new Error("Catalog item did not properly nest complete product details.");
    }
  });

  // 7. Supplier Purchase History Retrieval
  await runTest("SupplierService.getSupplierPurchaseHistory() fetches purchase records safely", async () => {
    const history = await SupplierService.getSupplierPurchaseHistory("sup-apex", { page: 1, limit: 5 });
    if (!history || !Array.isArray(history.purchaseOrders)) {
      throw new Error("Failed to fetch purchase orders logs.");
    }
    // We expect the mock PO "po-1" to belong to apex
    const po = history.purchaseOrders.find((p) => p.id === "po-1");
    if (!po || po.supplierId !== "sup-apex") {
      throw new Error("Could not find the seeded purchase history items.");
    }
  });

  // 8. Soft Delete functionality
  await runTest("SupplierService.deleteSupplier() soft deletes a supplier profile", async () => {
    const deleted = await SupplierService.deleteSupplier(testSupplierId);
    if (!deleted || !deleted.isDeleted) {
      throw new Error("Supplier record isDeleted flag not set to true.");
    }

    // Verify it is excluded from normal paged search queries
    const activeSuppliers = await SupplierService.getSuppliersPaged({ page: 1, limit: 50 });
    const exists = activeSuppliers.suppliers.some((s) => s.id === testSupplierId);
    if (exists) {
      throw new Error("Soft deleted supplier still returned by active suppliers catalog lists.");
    }

    // Direct access to soft-deleted record is prohibited via service
    await assertThrows(
      async () => {
        await SupplierService.getSupplierById(testSupplierId);
      },
      NotFoundError,
      "not found"
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
  console.error("Fatal uncaught error during supplier testing:", err);
  process.exit(1);
});
