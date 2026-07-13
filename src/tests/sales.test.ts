import { SalesService } from "../services/sales.service.ts";
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
  console.log("🛠️  STARTING SALES MANAGEMENT SUITE TESTS");
  console.log("=================================================");

  // Setup testing customer
  const testCustomer = await db.createCustomer({
    companyName: "Sales Test Corp",
    contactName: "Sally Seller",
    email: `sales-test-${Math.random().toString(36).substring(2, 9)}@test.com`,
    phone: "+15550001",
    address: "777 Sales Boulevard, Dallas, TX",
  });

  const customerId = testCustomer.id;
  const employeeId = "u-employee"; // Valid user id in mocks
  let createdInvoiceId = "";

  // 1. Create Valid Sales Invoice
  await runTest("SalesService.createSalesInvoice() creates valid Invoice with Tax/Discount and deducts Stock", async () => {
    // Check initial stock for pr-motor (should be 35 based on mocks)
    const initialStock = await db.getStockLevel("pr-motor", "w-main");
    const initialQty = initialStock ? Number(initialStock.quantity) : 0;

    // Create Invoice with 10% tax and 5% discount
    // pr-motor unit price is 1450.00. Buying 2 units.
    // Subtotal = 2 * 1450 = 2900.00
    // Discount (5%) = 145.00. Taxable subtotal = 2755.00
    // Tax (10%) = 275.50
    // Total Amount = 2755.00 + 275.50 = 3030.50
    const invoice = await SalesService.createSalesInvoice({
      customerId,
      createdById: employeeId,
      items: [{ productId: "pr-motor", quantity: 2 }],
      taxRate: 10,
      discountRate: 5,
    });

    if (!invoice) {
      throw new Error("Created invoice came back null/undefined.");
    }
    createdInvoiceId = invoice.id;

    if (invoice.invoiceNumber === undefined) {
      throw new Error("Invoice has no invoiceNumber.");
    }

    // Verify subtotal, tax and discount fields
    if (Number(invoice.subtotal) !== 2900) {
      throw new Error(`Expected subtotal 2900, got: ${invoice.subtotal}`);
    }
    if (Number(invoice.discountAmount) !== 145) {
      throw new Error(`Expected discountAmount 145, got: ${invoice.discountAmount}`);
    }
    if (Number(invoice.taxAmount) !== 275.5) {
      throw new Error(`Expected taxAmount 275.5, got: ${invoice.taxAmount}`);
    }
    if (Number(invoice.amount) !== 3030.5) {
      throw new Error(`Expected total amount 3030.5, got: ${invoice.amount}`);
    }

    // Verify stock is deducted correctly
    const finalStock = await db.getStockLevel("pr-motor", "w-main");
    const finalQty = finalStock ? Number(finalStock.quantity) : 0;

    if (finalQty !== initialQty - 2) {
      throw new Error(`Expected stock to be decremented by 2 units. Was ${initialQty}, now ${finalQty}`);
    }
  });

  // 2. Block if customer doesn't exist
  await runTest("SalesService.createSalesInvoice() blocks creation with invalid customer ID", async () => {
    await assertThrows(
      async () => {
        await SalesService.createSalesInvoice({
          customerId: "cust-invalid-dummy-999",
          createdById: employeeId,
          items: [{ productId: "pr-motor", quantity: 1 }],
        });
      },
      NotFoundError,
      "does not exist"
    );
  });

  // 3. Block if product doesn't exist
  await runTest("SalesService.createSalesInvoice() blocks creation with invalid product ID", async () => {
    await assertThrows(
      async () => {
        await SalesService.createSalesInvoice({
          customerId,
          createdById: employeeId,
          items: [{ productId: "prod-invalid-dummy-999", quantity: 1 }],
        });
      },
      NotFoundError,
      "not found"
    );
  });

  // 4. Block if insufficient stock
  await runTest("SalesService.createSalesInvoice() blocks if warehouse stock is insufficient", async () => {
    await assertThrows(
      async () => {
        // pr-gear has 18 units in w-main. Requesting 20.
        await SalesService.createSalesInvoice({
          customerId,
          createdById: employeeId,
          items: [{ productId: "pr-gear", quantity: 20 }],
        });
      },
      BadRequestError,
      "Insufficient stock"
    );
  });

  // 5. Get Invoice by ID
  await runTest("SalesService.getInvoiceById() successfully retrieves full Invoice details", async () => {
    const invoice = await SalesService.getInvoiceById(createdInvoiceId);

    if (!invoice) {
      throw new Error("Could not retrieve created invoice by ID.");
    }
    if (invoice.id !== createdInvoiceId) {
      throw new Error(`Expected invoice ID ${createdInvoiceId}, got: ${invoice.id}`);
    }
    if (!invoice.salesOrder) {
      throw new Error("Invoice is missing salesOrder details.");
    }
    if (invoice.salesOrder.customerId !== customerId) {
      throw new Error("Sales order customer ID does not match.");
    }
    if (invoice.salesOrder.items.length === 0) {
      throw new Error("Sales order items are missing.");
    }
  });

  // 6. Get Invoices Paged
  await runTest("SalesService.getInvoicesPaged() paginates and filters correctly", async () => {
    const result = await SalesService.getInvoicesPaged({ page: 1, limit: 10, search: "Sales Test" });

    if (!result || !result.invoices) {
      throw new Error("Pagination result or invoices list is missing.");
    }

    const found = result.invoices.find((i: any) => i.id === createdInvoiceId);
    if (!found) {
      throw new Error("Created invoice was not found in paginated search results.");
    }
  });

  // 7. Get Daily/Monthly Sales reporting
  await runTest("SalesService reporting methods aggregate and return proper structures", async () => {
    const dailyReport = await SalesService.getDailySales({});
    if (!Array.isArray(dailyReport) || dailyReport.length === 0) {
      throw new Error("Daily sales report must be a non-empty array.");
    }
    if (dailyReport[0].totalSales === undefined || dailyReport[0].invoiceCount === undefined) {
      throw new Error("Daily sales report items are missing aggregation properties.");
    }

    const monthlyReport = await SalesService.getMonthlySales();
    if (!Array.isArray(monthlyReport) || monthlyReport.length !== 12) {
      throw new Error("Monthly sales report must have exactly 12 pre-populated months.");
    }
    if (monthlyReport[0].month === undefined || monthlyReport[0].totalSales === undefined) {
      throw new Error("Monthly sales report items are missing month/sales attributes.");
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
  console.error("Fatal uncaught error during sales testing:", err);
  process.exit(1);
});
