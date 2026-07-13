import { CustomerService } from "../services/customer.service.ts";
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
  console.log("🛠️  STARTING CUSTOMER MANAGEMENT SUITE TESTS");
  console.log("=================================================");

  let testCustId = "";
  const uniqueEmail = `test-customer-${Math.random().toString(36).substring(2, 9)}@example.com`;

  // 1. Create Customer
  await runTest("CustomerService.createCustomer() creates a valid customer", async () => {
    const customer = await CustomerService.createCustomer({
      companyName: "Test Industries",
      contactName: "John Doe",
      email: uniqueEmail,
      phone: "+15551234567",
      address: "123 Test Lane, Austin, TX",
    });

    if (!customer) {
      throw new Error("Created customer came back null/undefined.");
    }
    if (customer.contactName !== "John Doe") {
      throw new Error(`Expected contactName 'John Doe', got: ${customer.contactName}`);
    }
    if (customer.email !== uniqueEmail) {
      throw new Error(`Expected email '${uniqueEmail}', got: ${customer.email}`);
    }
    if (customer.isDeleted !== false) {
      throw new Error("Customer should have isDeleted = false initially.");
    }

    testCustId = customer.id;
  });

  // 2. Prevent duplicate email creation
  await runTest("CustomerService.createCustomer() blocks creation with duplicate email", async () => {
    await assertThrows(
      async () => {
        await CustomerService.createCustomer({
          companyName: "Another Corp",
          contactName: "Jane Doe",
          email: uniqueEmail, // Duplicate
        });
      },
      BadRequestError,
      "already exists"
    );
  });

  // 3. Paginated query and searching
  await runTest("CustomerService.getCustomersPaged() fetches paginated and searched results", async () => {
    const result = await CustomerService.getCustomersPaged({ page: 1, limit: 10, search: "Doe" });

    if (!result || !result.customers) {
      throw new Error("Pagination result or customers list is missing.");
    }

    const found = result.customers.find((c: any) => c.id === testCustId);
    if (!found) {
      throw new Error("Created customer was not found in paginated search results for 'Doe'.");
    }

    if (result.total <= 0) {
      throw new Error("Total count should be greater than zero.");
    }
  });

  // 4. Retrieve Customer with history
  await runTest("CustomerService.getCustomerById() retrieves details and purchase history", async () => {
    const customer = await CustomerService.getCustomerById(testCustId);

    if (!customer) {
      throw new Error("Could not retrieve customer by ID.");
    }
    if (customer.id !== testCustId) {
      throw new Error("Retrieved customer ID does not match.");
    }
    if (!customer.salesOrders) {
      throw new Error("Sales orders (purchase history) array is missing.");
    }
  });

  // 5. Update Customer
  await runTest("CustomerService.updateCustomer() modifies customer fields", async () => {
    const updated = await CustomerService.updateCustomer(testCustId, {
      companyName: "Test Industries Updated",
      contactName: "Johnny Doe",
      email: uniqueEmail,
      phone: "+15559876543",
      address: "456 New Road, Austin, TX",
    });

    if (!updated) {
      throw new Error("Update returned null/undefined.");
    }
    if (updated.contactName !== "Johnny Doe") {
      throw new Error(`Expected contactName updated to 'Johnny Doe', got: ${updated.contactName}`);
    }
    if (updated.companyName !== "Test Industries Updated") {
      throw new Error(`Expected companyName updated to 'Test Industries Updated', got: ${updated.companyName}`);
    }
  });

  // 6. Delete Customer (Soft delete)
  await runTest("CustomerService.deleteCustomer() soft-deletes a customer and blocks retrieval", async () => {
    await CustomerService.deleteCustomer(testCustId);

    // Verify it blocks getCustomerById
    await assertThrows(
      async () => {
        await CustomerService.getCustomerById(testCustId);
      },
      NotFoundError,
      "not found"
    );

    // Verify it is excluded from paginated results
    const result = await CustomerService.getCustomersPaged({ page: 1, limit: 10 });
    const found = result.customers.find((c: any) => c.id === testCustId);
    if (found) {
      throw new Error("Soft-deleted customer should not appear in active customers list.");
    }
  });

  // 7. Verify updating or deleting non-existent customer throws NotFoundError
  await runTest("CustomerService methods throw NotFoundError for non-existent ID", async () => {
    const dummyId = "cust-nonexistent-id-999";
    await assertThrows(
      async () => {
        await CustomerService.getCustomerById(dummyId);
      },
      NotFoundError,
      "not found"
    );

    await assertThrows(
      async () => {
        await CustomerService.updateCustomer(dummyId, {
          contactName: "No One",
          email: "noone@example.com",
        });
      },
      NotFoundError,
      "does not exist"
    );

    await assertThrows(
      async () => {
        await CustomerService.deleteCustomer(dummyId);
      },
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
  console.error("Fatal uncaught error during customer testing:", err);
  process.exit(1);
});
