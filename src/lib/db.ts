import { PrismaClient, UserRole, EmployeeStatus, AttendanceStatus, StockMovementType, SalesOrderStatus, InvoiceStatus, PurchaseOrderStatus, AccountType, JournalStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "./supabase.ts";

// Initialize Prisma Client
export let prisma: PrismaClient | null = null;
export let isPrismaActive = false;

try {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== "postgresql://johndoe:mypassword@localhost:5432/mydb?schema=public") {
    prisma = new PrismaClient();
    isPrismaActive = true;
    console.log("🔌 Prisma Client Initialized. Running in PostgreSQL Mode.");
  } else {
    console.log("ℹ️ No DATABASE_URL found or default used. Running in Resilient In-Memory Fallback Mode.");
  }
} catch (error) {
  console.warn("⚠️ Failed to initialize Prisma Client, falling back to In-Memory mode:", error);
  isPrismaActive = false;
}

// Helper to check if database is actually reachable
export async function checkDatabaseConnection(): Promise<boolean> {
  if (!isPrismaActive || !prisma) return false;
  try {
    // Quick probe query
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.warn("⚠️ PostgreSQL Database is unreachable. Falling back to In-Memory Mode.");
    return false;
  }
}

// Auto-seeding function for PostgreSQL if empty
export async function seedDatabaseIfEmpty(): Promise<void> {
  if (!isPrismaActive || !prisma) {
    console.log("ℹ️ Database connection is inactive. Auto-seeding skipped.");
    return;
  }

  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log("📊 Database already has users. Seeding not required.");
      return;
    }

    console.log("🌱 Database is empty. Commencing automatic seed to Supabase PostgreSQL...");

    // 0. Seed Roles, Permissions, and RolePermissions
    console.log("🔐 Seeding database roles and permissions...");
    const roleAdmin = await prisma.role.upsert({
      where: { name: "ADMIN" },
      update: {},
      create: { name: "ADMIN", description: "Full enterprise administrator with unrestricted access" }
    });
    const roleManager = await prisma.role.upsert({
      where: { name: "MANAGER" },
      update: {},
      create: { name: "MANAGER", description: "Logistic Manager for SCM, inventory, and purchasing" }
    });
    const roleAccountant = await prisma.role.upsert({
      where: { name: "ACCOUNTANT" },
      update: {},
      create: { name: "ACCOUNTANT", description: "Treasury Accountant for bookkeeping, finance, and invoicing" }
    });
    const roleEmployee = await prisma.role.upsert({
      where: { name: "EMPLOYEE" },
      update: {},
      create: { name: "EMPLOYEE", description: "Standard Employee with personal profile and logs access" }
    });

    const roleMap = {
      ADMIN: roleAdmin,
      MANAGER: roleManager,
      ACCOUNTANT: roleAccountant,
      EMPLOYEE: roleEmployee
    };

    const permissionMap: Record<string, any> = {};
    const permissionsData = [
      { name: "products.read", description: "View products" },
      { name: "products.write", description: "Create, update, delete products" },
      { name: "inventory.read", description: "View inventory" },
      { name: "inventory.update", description: "Manage inventory" },
      { name: "sales.read", description: "View sales" },
      { name: "sales.write", description: "Manage sales" },
      { name: "crm.read", description: "View customers" },
      { name: "crm.write", description: "Manage customers" },
      { name: "purchasing.read", description: "View purchasing" },
      { name: "purchasing.write", description: "Manage purchasing" },
      { name: "suppliers.read", description: "View suppliers" },
      { name: "suppliers.write", description: "Manage suppliers" },
      { name: "hr.read", description: "View HR and employees" },
      { name: "hr.write", description: "Manage HR and employees" },
      { name: "hr.self", description: "View own HR information" },
      { name: "payroll.read", description: "View payroll logs" },
      { name: "payroll.write", description: "Issue and manage payroll" },
      { name: "payroll.self", description: "View own payroll payments" },
      { name: "finance.read", description: "View finance, general ledger, accounts" },
      { name: "finance.write", description: "Manage journals, accounts, balances" },
      { name: "logs.read", description: "View activity logs" },
      { name: "system.admin", description: "Unrestricted system configuration access" }
    ];

    for (const perm of permissionsData) {
      const dbPerm = await prisma.permission.upsert({
        where: { name: perm.name },
        update: {},
        create: { name: perm.name, description: perm.description }
      });
      permissionMap[perm.name] = dbPerm;
    }

    const rolePermissionsMap: Record<string, string[]> = {
      ADMIN: permissionsData.map(p => p.name),
      MANAGER: [
        "products.read",
        "products.write",
        "inventory.read",
        "inventory.update",
        "sales.read",
        "purchasing.read",
        "purchasing.write",
        "suppliers.read",
        "suppliers.write"
      ],
      ACCOUNTANT: [
        "sales.read",
        "sales.write",
        "crm.read",
        "purchasing.read",
        "suppliers.read",
        "payroll.read",
        "payroll.write",
        "finance.read",
        "finance.write"
      ],
      EMPLOYEE: [
        "hr.self",
        "payroll.self"
      ]
    };

    for (const [roleName, permissions] of Object.entries(rolePermissionsMap)) {
      const role = roleMap[roleName as keyof typeof roleMap];
      for (const permName of permissions) {
        const perm = permissionMap[permName];
        if (role && perm) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: perm.id
              }
            },
            update: {},
            create: {
              roleId: role.id,
              permissionId: perm.id
            }
          });
        }
      }
    }

    // Register default users in Supabase Auth if active
    let adminAuthId = "u-admin";
    let managerAuthId = "u-manager";
    let employeeAuthId = "u-employee";
    let accountantAuthId = "u-accountant";

    if (supabaseAdmin) {
      try {
        console.log("🔑 Syncing seed users with Supabase Auth...");
        const usersToSync = [
          { id: "u-admin", email: "admin@erp.com", password: "password123", role: "ADMIN", first: "Sarah", last: "Admin" },
          { id: "u-manager", email: "manager@erp.com", password: "password123", role: "MANAGER", first: "Marcus", last: "Manager" },
          { id: "u-employee", email: "employee@erp.com", password: "password123", role: "EMPLOYEE", first: "Elena", last: "Employee" },
          { id: "u-accountant", email: "accountant@erp.com", password: "password123", role: "ACCOUNTANT", first: "Franklin", last: "Ledger" }
        ];

        const { data: suList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
        const existingEmails = new Set(suList?.users?.map(u => u.email?.toLowerCase()) || []);

        for (const u of usersToSync) {
          if (!existingEmails.has(u.email.toLowerCase())) {
            const { data: suUser, error: suErr } = await supabaseAdmin.auth.admin.createUser({
              email: u.email,
              password: u.password,
              email_confirm: true,
              user_metadata: {
                role: u.role,
                firstName: u.first,
                lastName: u.last
              }
            });

            if (suErr) {
              console.warn(`⚠️ Could not create user ${u.email} in Supabase Auth:`, suErr.message);
            } else if (suUser?.user) {
              console.log(`✅ Created Supabase Auth user: ${u.email} (${suUser.user.id})`);
              if (u.id === "u-admin") adminAuthId = suUser.user.id;
              if (u.id === "u-manager") managerAuthId = suUser.user.id;
              if (u.id === "u-employee") employeeAuthId = suUser.user.id;
              if (u.id === "u-accountant") accountantAuthId = suUser.user.id;
            }
          } else {
            const foundUser = suList?.users?.find(su => su.email?.toLowerCase() === u.email.toLowerCase());
            if (foundUser) {
              if (u.id === "u-admin") adminAuthId = foundUser.id;
              if (u.id === "u-manager") managerAuthId = foundUser.id;
              if (u.id === "u-employee") employeeAuthId = foundUser.id;
              if (u.id === "u-accountant") accountantAuthId = foundUser.id;
            }
          }
        }
      } catch (authSyncErr) {
        console.warn("⚠️ Failed to sync seed users to Supabase Auth:", authSyncErr);
      }
    }

    // 1. Seed Users & Profiles
    await prisma.user.create({
      data: {
        id: adminAuthId,
        email: "admin@erp.com",
        passwordHash: HASHED_PASS,
        role: UserRole.ADMIN,
        roleId: roleAdmin.id,
        isActive: true,
        mustChangePassword: false,
        profile: {
          create: {
            id: "p-admin",
            firstName: "Sarah",
            lastName: "Admin",
            phone: "+1 (555) 0100",
            address: "100 Executive Way, Suite A",
          }
        }
      }
    });

    await prisma.user.create({
      data: {
        id: managerAuthId,
        email: "manager@erp.com",
        passwordHash: HASHED_PASS,
        role: UserRole.MANAGER,
        roleId: roleManager.id,
        isActive: true,
        mustChangePassword: false,
        profile: {
          create: {
            id: "p-manager",
            firstName: "Marcus",
            lastName: "Manager",
            phone: "+1 (555) 0101",
            address: "102 Warehouse Rd",
          }
        }
      }
    });

    await prisma.user.create({
      data: {
        id: employeeAuthId,
        email: "employee@erp.com",
        passwordHash: HASHED_PASS,
        role: UserRole.EMPLOYEE,
        roleId: roleEmployee.id,
        isActive: true,
        mustChangePassword: false,
        profile: {
          create: {
            id: "p-employee",
            firstName: "Elena",
            lastName: "Employee",
            phone: "+1 (555) 0102",
            address: "404 Industrial Blvd",
          }
        }
      }
    });

    await prisma.user.create({
      data: {
        id: accountantAuthId,
        email: "accountant@erp.com",
        passwordHash: HASHED_PASS,
        role: UserRole.ACCOUNTANT,
        roleId: roleAccountant.id,
        isActive: true,
        mustChangePassword: false,
        profile: {
          create: {
            id: "p-accountant",
            firstName: "Franklin",
            lastName: "Ledger",
            phone: "+1 (555) 0103",
            address: "500 Treasury Ave",
          }
        }
      }
    });

    // 2. Seed Departments & Employees
    await prisma.department.create({
      data: {
        id: "d-exc",
        name: "Executive Suite",
        code: "EXC",
        description: "Strategic administration and policy-making",
      }
    });

    await prisma.department.create({
      data: {
        id: "d-scm",
        name: "Supply Chain & Warehouse",
        code: "SCM",
        description: "Inventory routing and logistical control",
      }
    });

    await prisma.department.create({
      data: {
        id: "d-fin",
        name: "Finance & Accounts",
        code: "FIN",
        description: "Corporate books, ledger journaling, and payroll",
      }
    });

    await prisma.department.create({
      data: {
        id: "d-sls",
        name: "Sales & Distribution",
        code: "SLS",
        description: "Client relationship and customer sales orders",
      }
    });

    // Create Employees
    await prisma.employee.create({
      data: {
        id: "e-admin",
        userId: adminAuthId,
        departmentId: "d-exc",
        position: "Chief Executive Officer",
        salary: 155000.00,
        hireDate: new Date("2024-01-15"),
        status: EmployeeStatus.ACTIVE,
      }
    });

    await prisma.employee.create({
      data: {
        id: "e-manager",
        userId: managerAuthId,
        departmentId: "d-scm",
        position: "SCM Director",
        salary: 98000.00,
        hireDate: new Date("2024-06-01"),
        status: EmployeeStatus.ACTIVE,
      }
    });

    await prisma.employee.create({
      data: {
        id: "e-employee",
        userId: employeeAuthId,
        departmentId: "d-scm",
        position: "Inventory Associate",
        salary: 48000.00,
        hireDate: new Date("2025-02-10"),
        status: EmployeeStatus.ACTIVE,
      }
    });

    await prisma.employee.create({
      data: {
        id: "e-accountant",
        userId: accountantAuthId,
        departmentId: "d-fin",
        position: "Senior Certified Accountant",
        salary: 85000.00,
        hireDate: new Date("2024-09-18"),
        status: EmployeeStatus.ACTIVE,
      }
    });

    // Update Departments with Managers
    await prisma.department.update({
      where: { id: "d-exc" },
      data: { managerId: "e-admin" }
    });

    await prisma.department.update({
      where: { id: "d-scm" },
      data: { managerId: "e-manager" }
    });

    // 3. Seed Inventory Categories, Products & Warehouses
    await prisma.category.create({
      data: {
        id: "c-raw",
        name: "Raw Materials",
        code: "RAW",
        description: "Primary inputs for industrial manufacturing",
      }
    });

    await prisma.category.create({
      data: {
        id: "c-fin",
        name: "Finished Goods",
        code: "FINISHED",
        description: "Completed products ready for client delivery",
      }
    });

    // Create Products
    await prisma.product.create({
      data: {
        id: "pr-steel",
        name: "Structural Steel Girders",
        sku: "RAW-STL-001",
        description: "Load-bearing 1-beam girders, 10m length",
        categoryId: "c-raw",
        price: 450.00,
        cost: 280.00,
        unitOfMeasure: "PCS",
        isDeleted: false,
      }
    });

    await prisma.product.create({
      data: {
        id: "pr-copper",
        name: "High-Conductivity Copper Rods",
        sku: "RAW-COP-002",
        description: "Industrial wire feedstock rods, 20mm dia",
        categoryId: "c-raw",
        price: 12.50,
        cost: 7.20,
        unitOfMeasure: "KG",
        isDeleted: false,
      }
    });

    await prisma.product.create({
      data: {
        id: "pr-motor",
        name: "Three-Phase Electric Motor 15HP",
        sku: "FIN-MTR-100",
        description: "460V heavy-duty induction motor",
        categoryId: "c-fin",
        price: 1450.00,
        cost: 890.00,
        unitOfMeasure: "PCS",
        isDeleted: false,
      }
    });

    await prisma.product.create({
      data: {
        id: "pr-gear",
        name: "Precision Gearbox Ratio 10:1",
        sku: "FIN-GRB-101",
        description: "Low-backlash high-torque industrial gearbox",
        categoryId: "c-fin",
        price: 850.00,
        cost: 510.00,
        unitOfMeasure: "PCS",
        isDeleted: false,
      }
    });

    // Create Warehouses
    await prisma.warehouse.create({
      data: {
        id: "w-main",
        name: "Central Manufacturing Warehouse",
        code: "WH-MAIN",
        location: "404 Heavy Industrial Zone, Detroit, MI",
      }
    });

    await prisma.warehouse.create({
      data: {
        id: "w-east",
        name: "East Coast Logistics Hub",
        code: "WH-EAST",
        location: "10 Commerce Blvd, Newark, NJ",
      }
    });

    // Create StockLevels
    await prisma.stockLevel.create({ data: { id: "sl-1", productId: "pr-steel", warehouseId: "w-main", quantity: 150.00, reorderPoint: 40.00, minStock: 20.00, maxStock: 500.00 } });
    await prisma.stockLevel.create({ data: { id: "sl-2", productId: "pr-copper", warehouseId: "w-main", quantity: 2400.00, reorderPoint: 500.00, minStock: 200.00, maxStock: 5000.00 } });
    await prisma.stockLevel.create({ data: { id: "sl-3", productId: "pr-motor", warehouseId: "w-main", quantity: 35.00, reorderPoint: 10.00, minStock: 5.00, maxStock: 100.00 } });
    await prisma.stockLevel.create({ data: { id: "sl-4", productId: "pr-gear", warehouseId: "w-main", quantity: 18.00, reorderPoint: 5.00, minStock: 2.00, maxStock: 50.00 } });
    await prisma.stockLevel.create({ data: { id: "sl-5", productId: "pr-motor", warehouseId: "w-east", quantity: 12.00, reorderPoint: 5.00, minStock: 2.00, maxStock: 50.00 } });

    // Create StockMovements
    await prisma.stockMovement.create({ data: { id: "sm-1", productId: "pr-steel", warehouseId: "w-main", quantityChange: 150.00, type: StockMovementType.INCOMING, referenceNumber: "PO-2026-0001", description: "Initial setup shipment receipt", createdById: managerAuthId } });
    await prisma.stockMovement.create({ data: { id: "sm-2", productId: "pr-motor", warehouseId: "w-main", quantityChange: 35.00, type: StockMovementType.INCOMING, referenceNumber: "PO-2026-0002", description: "Assembled motors check-in", createdById: managerAuthId } });

    // 4. Seed Customers & Sales
    await prisma.customer.create({
      data: {
        id: "cust-acme",
        companyName: "Acme Industrial Corp",
        contactName: "Alice Walker",
        email: "procurement@acmeind.com",
        phone: "+1 (555) 0800",
        address: "888 Enterprise Plaza, Chicago, IL",
        isDeleted: false,
      }
    });

    await prisma.customer.create({
      data: {
        id: "cust-glob",
        companyName: "Global Motors Ltd",
        contactName: "Robert Ford",
        email: "supply@globalmotors.co.uk",
        phone: "+44 20 7946 0912",
        address: "40 Motorway Circle, Birmingham, UK",
        isDeleted: false,
      }
    });

    // Sales Order & items
    await prisma.salesOrder.create({
      data: {
        id: "so-1",
        orderNumber: "SO-2026-0001",
        customerId: "cust-acme",
        status: SalesOrderStatus.CONFIRMED,
        totalAmount: 4350.00,
        createdById: employeeAuthId,
        items: {
          create: {
            id: "soi-1",
            productId: "pr-motor",
            quantity: 3.00,
            unitPrice: 1450.00,
            totalPrice: 4350.00,
          }
        }
      }
    });

    // Invoice
    await prisma.invoice.create({
      data: {
        id: "inv-1",
        invoiceNumber: "INV-2026-0001",
        salesOrderId: "so-1",
        subtotal: 4350.00,
        taxRate: 0.00,
        taxAmount: 0.00,
        discountRate: 0.00,
        discountAmount: 0.00,
        amount: 4350.00,
        status: InvoiceStatus.UNPAID,
        dueDate: new Date("2026-08-01"),
      }
    });

    // 5. Seed Suppliers & Purchasing
    await prisma.supplier.create({
      data: {
        id: "sup-apex",
        companyName: "Apex Metal Casting Co.",
        contactName: "Thomas Sterling",
        email: "sales@apexcasting.com",
        phone: "+1 (555) 0900",
        address: "1 Steel Foundry Rd, Pittsburgh, PA",
        isDeleted: false,
      }
    });

    await prisma.supplier.create({
      data: {
        id: "sup-copper",
        companyName: "Copper Refinery Inc",
        contactName: "Lina Copperfield",
        email: "orders@copperrefinery.com",
        phone: "+1 (555) 0901",
        address: "50 Ore Extraction Way, Salt Lake City, UT",
        isDeleted: false,
      }
    });

    // Supplier Products
    await prisma.supplierProduct.create({ data: { id: "sp-1", supplierId: "sup-apex", productId: "pr-steel", price: 280.00, leadTimeDays: 5 } });
    await prisma.supplierProduct.create({ data: { id: "sp-2", supplierId: "sup-copper", productId: "pr-copper", price: 7.20, leadTimeDays: 3 } });

    // Purchase Order
    await prisma.purchaseOrder.create({
      data: {
        id: "po-1",
        poNumber: "PO-2026-0001",
        supplierId: "sup-apex",
        status: PurchaseOrderStatus.RECEIVED,
        totalAmount: 42000.00,
        createdById: managerAuthId,
        items: {
          create: {
            id: "poi-1",
            productId: "pr-steel",
            quantity: 150.00,
            unitCost: 280.00,
            totalPrice: 42000.00,
          }
        }
      }
    });

    // 6. Seed Accounts & Finance
    await prisma.account.create({ data: { id: "acc-cash", name: "Main Operating Cash Account", code: "1010", type: AccountType.ASSET, balance: 500000.00 } });
    await prisma.account.create({ data: { id: "acc-ar", name: "Accounts Receivable (A/R)", code: "1200", type: AccountType.ASSET, balance: 4350.00 } });
    await prisma.account.create({ data: { id: "acc-inv", name: "Inventory Raw Assets", code: "1300", type: AccountType.ASSET, balance: 75150.00 } });
    await prisma.account.create({ data: { id: "acc-ap", name: "Accounts Payable (A/P)", code: "2000", type: AccountType.LIABILITY, balance: 42000.00 } });
    await prisma.account.create({ data: { id: "acc-equity", name: "Retained Earnings", code: "3000", type: AccountType.EQUITY, balance: 537500.00 } });
    await prisma.account.create({ data: { id: "acc-sales", name: "Product Sales Revenues", code: "4000", type: AccountType.REVENUE, balance: 0.00 } });
    await prisma.account.create({ data: { id: "acc-cogs", name: "Cost of Goods Sold (COGS)", code: "5000", type: AccountType.EXPENSE, balance: 0.00 } });

    // Journal Entry
    await prisma.journalEntry.create({
      data: {
        id: "je-1",
        entryNumber: "JE-2026-0001",
        description: "Log sales invoice INV-2026-0001",
        status: JournalStatus.POSTED,
        createdById: accountantAuthId,
        lines: {
          createMany: {
            data: [
              { id: "jl-1", accountId: "acc-ar", debit: 4350.00, credit: 0.00, description: "Debit customer accounts receivable" },
              { id: "jl-2", accountId: "acc-sales", debit: 0.00, credit: 4350.00, description: "Credit sales revenues" }
            ]
          }
        }
      }
    });

    // 7. Seed Notifications
    await prisma.notification.create({
      data: {
        id: "notif-1",
        userId: adminAuthId,
        role: UserRole.ADMIN,
        type: "LOW_STOCK",
        title: "Low Stock Alert: Structural Steel Girders",
        message: "Product 'Structural Steel Girders' (RAW-STL-001) has dropped below reorder point at 'Central Manufacturing Warehouse'. Current: 150, Reorder Point: 40.00",
        referenceId: "pr-steel",
        isRead: false,
      }
    });

    await prisma.notification.create({
      data: {
        id: "notif-2",
        role: UserRole.MANAGER,
        type: "PURCHASE_APPROVAL",
        title: "Purchase Order Pending Approval",
        message: "Purchase Order PO-2026-0001 requires authorization. Total value: $15,400.00",
        referenceId: "po-1",
        isRead: false,
      }
    });

    console.log("🌱 Database seeding completed successfully!");
  } catch (err) {
    console.error("❌ Error seeding database:", err);
    throw err;
  }
}

// ==========================================
// IN-MEMORY DATABASE STATE (SEED DATA)
// ==========================================

const SALT_ROUNDS = 10;
const HASHED_PASS = bcrypt.hashSync("password123", SALT_ROUNDS);

export let mockUsers = [
  { id: "u-admin", email: "admin@erp.com", passwordHash: HASHED_PASS, role: UserRole.ADMIN, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "u-manager", email: "manager@erp.com", passwordHash: HASHED_PASS, role: UserRole.MANAGER, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "u-employee", email: "employee@erp.com", passwordHash: HASHED_PASS, role: UserRole.EMPLOYEE, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "u-accountant", email: "accountant@erp.com", passwordHash: HASHED_PASS, role: UserRole.ACCOUNTANT, isActive: true, createdAt: new Date(), updatedAt: new Date() },
];

export let mockRefreshTokens = new Set<string>();

export let mockProfiles: any[] = [
  { id: "p-admin", userId: "u-admin", firstName: "Sarah", lastName: "Admin", phone: "+1 (555) 0100", address: "100 Executive Way, Suite A", createdAt: new Date(), updatedAt: new Date() },
  { id: "p-manager", userId: "u-manager", firstName: "Marcus", lastName: "Manager", phone: "+1 (555) 0101", address: "102 Warehouse Rd", createdAt: new Date(), updatedAt: new Date() },
  { id: "p-employee", userId: "u-employee", firstName: "Elena", lastName: "Employee", phone: "+1 (555) 0102", address: "404 Industrial Blvd", createdAt: new Date(), updatedAt: new Date() },
  { id: "p-accountant", userId: "u-accountant", firstName: "Franklin", lastName: "Ledger", phone: "+1 (555) 0103", address: "500 Treasury Ave", createdAt: new Date(), updatedAt: new Date() },
];

export let mockDepartments = [
  { id: "d-exc", name: "Executive Suite", code: "EXC", description: "Strategic administration and policy-making", managerId: "e-admin", createdAt: new Date(), updatedAt: new Date() },
  { id: "d-scm", name: "Supply Chain & Warehouse", code: "SCM", description: "Inventory routing and logistical control", managerId: "e-manager", createdAt: new Date(), updatedAt: new Date() },
  { id: "d-fin", name: "Finance & Accounts", code: "FIN", description: "Corporate books, ledger journaling, and payroll", managerId: null, createdAt: new Date(), updatedAt: new Date() },
  { id: "d-sls", name: "Sales & Distribution", code: "SLS", description: "Client relationship and customer sales orders", managerId: null, createdAt: new Date(), updatedAt: new Date() },
];

export let mockEmployees: any[] = [
  { id: "e-admin", userId: "u-admin", departmentId: "d-exc", position: "Chief Executive Officer", salary: 155000.00, hireDate: new Date("2024-01-15"), status: EmployeeStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date() },
  { id: "e-manager", userId: "u-manager", departmentId: "d-scm", position: "SCM Director", salary: 98000.00, hireDate: new Date("2024-06-01"), status: EmployeeStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date() },
  { id: "e-employee", userId: "u-employee", departmentId: "d-scm", position: "Inventory Associate", salary: 48000.00, hireDate: new Date("2025-02-10"), status: EmployeeStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date() },
  { id: "e-accountant", userId: "u-accountant", departmentId: "d-fin", position: "Senior Certified Accountant", salary: 85000.00, hireDate: new Date("2024-09-18"), status: EmployeeStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date() },
];

export let mockCategories = [
  { id: "c-raw", name: "Raw Materials", code: "RAW", description: "Primary inputs for industrial manufacturing", createdAt: new Date(), updatedAt: new Date() },
  { id: "c-fin", name: "Finished Goods", code: "FINISHED", description: "Completed products ready for client delivery", createdAt: new Date(), updatedAt: new Date() },
];

export let mockProducts = [
  { id: "pr-steel", name: "Structural Steel Girders", sku: "RAW-STL-001", description: "Load-bearing 1-beam girders, 10m length", categoryId: "c-raw", price: 450.00, cost: 280.00, unitOfMeasure: "PCS", isDeleted: false, createdAt: new Date(), updatedAt: new Date() },
  { id: "pr-copper", name: "High-Conductivity Copper Rods", sku: "RAW-COP-002", description: "Industrial wire feedstock rods, 20mm dia", categoryId: "c-raw", price: 12.50, cost: 7.20, unitOfMeasure: "KG", isDeleted: false, createdAt: new Date(), updatedAt: new Date() },
  { id: "pr-motor", name: "Three-Phase Electric Motor 15HP", sku: "FIN-MTR-100", description: "460V heavy-duty induction motor", categoryId: "c-fin", price: 1450.00, cost: 890.00, unitOfMeasure: "PCS", isDeleted: false, createdAt: new Date(), updatedAt: new Date() },
  { id: "pr-gear", name: "Precision Gearbox Ratio 10:1", sku: "FIN-GRB-101", description: "Low-backlash high-torque industrial gearbox", categoryId: "c-fin", price: 850.00, cost: 510.00, unitOfMeasure: "PCS", isDeleted: false, createdAt: new Date(), updatedAt: new Date() },
];

export let mockWarehouses = [
  { id: "w-main", name: "Central Manufacturing Warehouse", code: "WH-MAIN", location: "404 Heavy Industrial Zone, Detroit, MI", createdAt: new Date(), updatedAt: new Date() },
  { id: "w-east", name: "East Coast Logistics Hub", code: "WH-EAST", location: "10 Commerce Blvd, Newark, NJ", createdAt: new Date(), updatedAt: new Date() },
];

export let mockStockLevels = [
  { id: "sl-1", productId: "pr-steel", warehouseId: "w-main", quantity: 150.00, reorderPoint: 40.00, minStock: 20.00, maxStock: 500.00, updatedAt: new Date() },
  { id: "sl-2", productId: "pr-copper", warehouseId: "w-main", quantity: 2400.00, reorderPoint: 500.00, minStock: 200.00, maxStock: 5000.00, updatedAt: new Date() },
  { id: "sl-3", productId: "pr-motor", warehouseId: "w-main", quantity: 35.00, reorderPoint: 10.00, minStock: 5.00, maxStock: 100.00, updatedAt: new Date() },
  { id: "sl-4", productId: "pr-gear", warehouseId: "w-main", quantity: 18.00, reorderPoint: 5.00, minStock: 2.00, maxStock: 50.00, updatedAt: new Date() },
  { id: "sl-5", productId: "pr-motor", warehouseId: "w-east", quantity: 12.00, reorderPoint: 5.00, minStock: 2.00, maxStock: 50.00, updatedAt: new Date() },
];

export let mockStockMovements: any[] = [
  { id: "sm-1", productId: "pr-steel", warehouseId: "w-main", quantityChange: 150.00, type: StockMovementType.INCOMING, referenceNumber: "PO-2026-0001", description: "Initial setup shipment receipt", createdById: "u-manager", createdAt: new Date() },
  { id: "sm-2", productId: "pr-motor", warehouseId: "w-main", quantityChange: 35.00, type: StockMovementType.INCOMING, referenceNumber: "PO-2026-0002", description: "Assembled motors check-in", createdById: "u-manager", createdAt: new Date() },
];

export let mockCustomers = [
  { id: "cust-acme", companyName: "Acme Industrial Corp", contactName: "Alice Walker", email: "procurement@acmeind.com", phone: "+1 (555) 0800", address: "888 Enterprise Plaza, Chicago, IL", isDeleted: false, createdAt: new Date(), updatedAt: new Date() },
  { id: "cust-glob", companyName: "Global Motors Ltd", contactName: "Robert Ford", email: "supply@globalmotors.co.uk", phone: "+44 20 7946 0912", address: "40 Motorway Circle, Birmingham, UK", isDeleted: false, createdAt: new Date(), updatedAt: new Date() },
];

export let mockSalesOrders = [
  { id: "so-1", orderNumber: "SO-2026-0001", customerId: "cust-acme", status: SalesOrderStatus.CONFIRMED, totalAmount: 4350.00, createdById: "u-employee", createdAt: new Date(), updatedAt: new Date() },
];

export let mockSalesOrderItems = [
  { id: "soi-1", salesOrderId: "so-1", productId: "pr-motor", quantity: 3.00, unitPrice: 1450.00, totalPrice: 4350.00 },
];

export let mockInvoices: any[] = [
  { id: "inv-1", invoiceNumber: "INV-2026-0001", salesOrderId: "so-1", subtotal: 4350.00, taxRate: 0.00, taxAmount: 0.00, discountRate: 0.00, discountAmount: 0.00, amount: 4350.00, status: InvoiceStatus.UNPAID as InvoiceStatus, dueDate: new Date("2026-08-01"), createdAt: new Date(), updatedAt: new Date() },
];

export let mockPayments = [] as any[];
export let mockAttendances = [] as any[];
export let mockSalaryPayments = [] as any[];

export let mockSuppliers = [
  { id: "sup-apex", companyName: "Apex Metal Casting Co.", contactName: "Thomas Sterling", email: "sales@apexcasting.com", phone: "+1 (555) 0900", address: "1 Steel Foundry Rd, Pittsburgh, PA", isDeleted: false, createdAt: new Date(), updatedAt: new Date() },
  { id: "sup-copper", companyName: "Copper Refinery Inc", contactName: "Lina Copperfield", email: "orders@copperrefinery.com", phone: "+1 (555) 0901", address: "50 Ore Extraction Way, Salt Lake City, UT", isDeleted: false, createdAt: new Date(), updatedAt: new Date() },
];

export let mockSupplierProducts = [
  { id: "sp-1", supplierId: "sup-apex", productId: "pr-steel", price: 280.00, leadTimeDays: 5, createdAt: new Date(), updatedAt: new Date() },
  { id: "sp-2", supplierId: "sup-copper", productId: "pr-copper", price: 7.20, leadTimeDays: 3, createdAt: new Date(), updatedAt: new Date() },
];

export let mockPurchaseOrders = [
  { id: "po-1", poNumber: "PO-2026-0001", supplierId: "sup-apex", status: PurchaseOrderStatus.RECEIVED as PurchaseOrderStatus, totalAmount: 42000.00, createdById: "u-manager", createdAt: new Date(), updatedAt: new Date() },
];

export let mockPurchaseOrderItems = [
  { id: "poi-1", purchaseOrderId: "po-1", productId: "pr-steel", quantity: 150.00, unitCost: 280.00, totalPrice: 42000.00 },
];

export let mockAccounts = [
  { id: "acc-cash", name: "Main Operating Cash Account", code: "1010", type: AccountType.ASSET, balance: 500000.00, createdAt: new Date(), updatedAt: new Date() },
  { id: "acc-ar", name: "Accounts Receivable (A/R)", code: "1200", type: AccountType.ASSET, balance: 4350.00, createdAt: new Date(), updatedAt: new Date() },
  { id: "acc-inv", name: "Inventory Raw Assets", code: "1300", type: AccountType.ASSET, balance: 75150.00, createdAt: new Date(), updatedAt: new Date() },
  { id: "acc-ap", name: "Accounts Payable (A/P)", code: "2000", type: AccountType.LIABILITY, balance: 42000.00, createdAt: new Date(), updatedAt: new Date() },
  { id: "acc-equity", name: "Retained Earnings", code: "3000", type: AccountType.EQUITY, balance: 537500.00, createdAt: new Date(), updatedAt: new Date() },
  { id: "acc-sales", name: "Product Sales Revenues", code: "4000", type: AccountType.REVENUE, balance: 0.00, createdAt: new Date(), updatedAt: new Date() },
  { id: "acc-cogs", name: "Cost of Goods Sold (COGS)", code: "5000", type: AccountType.EXPENSE, balance: 0.00, createdAt: new Date(), updatedAt: new Date() },
];

export let mockJournalEntries = [
  { id: "je-1", entryNumber: "JE-2026-0001", date: new Date(), description: "Log sales invoice INV-2026-0001", status: JournalStatus.POSTED, createdById: "u-accountant", createdAt: new Date(), updatedAt: new Date() },
];

export let mockJournalLines = [
  { id: "jl-1", journalEntryId: "je-1", accountId: "acc-ar", debit: 4350.00, credit: 0.00, description: "Debit customer accounts receivable" },
  { id: "jl-2", journalEntryId: "je-1", accountId: "acc-sales", debit: 0.00, credit: 4350.00, description: "Credit sales revenues" },
];

export let mockNotifications: any[] = [
  {
    id: "notif-1",
    userId: "u-admin",
    role: "ADMIN",
    type: "LOW_STOCK",
    title: "Low Stock Alert: Structural Steel Girders",
    message: "Product 'Structural Steel Girders' (RAW-STL-001) has dropped below reorder point at 'Central Manufacturing Warehouse'. Current: 150, Reorder Point: 40.00 (Example Mock Notification)",
    referenceId: "pr-steel",
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "notif-2",
    userId: null,
    role: "MANAGER",
    type: "PURCHASE_APPROVAL",
    title: "Purchase Order Pending Approval",
    message: "Purchase Order PO-2026-0001 requires authorization. Total value: $15,400.00",
    referenceId: "po-1",
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export let mockUploadedFiles: any[] = [];
export let mockActivityLogs: any[] = [];

export let mockTasks: any[] = [
  { id: "task-1", title: "Complete safety compliance module v2026", desc: "Corporate EHS review", completed: false },
  { id: "task-2", title: "Verify daily department logs", desc: "Log shift metrics", completed: true },
  { id: "task-3", title: "Review updated workplace guidelines", desc: "Acknowledge in HR portal", completed: false }
];

export let mockLeaveRequests: any[] = [
  { id: "leave-1", type: "ANNUAL", start: "2026-08-15", end: "2026-08-20", reason: "Family Summer Vacation", status: "APPROVED" }
];


// ==========================================
// UNIFIED DATA SERVICE (DUAL MODE WRAPPER)
// ==========================================

export const db = {
  // Check Mode
  isPrisma() {
    return isPrismaActive;
  },

  // 1. AUTH DOMAIN
  async findUserByEmail(email: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.user.findUnique({
          where: { email },
          include: {
            profile: true,
            roleRef: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          },
        });
      } catch (err) {
        console.error("Prisma error in findUserByEmail, using mock fallback:", err);
      }
    }

    // Fallback
    const user = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return null;
    const profile = mockProfiles.find((p) => p.userId === user.id);
    return { ...user, profile };
  },

  async findUserById(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.user.findUnique({
          where: { id },
          include: {
            profile: true,
            roleRef: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          },
        });
      } catch (err) {
        console.error("Prisma error in findUserById, using mock fallback:", err);
      }
    }

    // Fallback
    const user = mockUsers.find((u) => u.id === id);
    if (!user) return null;
    const profile = mockProfiles.find((p) => p.userId === user.id);
    return { ...user, profile };
  },

  async createUser(data: { email: string; passwordHash: string; role: UserRole; firstName: string; lastName: string }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        const dbRole = await prisma.role.findUnique({ where: { name: data.role } });
        return await prisma.user.create({
          data: {
            email: data.email,
            passwordHash: data.passwordHash,
            role: data.role,
            roleId: dbRole?.id || null,
            profile: {
              create: {
                firstName: data.firstName,
                lastName: data.lastName,
              },
            },
          },
          include: { profile: true },
        });
      } catch (err) {
        console.error("Prisma error in createUser, using mock fallback:", err);
      }
    }

    // Fallback
    const id = "u-" + Math.random().toString(36).substring(2, 9);
    const newUser = { id, email: data.email, passwordHash: data.passwordHash, role: data.role, isActive: true, createdAt: new Date(), updatedAt: new Date() };
    const newProfile = { id: "p-" + id, userId: id, firstName: data.firstName, lastName: data.lastName, phone: "", address: "", createdAt: new Date(), updatedAt: new Date() };

    mockUsers.push(newUser);
    mockProfiles.push(newProfile);
    return { ...newUser, profile: newProfile };
  },

  async getUsers() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.user.findMany({
          include: { profile: true, employee: true },
        });
      } catch (err) {
        console.error("Prisma error in getUsers, using mock fallback:", err);
      }
    }

    return mockUsers.map((u) => {
      const profile = mockProfiles.find((p) => p.userId === u.id);
      const employee = mockEmployees.find((e) => e.userId === u.id);
      return { ...u, profile, employee };
    });
  },

  async updateUser(id: string, data: { email?: string; role?: UserRole; isActive?: boolean; passwordHash?: string; mustChangePassword?: boolean; firstName?: string; lastName?: string; phone?: string; address?: string; profilePhotoUrl?: string }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        const dbRole = data.role ? await prisma.role.findUnique({ where: { name: data.role } }) : null;
        
        const updateData: any = {};
        if (data.email !== undefined) updateData.email = data.email;
        if (data.role !== undefined) updateData.role = data.role;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
        if (data.mustChangePassword !== undefined) updateData.mustChangePassword = data.mustChangePassword;
        if (dbRole) {
          updateData.roleId = dbRole.id;
        }

        const profileUpdate: any = {};
        if (data.firstName !== undefined) profileUpdate.firstName = data.firstName;
        if (data.lastName !== undefined) profileUpdate.lastName = data.lastName;
        if (data.phone !== undefined) profileUpdate.phone = data.phone;
        if (data.address !== undefined) profileUpdate.address = data.address;
        if (data.profilePhotoUrl !== undefined) profileUpdate.profilePhotoUrl = data.profilePhotoUrl;

        if (Object.keys(profileUpdate).length > 0) {
          const existingProfile = await prisma.profile.findUnique({
            where: { userId: id }
          });
          if (existingProfile) {
            await prisma.profile.update({
              where: { userId: id },
              data: profileUpdate
            });
          } else {
            await prisma.profile.create({
              data: {
                userId: id,
                firstName: data.firstName || "",
                lastName: data.lastName || "",
                phone: data.phone || "",
                address: data.address || "",
                profilePhotoUrl: data.profilePhotoUrl || "",
                ...profileUpdate
              }
            });
          }
        }

        return await prisma.user.update({
          where: { id },
          data: updateData,
          include: { profile: true },
        });
      } catch (err) {
        console.error("Prisma error in updateUser:", err);
        throw err;
      }
    }

    const user = mockUsers.find((u) => u.id === id);
    if (!user) return null;

    if (data.email !== undefined) user.email = data.email;
    if (data.role !== undefined) user.role = data.role;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    if (data.passwordHash !== undefined) user.passwordHash = data.passwordHash;
    if (data.mustChangePassword !== undefined) (user as any).mustChangePassword = data.mustChangePassword;

    let profile = mockProfiles.find((p) => p.userId === id);
    if (!profile) {
      profile = { id: "p-" + id, userId: id, firstName: "", lastName: "", phone: "", address: "", profilePhotoUrl: null, createdAt: new Date(), updatedAt: new Date() };
      mockProfiles.push(profile);
    }
    if (data.firstName !== undefined) profile.firstName = data.firstName;
    if (data.lastName !== undefined) profile.lastName = data.lastName;
    if (data.phone !== undefined) profile.phone = data.phone;
    if (data.address !== undefined) profile.address = data.address;
    if (data.profilePhotoUrl !== undefined) profile.profilePhotoUrl = data.profilePhotoUrl;

    return { ...user, profile };
  },

  async saveRefreshToken(token: string) {
    mockRefreshTokens.add(token);
    return true;
  },

  async hasRefreshToken(token: string) {
    return mockRefreshTokens.has(token);
  },

  async revokeRefreshToken(token: string) {
    return mockRefreshTokens.delete(token);
  },

  // 2. HR DOMAIN
  async getDepartments() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.department.findMany({
          include: { employees: true },
        });
      } catch (err) {
        console.error("Prisma error in getDepartments, using mock fallback:", err);
      }
    }
    return mockDepartments.map((d) => {
      const employees = mockEmployees.filter((e) => e.departmentId === d.id);
      return { ...d, employees };
    });
  },

  async createDepartment(data: { name: string; code: string; description?: string }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        const existing = await prisma.department.findFirst({
          where: {
            OR: [
              { name: data.name },
              { code: data.code }
            ]
          }
        });
        if (existing) {
          console.log(`Department with name "${data.name}" or code "${data.code}" already exists in DB. Returning existing.`);
          return existing;
        }
        return await prisma.department.create({ data });
      } catch (err) {
        console.error("Prisma error in createDepartment, using mock fallback:", err);
      }
    }

    const existingMock = mockDepartments.find(
      (d) => d.name.toLowerCase() === data.name.toLowerCase() || d.code.toLowerCase() === data.code.toLowerCase()
    );
    if (existingMock) {
      return existingMock;
    }

    const id = "d-" + Math.random().toString(36).substring(2, 9);
    const newDep = { id, name: data.name, code: data.code, description: data.description || null, managerId: null, createdAt: new Date(), updatedAt: new Date() };
    mockDepartments.push(newDep);
    return newDep;
  },

  async getEmployees() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.employee.findMany({
          include: { user: { include: { profile: true } }, department: true },
        });
      } catch (err) {
        console.error("Prisma error in getEmployees, using mock fallback:", err);
      }
    }
    return mockEmployees.map((e) => {
      const user = mockUsers.find((u) => u.id === e.userId);
      const profile = mockProfiles.find((p) => p.userId === e.userId);
      const department = mockDepartments.find((d) => d.id === e.departmentId);
      return { ...e, user: { ...user, profile }, department };
    });
  },

  async createEmployee(data: { userId: string; departmentId: string; position: string; salary: number; hireDate: Date }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.employee.create({
          data: {
            userId: data.userId,
            departmentId: data.departmentId,
            position: data.position,
            salary: data.salary,
            hireDate: data.hireDate,
          },
        });
      } catch (err) {
        console.error("Prisma error in createEmployee, using mock fallback:", err);
      }
    }

    const id = "e-" + Math.random().toString(36).substring(2, 9);
    const newEmp = { id, userId: data.userId, departmentId: data.departmentId, position: data.position, salary: data.salary, hireDate: data.hireDate, status: EmployeeStatus.ACTIVE, createdAt: new Date(), updatedAt: new Date() };
    mockEmployees.push(newEmp);
    return newEmp;
  },

  async getEmployeeById(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.employee.findUnique({
          where: { id },
          include: {
            user: { include: { profile: true } },
            department: true,
            attendances: { orderBy: { date: "desc" }, take: 10 },
            salaryPayments: { orderBy: { payDate: "desc" }, take: 10 }
          }
        });
      } catch (err) {
        console.error("Prisma error in getEmployeeById:", err);
      }
    }

    const emp = mockEmployees.find((e) => e.id === id);
    if (!emp) return null;

    const user = mockUsers.find((u) => u.id === emp.userId);
    const profile = mockProfiles.find((p) => p.userId === emp.userId);
    const department = mockDepartments.find((d) => d.id === emp.departmentId);
    const attendances = mockAttendances.filter((a) => a.employeeId === emp.id).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
    const salaryPayments = mockSalaryPayments.filter((s) => s.employeeId === emp.id).sort((a, b) => b.payDate.getTime() - a.payDate.getTime()).slice(0, 10);

    return {
      ...emp,
      user: user ? { ...user, profile } : null,
      department,
      attendances: attendances.map((a) => ({ ...a, date: new Date(a.date) })),
      salaryPayments: salaryPayments.map((s) => ({ ...s, payDate: new Date(s.payDate) }))
    };
  },

  async getTasks() {
    return mockTasks;
  },

  async createTask(data: { title: string; desc: string }) {
    const id = "task-" + Math.random().toString(36).substring(2, 9);
    const newTask = { id, title: data.title, desc: data.desc, completed: false, createdAt: new Date() };
    mockTasks.unshift(newTask);
    return newTask;
  },

  async toggleTask(id: string) {
    const task = mockTasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
    }
    return task;
  },

  async deleteTask(id: string) {
    const idx = mockTasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      mockTasks.splice(idx, 1);
      return true;
    }
    return false;
  },

  async getLeaveRequests() {
    return mockLeaveRequests;
  },

  async createLeaveRequest(data: { type: string; start: string; end: string; reason: string }) {
    const id = "leave-" + Math.random().toString(36).substring(2, 9);
    const newLeave = {
      id,
      type: data.type,
      start: data.start,
      end: data.end,
      reason: data.reason,
      status: "PENDING",
      createdAt: new Date()
    };
    mockLeaveRequests.unshift(newLeave);
    return newLeave;
  },

  async updateLeaveRequestStatus(id: string, status: "APPROVED" | "REJECTED") {
    const leave = mockLeaveRequests.find(l => l.id === id);
    if (leave) {
      leave.status = status;
    }
    return leave;
  },

  async getEmployeesPaged(params: { page: number; limit: number; search?: string; departmentId?: string; status?: EmployeeStatus }) {
    const { page, limit, search, departmentId, status } = params;
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const whereClause: any = {};
        if (departmentId) {
          whereClause.departmentId = departmentId;
        }
        if (status) {
          whereClause.status = status;
        }
        if (search) {
          const s = search;
          whereClause.OR = [
            { position: { contains: s, mode: "insensitive" } },
            {
              user: {
                OR: [
                  { email: { contains: s, mode: "insensitive" } },
                  {
                    profile: {
                      OR: [
                        { firstName: { contains: s, mode: "insensitive" } },
                        { lastName: { contains: s, mode: "insensitive" } }
                      ]
                    }
                  }
                ]
              }
            }
          ];
        }

        const [employees, total] = await Promise.all([
          prisma.employee.findMany({
            where: whereClause,
            include: { user: { include: { profile: true } }, department: true },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" }
          }),
          prisma.employee.count({ where: whereClause })
        ]);

        return { employees, total, page, limit };
      } catch (err) {
        console.error("Prisma error in getEmployeesPaged, using mock fallback:", err);
      }
    }

    // Mock Fallback
    let filtered = [...mockEmployees];

    if (departmentId) {
      filtered = filtered.filter((e) => e.departmentId === departmentId);
    }
    if (status) {
      filtered = filtered.filter((e) => e.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((e) => {
        const user = mockUsers.find((u) => u.id === e.userId);
        const profile = mockProfiles.find((p) => p.userId === e.userId);
        return (
          e.position.toLowerCase().includes(q) ||
          (user?.email && user.email.toLowerCase().includes(q)) ||
          (profile?.firstName && profile.firstName.toLowerCase().includes(q)) ||
          (profile?.lastName && profile.lastName.toLowerCase().includes(q))
        );
      });
    }

    const total = filtered.length;
    const sorted = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    const employeesWithRelations = paginated.map((e) => {
      const user = mockUsers.find((u) => u.id === e.userId);
      const profile = mockProfiles.find((p) => p.userId === e.userId);
      const department = mockDepartments.find((d) => d.id === e.departmentId);
      return {
        ...e,
        user: user ? { ...user, profile } : null,
        department
      };
    });

    return { employees: employeesWithRelations, total, page, limit };
  },

  async createEmployeeWithUser(data: {
    email: string;
    passwordHash: string;
    plainPassword?: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    phone?: string;
    address?: string;
    departmentId?: string | null;
    position: string;
    salary: number;
    hireDate: Date;
    profilePhotoUrl?: string;
  }) {
    // 1. Synchronize to Supabase Auth if active
    let supabaseUserId: string | null = null;
    if (supabaseAdmin) {
      try {
        console.log(`🔐 Programmatically creating user credentials in Supabase Auth: ${data.email}`);
        const { data: suData, error: suErr } = await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: data.plainPassword || "password123",
          email_confirm: true,
          user_metadata: {
            role: data.role,
            firstName: data.firstName,
            lastName: data.lastName
          }
        });
        if (suErr) {
          console.error("❌ Supabase Auth admin user creation failed:", suErr);
          throw suErr;
        }
        supabaseUserId = suData?.user?.id || null;
      } catch (suErr: any) {
        console.error("❌ Failed to register user credentials in Supabase Auth:", suErr);
        throw new Error(`Failed to create authentication credentials in Supabase Auth: ${suErr.message || suErr}`);
      }
    }

    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.$transaction(async (tx) => {
          // Check email
          const existingUser = await tx.user.findUnique({ where: { email: data.email } });
          if (existingUser) {
            throw new Error(`User with email ${data.email} already exists.`);
          }

          // Fetch database role ID
          const dbRole = await tx.role.findUnique({ where: { name: data.role } });

          const user = await tx.user.create({
            data: {
              id: supabaseUserId || undefined,
              email: data.email,
              passwordHash: data.passwordHash,
              role: data.role,
              roleId: dbRole?.id || null,
              mustChangePassword: true, // Created by admin: requires first-time login password change
              profile: {
                create: {
                  firstName: data.firstName,
                  lastName: data.lastName,
                  phone: data.phone || null,
                  address: data.address || null,
                  profilePhotoUrl: data.profilePhotoUrl || null
                }
              }
            }
          });

          const employee = await tx.employee.create({
            data: {
              userId: user.id,
              departmentId: data.departmentId || null,
              position: data.position,
              salary: data.salary,
              hireDate: data.hireDate,
              status: EmployeeStatus.ACTIVE
            },
            include: { user: { include: { profile: true } }, department: true }
          });

          return employee;
        });
      } catch (err: any) {
        console.error("Prisma transaction error in createEmployeeWithUser:", err);
        throw err;
      }
    }

    // Mock implementation
    const existing = mockUsers.find((u) => u.email.toLowerCase() === data.email.toLowerCase());
    if (existing) {
      throw new Error(`User with email ${data.email} already exists.`);
    }

    const uId = "u-" + Math.random().toString(36).substring(2, 9);
    const newUser = {
      id: uId,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockUsers.push(newUser);

    const profId = "prof-" + Math.random().toString(36).substring(2, 9);
    const newProfile = {
      id: profId,
      userId: uId,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      address: data.address || null,
      profilePhotoUrl: data.profilePhotoUrl || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockProfiles.push(newProfile);

    const empId = "e-" + Math.random().toString(36).substring(2, 9);
    const newEmp = {
      id: empId,
      userId: uId,
      departmentId: data.departmentId || null,
      position: data.position,
      salary: data.salary,
      hireDate: data.hireDate,
      status: EmployeeStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockEmployees.push(newEmp);

    const dept = mockDepartments.find((d) => d.id === data.departmentId);

    return {
      ...newEmp,
      user: {
        ...newUser,
        profile: newProfile
      },
      department: dept || null
    };
  },

  async updateEmployee(
    id: string,
    data: {
      departmentId?: string | null;
      position?: string;
      salary?: number;
      status?: EmployeeStatus;
      profilePhotoUrl?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
    }
  ) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        const emp = await prisma.employee.findUnique({ where: { id } });
        if (!emp) throw new Error("Employee not found");

        const updateData: any = {};
        if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
        if (data.position !== undefined) updateData.position = data.position;
        if (data.salary !== undefined) updateData.salary = data.salary;
        if (data.status !== undefined) updateData.status = data.status;

        // Update profile too if fields are provided
        const profileUpdate: any = {};
        if (data.profilePhotoUrl !== undefined) profileUpdate.profilePhotoUrl = data.profilePhotoUrl;
        if (data.firstName !== undefined) profileUpdate.firstName = data.firstName;
        if (data.lastName !== undefined) profileUpdate.lastName = data.lastName;
        if (data.phone !== undefined) profileUpdate.phone = data.phone;
        if (data.address !== undefined) profileUpdate.address = data.address;

        if (Object.keys(profileUpdate).length > 0) {
          await prisma.profile.update({
            where: { userId: emp.userId },
            data: profileUpdate
          });
        }

        return await prisma.employee.update({
          where: { id },
          data: updateData,
          include: { user: { include: { profile: true } }, department: true }
        });
      } catch (err) {
        console.error("Prisma error in updateEmployee:", err);
        throw err;
      }
    }

    const empIndex = mockEmployees.findIndex((e) => e.id === id);
    if (empIndex === -1) {
      throw new Error("Employee not found.");
    }

    const emp = mockEmployees[empIndex];
    if (data.departmentId !== undefined) emp.departmentId = data.departmentId;
    if (data.position !== undefined) emp.position = data.position;
    if (data.salary !== undefined) emp.salary = data.salary;
    if (data.status !== undefined) emp.status = data.status;
    emp.updatedAt = new Date();

    const profileIndex = mockProfiles.findIndex((p) => p.userId === emp.userId);
    if (profileIndex !== -1) {
      const profile = mockProfiles[profileIndex];
      if (data.profilePhotoUrl !== undefined) profile.profilePhotoUrl = data.profilePhotoUrl;
      if (data.firstName !== undefined) profile.firstName = data.firstName;
      if (data.lastName !== undefined) profile.lastName = data.lastName;
      if (data.phone !== undefined) profile.phone = data.phone;
      if (data.address !== undefined) profile.address = data.address;
      profile.updatedAt = new Date();
    }

    const user = mockUsers.find((u) => u.id === emp.userId);
    const profile = mockProfiles.find((p) => p.userId === emp.userId);
    const dept = mockDepartments.find((d) => d.id === emp.departmentId);

    return {
      ...emp,
      user: user ? { ...user, profile } : null,
      department: dept || null
    };
  },

  async deleteEmployee(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        const emp = await prisma.employee.findUnique({ where: { id } });
        if (!emp) throw new Error("Employee not found");

        // Transaction to delete user (which cascades to employee and profile)
        await prisma.user.delete({ where: { id: emp.userId } });
        return true;
      } catch (err) {
        console.error("Prisma error in deleteEmployee:", err);
        throw err;
      }
    }

    const empIndex = mockEmployees.findIndex((e) => e.id === id);
    if (empIndex === -1) {
      throw new Error("Employee not found.");
    }

    const emp = mockEmployees[empIndex];
    mockEmployees.splice(empIndex, 1);

    const userIndex = mockUsers.findIndex((u) => u.id === emp.userId);
    if (userIndex !== -1) {
      mockUsers.splice(userIndex, 1);
    }

    const profileIndex = mockProfiles.findIndex((p) => p.userId === emp.userId);
    if (profileIndex !== -1) {
      mockProfiles.splice(profileIndex, 1);
    }

    return true;
  },

  async createAttendance(data: {
    employeeId: string;
    date: Date;
    checkIn?: Date | null;
    checkOut?: Date | null;
    status: AttendanceStatus;
    notes?: string | null;
  }) {
    const isDbReachable = await checkDatabaseConnection();
    const normalizedDate = new Date(data.date);
    normalizedDate.setHours(0, 0, 0, 0);

    if (isDbReachable && prisma) {
      try {
        return await prisma.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: data.employeeId,
              date: normalizedDate
            }
          },
          update: {
            checkIn: data.checkIn || undefined,
            checkOut: data.checkOut || undefined,
            status: data.status,
            notes: data.notes || undefined
          },
          create: {
            employeeId: data.employeeId,
            date: normalizedDate,
            checkIn: data.checkIn || null,
            checkOut: data.checkOut || null,
            status: data.status,
            notes: data.notes || null
          }
        });
      } catch (err) {
        console.error("Prisma error in createAttendance:", err);
        throw err;
      }
    }

    // Mock implementation
    const existingIndex = mockAttendances.findIndex(
      (a) =>
        a.employeeId === data.employeeId &&
        new Date(a.date).toDateString() === normalizedDate.toDateString()
    );

    if (existingIndex !== -1) {
      const existing = mockAttendances[existingIndex];
      mockAttendances[existingIndex] = {
        ...existing,
        checkIn: data.checkIn !== undefined ? data.checkIn : existing.checkIn,
        checkOut: data.checkOut !== undefined ? data.checkOut : existing.checkOut,
        status: data.status,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        updatedAt: new Date()
      };
      return mockAttendances[existingIndex];
    }

    const aId = "att-" + Math.random().toString(36).substring(2, 9);
    const newAtt = {
      id: aId,
      employeeId: data.employeeId,
      date: normalizedDate,
      checkIn: data.checkIn || null,
      checkOut: data.checkOut || null,
      status: data.status,
      notes: data.notes || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockAttendances.push(newAtt);
    return newAtt;
  },

  async getAttendancesPaged(params: { page: number; limit: number; employeeId?: string; startDate?: Date; endDate?: Date }) {
    const { page, limit, employeeId, startDate, endDate } = params;
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const whereClause: any = {};
        if (employeeId) whereClause.employeeId = employeeId;
        if (startDate || endDate) {
          whereClause.date = {};
          if (startDate) whereClause.date.gte = startDate;
          if (endDate) whereClause.date.lte = endDate;
        }

        const [attendances, total] = await Promise.all([
          prisma.attendance.findMany({
            where: whereClause,
            include: { employee: { include: { user: { include: { profile: true } } } } },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { date: "desc" }
          }),
          prisma.attendance.count({ where: whereClause })
        ]);

        return { attendances, total, page, limit };
      } catch (err) {
        console.error("Prisma error in getAttendancesPaged:", err);
      }
    }

    let filtered = [...mockAttendances];
    if (employeeId) {
      filtered = filtered.filter((a) => a.employeeId === employeeId);
    }
    if (startDate) {
      filtered = filtered.filter((a) => new Date(a.date) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter((a) => new Date(a.date) <= new Date(endDate));
    }

    const total = filtered.length;
    const sorted = filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    const attendancesWithRelations = paginated.map((a) => {
      const emp = mockEmployees.find((e) => e.id === a.employeeId);
      const user = emp ? mockUsers.find((u) => u.id === emp.userId) : null;
      const profile = emp ? mockProfiles.find((p) => p.userId === emp.userId) : null;

      return {
        ...a,
        employee: emp ? { ...emp, user: user ? { ...user, profile } : null } : null
      };
    });

    return { attendances: attendancesWithRelations, total, page, limit };
  },

  async createSalaryPayment(data: {
    employeeId: string;
    amount: number;
    payDate: Date;
    paymentMethod: string;
    status: string;
  }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.salaryPayment.create({
          data: {
            employeeId: data.employeeId,
            amount: data.amount,
            payDate: data.payDate,
            paymentMethod: data.paymentMethod,
            status: data.status
          }
        });
      } catch (err) {
        console.error("Prisma error in createSalaryPayment:", err);
        throw err;
      }
    }

    const payId = "sal-" + Math.random().toString(36).substring(2, 9);
    const payment = {
      id: payId,
      employeeId: data.employeeId,
      amount: data.amount,
      payDate: data.payDate,
      paymentMethod: data.paymentMethod,
      status: data.status,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockSalaryPayments.push(payment);
    return payment;
  },

  async getSalaryPaymentsPaged(params: { page: number; limit: number; employeeId?: string }) {
    const { page, limit, employeeId } = params;
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const whereClause: any = {};
        if (employeeId) whereClause.employeeId = employeeId;

        const [salaryPayments, total] = await Promise.all([
          prisma.salaryPayment.findMany({
            where: whereClause,
            include: { employee: { include: { user: { include: { profile: true } } } } },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { payDate: "desc" }
          }),
          prisma.salaryPayment.count({ where: whereClause })
        ]);

        return { salaryPayments, total, page, limit };
      } catch (err) {
        console.error("Prisma error in getSalaryPaymentsPaged:", err);
      }
    }

    let filtered = [...mockSalaryPayments];
    if (employeeId) {
      filtered = filtered.filter((s) => s.employeeId === employeeId);
    }

    const total = filtered.length;
    const sorted = filtered.sort((a, b) => b.payDate.getTime() - a.payDate.getTime());
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    const paymentsWithRelations = paginated.map((s) => {
      const emp = mockEmployees.find((e) => e.id === s.employeeId);
      const user = emp ? mockUsers.find((u) => u.id === emp.userId) : null;
      const profile = emp ? mockProfiles.find((p) => p.userId === emp.userId) : null;

      return {
        ...s,
        employee: emp ? { ...emp, user: user ? { ...user, profile } : null } : null
      };
    });

    return { salaryPayments: paymentsWithRelations, total, page, limit };
  },

  // 3. INVENTORY DOMAIN
  async getCategories() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.category.findMany();
      } catch (err) {
        console.error("Prisma error in getCategories, using mock fallback:", err);
      }
    }
    return mockCategories;
  },

  async getProducts() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.product.findMany({
          where: { isDeleted: false },
          include: { category: true, stockLevels: { include: { warehouse: true } } },
        });
      } catch (err) {
        console.error("Prisma error in getProducts, using mock fallback:", err);
      }
    }

    return mockProducts
      .filter((p) => !p.isDeleted)
      .map((p) => {
        const category = mockCategories.find((c) => c.id === p.categoryId);
        const stockLevels = mockStockLevels
          .filter((sl) => sl.productId === p.id)
          .map((sl) => {
            const warehouse = mockWarehouses.find((wh) => wh.id === sl.warehouseId);
            return { ...sl, warehouse };
          });
        return { ...p, category, stockLevels };
      });
  },

  async getProductsPaged(params: { page?: number; limit?: number; search?: string; categoryId?: string }) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 1000;
    const { search, categoryId } = params;
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        const where: any = { isDeleted: false };
        if (categoryId) {
          where.categoryId = categoryId;
        }
        if (search) {
          where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ];
        }
        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
          prisma.product.findMany({
            where,
            include: { category: true, stockLevels: { include: { warehouse: true } } },
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
          }),
          prisma.product.count({ where }),
        ]);
        return { products, total };
      } catch (err) {
        console.error("Prisma error in getProductsPaged, using mock fallback:", err);
      }
    }

    let filtered = mockProducts.filter((p) => !p.isDeleted);
    if (categoryId) {
      filtered = filtered.filter((p) => p.categoryId === categoryId);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          p.sku.toLowerCase().includes(s) ||
          (p.description && p.description.toLowerCase().includes(s))
      );
    }

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const paged = filtered.slice(skip, skip + limit);

    const products = paged.map((p) => {
      const category = mockCategories.find((c) => c.id === p.categoryId);
      const stockLevels = mockStockLevels
        .filter((sl) => sl.productId === p.id)
        .map((sl) => {
          const warehouse = mockWarehouses.find((wh) => wh.id === sl.warehouseId);
          return { ...sl, warehouse };
        });
      return { ...p, category, stockLevels };
    });

    return { products, total };
  },

  async createProduct(data: { name: string; sku: string; description?: string; categoryId: string; price: number; cost: number; unitOfMeasure: string }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.product.create({
          data: {
            name: data.name,
            sku: data.sku,
            description: data.description,
            categoryId: data.categoryId,
            price: data.price,
            cost: data.cost,
            unitOfMeasure: data.unitOfMeasure,
          },
        });
      } catch (err) {
        console.error("Prisma error in createProduct, using mock fallback:", err);
      }
    }

    const id = "pr-" + Math.random().toString(36).substring(2, 9);
    const newProduct = { id, name: data.name, sku: data.sku, description: data.description || null, categoryId: data.categoryId, price: data.price, cost: data.cost, unitOfMeasure: data.unitOfMeasure, isDeleted: false, createdAt: new Date(), updatedAt: new Date() };
    mockProducts.push(newProduct);
    return newProduct;
  },

  async getProductById(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.product.findFirst({
          where: { id, isDeleted: false },
          include: { category: true, stockLevels: { include: { warehouse: true } } },
        });
      } catch (err) {
        console.error("Prisma error in getProductById, using mock fallback:", err);
      }
    }

    const p = mockProducts.find((prod) => prod.id === id && !prod.isDeleted);
    if (!p) return null;

    const category = mockCategories.find((c) => c.id === p.categoryId);
    const stockLevels = mockStockLevels
      .filter((sl) => sl.productId === p.id)
      .map((sl) => {
        const warehouse = mockWarehouses.find((wh) => wh.id === sl.warehouseId);
        return { ...sl, warehouse };
      });
    return { ...p, category, stockLevels };
  },

  async updateProduct(id: string, data: Partial<{ name: string; sku: string; description?: string; categoryId: string; price: number; cost: number; unitOfMeasure: string; imageUrl?: string }>) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.product.update({
          where: { id },
          data: {
            name: data.name,
            sku: data.sku,
            description: data.description,
            categoryId: data.categoryId,
            price: data.price,
            cost: data.cost,
            unitOfMeasure: data.unitOfMeasure,
            imageUrl: data.imageUrl,
          },
        });
      } catch (err) {
        console.error("Prisma error in updateProduct, using mock fallback:", err);
      }
    }

    const index = mockProducts.findIndex((prod) => prod.id === id);
    if (index === -1) return null;

    const existingProduct = mockProducts[index];
    const updatedProduct = {
      ...existingProduct,
      name: data.name !== undefined ? data.name : existingProduct.name,
      sku: data.sku !== undefined ? data.sku : existingProduct.sku,
      description: data.description !== undefined ? (data.description || null) : existingProduct.description,
      categoryId: data.categoryId !== undefined ? data.categoryId : existingProduct.categoryId,
      price: data.price !== undefined ? data.price : existingProduct.price,
      cost: data.cost !== undefined ? data.cost : existingProduct.cost,
      unitOfMeasure: data.unitOfMeasure !== undefined ? data.unitOfMeasure : existingProduct.unitOfMeasure,
      imageUrl: data.imageUrl !== undefined ? data.imageUrl : (existingProduct as any).imageUrl,
      updatedAt: new Date(),
    };

    mockProducts[index] = updatedProduct;
    return updatedProduct;
  },

  async deleteProduct(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        await prisma.product.update({
          where: { id },
          data: { isDeleted: true },
        });
        return true;
      } catch (err) {
        console.error("Prisma error in deleteProduct, using mock fallback:", err);
      }
    }

    const index = mockProducts.findIndex((prod) => prod.id === id);
    if (index === -1) return false;

    mockProducts[index].isDeleted = true;
    mockProducts[index].updatedAt = new Date();
    return true;
  },

  async getWarehouses() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.warehouse.findMany();
      } catch (err) {
        console.error("Prisma error in getWarehouses, using mock fallback:", err);
      }
    }
    return mockWarehouses;
  },

  async getStockMovements() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.stockMovement.findMany({
          include: { product: true, warehouse: true, createdBy: { include: { profile: true } } },
          orderBy: { createdAt: "desc" },
        });
      } catch (err) {
        console.error("Prisma error in getStockMovements, using mock fallback:", err);
      }
    }
    return mockStockMovements.map((sm) => {
      const product = mockProducts.find((p) => p.id === sm.productId);
      const warehouse = mockWarehouses.find((w) => w.id === sm.warehouseId);
      const createdBy = mockUsers.find((u) => u.id === sm.createdById);
      const profile = mockProfiles.find((p) => p.userId === sm.createdById);
      return { ...sm, product, warehouse, createdBy: { ...createdBy, profile } };
    });
  },

  async createStockMovement(data: { productId: string; warehouseId: string; quantityChange: number; type: StockMovementType; referenceNumber?: string; description?: string; createdById: string }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        // Run as transaction in production to guarantee atomicity of movement logging and balance updating
        return await prisma.$transaction(async (tx) => {
          const movement = await tx.stockMovement.create({
            data: {
              productId: data.productId,
              warehouseId: data.warehouseId,
              quantityChange: data.quantityChange,
              type: data.type,
              referenceNumber: data.referenceNumber,
              description: data.description,
              createdById: data.createdById,
            },
          });

          // Update or insert StockLevel
          await tx.stockLevel.upsert({
            where: {
              productId_warehouseId: {
                productId: data.productId,
                warehouseId: data.warehouseId,
              },
            },
            create: {
              productId: data.productId,
              warehouseId: data.warehouseId,
              quantity: data.quantityChange,
            },
            update: {
              quantity: { increment: data.quantityChange },
            },
          });

          return movement;
        });
      } catch (err) {
        console.error("Prisma transaction failed for stock movement, using mock fallback:", err);
      }
    }

    // Fallback State Update
    const id = "sm-" + Math.random().toString(36).substring(2, 9);
    const movement = { id, productId: data.productId, warehouseId: data.warehouseId, quantityChange: data.quantityChange, type: data.type, referenceNumber: data.referenceNumber || null, description: data.description || null, createdById: data.createdById, createdAt: new Date() };
    mockStockMovements.push(movement);

    // Update Stock Levels
    const existingSL = mockStockLevels.find((sl) => sl.productId === data.productId && sl.warehouseId === data.warehouseId);
    if (existingSL) {
      existingSL.quantity = Number(existingSL.quantity) + data.quantityChange;
      existingSL.updatedAt = new Date();
    } else {
      mockStockLevels.push({
        id: "sl-" + Math.random().toString(36).substring(2, 9),
        productId: data.productId,
        warehouseId: data.warehouseId,
        quantity: data.quantityChange,
        reorderPoint: 10,
        minStock: 0,
        maxStock: 1000,
        updatedAt: new Date(),
      });
    }

    return movement;
  },

  async getStockLevel(productId: string, warehouseId: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.stockLevel.findUnique({
          where: {
            productId_warehouseId: { productId, warehouseId },
          },
          include: { product: { include: { category: true } }, warehouse: true },
        });
      } catch (err) {
        console.error("Prisma error in getStockLevel, using mock fallback:", err);
      }
    }

    const sl = mockStockLevels.find((s) => s.productId === productId && s.warehouseId === warehouseId);
    if (!sl) return null;

    const product = mockProducts.find((p) => p.id === productId);
    const category = product ? mockCategories.find((c) => c.id === product.categoryId) : null;
    const warehouse = mockWarehouses.find((w) => w.id === warehouseId);

    return {
      ...sl,
      product: product ? { ...product, category } : null,
      warehouse,
    };
  },

  async updateStockLevelBounds(productId: string, warehouseId: string, bounds: { reorderPoint?: number; minStock?: number; maxStock?: number }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.stockLevel.upsert({
          where: {
            productId_warehouseId: { productId, warehouseId },
          },
          update: {
            reorderPoint: bounds.reorderPoint,
            minStock: bounds.minStock,
            maxStock: bounds.maxStock,
          },
          create: {
            productId,
            warehouseId,
            quantity: 0,
            reorderPoint: bounds.reorderPoint ?? 10,
            minStock: bounds.minStock ?? 0,
            maxStock: bounds.maxStock ?? 1000,
          },
          include: { product: true, warehouse: true },
        });
      } catch (err) {
        console.error("Prisma error in updateStockLevelBounds, using mock fallback:", err);
      }
    }

    let slIndex = mockStockLevels.findIndex((s) => s.productId === productId && s.warehouseId === warehouseId);
    if (slIndex === -1) {
      const newSl = {
        id: "sl-" + Math.random().toString(36).substring(2, 9),
        productId,
        warehouseId,
        quantity: 0,
        reorderPoint: bounds.reorderPoint ?? 10,
        minStock: bounds.minStock ?? 0,
        maxStock: bounds.maxStock ?? 1000,
        updatedAt: new Date(),
      };
      mockStockLevels.push(newSl);
      slIndex = mockStockLevels.length - 1;
    } else {
      const existing = mockStockLevels[slIndex];
      mockStockLevels[slIndex] = {
        ...existing,
        reorderPoint: bounds.reorderPoint !== undefined ? bounds.reorderPoint : existing.reorderPoint,
        minStock: bounds.minStock !== undefined ? bounds.minStock : (existing.minStock ?? 0),
        maxStock: bounds.maxStock !== undefined ? bounds.maxStock : (existing.maxStock ?? 1000),
        updatedAt: new Date(),
      };
    }

    const updated = mockStockLevels[slIndex];
    const product = mockProducts.find((p) => p.id === productId);
    const warehouse = mockWarehouses.find((w) => w.id === warehouseId);
    return { ...updated, product, warehouse };
  },

  async getStockLevels() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.stockLevel.findMany();
      } catch (err) {
        console.error("Prisma error in getStockLevels, using mock fallback:", err);
      }
    }
    return mockStockLevels;
  },

  async getStockLevelsPaged(params: { page: number; limit: number; search?: string; warehouseId?: string; categoryId?: string; alert?: string }) {
    const { page, limit, search, warehouseId, categoryId, alert } = params;
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        const where: any = {
          product: { isDeleted: false }
        };
        if (warehouseId) {
          where.warehouseId = warehouseId;
        }
        if (categoryId) {
          where.product.categoryId = categoryId;
        }
        if (search) {
          where.product.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
          ];
        }

        let stockLevels = await prisma.stockLevel.findMany({
          where,
          include: { product: { include: { category: true } }, warehouse: true },
          orderBy: { quantity: "asc" },
        });

        if (alert === "low") {
          stockLevels = stockLevels.filter((sl) => Number(sl.quantity) <= Number(sl.reorderPoint));
        } else if (alert === "excess") {
          stockLevels = stockLevels.filter((sl) => Number(sl.quantity) >= Number(sl.maxStock));
        } else if (alert === "minimum") {
          stockLevels = stockLevels.filter((sl) => Number(sl.quantity) < Number(sl.minStock));
        }

        const total = stockLevels.length;
        const skip = (page - 1) * limit;
        const paged = stockLevels.slice(skip, skip + limit);

        return { stockLevels: paged, total };
      } catch (err) {
        console.error("Prisma error in getStockLevelsPaged, using mock fallback:", err);
      }
    }

    let filtered = mockStockLevels.filter((sl) => {
      const product = mockProducts.find((p) => p.id === sl.productId && !p.isDeleted);
      if (!product) return false;
      
      if (warehouseId && sl.warehouseId !== warehouseId) return false;
      if (categoryId && product.categoryId !== categoryId) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!product.name.toLowerCase().includes(s) && !product.sku.toLowerCase().includes(s)) {
          return false;
        }
      }
      return true;
    });

    if (alert === "low") {
      filtered = filtered.filter((sl) => Number(sl.quantity) <= Number(sl.reorderPoint));
    } else if (alert === "excess") {
      filtered = filtered.filter((sl) => Number(sl.quantity) >= Number(sl.maxStock ?? 1000));
    } else if (alert === "minimum") {
      filtered = filtered.filter((sl) => Number(sl.quantity) < Number(sl.minStock ?? 0));
    }

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const paged = filtered.slice(skip, skip + limit);

    const stockLevels = paged.map((sl) => {
      const product = mockProducts.find((p) => p.id === sl.productId);
      const category = product ? mockCategories.find((c) => c.id === product.categoryId) : null;
      const warehouse = mockWarehouses.find((w) => w.id === sl.warehouseId);
      return {
        ...sl,
        product: product ? { ...product, category } : null,
        warehouse,
      };
    });

    return { stockLevels, total };
  },

  async getStockHistoryPaged(params: { page: number; limit: number; productId?: string; warehouseId?: string; type?: string }) {
    const { page, limit, productId, warehouseId, type } = params;
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        const where: any = {};
        if (productId) where.productId = productId;
        if (warehouseId) where.warehouseId = warehouseId;
        if (type) where.type = type;

        const skip = (page - 1) * limit;
        const [movements, total] = await Promise.all([
          prisma.stockMovement.findMany({
            where,
            include: { product: { include: { category: true } }, warehouse: true, createdBy: { include: { profile: true } } },
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
          }),
          prisma.stockMovement.count({ where }),
        ]);

        return { movements, total };
      } catch (err) {
        console.error("Prisma error in getStockHistoryPaged, using mock fallback:", err);
      }
    }

    let filtered = mockStockMovements;
    if (productId) filtered = filtered.filter((m) => m.productId === productId);
    if (warehouseId) filtered = filtered.filter((m) => m.warehouseId === warehouseId);
    if (type) filtered = filtered.filter((m) => m.type === type);

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const paged = filtered.slice(skip, skip + limit);

    const movements = paged.map((m) => {
      const product = mockProducts.find((p) => p.id === m.productId);
      const category = product ? mockCategories.find((c) => c.id === product.categoryId) : null;
      const warehouse = mockWarehouses.find((w) => w.id === m.warehouseId);
      const createdBy = mockUsers.find((u) => u.id === m.createdById);
      const profile = mockProfiles.find((p) => p.userId === m.createdById);

      return {
        ...m,
        product: product ? { ...product, category } : null,
        warehouse,
        createdBy: createdBy ? { ...createdBy, profile } : null,
      };
    });

    return { movements, total };
  },

  async getInventoryReport() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        const [allStock, allProducts] = await Promise.all([
          prisma.stockLevel.findMany({
            include: { product: true },
          }),
          prisma.product.findMany({
            where: { isDeleted: false },
          }),
        ]);

        let totalItemsInStock = 0;
        let totalValuationCost = 0;
        let totalValuationPrice = 0;
        let itemsBelowReorder = 0;
        let itemsBelowMin = 0;
        let itemsWithExcess = 0;

        allStock.forEach((sl) => {
          const qty = Number(sl.quantity);
          totalItemsInStock += qty;
          totalValuationCost += qty * Number(sl.product.cost);
          totalValuationPrice += qty * Number(sl.product.price);

          if (qty <= Number(sl.reorderPoint)) {
            itemsBelowReorder++;
          }
          if (qty < Number(sl.minStock)) {
            itemsBelowMin++;
          }
          if (qty >= Number(sl.maxStock)) {
            itemsWithExcess++;
          }
        });

        const categories = await prisma.category.findMany();
        const categoryDistribution = categories.map((cat) => {
          const catStock = allStock.filter((sl) => sl.product.categoryId === cat.id);
          const totalQty = catStock.reduce((acc, curr) => acc + Number(curr.quantity), 0);
          const valuation = catStock.reduce((acc, curr) => acc + (Number(curr.quantity) * Number(curr.product.price)), 0);
          return {
            categoryId: cat.id,
            categoryName: cat.name,
            totalQuantity: totalQty,
            valuation,
          };
        });

        return {
          totalItemsInStock,
          totalValuationCost,
          totalValuationPrice,
          itemsBelowReorder,
          itemsBelowMin,
          itemsWithExcess,
          totalUniqueProducts: allProducts.length,
          categoryDistribution,
        };
      } catch (err) {
        console.error("Prisma error in getInventoryReport, using mock fallback:", err);
      }
    }

    let totalItemsInStock = 0;
    let totalValuationCost = 0;
    let totalValuationPrice = 0;
    let itemsBelowReorder = 0;
    let itemsBelowMin = 0;
    let itemsWithExcess = 0;

    mockStockLevels.forEach((sl) => {
      const prod = mockProducts.find((p) => p.id === sl.productId && !p.isDeleted);
      if (prod) {
        const qty = Number(sl.quantity);
        totalItemsInStock += qty;
        totalValuationCost += qty * Number(prod.cost);
        totalValuationPrice += qty * Number(prod.price);

        if (qty <= Number(sl.reorderPoint)) {
          itemsBelowReorder++;
        }
        if (qty < Number(sl.minStock ?? 0)) {
          itemsBelowMin++;
        }
        if (qty >= Number(sl.maxStock ?? 1000)) {
          itemsWithExcess++;
        }
      }
    });

    const categoryDistribution = mockCategories.map((cat) => {
      const catStock = mockStockLevels.filter((sl) => {
        const prod = mockProducts.find((p) => p.id === sl.productId && !p.isDeleted);
        return prod && prod.categoryId === cat.id;
      });
      const totalQty = catStock.reduce((acc, curr) => acc + Number(curr.quantity), 0);
      const valuation = catStock.reduce((acc, curr) => {
        const prod = mockProducts.find((p) => p.id === curr.productId);
        return acc + (Number(curr.quantity) * Number(prod ? prod.price : 0));
      }, 0);
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        totalQuantity: totalQty,
        valuation,
      };
    });

    return {
      totalItemsInStock,
      totalValuationCost,
      totalValuationPrice,
      itemsBelowReorder,
      itemsBelowMin,
      itemsWithExcess,
      totalUniqueProducts: mockProducts.filter((p) => !p.isDeleted).length,
      categoryDistribution,
    };
  },

  async transferStock(data: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; referenceNumber?: string; description?: string; createdById: string }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.$transaction(async (tx) => {
          const outMovement = await tx.stockMovement.create({
            data: {
              productId: data.productId,
              warehouseId: data.fromWarehouseId,
              quantityChange: -data.quantity,
              type: "TRANSFER",
              referenceNumber: data.referenceNumber,
              description: data.description || "Stock transfer out",
              createdById: data.createdById,
            },
          });

          const inMovement = await tx.stockMovement.create({
            data: {
              productId: data.productId,
              warehouseId: data.toWarehouseId,
              quantityChange: data.quantity,
              type: "TRANSFER",
              referenceNumber: data.referenceNumber,
              description: data.description || "Stock transfer in",
              createdById: data.createdById,
            },
          });

          await tx.stockLevel.upsert({
            where: {
              productId_warehouseId: { productId: data.productId, warehouseId: data.fromWarehouseId },
            },
            create: {
              productId: data.productId,
              warehouseId: data.fromWarehouseId,
              quantity: -data.quantity,
            },
            update: {
              quantity: { decrement: data.quantity },
            },
          });

          await tx.stockLevel.upsert({
            where: {
              productId_warehouseId: { productId: data.productId, warehouseId: data.toWarehouseId },
            },
            create: {
              productId: data.productId,
              warehouseId: data.toWarehouseId,
              quantity: data.quantity,
            },
            update: {
              quantity: { increment: data.quantity },
            },
          });

          return { outMovement, inMovement };
        });
      } catch (err) {
        console.error("Prisma transaction failed for transferStock, using mock fallback:", err);
      }
    }

    const idOut = "sm-tr-out-" + Math.random().toString(36).substring(2, 9);
    const idIn = "sm-tr-in-" + Math.random().toString(36).substring(2, 9);

    const outMovement = {
      id: idOut,
      productId: data.productId,
      warehouseId: data.fromWarehouseId,
      quantityChange: -data.quantity,
      type: "TRANSFER",
      referenceNumber: data.referenceNumber || null,
      description: data.description || "Stock transfer out",
      createdById: data.createdById,
      createdAt: new Date(),
    };
    const inMovement = {
      id: idIn,
      productId: data.productId,
      warehouseId: data.toWarehouseId,
      quantityChange: data.quantity,
      type: "TRANSFER",
      referenceNumber: data.referenceNumber || null,
      description: data.description || "Stock transfer in",
      createdById: data.createdById,
      createdAt: new Date(),
    };

    mockStockMovements.push(outMovement);
    mockStockMovements.push(inMovement);

    const sourceSL = mockStockLevels.find((sl) => sl.productId === data.productId && sl.warehouseId === data.fromWarehouseId);
    if (sourceSL) {
      sourceSL.quantity = Number(sourceSL.quantity) - data.quantity;
      sourceSL.updatedAt = new Date();
    } else {
      mockStockLevels.push({
        id: "sl-" + Math.random().toString(36).substring(2, 9),
        productId: data.productId,
        warehouseId: data.fromWarehouseId,
        quantity: -data.quantity,
        reorderPoint: 10,
        minStock: 0,
        maxStock: 1000,
        updatedAt: new Date(),
      });
    }

    const destSL = mockStockLevels.find((sl) => sl.productId === data.productId && sl.warehouseId === data.toWarehouseId);
    if (destSL) {
      destSL.quantity = Number(destSL.quantity) + data.quantity;
      destSL.updatedAt = new Date();
    } else {
      mockStockLevels.push({
        id: "sl-" + Math.random().toString(36).substring(2, 9),
        productId: data.productId,
        warehouseId: data.toWarehouseId,
        quantity: data.quantity,
        reorderPoint: 10,
        minStock: 0,
        maxStock: 1000,
        updatedAt: new Date(),
      });
    }

    return { outMovement, inMovement };
  },

  // 4. SALES DOMAIN
  async getCustomers() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.customer.findMany({
          where: { isDeleted: false },
        });
      } catch (err) {
        console.error("Prisma error in getCustomers, using mock fallback:", err);
      }
    }
    return mockCustomers.filter((c) => !c.isDeleted);
  },

  async getCustomersPaged(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const whereClause: any = { isDeleted: false };
        if (search) {
          whereClause.OR = [
            { companyName: { contains: search, mode: "insensitive" } },
            { contactName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ];
        }

        const [customers, total] = await Promise.all([
          prisma.customer.findMany({
            where: whereClause,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
          }),
          prisma.customer.count({ where: whereClause }),
        ]);

        return { customers, total, page, limit };
      } catch (err) {
        console.error("Prisma error in getCustomersPaged, using mock fallback:", err);
      }
    }

    // Mock implementation
    let filtered = mockCustomers.filter((c) => !c.isDeleted);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          (c.companyName && c.companyName.toLowerCase().includes(q)) ||
          c.contactName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const sorted = [...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    return {
      customers: paginated,
      total,
      page,
      limit,
    };
  },

  async getCustomerById(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.customer.findUnique({
          where: { id },
          include: {
            salesOrders: {
              include: {
                items: {
                  include: { product: true },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        });
      } catch (err) {
        console.error("Prisma error in getCustomerById, using mock fallback:", err);
      }
    }

    const customer = mockCustomers.find((c) => c.id === id);
    if (!customer) return null;

    const salesOrders = mockSalesOrders
      .filter((so) => so.customerId === id)
      .map((so) => {
        const items = mockSalesOrderItems
          .filter((soi) => soi.salesOrderId === so.id)
          .map((soi) => {
            const product = mockProducts.find((p) => p.id === soi.productId);
            return { ...soi, product };
          });
        return { ...so, items };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { ...customer, salesOrders };
  },

  async getCustomerByEmail(email: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.customer.findFirst({
          where: { email, isDeleted: false },
        });
      } catch (err) {
        console.error("Prisma error in getCustomerByEmail, using mock fallback:", err);
      }
    }
    return mockCustomers.find((c) => c.email.toLowerCase() === email.toLowerCase() && !c.isDeleted) || null;
  },

  async createCustomer(data: { companyName?: string | null; contactName: string; email: string; phone?: string | null; address?: string | null }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.customer.create({
          data: {
            companyName: data.companyName,
            contactName: data.contactName,
            email: data.email,
            phone: data.phone,
            address: data.address,
          },
        });
      } catch (err: any) {
        console.error("Prisma error in createCustomer, using mock fallback:", err);
        throw err;
      }
    }

    const existing = mockCustomers.find((c) => c.email.toLowerCase() === data.email.toLowerCase() && !c.isDeleted);
    if (existing) {
      throw new Error(`Customer with email "${data.email}" already exists.`);
    }

    const newCust = {
      id: "cust-" + Math.random().toString(36).substring(2, 9),
      companyName: data.companyName || null,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone || null,
      address: data.address || null,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCustomers.push(newCust);
    return newCust;
  },

  async updateCustomer(id: string, data: { companyName?: string | null; contactName: string; email: string; phone?: string | null; address?: string | null }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.customer.update({
          where: { id },
          data: {
            companyName: data.companyName,
            contactName: data.contactName,
            email: data.email,
            phone: data.phone,
            address: data.address,
          },
        });
      } catch (err: any) {
        console.error("Prisma error in updateCustomer, using mock fallback:", err);
        throw err;
      }
    }

    const index = mockCustomers.findIndex((c) => c.id === id && !c.isDeleted);
    if (index === -1) {
      throw new Error("Customer not found or has been deleted.");
    }

    const existingEmail = mockCustomers.find((c) => c.email.toLowerCase() === data.email.toLowerCase() && c.id !== id && !c.isDeleted);
    if (existingEmail) {
      throw new Error(`Customer with email "${data.email}" already exists.`);
    }

    const updatedCust = {
      ...mockCustomers[index],
      companyName: data.companyName || null,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone || null,
      address: data.address || null,
      updatedAt: new Date(),
    };

    mockCustomers[index] = updatedCust;
    return updatedCust;
  },

  async deleteCustomer(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.customer.update({
          where: { id },
          data: { isDeleted: true },
        });
      } catch (err: any) {
        console.error("Prisma error in deleteCustomer, using mock fallback:", err);
        throw err;
      }
    }

    const index = mockCustomers.findIndex((c) => c.id === id && !c.isDeleted);
    if (index === -1) {
      throw new Error("Customer not found or already deleted.");
    }

    mockCustomers[index].isDeleted = true;
    mockCustomers[index].updatedAt = new Date();
    return mockCustomers[index];
  },

  async getSalesOrders() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.salesOrder.findMany({
          include: { customer: true, createdBy: { include: { profile: true } }, items: { include: { product: true } } },
        });
      } catch (err) {
        console.error("Prisma error in getSalesOrders, using mock fallback:", err);
      }
    }

    return mockSalesOrders.map((so) => {
      const customer = mockCustomers.find((c) => c.id === so.customerId);
      const createdBy = mockUsers.find((u) => u.id === so.createdById);
      const profile = mockProfiles.find((p) => p.userId === so.createdById);
      const items = mockSalesOrderItems
        .filter((soi) => soi.salesOrderId === so.id)
        .map((soi) => {
          const product = mockProducts.find((p) => p.id === soi.productId);
          return { ...soi, product };
        });
      return { ...so, customer, createdBy: { ...createdBy, profile }, items };
    });
  },

  async createSalesOrder(data: { customerId: string; createdById: string; items: { productId: string; quantity: number }[] }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.$transaction(async (tx) => {
          // Generate a sequential order number
          const count = await tx.salesOrder.count();
          const orderNum = `SO-2026-${String(count + 1).padStart(4, "0")}`;

          // Resolve product prices and compute order lines
          const itemsData = [];
          let totalAmount = 0;

          for (const item of data.items) {
            const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
            const lineTotal = Number(product.price) * item.quantity;
            totalAmount += lineTotal;
            itemsData.push({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: product.price,
              totalPrice: lineTotal,
            });
          }

          // Create the Sales Order
          const salesOrder = await tx.salesOrder.create({
            data: {
              orderNumber: orderNum,
              customerId: data.customerId,
              status: SalesOrderStatus.CONFIRMED,
              totalAmount,
              createdById: data.createdById,
              items: {
                create: itemsData,
              },
            },
            include: { items: true },
          });

          // Generate corresponding Invoice automatically
          const invCount = await tx.invoice.count();
          await tx.invoice.create({
            data: {
              invoiceNumber: `INV-2026-${String(invCount + 1).padStart(4, "0")}`,
              salesOrderId: salesOrder.id,
              amount: totalAmount,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Net 30
            },
          });

          // Update Stock Levels as OUTGOING stock movement (Warehouse: WH-MAIN)
          for (const item of data.items) {
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                warehouseId: "w-main", // Default
                quantityChange: -item.quantity,
                type: StockMovementType.OUTGOING,
                referenceNumber: orderNum,
                description: `Fulfill order ${orderNum}`,
                createdById: data.createdById,
              },
            });

            await tx.stockLevel.upsert({
              where: { productId_warehouseId: { productId: item.productId, warehouseId: "w-main" } },
              create: { productId: item.productId, warehouseId: "w-main", quantity: -item.quantity },
              update: { quantity: { decrement: item.quantity } },
            });
          }

          return salesOrder;
        });
      } catch (err) {
        console.error("Prisma transaction failed for creating sales order, using mock fallback:", err);
      }
    }

    // In-Memory Fallback Implementation
    const orderId = "so-" + Math.random().toString(36).substring(2, 9);
    const orderNum = `SO-2026-${String(mockSalesOrders.length + 1).padStart(4, "0")}`;
    let totalAmount = 0;
    const itemsData = [] as any[];

    for (const item of data.items) {
      const prod = mockProducts.find((p) => p.id === item.productId);
      if (!prod) throw new Error("Product not found: " + item.productId);
      const lineTotal = prod.price * item.quantity;
      totalAmount += lineTotal;
      itemsData.push({
        id: "soi-" + Math.random().toString(36).substring(2, 9),
        salesOrderId: orderId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: prod.price,
        totalPrice: lineTotal,
      });
    }

    const order = { id: orderId, orderNumber: orderNum, customerId: data.customerId, status: SalesOrderStatus.CONFIRMED, totalAmount, createdById: data.createdById, createdAt: new Date(), updatedAt: new Date() };
    mockSalesOrders.push(order);
    mockSalesOrderItems.push(...itemsData);

    // Create Invoice
    const invId = "inv-" + Math.random().toString(36).substring(2, 9);
    const invNum = `INV-2026-${String(mockInvoices.length + 1).padStart(4, "0")}`;
    mockInvoices.push({
      id: invId,
      invoiceNumber: invNum,
      salesOrderId: orderId,
      subtotal: totalAmount,
      taxRate: 0.00,
      taxAmount: 0.00,
      discountRate: 0.00,
      discountAmount: 0.00,
      amount: totalAmount,
      status: InvoiceStatus.UNPAID,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Deduct stock levels in WH-MAIN
    for (const item of data.items) {
      const movementId = "sm-" + Math.random().toString(36).substring(2, 9);
      mockStockMovements.push({
        id: movementId,
        productId: item.productId,
        warehouseId: "w-main",
        quantityChange: -item.quantity,
        type: StockMovementType.OUTGOING,
        referenceNumber: orderNum,
        description: `Fulfill sales order ${orderNum}`,
        createdById: data.createdById,
        createdAt: new Date(),
      });

      const existingSL = mockStockLevels.find((sl) => sl.productId === item.productId && sl.warehouseId === "w-main");
      if (existingSL) {
        existingSL.quantity = Number(existingSL.quantity) - item.quantity;
        existingSL.updatedAt = new Date();
      }
    }

    return { ...order, items: itemsData };
  },

  async getInvoices() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.invoice.findMany({
          include: { salesOrder: { include: { customer: true } }, payments: true },
        });
      } catch (err) {
        console.error("Prisma error in getInvoices, using mock fallback:", err);
      }
    }
    return mockInvoices.map((inv) => {
      const salesOrder = mockSalesOrders.find((so) => so.id === inv.salesOrderId);
      const customer = salesOrder ? mockCustomers.find((c) => c.id === salesOrder.customerId) : null;
      const payments = mockPayments.filter((p) => p.invoiceId === inv.id);
      return { ...inv, salesOrder: { ...salesOrder, customer }, payments };
    });
  },

  async getInvoiceById(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.invoice.findUnique({
          where: { id },
          include: {
            salesOrder: {
              include: {
                customer: true,
                createdBy: { include: { profile: true } },
                items: { include: { product: true } }
              }
            },
            payments: true
          }
        });
      } catch (err) {
        console.error("Prisma error in getInvoiceById:", err);
      }
    }

    const inv = mockInvoices.find((i) => i.id === id);
    if (!inv) return null;

    const salesOrder = mockSalesOrders.find((so) => so.id === inv.salesOrderId);
    const customer = salesOrder ? mockCustomers.find((c) => c.id === salesOrder.customerId) : null;
    const createdBy = salesOrder ? mockUsers.find((u) => u.id === salesOrder.createdById) : null;
    const profile = salesOrder ? mockProfiles.find((p) => p.userId === salesOrder.createdById) : null;
    const items = mockSalesOrderItems
      .filter((soi) => soi.salesOrderId === inv.salesOrderId)
      .map((soi) => {
        const product = mockProducts.find((p) => p.id === soi.productId);
        return { ...soi, product };
      });
    const payments = mockPayments.filter((p) => p.invoiceId === inv.id);

    return {
      ...inv,
      salesOrder: {
        ...salesOrder,
        customer,
        createdBy: { ...createdBy, profile },
        items
      },
      payments
    };
  },

  async updateInvoiceAttachment(id: string, attachmentUrl: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.invoice.update({
          where: { id },
          data: { attachmentUrl },
        });
      } catch (err) {
        console.error("Prisma error in updateInvoiceAttachment, using mock fallback:", err);
      }
    }

    const index = mockInvoices.findIndex((i) => i.id === id);
    if (index === -1) return null;

    mockInvoices[index].attachmentUrl = attachmentUrl;
    mockInvoices[index].updatedAt = new Date();
    return mockInvoices[index];
  },

  async getInvoicesPaged(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const whereClause: any = {};
        if (search) {
          whereClause.OR = [
            { invoiceNumber: { contains: search, mode: "insensitive" } },
            {
              salesOrder: {
                customer: {
                  OR: [
                    { companyName: { contains: search, mode: "insensitive" } },
                    { contactName: { contains: search, mode: "insensitive" } }
                  ]
                }
              }
            }
          ];
        }

        const [invoices, total] = await Promise.all([
          prisma.invoice.findMany({
            where: whereClause,
            include: {
              salesOrder: {
                include: { customer: true, createdBy: { include: { profile: true } } }
              },
              payments: true
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" }
          }),
          prisma.invoice.count({ where: whereClause })
        ]);

        return { invoices, total, page, limit };
      } catch (err) {
        console.error("Prisma error in getInvoicesPaged, using mock fallback:", err);
      }
    }

    // Mock Fallback
    let filtered = [...mockInvoices];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((inv) => {
        const salesOrder = mockSalesOrders.find((so) => so.id === inv.salesOrderId);
        const customer = salesOrder ? mockCustomers.find((c) => c.id === salesOrder.customerId) : null;
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          (customer?.companyName && customer.companyName.toLowerCase().includes(q)) ||
          (customer?.contactName && customer.contactName.toLowerCase().includes(q))
        );
      });
    }

    const total = filtered.length;
    const sorted = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    const invoicesWithRelations = paginated.map((inv) => {
      const salesOrder = mockSalesOrders.find((so) => so.id === inv.salesOrderId);
      const customer = salesOrder ? mockCustomers.find((c) => c.id === salesOrder.customerId) : null;
      const createdBy = salesOrder ? mockUsers.find((u) => u.id === salesOrder.createdById) : null;
      const profile = salesOrder ? mockProfiles.find((p) => p.userId === salesOrder?.createdById) : null;
      const payments = mockPayments.filter((p) => p.invoiceId === inv.id);

      return {
        ...inv,
        salesOrder: {
          ...salesOrder,
          customer,
          createdBy: { ...createdBy, profile }
        },
        payments
      };
    });

    return {
      invoices: invoicesWithRelations,
      total,
      page,
      limit
    };
  },

  async createSalesInvoice(data: {
    customerId: string;
    createdById: string;
    items: { productId: string; quantity: number }[];
    taxRate?: number;
    discountRate?: number;
  }) {
    const isDbReachable = await checkDatabaseConnection();
    const taxRate = data.taxRate || 0;
    const discountRate = data.discountRate || 0;

    if (isDbReachable && prisma) {
      try {
        return await prisma.$transaction(async (tx) => {
          // 1. Generate sequential SO number
          const soCount = await tx.salesOrder.count();
          const orderNum = `SO-2026-${String(soCount + 1).padStart(4, "0")}`;

          // 2. Fetch product info and calculate subtotal
          const itemsData = [];
          let subtotal = 0;

          for (const item of data.items) {
            const product = await tx.product.findUniqueOrThrow({
              where: { id: item.productId }
            });
            const lineTotal = Number(product.price) * item.quantity;
            subtotal += lineTotal;

            itemsData.push({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: product.price,
              totalPrice: lineTotal
            });
          }

          // 3. Calculate tax and discount
          const discountAmount = subtotal * (discountRate / 100);
          const taxableAmount = subtotal - discountAmount;
          const taxAmount = taxableAmount * (taxRate / 100);
          const totalAmount = taxableAmount + taxAmount;

          // 4. Create Sales Order
          const salesOrder = await tx.salesOrder.create({
            data: {
              orderNumber: orderNum,
              customerId: data.customerId,
              status: SalesOrderStatus.CONFIRMED,
              totalAmount: totalAmount,
              createdById: data.createdById,
              items: {
                create: itemsData
              }
            },
            include: {
              items: { include: { product: true } },
              customer: true,
              createdBy: { include: { profile: true } }
            }
          });

          // 5. Generate Invoice
          const invCount = await tx.invoice.count();
          const invoiceNumber = `INV-2026-${String(invCount + 1).padStart(4, "0")}`;

          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber,
              salesOrderId: salesOrder.id,
              subtotal,
              taxRate,
              taxAmount,
              discountRate,
              discountAmount,
              amount: totalAmount,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Net 30
              status: InvoiceStatus.UNPAID
            },
            include: {
              payments: true
            }
          });

          // 6. Deduct inventory from StockLevel & Log StockMovement
          for (const item of data.items) {
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                warehouseId: "w-main",
                quantityChange: -item.quantity,
                type: StockMovementType.OUTGOING,
                referenceNumber: invoiceNumber,
                description: `Sales Invoice ${invoiceNumber} deduction`,
                createdById: data.createdById
              }
            });

            await tx.stockLevel.upsert({
              where: { productId_warehouseId: { productId: item.productId, warehouseId: "w-main" } },
              create: { productId: item.productId, warehouseId: "w-main", quantity: -item.quantity },
              update: { quantity: { decrement: item.quantity } }
            });
          }

          return {
            ...invoice,
            salesOrder
          };
        });
      } catch (err: any) {
        console.error("Prisma transaction failed for creating sales invoice:", err);
        throw err;
      }
    }

    // Mock implementation
    const orderId = "so-" + Math.random().toString(36).substring(2, 9);
    const orderNum = `SO-2026-${String(mockSalesOrders.length + 1).padStart(4, "0")}`;
    const invId = "inv-" + Math.random().toString(36).substring(2, 9);
    const invoiceNumber = `INV-2026-${String(mockInvoices.length + 1).padStart(4, "0")}`;

    let subtotal = 0;
    const itemsData = [] as any[];

    for (const item of data.items) {
      const prod = mockProducts.find((p) => p.id === item.productId);
      if (!prod) throw new Error("Product not found: " + item.productId);
      const lineTotal = prod.price * item.quantity;
      subtotal += lineTotal;

      itemsData.push({
        id: "soi-" + Math.random().toString(36).substring(2, 9),
        salesOrderId: orderId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: prod.price,
        totalPrice: lineTotal,
        product: prod
      });
    }

    const discountAmount = subtotal * (discountRate / 100);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * (taxRate / 100);
    const totalAmount = taxableAmount + taxAmount;

    const order = {
      id: orderId,
      orderNumber: orderNum,
      customerId: data.customerId,
      status: SalesOrderStatus.CONFIRMED,
      totalAmount,
      createdById: data.createdById,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockSalesOrders.push(order);
    mockSalesOrderItems.push(...itemsData.map(it => {
      const { product, ...rest } = it;
      return rest;
    }));

    const invoice = {
      id: invId,
      invoiceNumber,
      salesOrderId: orderId,
      subtotal,
      taxRate,
      taxAmount,
      discountRate,
      discountAmount,
      amount: totalAmount,
      status: InvoiceStatus.UNPAID,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockInvoices.push(invoice);

    // Deduct stock levels in WH-MAIN & Log StockMovement
    for (const item of data.items) {
      const movementId = "sm-" + Math.random().toString(36).substring(2, 9);
      mockStockMovements.push({
        id: movementId,
        productId: item.productId,
        warehouseId: "w-main",
        quantityChange: -item.quantity,
        type: StockMovementType.OUTGOING,
        referenceNumber: invoiceNumber,
        description: `Sales Invoice ${invoiceNumber} deduction`,
        createdById: data.createdById,
        createdAt: new Date()
      });

      const existingSL = mockStockLevels.find((sl) => sl.productId === item.productId && sl.warehouseId === "w-main");
      if (existingSL) {
        existingSL.quantity = Number(existingSL.quantity) - item.quantity;
        existingSL.updatedAt = new Date();
      } else {
        mockStockLevels.push({
          id: "sl-" + Math.random().toString(36).substring(2, 9),
          productId: item.productId,
          warehouseId: "w-main",
          quantity: -item.quantity,
          reorderPoint: 10,
          minStock: 0,
          maxStock: 1000,
          updatedAt: new Date()
        });
      }
    }

    const customer = mockCustomers.find((c) => c.id === data.customerId);
    const createdBy = mockUsers.find((u) => u.id === data.createdById);
    const profile = mockProfiles.find((p) => p.userId === data.createdById);

    return {
      ...invoice,
      salesOrder: {
        ...order,
        customer,
        createdBy: { ...createdBy, profile },
        items: itemsData
      },
      payments: []
    };
  },

  async getDailySales(params: { startDate?: Date; endDate?: Date }) {
    const isDbReachable = await checkDatabaseConnection();
    const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // default last 30 days
    const endDate = params.endDate || new Date();

    if (isDbReachable && prisma) {
      try {
        const invoices = await prisma.invoice.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          orderBy: { createdAt: "asc" }
        });

        const dailyMap = new Map<string, { date: string; totalSales: number; invoiceCount: number; totalTax: number; totalDiscount: number }>();

        for (const inv of invoices) {
          const dateStr = inv.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
          const current = dailyMap.get(dateStr) || { date: dateStr, totalSales: 0, invoiceCount: 0, totalTax: 0, totalDiscount: 0 };

          current.totalSales += Number(inv.amount);
          current.invoiceCount += 1;
          current.totalTax += Number(inv.taxAmount);
          current.totalDiscount += Number(inv.discountAmount);

          dailyMap.set(dateStr, current);
        }

        return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      } catch (err) {
        console.error("Prisma error in getDailySales:", err);
      }
    }

    // Mock daily sales reporting
    const dailyMap = new Map<string, { date: string; totalSales: number; invoiceCount: number; totalTax: number; totalDiscount: number }>();
    const start = startDate.getTime();
    const end = endDate.getTime();

    for (const inv of mockInvoices) {
      const invTime = inv.createdAt.getTime();
      if (invTime >= start && invTime <= end) {
        const dateStr = inv.createdAt.toISOString().slice(0, 10);
        const current = dailyMap.get(dateStr) || { date: dateStr, totalSales: 0, invoiceCount: 0, totalTax: 0, totalDiscount: 0 };

        current.totalSales += Number(inv.amount);
        current.invoiceCount += 1;
        current.totalTax += Number(inv.taxAmount || 0);
        current.totalDiscount += Number(inv.discountAmount || 0);

        dailyMap.set(dateStr, current);
      }
    }

    if (dailyMap.size === 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
      dailyMap.set(todayStr, { date: todayStr, totalSales: 4350.00, invoiceCount: 1, totalTax: 0, totalDiscount: 0 });
    }

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  },

  async getMonthlySales(year?: number) {
    const isDbReachable = await checkDatabaseConnection();
    const targetYear = year || new Date().getFullYear();

    if (isDbReachable && prisma) {
      try {
        const startOfYear = new Date(targetYear, 0, 1);
        const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

        const invoices = await prisma.invoice.findMany({
          where: {
            createdAt: {
              gte: startOfYear,
              lte: endOfYear
            }
          },
          orderBy: { createdAt: "asc" }
        });

        const monthlyMap = new Map<string, { month: string; totalSales: number; invoiceCount: number; totalTax: number; totalDiscount: number }>();

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (let i = 0; i < 12; i++) {
          const mKey = `${targetYear}-${String(i + 1).padStart(2, "0")}`;
          monthlyMap.set(mKey, { month: monthNames[i], totalSales: 0, invoiceCount: 0, totalTax: 0, totalDiscount: 0 });
        }

        for (const inv of invoices) {
          const monthIndex = inv.createdAt.getMonth();
          const mKey = `${targetYear}-${String(monthIndex + 1).padStart(2, "0")}`;
          const current = monthlyMap.get(mKey)!;

          current.totalSales += Number(inv.amount);
          current.invoiceCount += 1;
          current.totalTax += Number(inv.taxAmount);
          current.totalDiscount += Number(inv.discountAmount);

          monthlyMap.set(mKey, current);
        }

        return Array.from(monthlyMap.values());
      } catch (err) {
        console.error("Prisma error in getMonthlySales:", err);
      }
    }

    const monthlyMap = new Map<string, { month: string; totalSales: number; invoiceCount: number; totalTax: number; totalDiscount: number }>();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 12; i++) {
      const mKey = `${targetYear}-${String(i + 1).padStart(2, "0")}`;
      monthlyMap.set(mKey, { month: monthNames[i], totalSales: 0, invoiceCount: 0, totalTax: 0, totalDiscount: 0 });
    }

    for (const inv of mockInvoices) {
      if (inv.createdAt.getFullYear() === targetYear) {
        const monthIndex = inv.createdAt.getMonth();
        const mKey = `${targetYear}-${String(monthIndex + 1).padStart(2, "0")}`;
        const current = monthlyMap.get(mKey);
        if (current) {
          current.totalSales += Number(inv.amount);
          current.invoiceCount += 1;
          current.totalTax += Number(inv.taxAmount || 0);
          current.totalDiscount += Number(inv.discountAmount || 0);
          monthlyMap.set(mKey, current);
        }
      }
    }

    return Array.from(monthlyMap.values());
  },

  // 5. PURCHASING DOMAIN
  async getSuppliers() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.supplier.findMany({ where: { isDeleted: false } });
      } catch (err) {
        console.error("Prisma error in getSuppliers, using mock fallback:", err);
      }
    }
    return mockSuppliers.filter((s) => !s.isDeleted);
  },

  async getSuppliersPaged(params: { page: number; limit: number; search?: string }) {
    const isDbReachable = await checkDatabaseConnection();
    const skip = (params.page - 1) * params.limit;
    const take = params.limit;

    if (isDbReachable && prisma) {
      try {
        const whereClause: any = {
          isDeleted: false,
        };

        if (params.search) {
          whereClause.OR = [
            { companyName: { contains: params.search, mode: "insensitive" } },
            { contactName: { contains: params.search, mode: "insensitive" } },
            { email: { contains: params.search, mode: "insensitive" } },
            { phone: { contains: params.search, mode: "insensitive" } },
            { address: { contains: params.search, mode: "insensitive" } },
          ];
        }

        const [suppliers, total] = await Promise.all([
          prisma.supplier.findMany({
            where: whereClause,
            skip,
            take,
            orderBy: { companyName: "asc" },
            include: {
              supplierProducts: {
                include: {
                  product: true
                }
              }
            }
          }),
          prisma.supplier.count({ where: whereClause }),
        ]);

        return { suppliers, total };
      } catch (err) {
        console.error("Prisma error in getSuppliersPaged, using mock fallback:", err);
      }
    }

    // Mock fallback
    let filtered = mockSuppliers.filter((s) => !s.isDeleted);
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.companyName.toLowerCase().includes(q) ||
          (s.contactName && s.contactName.toLowerCase().includes(q)) ||
          s.email.toLowerCase().includes(q) ||
          (s.phone && s.phone.toLowerCase().includes(q)) ||
          (s.address && s.address.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const pagedSuppliers = filtered.slice(skip, skip + take).map((s) => {
      const supplierProducts = mockSupplierProducts
        .filter((sp) => sp.supplierId === s.id)
        .map((sp) => {
          const product = mockProducts.find((p) => p.id === sp.productId);
          return { ...sp, product };
        });
      return { ...s, supplierProducts };
    });

    return { suppliers: pagedSuppliers, total };
  },

  async getSupplierById(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.supplier.findFirst({
          where: { id, isDeleted: false },
          include: {
            supplierProducts: {
              include: {
                product: true,
              },
            },
          },
        });
      } catch (err) {
        console.error("Prisma error in getSupplierById, using mock fallback:", err);
      }
    }

    const supplier = mockSuppliers.find((s) => s.id === id && !s.isDeleted);
    if (!supplier) return null;

    const supplierProducts = mockSupplierProducts
      .filter((sp) => sp.supplierId === supplier.id)
      .map((sp) => {
        const product = mockProducts.find((p) => p.id === sp.productId);
        return { ...sp, product };
      });

    return { ...supplier, supplierProducts };
  },

  async createSupplier(data: { companyName: string; contactName?: string; email: string; phone?: string; address?: string }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.supplier.create({
          data: {
            companyName: data.companyName,
            contactName: data.contactName,
            email: data.email,
            phone: data.phone,
            address: data.address,
            isDeleted: false,
          },
        });
      } catch (err) {
        console.error("Prisma error in createSupplier, using mock fallback:", err);
      }
    }

    // Check email unique
    const existing = mockSuppliers.find((s) => s.email.toLowerCase() === data.email.toLowerCase() && !s.isDeleted);
    if (existing) {
      throw new Error("A supplier with this email already exists.");
    }

    const newSupplier = {
      id: "sup-" + Math.random().toString(36).substring(2, 9),
      companyName: data.companyName,
      contactName: data.contactName || null,
      email: data.email,
      phone: data.phone || null,
      address: data.address || null,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockSuppliers.push(newSupplier);
    return newSupplier;
  },

  async updateSupplier(id: string, data: { companyName?: string; contactName?: string; email?: string; phone?: string; address?: string }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.supplier.update({
          where: { id },
          data,
        });
      } catch (err) {
        console.error("Prisma error in updateSupplier, using mock fallback:", err);
      }
    }

    const supplierIndex = mockSuppliers.findIndex((s) => s.id === id && !s.isDeleted);
    if (supplierIndex === -1) {
      throw new Error("Supplier not found.");
    }

    if (data.email) {
      const existing = mockSuppliers.find((s) => s.email.toLowerCase() === data.email!.toLowerCase() && s.id !== id && !s.isDeleted);
      if (existing) {
        throw new Error("A supplier with this email already exists.");
      }
    }

    const existingSupplier = mockSuppliers[supplierIndex];
    const updated = {
      ...existingSupplier,
      ...data,
      updatedAt: new Date(),
    };

    mockSuppliers[supplierIndex] = updated as any;
    return updated;
  },

  async deleteSupplier(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.supplier.update({
          where: { id },
          data: { isDeleted: true },
        });
      } catch (err) {
        console.error("Prisma error in deleteSupplier, using mock fallback:", err);
      }
    }

    const supplier = mockSuppliers.find((s) => s.id === id && !s.isDeleted);
    if (!supplier) {
      throw new Error("Supplier not found.");
    }

    supplier.isDeleted = true;
    supplier.updatedAt = new Date();
    return supplier;
  },

  async getSupplierProducts(supplierId: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.supplierProduct.findMany({
          where: { supplierId },
          include: { product: true },
        });
      } catch (err) {
        console.error("Prisma error in getSupplierProducts, using mock fallback:", err);
      }
    }

    return mockSupplierProducts
      .filter((sp) => sp.supplierId === supplierId)
      .map((sp) => {
        const product = mockProducts.find((p) => p.id === sp.productId);
        return { ...sp, product };
      });
  },

  async addSupplierProduct(data: { supplierId: string; productId: string; price: number; leadTimeDays?: number }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.supplierProduct.upsert({
          where: {
            supplierId_productId: { supplierId: data.supplierId, productId: data.productId },
          },
          update: {
            price: data.price,
            leadTimeDays: data.leadTimeDays || 3,
          },
          create: {
            supplierId: data.supplierId,
            productId: data.productId,
            price: data.price,
            leadTimeDays: data.leadTimeDays || 3,
          },
          include: { product: true },
        });
      } catch (err) {
        console.error("Prisma error in addSupplierProduct, using mock fallback:", err);
      }
    }

    const existingIndex = mockSupplierProducts.findIndex(
      (sp) => sp.supplierId === data.supplierId && sp.productId === data.productId
    );

    if (existingIndex !== -1) {
      mockSupplierProducts[existingIndex].price = data.price;
      mockSupplierProducts[existingIndex].leadTimeDays = data.leadTimeDays || 3;
      mockSupplierProducts[existingIndex].updatedAt = new Date();
      const sp = mockSupplierProducts[existingIndex];
      const product = mockProducts.find((p) => p.id === sp.productId);
      return { ...sp, product };
    } else {
      const newSP = {
        id: "sp-" + Math.random().toString(36).substring(2, 9),
        supplierId: data.supplierId,
        productId: data.productId,
        price: data.price,
        leadTimeDays: data.leadTimeDays || 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSupplierProducts.push(newSP);
      const product = mockProducts.find((p) => p.id === newSP.productId);
      return { ...newSP, product };
    }
  },

  async removeSupplierProduct(supplierId: string, productId: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.supplierProduct.delete({
          where: {
            supplierId_productId: { supplierId, productId },
          },
        });
      } catch (err) {
        console.error("Prisma error in removeSupplierProduct, using mock fallback:", err);
      }
    }

    const index = mockSupplierProducts.findIndex(
      (sp) => sp.supplierId === supplierId && sp.productId === productId
    );
    if (index === -1) {
      throw new Error("Supplier product mapping not found.");
    }

    const [removed] = mockSupplierProducts.splice(index, 1);
    return removed;
  },

  async getSupplierPurchaseHistory(supplierId: string, params: { page: number; limit: number }) {
    const isDbReachable = await checkDatabaseConnection();
    const skip = (params.page - 1) * params.limit;
    const take = params.limit;

    if (isDbReachable && prisma) {
      try {
        const [purchaseOrders, total] = await Promise.all([
          prisma.purchaseOrder.findMany({
            where: { supplierId },
            skip,
            take,
            orderBy: { createdAt: "desc" },
            include: {
              items: {
                include: { product: true },
              },
            },
          }),
          prisma.purchaseOrder.count({ where: { supplierId } }),
        ]);

        return { purchaseOrders, total };
      } catch (err) {
        console.error("Prisma error in getSupplierPurchaseHistory, using mock fallback:", err);
      }
    }

    const filtered = mockPurchaseOrders.filter((po) => po.supplierId === supplierId);
    const total = filtered.length;
    const pagedPOs = filtered.slice(skip, skip + take).map((po) => {
      const items = mockPurchaseOrderItems
        .filter((poi) => poi.purchaseOrderId === po.id)
        .map((poi) => {
          const product = mockProducts.find((p) => p.id === poi.productId);
          return { ...poi, product };
        });
      return { ...po, items };
    });

    return { purchaseOrders: pagedPOs, total };
  },

  async getPurchaseOrders() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.purchaseOrder.findMany({
          include: { supplier: true, createdBy: { include: { profile: true } }, items: { include: { product: true } } },
        });
      } catch (err) {
        console.error("Prisma error in getPurchaseOrders, using mock fallback:", err);
      }
    }

    return mockPurchaseOrders.map((po) => {
      const supplier = mockSuppliers.find((s) => s.id === po.supplierId);
      const createdBy = mockUsers.find((u) => u.id === po.createdById);
      const profile = mockProfiles.find((p) => p.userId === po.createdById);
      const items = mockPurchaseOrderItems
        .filter((poi) => poi.purchaseOrderId === po.id)
        .map((poi) => {
          const product = mockProducts.find((p) => p.id === poi.productId);
          return { ...poi, product };
        });
      return { ...po, supplier, createdBy: { ...createdBy, profile }, items };
    });
  },

  async createPurchaseOrder(data: { supplierId: string; createdById: string; items: { productId: string; quantity: number }[] }) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.$transaction(async (tx) => {
          const count = await tx.purchaseOrder.count();
          const poNum = `PO-2026-${String(count + 1).padStart(4, "0")}`;

          const itemsData = [];
          let totalAmount = 0;

          for (const item of data.items) {
            const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
            const lineTotal = Number(product.cost) * item.quantity;
            totalAmount += lineTotal;
            itemsData.push({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: product.cost,
              totalPrice: lineTotal,
            });
          }

          const purchaseOrder = await tx.purchaseOrder.create({
            data: {
              poNumber: poNum,
              supplierId: data.supplierId,
              status: PurchaseOrderStatus.PENDING,
              totalAmount,
              createdById: data.createdById,
              items: {
                create: itemsData,
              },
            },
            include: {
              items: { include: { product: true } },
              supplier: true,
              createdBy: { include: { profile: true } },
            },
          });

          return purchaseOrder;
        });
      } catch (err) {
        console.error("Prisma transaction failed for creating PO, using mock fallback:", err);
      }
    }

    // In-Memory Fallback
    const orderId = "po-" + Math.random().toString(36).substring(2, 9);
    const poNum = `PO-2026-${String(mockPurchaseOrders.length + 1).padStart(4, "0")}`;
    let totalAmount = 0;
    const itemsData = [] as any[];

    for (const item of data.items) {
      const prod = mockProducts.find((p) => p.id === item.productId);
      if (!prod) throw new Error("Product not found: " + item.productId);
      const lineTotal = prod.cost * item.quantity;
      totalAmount += lineTotal;
      itemsData.push({
        id: "poi-" + Math.random().toString(36).substring(2, 9),
        purchaseOrderId: orderId,
        productId: item.productId,
        quantity: item.quantity,
        unitCost: prod.cost,
        totalPrice: lineTotal,
      });
    }

    const order = {
      id: orderId,
      poNumber: poNum,
      supplierId: data.supplierId,
      status: PurchaseOrderStatus.PENDING,
      totalAmount,
      createdById: data.createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPurchaseOrders.push(order);
    mockPurchaseOrderItems.push(...itemsData);

    const itemsWithProd = itemsData.map((item) => {
      const product = mockProducts.find((p) => p.id === item.productId);
      return { ...item, product };
    });

    const supplier = mockSuppliers.find((s) => s.id === data.supplierId);
    const createdBy = mockUsers.find((u) => u.id === data.createdById);
    const profile = mockProfiles.find((p) => p.userId === data.createdById);

    return { ...order, items: itemsWithProd, supplier, createdBy: { ...createdBy, profile } };
  },

  async getPurchaseOrderById(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.purchaseOrder.findUnique({
          where: { id },
          include: {
            supplier: true,
            createdBy: { include: { profile: true } },
            items: {
              include: { product: true },
            },
          },
        });
      } catch (err) {
        console.error("Prisma error in getPurchaseOrderById, using mock fallback:", err);
      }
    }

    const po = mockPurchaseOrders.find((p) => p.id === id);
    if (!po) return null;

    const supplier = mockSuppliers.find((s) => s.id === po.supplierId);
    const createdBy = mockUsers.find((u) => u.id === po.createdById);
    const profile = mockProfiles.find((p) => p.userId === po.createdById);
    const items = mockPurchaseOrderItems
      .filter((poi) => poi.purchaseOrderId === po.id)
      .map((poi) => {
        const product = mockProducts.find((p) => p.id === poi.productId);
        return { ...poi, product };
      });
    return { ...po, supplier, createdBy: { ...createdBy, profile }, items };
  },

  async updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.purchaseOrder.update({
          where: { id },
          data: { status },
          include: {
            supplier: true,
            createdBy: { include: { profile: true } },
            items: {
              include: { product: true },
            },
          },
        });
      } catch (err) {
        console.error("Prisma error in updatePurchaseOrderStatus, using mock fallback:", err);
      }
    }

    const poIndex = mockPurchaseOrders.findIndex((p) => p.id === id);
    if (poIndex === -1) {
      throw new Error("Purchase order not found");
    }

    mockPurchaseOrders[poIndex].status = status;
    mockPurchaseOrders[poIndex].updatedAt = new Date();

    const po = mockPurchaseOrders[poIndex];
    const supplier = mockSuppliers.find((s) => s.id === po.supplierId);
    const createdBy = mockUsers.find((u) => u.id === po.createdById);
    const profile = mockProfiles.find((p) => p.userId === po.createdById);
    const items = mockPurchaseOrderItems
      .filter((poi) => poi.purchaseOrderId === po.id)
      .map((poi) => {
        const product = mockProducts.find((p) => p.id === poi.productId);
        return { ...poi, product };
      });
    return { ...po, supplier, createdBy: { ...createdBy, profile }, items };
  },

  async receivePurchaseOrder(id: string, receivedById: string, warehouseId: string = "w-main") {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.$transaction(async (tx) => {
          const po = await tx.purchaseOrder.findUniqueOrThrow({
            where: { id },
            include: { items: true },
          });

          if (po.status === PurchaseOrderStatus.RECEIVED) {
            throw new Error("Purchase order has already been received.");
          }
          if (po.status === PurchaseOrderStatus.CANCELLED) {
            throw new Error("Cannot receive a cancelled purchase order.");
          }
          if (po.status !== PurchaseOrderStatus.APPROVED) {
            throw new Error("Purchase order must be APPROVED before it can be received.");
          }

          const warehouseExists = await tx.warehouse.findUnique({ where: { id: warehouseId } });
          const targetWarehouseId = warehouseExists ? warehouseId : "w-main";

          const updatedPO = await tx.purchaseOrder.update({
            where: { id },
            data: { status: PurchaseOrderStatus.RECEIVED },
            include: {
              supplier: true,
              createdBy: { include: { profile: true } },
              items: { include: { product: true } },
            },
          });

          for (const item of po.items) {
            const qty = Number(item.quantity);

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                warehouseId: targetWarehouseId,
                quantityChange: qty,
                type: StockMovementType.INCOMING,
                referenceNumber: po.poNumber,
                description: `Received goods for PO ${po.poNumber}`,
                createdById: receivedById,
              },
            });

            await tx.stockLevel.upsert({
              where: {
                productId_warehouseId: {
                  productId: item.productId,
                  warehouseId: targetWarehouseId,
                },
              },
              create: {
                productId: item.productId,
                warehouseId: targetWarehouseId,
                quantity: qty,
              },
              update: {
                quantity: { increment: qty },
              },
            });
          }

          return updatedPO;
        });
      } catch (err: any) {
        console.error("Prisma transaction failed for receiving PO:", err);
        throw err;
      }
    }

    const poIndex = mockPurchaseOrders.findIndex((p) => p.id === id);
    if (poIndex === -1) {
      throw new Error("Purchase order not found");
    }

    const po = mockPurchaseOrders[poIndex];
    if (po.status === PurchaseOrderStatus.RECEIVED) {
      throw new Error("Purchase order has already been received.");
    }
    if (po.status === PurchaseOrderStatus.CANCELLED) {
      throw new Error("Cannot receive a cancelled purchase order.");
    }
    if (po.status !== PurchaseOrderStatus.APPROVED) {
      throw new Error("Purchase order must be APPROVED before it can be received.");
    }

    po.status = PurchaseOrderStatus.RECEIVED;
    po.updatedAt = new Date();

    const poItems = mockPurchaseOrderItems.filter((poi) => poi.purchaseOrderId === id);

    for (const item of poItems) {
      mockStockMovements.push({
        id: "sm-" + Math.random().toString(36).substring(2, 9),
        productId: item.productId,
        warehouseId,
        quantityChange: item.quantity,
        type: StockMovementType.INCOMING,
        referenceNumber: po.poNumber,
        description: `Received goods for PO ${po.poNumber}`,
        createdById: receivedById,
        createdAt: new Date(),
      });

      const existingSL = mockStockLevels.find((sl) => sl.productId === item.productId && sl.warehouseId === warehouseId);
      if (existingSL) {
        existingSL.quantity = Number(existingSL.quantity) + Number(item.quantity);
        existingSL.updatedAt = new Date();
      } else {
        mockStockLevels.push({
          id: "sl-" + Math.random().toString(36).substring(2, 9),
          productId: item.productId,
          warehouseId,
          quantity: item.quantity,
          reorderPoint: 10,
          minStock: 0,
          maxStock: 1000,
          updatedAt: new Date(),
        });
      }
    }

    const supplier = mockSuppliers.find((s) => s.id === po.supplierId);
    const createdBy = mockUsers.find((u) => u.id === po.createdById);
    const profile = mockProfiles.find((p) => p.userId === po.createdById);
    const items = poItems.map((poi) => {
      const product = mockProducts.find((p) => p.id === poi.productId);
      return { ...poi, product };
    });

    return { ...po, supplier, createdBy: { ...createdBy, profile }, items };
  },

  // 6. FINANCE DOMAIN
  async getAccounts() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.account.findMany();
      } catch (err) {
        console.error("Prisma error in getAccounts, using mock fallback:", err);
      }
    }
    return mockAccounts;
  },

  async getJournalEntries() {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.journalEntry.findMany({
          include: { createdBy: { include: { profile: true } }, lines: { include: { account: true } } },
          orderBy: { date: "desc" },
        });
      } catch (err) {
        console.error("Prisma error in getJournalEntries, using mock fallback:", err);
      }
    }
    return mockJournalEntries.map((je) => {
      const createdBy = mockUsers.find((u) => u.id === je.createdById);
      const profile = mockProfiles.find((p) => p.userId === je.createdById);
      const lines = mockJournalLines
        .filter((jl) => jl.journalEntryId === je.id)
        .map((jl) => {
          const account = mockAccounts.find((a) => a.id === jl.accountId);
          return { ...jl, account };
        });
      return { ...je, createdBy: { ...createdBy, profile }, lines };
    });
  },

  async createJournalEntry(data: { description: string; createdById: string; lines: { accountId: string; debit: number; credit: number; description?: string }[] }) {
    // Audit constraints checking: Debits must match Credits exactly
    let totalDebit = 0;
    let totalCredit = 0;
    for (const l of data.lines) {
      totalDebit += l.debit;
      totalCredit += l.credit;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Accounting Rule Exception: Journal entries must balance. Debits ($${totalDebit}) must equal Credits ($${totalCredit}). Difference: $${Math.abs(totalDebit - totalCredit)}`);
    }

    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.$transaction(async (tx) => {
          const count = await tx.journalEntry.count();
          const entryNum = `JE-2026-${String(count + 1).padStart(4, "0")}`;

          const entry = await tx.journalEntry.create({
            data: {
              entryNumber: entryNum,
              description: data.description,
              status: JournalStatus.POSTED,
              createdById: data.createdById,
              lines: {
                create: data.lines.map((l) => ({
                  accountId: l.accountId,
                  debit: l.debit,
                  credit: l.credit,
                  description: l.description,
                })),
              },
            },
            include: { lines: true },
          });

          // Balance updating on Accounts
          for (const l of data.lines) {
            const acc = await tx.account.findUniqueOrThrow({ where: { id: l.accountId } });
            let balanceChange = 0;

            // Accounting rule logic:
            // ASSET & EXPENSE: Debit increases (+), Credit decreases (-)
            // LIABILITY, EQUITY, REVENUE: Debit decreases (-), Credit increases (+)
            if (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) {
              balanceChange = l.debit - l.credit;
            } else {
              balanceChange = l.credit - l.debit;
            }

            await tx.account.update({
              where: { id: l.accountId },
              data: {
                balance: { increment: balanceChange },
              },
            });
          }

          return entry;
        });
      } catch (err) {
        console.error("Prisma transaction failed for creating journal entry, using mock fallback:", err);
      }
    }

    // In-Memory Fallback
    const jeId = "je-" + Math.random().toString(36).substring(2, 9);
    const entryNum = `JE-2026-${String(mockJournalEntries.length + 1).padStart(4, "0")}`;

    const entryObj = { id: jeId, entryNumber: entryNum, date: new Date(), description: data.description, status: JournalStatus.POSTED, createdById: data.createdById, createdAt: new Date(), updatedAt: new Date() };
    mockJournalEntries.push(entryObj);

    const linesObj = data.lines.map((l) => {
      const lineId = "jl-" + Math.random().toString(36).substring(2, 9);
      const line = { id: lineId, journalEntryId: jeId, accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description || null };
      mockJournalLines.push(line);

      // Adjust mock account balances
      const acc = mockAccounts.find((a) => a.id === l.accountId);
      if (acc) {
        let balanceChange = 0;
        if (acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE) {
          balanceChange = l.debit - l.credit;
        } else {
          balanceChange = l.credit - l.debit;
        }
        acc.balance = Number(acc.balance) + balanceChange;
      }

      return line;
    });

    return { ...entryObj, lines: linesObj };
  },

  async getPaymentById(id: string) {
    const isDbReachable = await checkDatabaseConnection();
    if (isDbReachable && prisma) {
      try {
        return await prisma.payment.findUnique({
          where: { id },
          include: {
            invoice: {
              include: {
                salesOrder: {
                  include: { customer: true }
                }
              }
            }
          }
        });
      } catch (err) {
        console.error("Prisma error in getPaymentById:", err);
      }
    }

    const payment = mockPayments.find((p) => p.id === id);
    if (!payment) return null;

    const invoice = mockInvoices.find((i) => i.id === payment.invoiceId);
    const salesOrder = invoice ? mockSalesOrders.find((so) => so.id === invoice.salesOrderId) : null;
    const customer = salesOrder ? mockCustomers.find((c) => c.id === salesOrder.customerId) : null;

    return {
      ...payment,
      invoice: invoice ? {
        ...invoice,
        salesOrder: salesOrder ? { ...salesOrder, customer } : null
      } : null
    };
  },

  async getPaymentsPaged(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const whereClause: any = {};
        if (search) {
          whereClause.OR = [
            { referenceNo: { contains: search, mode: "insensitive" } },
            { paymentMethod: { contains: search, mode: "insensitive" } },
            {
              invoice: {
                OR: [
                  { invoiceNumber: { contains: search, mode: "insensitive" } },
                  {
                    salesOrder: {
                      customer: {
                        OR: [
                          { companyName: { contains: search, mode: "insensitive" } },
                          { contactName: { contains: search, mode: "insensitive" } }
                        ]
                      }
                    }
                  }
                ]
              }
            }
          ];
        }

        const [payments, total] = await Promise.all([
          prisma.payment.findMany({
            where: whereClause,
            include: {
              invoice: {
                include: {
                  salesOrder: {
                    include: { customer: true }
                  }
                }
              }
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { paymentDate: "desc" }
          }),
          prisma.payment.count({ where: whereClause })
        ]);

        return { payments, total, page, limit };
      } catch (err) {
        console.error("Prisma error in getPaymentsPaged, using mock fallback:", err);
      }
    }

    // Mock Fallback
    let filtered = [...mockPayments];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) => {
        const invoice = mockInvoices.find((i) => i.id === p.invoiceId);
        const salesOrder = invoice ? mockSalesOrders.find((so) => so.id === invoice.salesOrderId) : null;
        const customer = salesOrder ? mockCustomers.find((c) => c.id === salesOrder.customerId) : null;

        return (
          p.paymentMethod.toLowerCase().includes(q) ||
          (p.referenceNo && p.referenceNo.toLowerCase().includes(q)) ||
          (invoice?.invoiceNumber && invoice.invoiceNumber.toLowerCase().includes(q)) ||
          (customer?.companyName && customer.companyName.toLowerCase().includes(q)) ||
          (customer?.contactName && customer.contactName.toLowerCase().includes(q))
        );
      });
    }

    const total = filtered.length;
    const sorted = filtered.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
    const paginated = sorted.slice((page - 1) * limit, page * limit);

    const paymentsWithRelations = paginated.map((p) => {
      const invoice = mockInvoices.find((i) => i.id === p.invoiceId);
      const salesOrder = invoice ? mockSalesOrders.find((so) => so.id === invoice.salesOrderId) : null;
      const customer = salesOrder ? mockCustomers.find((c) => c.id === salesOrder.customerId) : null;

      return {
        ...p,
        invoice: invoice ? {
          ...invoice,
          salesOrder: salesOrder ? { ...salesOrder, customer } : null
        } : null
      };
    });

    return {
      payments: paymentsWithRelations,
      total,
      page,
      limit
    };
  },

  async createPayment(data: { invoiceId: string; amountPaid: number; paymentMethod: string; referenceNo?: string | null }) {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        return await prisma.$transaction(async (tx) => {
          // 1. Fetch invoice
          const invoice = await tx.invoice.findUniqueOrThrow({
            where: { id: data.invoiceId },
            include: { payments: true }
          });

          // 2. Calculate previous payments and outstanding balance
          const previousPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
          const totalAmount = Number(invoice.amount);
          const outstanding = totalAmount - previousPaid;

          if (outstanding <= 0) {
            throw new Error(`Invoice ${invoice.invoiceNumber} is already fully paid.`);
          }

          if (data.amountPaid > outstanding + 0.01) { // allow tiny float tolerance
            throw new Error(`Payment amount $${data.amountPaid} exceeds outstanding balance of $${outstanding.toFixed(2)}.`);
          }

          // 3. Create payment record
          const payment = await tx.payment.create({
            data: {
              invoiceId: data.invoiceId,
              amountPaid: data.amountPaid,
              paymentMethod: data.paymentMethod,
              referenceNo: data.referenceNo || null
            }
          });

          // 4. Update invoice status
          const newTotalPaid = previousPaid + data.amountPaid;
          let newStatus: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
          if (newTotalPaid >= totalAmount - 0.01) {
            newStatus = InvoiceStatus.PAID;
          }

          const updatedInvoice = await tx.invoice.update({
            where: { id: data.invoiceId },
            data: { status: newStatus },
            include: { payments: true }
          });

          return {
            ...payment,
            invoice: updatedInvoice
          };
        });
      } catch (err: any) {
        console.error("Prisma transaction failed for creating payment:", err);
        throw err;
      }
    }

    // Mock implementation
    const invoice = mockInvoices.find((i) => i.id === data.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    const previousPayments = mockPayments.filter((p) => p.invoiceId === data.invoiceId);
    const previousPaid = previousPayments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
    const totalAmount = Number(invoice.amount);
    const outstanding = totalAmount - previousPaid;

    if (outstanding <= 0) {
      throw new Error(`Invoice ${invoice.invoiceNumber} is already fully paid.`);
    }

    if (data.amountPaid > outstanding + 0.01) {
      throw new Error(`Payment amount $${data.amountPaid} exceeds outstanding balance of $${outstanding.toFixed(2)}.`);
    }

    const pId = "pay-" + Math.random().toString(36).substring(2, 9);
    const payment = {
      id: pId,
      invoiceId: data.invoiceId,
      amountPaid: data.amountPaid,
      paymentMethod: data.paymentMethod,
      referenceNo: data.referenceNo || null,
      paymentDate: new Date()
    };
    mockPayments.push(payment);

    // Update mock invoice status
    const newTotalPaid = previousPaid + data.amountPaid;
    let newStatus: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
    if (newTotalPaid >= totalAmount - 0.01) {
      newStatus = InvoiceStatus.PAID;
    }
    invoice.status = newStatus;
    invoice.updatedAt = new Date();

    return {
      ...payment,
      invoice
    };
  }
};
