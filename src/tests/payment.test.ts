import { PaymentService } from "../services/payment.service.ts";
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
  console.log("🛠️  STARTING PAYMENT MANAGEMENT SUITE TESTS");
  console.log("=================================================");

  // 1. Setup Customer and Invoice
  const testCustomer = await db.createCustomer({
    companyName: "Payment Test Corp",
    contactName: "Pamela Payee",
    email: `payment-test-${Math.random().toString(36).substring(2, 9)}@test.com`,
    phone: "+15550201",
    address: "888 Payment Boulevard, Austin, TX",
  });

  const customerId = testCustomer.id;
  const employeeId = "u-employee";

  // Create an invoice first
  // Buying 1 unit of pr-motor (1450.00) with no tax or discount. Total = 1450.00
  const invoice = await SalesService.createSalesInvoice({
    customerId,
    createdById: employeeId,
    items: [{ productId: "pr-motor", quantity: 1 }],
  });

  const invoiceId = invoice.id;
  let createdPaymentId = "";

  // 2. Test: Partial Payment
  await runTest("PaymentService.createPayment() processes partial payment and sets status to PARTIALLY_PAID", async () => {
    // Current total = 1450.00. Pay 450.00 partial
    const payment = await PaymentService.createPayment({
      invoiceId,
      amountPaid: 450,
      paymentMethod: "BANK_TRANSFER",
      referenceNo: "TXN-BANK-001",
    });

    if (!payment) {
      throw new Error("Created payment came back null/undefined.");
    }
    createdPaymentId = payment.id;

    if (Number(payment.amountPaid) !== 450) {
      throw new Error(`Expected amountPaid 450, got: ${payment.amountPaid}`);
    }

    if (payment.paymentMethod !== "BANK_TRANSFER") {
      throw new Error(`Expected paymentMethod BANK_TRANSFER, got: ${payment.paymentMethod}`);
    }

    // Verify invoice status is updated to PARTIALLY_PAID
    const updatedInvoice = await db.getInvoiceById(invoiceId);
    if (!updatedInvoice) {
      throw new Error("Could not fetch invoice after partial payment.");
    }

    if (updatedInvoice.status !== "PARTIALLY_PAID") {
      throw new Error(`Expected invoice status PARTIALLY_PAID, got: ${updatedInvoice.status}`);
    }
  });

  // 3. Test: Get Outstanding Details
  await runTest("PaymentService.getInvoiceOutstandingDetails() returns correct calculated values", async () => {
    const details = await PaymentService.getInvoiceOutstandingDetails(invoiceId);

    if (details.totalAmount !== 1450) {
      throw new Error(`Expected totalAmount 1450, got: ${details.totalAmount}`);
    }

    if (details.totalPaid !== 450) {
      throw new Error(`Expected totalPaid 450, got: ${details.totalPaid}`);
    }

    if (details.outstanding !== 1000) {
      throw new Error(`Expected outstanding 1000, got: ${details.outstanding}`);
    }

    if (details.status !== "PARTIALLY_PAID") {
      throw new Error(`Expected status PARTIALLY_PAID, got: ${details.status}`);
    }
  });

  // 4. Test: Block Overpayment
  await runTest("PaymentService.createPayment() blocks payment exceeding outstanding balance", async () => {
    // Current outstanding is 1000. Try to pay 1050.
    await assertThrows(
      async () => {
        await PaymentService.createPayment({
          invoiceId,
          amountPaid: 1050,
          paymentMethod: "CASH",
        });
      },
      BadRequestError,
      "exceeds the outstanding balance"
    );
  });

  // 5. Test: Complete Full Payment
  await runTest("PaymentService.createPayment() processes final full payment and sets status to PAID", async () => {
    // Pay remaining 1000
    const payment = await PaymentService.createPayment({
      invoiceId,
      amountPaid: 1000,
      paymentMethod: "MOBILE_PAYMENT",
      referenceNo: "TXN-MOBILE-002",
    });

    if (!payment) {
      throw new Error("Created final payment came back null/undefined.");
    }

    // Verify invoice status is updated to PAID
    const updatedInvoice = await db.getInvoiceById(invoiceId);
    if (!updatedInvoice) {
      throw new Error("Could not fetch invoice after final payment.");
    }

    if (updatedInvoice.status !== "PAID") {
      throw new Error(`Expected invoice status PAID, got: ${updatedInvoice.status}`);
    }

    const details = await PaymentService.getInvoiceOutstandingDetails(invoiceId);
    if (details.outstanding !== 0) {
      throw new Error(`Expected outstanding balance 0, got: ${details.outstanding}`);
    }
  });

  // 6. Test: Block payment on fully paid invoice
  await runTest("PaymentService.createPayment() blocks payment on an already fully paid invoice", async () => {
    await assertThrows(
      async () => {
        await PaymentService.createPayment({
          invoiceId,
          amountPaid: 100,
          paymentMethod: "CASH",
        });
      },
      BadRequestError,
      "already fully paid"
    );
  });

  // 7. Test: Get Payment by ID
  await runTest("PaymentService.getPaymentById() retrieves full details including invoice & customer", async () => {
    const payment = await PaymentService.getPaymentById(createdPaymentId);

    if (!payment) {
      throw new Error("Could not retrieve created payment by ID.");
    }

    if (payment.id !== createdPaymentId) {
      throw new Error(`Expected payment ID ${createdPaymentId}, got: ${payment.id}`);
    }

    if (!payment.invoice) {
      throw new Error("Payment details missing invoice relation.");
    }

    if (!payment.invoice.salesOrder?.customer) {
      throw new Error("Payment details missing customer relation.");
    }

    if (payment.invoice.salesOrder.customer.id !== customerId) {
      throw new Error("Customer relation ID mismatch.");
    }
  });

  // 8. Test: Get Paginated Payments
  await runTest("PaymentService.getPaymentsPaged() filters and paginates correctly", async () => {
    const result = await PaymentService.getPaymentsPaged({
      page: 1,
      limit: 10,
      search: "TXN-BANK",
    });

    if (!result || !result.payments) {
      throw new Error("Paginated result is missing payments array.");
    }

    const found = result.payments.find((p: any) => p.id === createdPaymentId);
    if (!found) {
      throw new Error("Created bank transfer payment was not found in paginated search.");
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
  console.error("Fatal uncaught error during payment testing:", err);
  process.exit(1);
});
