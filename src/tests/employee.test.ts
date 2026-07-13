import { EmployeeService } from "../services/employee.service.ts";
import { db } from "../lib/db.ts";
import { NotFoundError, BadRequestError, ConflictError } from "../utils/errors.ts";
import { UserRole, EmployeeStatus, AttendanceStatus } from "@prisma/client";

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
  console.log("🛠️  STARTING EMPLOYEE MANAGEMENT SUITE TESTS");
  console.log("=================================================");

  let testEmpId = "";
  const uniqueEmail = `test-hr-employee-${Math.random().toString(36).substring(2, 9)}@example.com`;

  // 1. Create/Hire Employee
  await runTest("EmployeeService.createEmployee() hires a valid employee with user & profile", async () => {
    const employee = await EmployeeService.createEmployee({
      email: uniqueEmail,
      firstName: "Davy",
      lastName: "Jones",
      phone: "+1 (555) 888-9999",
      address: "100 Locker Deep Ocean Road",
      position: "Ocean Logistics Manager",
      salary: 75000,
      hireDate: new Date(),
      role: UserRole.EMPLOYEE,
      profilePhotoUrl: "https://example.com/photos/davy.jpg",
    });

    if (!employee) {
      throw new Error("Hired employee came back null/undefined.");
    }
    if (employee.position !== "Ocean Logistics Manager") {
      throw new Error(`Expected position 'Ocean Logistics Manager', got: ${employee.position}`);
    }
    if (employee.user.email !== uniqueEmail) {
      throw new Error(`Expected email '${uniqueEmail}', got: ${employee.user.email}`);
    }
    if (employee.user.profile.firstName !== "Davy") {
      throw new Error(`Expected firstName 'Davy', got: ${employee.user.profile.firstName}`);
    }
    if (employee.user.profile.profilePhotoUrl !== "https://example.com/photos/davy.jpg") {
      throw new Error(`Expected profilePhotoUrl, got: ${employee.user.profile.profilePhotoUrl}`);
    }
    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new Error("Employee status should default to ACTIVE.");
    }

    testEmpId = employee.id;
  });

  // 2. Prevent duplicate user/employee creation with same email
  await runTest("EmployeeService.createEmployee() blocks hiring with duplicate email", async () => {
    await assertThrows(
      async () => {
        await EmployeeService.createEmployee({
          email: uniqueEmail, // Duplicate
          firstName: "Duplicate",
          lastName: "Hiring",
          position: "Faker",
          salary: 40000,
          hireDate: new Date(),
          role: UserRole.EMPLOYEE,
        });
      },
      ConflictError,
      "already exists"
    );
  });

  // 3. Paginated query and searching
  await runTest("EmployeeService.getEmployeesPaged() retrieves results with search & pagination", async () => {
    const result = await EmployeeService.getEmployeesPaged({ page: 1, limit: 10, search: "Davy" });

    if (!result || !result.employees) {
      throw new Error("Paged result came back empty.");
    }
    const found = result.employees.some((e: any) => e.id === testEmpId);
    if (!found) {
      throw new Error("Could not find newly created employee using search.");
    }
  });

  // 4. Fetch specific employee with detailed history
  await runTest("EmployeeService.getEmployeeById() returns detailed employee record", async () => {
    const employee = await EmployeeService.getEmployeeById(testEmpId);

    if (!employee) {
      throw new Error(`Could not fetch employee with ID: ${testEmpId}`);
    }
    if (employee.user.profile.lastName !== "Jones") {
      throw new Error(`Expected lastName 'Jones', got: ${employee.user.profile.lastName}`);
    }
  });

  // 5. Update employee details and profile fields
  await runTest("EmployeeService.updateEmployee() updates details and profile properties", async () => {
    const updated = await EmployeeService.updateEmployee(testEmpId, {
      position: "Director of Marine Operations",
      salary: 95000,
      firstName: "Captain Davy",
    });

    if (updated.position !== "Director of Marine Operations") {
      throw new Error(`Expected updated position, got: ${updated.position}`);
    }
    if (updated.salary !== 95000) {
      throw new Error(`Expected updated salary 95000, got: ${updated.salary}`);
    }
    if (updated.user.profile.firstName !== "Captain Davy") {
      throw new Error(`Expected updated firstName 'Captain Davy', got: ${updated.user.profile.firstName}`);
    }
  });

  // 6. Log Daily Attendance
  await runTest("EmployeeService.logAttendance() upserts daily check-in records", async () => {
    const today = new Date();
    const attendance = await EmployeeService.logAttendance({
      employeeId: testEmpId,
      date: today,
      checkIn: new Date(),
      status: AttendanceStatus.PRESENT,
      notes: "Arrived exactly on time.",
    });

    if (!attendance) {
      throw new Error("Log attendance returned null.");
    }
    if (attendance.status !== AttendanceStatus.PRESENT) {
      throw new Error("Expected status PRESENT.");
    }
    if (attendance.notes !== "Arrived exactly on time.") {
      throw new Error("Expected notes to be persisted.");
    }

    // Retrieve attendance via paged API
    const records = await EmployeeService.getAttendancesPaged({ page: 1, limit: 10, employeeId: testEmpId });
    if (records.total === 0) {
      throw new Error("Attendance log search returned 0 results.");
    }
  });

  // 7. Issue Salary Payments
  await runTest("EmployeeService.issueSalaryPayment() records payroll disbursements", async () => {
    const payDate = new Date();
    const pay = await EmployeeService.issueSalaryPayment({
      employeeId: testEmpId,
      amount: 7916.67,
      payDate,
      paymentMethod: "BANK_TRANSFER",
      status: "PAID",
    });

    if (!pay) {
      throw new Error("Salary payment logged null.");
    }
    if (pay.amount !== 7916.67) {
      throw new Error(`Expected amount 7916.67, got: ${pay.amount}`);
    }

    // Retrieve salary records via paged API
    const salaries = await EmployeeService.getSalaryPaymentsPaged({ page: 1, limit: 10, employeeId: testEmpId });
    if (salaries.total === 0) {
      throw new Error("Salary disbursement query returned 0 results.");
    }
  });

  // 8. Delete cascades user, profile, and employee
  await runTest("EmployeeService.deleteEmployee() removes employee records entirely", async () => {
    const success = await EmployeeService.deleteEmployee(testEmpId);
    if (!success) {
      throw new Error("Delete operation returned false.");
    }

    // Verify lookup fails with NotFoundError
    await assertThrows(
      async () => {
        await EmployeeService.getEmployeeById(testEmpId);
      },
      NotFoundError
    );
  });

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
  console.error("Unhandle test crash:", err);
  process.exit(1);
});
