export type UserRole = "ADMIN" | "MANAGER" | "EMPLOYEE" | "ACCOUNTANT";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  profile?: Profile;
}

export interface Profile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  address?: string | null;
  profilePhotoUrl?: string | null;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  categoryId: string;
  price: number;
  cost: number;
  unitOfMeasure: string;
  imageUrl?: string | null;
  category?: Category;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location: string;
}

export interface StockLevel {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reorderPoint: number;
  minStock: number;
  maxStock: number;
  product?: Product;
  warehouse?: Warehouse;
}

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  quantityChange: number;
  type: "INCOMING" | "OUTGOING" | "TRANSFER" | "ADJUSTMENT";
  referenceNumber?: string | null;
  description?: string | null;
  createdAt: string;
  product?: Product;
  warehouse?: Warehouse;
}

export interface Customer {
  id: string;
  companyName?: string | null;
  contactName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  status: "DRAFT" | "CONFIRMED" | "SHIPPED" | "CANCELLED";
  totalAmount: number;
  createdAt: string;
  customer?: Customer;
  items?: SalesOrderItem[];
}

export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: Product;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  salesOrderId: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  amount: number;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
  dueDate: string;
  attachmentUrl?: string | null;
  createdAt: string;
  salesOrder?: SalesOrder;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amountPaid: number;
  paymentMethod: string;
  referenceNo?: string | null;
  paymentDate: string;
  invoice?: Invoice;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactName?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  status: "PENDING" | "APPROVED" | "RECEIVED" | "CANCELLED";
  totalAmount: number;
  createdAt: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitCost: number;
  totalPrice: number;
  product?: Product;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  managerId?: string | null;
  manager?: Employee | null;
}

export interface Employee {
  id: string;
  userId: string;
  departmentId?: string | null;
  position: string;
  salary: number;
  hireDate: string;
  status: "ACTIVE" | "ON_LEAVE" | "TERMINATED";
  user: User;
  department?: Department | null;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "ON_LEAVE";
  notes?: string | null;
  employee?: Employee;
}

export interface SalaryPayment {
  id: string;
  employeeId: string;
  amount: number;
  payDate: string;
  paymentMethod: string;
  status: string;
  employee?: Employee;
}

export interface Account {
  id: string;
  name: string;
  code: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  balance: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  status: "DRAFT" | "POSTED";
  lines?: JournalLine[];
}

export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  description?: string | null;
  account?: Account;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  referenceId?: string | null;
}

export interface ActivityLog {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: string | null;
  createdAt: string;
}
