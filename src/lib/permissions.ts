export type Role = "ADMIN" | "MANAGER" | "ACCOUNTANT" | "EMPLOYEE";

export const PERMISSIONS = {
  // Products Module
  PRODUCTS_READ: "products.read",
  PRODUCTS_WRITE: "products.write",
  
  // Inventory Module
  INVENTORY_READ: "inventory.read",
  INVENTORY_UPDATE: "inventory.update",
  
  // Sales Module
  SALES_READ: "sales.read",
  SALES_WRITE: "sales.write",
  
  // CRM / Customers Module
  CRM_READ: "crm.read",
  CRM_WRITE: "crm.write",
  
  // Purchasing Module
  PURCHASING_READ: "purchasing.read",
  PURCHASING_WRITE: "purchasing.write",
  
  // Suppliers Module
  SUPPLIERS_READ: "suppliers.read",
  SUPPLIERS_WRITE: "suppliers.write",
  
  // HR Module
  HR_READ: "hr.read",
  HR_WRITE: "hr.write",
  HR_SELF: "hr.self",
  
  // Payroll Module
  PAYROLL_READ: "payroll.read",
  PAYROLL_WRITE: "payroll.write",
  PAYROLL_SELF: "payroll.self",
  
  // Finance Module
  FINANCE_READ: "finance.read",
  FINANCE_WRITE: "finance.write",
  
  // Activity Logs Module
  LOGS_READ: "logs.read",
  
  // Settings Module
  SYSTEM_ADMIN: "system.admin",
};

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: Object.values(PERMISSIONS),
  
  MANAGER: [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_WRITE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.SALES_READ, // Sales Read Only
    PERMISSIONS.PURCHASING_READ,
    PERMISSIONS.PURCHASING_WRITE,
    PERMISSIONS.SUPPLIERS_READ,
    PERMISSIONS.SUPPLIERS_WRITE,
  ],
  
  ACCOUNTANT: [
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE, // Sales ✔
    PERMISSIONS.CRM_READ, // CRM Read Only
    PERMISSIONS.PURCHASING_READ, // Purchasing Read Only
    PERMISSIONS.SUPPLIERS_READ, // Suppliers Read Only
    PERMISSIONS.PAYROLL_READ,
    PERMISSIONS.PAYROLL_WRITE, // Payroll ✔
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.FINANCE_WRITE, // Finance ✔
  ],
  
  EMPLOYEE: [
    PERMISSIONS.HR_SELF,
    PERMISSIONS.PAYROLL_SELF,
  ],
};

export function hasPermission(user: { role: string } | null | undefined, permission: string): boolean {
  if (!user) return false;
  const role = user.role as Role;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

// Sidebar config based on Role & permissions
export interface SidebarItem {
  name: string;
  path: string;
  iconName: string;
  permission?: string;
}

export const SIDEBAR_CONFIG: Record<Role, SidebarItem[]> = {
  ADMIN: [
    { name: "Dashboard", path: "/admin/dashboard", iconName: "LayoutDashboard" },
    { name: "User Management", path: "/admin/users", iconName: "Shield", permission: PERMISSIONS.SYSTEM_ADMIN },
    { name: "Products & Inventory", path: "/admin/products", iconName: "Package", permission: PERMISSIONS.PRODUCTS_READ },
    { name: "Sales & Customers", path: "/admin/sales", iconName: "TrendingUp", permission: PERMISSIONS.SALES_READ },
    { name: "Purchasing & Suppliers", path: "/admin/purchasing", iconName: "ShoppingCart", permission: PERMISSIONS.PURCHASING_READ },
    { name: "HR & Employees", path: "/admin/hr", iconName: "Users", permission: PERMISSIONS.HR_READ },
    { name: "Finance & Accounting", path: "/admin/finance", iconName: "DollarSign", permission: PERMISSIONS.FINANCE_READ },
    { name: "Activity Logs", path: "/admin/logs", iconName: "FileText", permission: PERMISSIONS.LOGS_READ },
  ],
  MANAGER: [
    { name: "Dashboard", path: "/logistics/dashboard", iconName: "LayoutDashboard" },
    { name: "Products & Catalog", path: "/logistics/products", iconName: "Package", permission: PERMISSIONS.PRODUCTS_READ },
    { name: "Purchasing & Orders", path: "/logistics/purchasing", iconName: "ShoppingCart", permission: PERMISSIONS.PURCHASING_READ },
  ],
  ACCOUNTANT: [
    { name: "Dashboard", path: "/finance/dashboard", iconName: "LayoutDashboard" },
    { name: "Sales & Invoices", path: "/finance/sales", iconName: "TrendingUp", permission: PERMISSIONS.SALES_READ },
    { name: "Finance & Accounts", path: "/finance/finance", iconName: "DollarSign", permission: PERMISSIONS.FINANCE_READ },
    { name: "Payroll Ledger", path: "/finance/hr", iconName: "Users", permission: PERMISSIONS.PAYROLL_READ },
  ],
  EMPLOYEE: [
    { name: "Dashboard", path: "/employee/dashboard", iconName: "LayoutDashboard" },
    { name: "Attendance & Profile", path: "/employee/hr", iconName: "Users" },
  ],
};

export function getDefaultDashboardPath(role: string | null | undefined): string {
  if (!role) return "/login";
  switch (role) {
    case "ADMIN": return "/admin/dashboard";
    case "MANAGER": return "/logistics/dashboard";
    case "ACCOUNTANT": return "/finance/dashboard";
    case "EMPLOYEE": return "/employee/dashboard";
    default: return "/login";
  }
}
