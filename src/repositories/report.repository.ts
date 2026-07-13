import { prisma, checkDatabaseConnection } from "../lib/db.ts";
import {
  mockPayments,
  mockSalesOrders,
  mockSalesOrderItems,
  mockInvoices,
  mockCustomers,
  mockProducts,
  mockStockLevels,
  mockPurchaseOrders,
  mockPurchaseOrderItems,
  mockSuppliers,
  mockEmployees,
  mockDepartments,
  mockAttendances,
  mockSalaryPayments,
  mockWarehouses,
  mockCategories,
  mockProfiles,
} from "../lib/db.ts";
import {
  SalesOrderStatus,
  InvoiceStatus,
  PurchaseOrderStatus,
  AttendanceStatus,
  EmployeeStatus,
} from "@prisma/client";

// ==========================================
// REPORT DATA INTERFACES
// ==========================================

export interface SalesReportData {
  summary: {
    totalRevenue: number;
    totalInvoiceAmount: number;
    totalOrdersCount: number;
    confirmedOrdersCount: number;
    shippedOrdersCount: number;
    cancelledOrdersCount: number;
  };
  trend: { date: string; amount: number; count: number }[];
  productSales: {
    productId: string;
    productName: string;
    sku: string;
    quantitySold: number;
    revenue: number;
  }[];
  orders: {
    id: string;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    status: SalesOrderStatus;
    createdAt: Date;
  }[];
}

export interface PurchaseReportData {
  summary: {
    totalPurchaseAmount: number;
    totalOrdersCount: number;
    pendingOrdersCount: number;
    approvedOrdersCount: number;
    receivedOrdersCount: number;
    cancelledOrdersCount: number;
  };
  trend: { date: string; amount: number; count: number }[];
  supplierPurchases: {
    supplierId: string;
    supplierName: string;
    totalAmount: number;
    orderCount: number;
  }[];
  orders: {
    id: string;
    poNumber: string;
    supplierName: string;
    totalAmount: number;
    status: PurchaseOrderStatus;
    createdAt: Date;
  }[];
}

export interface InventoryReportData {
  summary: {
    totalUniqueProducts: number;
    totalStockQuantity: number;
    totalStockValueAtCost: number;
    totalStockValueAtPrice: number;
    lowStockCount: number;
  };
  warehouseBreakdown: {
    warehouseId: string;
    warehouseName: string;
    totalUniqueProducts: number;
    totalStockQuantity: number;
    stockValueAtCost: number;
  }[];
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    productCount: number;
    totalQuantity: number;
  }[];
  lowStockItems: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    reorderPoint: number;
    minStock: number;
    warehouseName: string;
  }[];
}

export interface CustomerReportData {
  summary: {
    totalCustomersCount: number;
    activeCustomersCount: number; // customer has at least 1 order in date range
    totalCustomerSpend: number;
    averageCustomerSpend: number;
  };
  customerMetrics: {
    customerId: string;
    companyName: string | null;
    contactName: string;
    email: string;
    totalSpent: number;
    orderCount: number;
    averageOrderValue: number;
    lastOrderDate: Date | null;
  }[];
}

export interface EmployeeReportData {
  summary: {
    totalEmployeesCount: number;
    activeEmployeesCount: number;
    averageSalary: number;
    totalPayrollPaid: number;
    averageAttendanceRate: number; // percentage of days marked PRESENT
  };
  departmentBreakdown: {
    departmentId: string;
    departmentName: string;
    employeeCount: number;
    totalMonthlySalaries: number;
  }[];
  attendanceStats: {
    employeeId: string;
    employeeName: string;
    daysPresent: number;
    daysAbsent: number;
    daysLate: number;
    daysOnLeave: number;
    attendanceRate: number;
  }[];
  payrollHistory: {
    id: string;
    employeeName: string;
    amount: number;
    payDate: Date;
    paymentMethod: string;
    status: string;
  }[];
}

export interface ProfitReportData {
  summary: {
    totalRevenue: number; // cash payments received
    totalCostOfGoodsSold: number; // cost * quantity sold
    totalOperatingPayroll: number; // total salaries paid
    totalSupplierPurchases: number; // received/approved PO payments/costs
    grossProfit: number; // totalRevenue - totalCostOfGoodsSold
    netProfit: number; // grossProfit - totalOperatingPayroll
  };
  monthlyBreakdown: {
    month: string; // YYYY-MM
    revenue: number;
    cogs: number;
    payroll: number;
    purchases: number;
    grossProfit: number;
    netProfit: number;
  }[];
}

// ==========================================
// REPOSITORY CLASS DEFINITION
// ==========================================

export class ReportRepository {
  /**
   * Helper to format Date to YYYY-MM-DD
   */
  private static formatDateString(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  /**
   * Helper to format Date to YYYY-MM
   */
  private static formatMonthString(date: Date): string {
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}`;
  }

  /**
   * Generates Sales Report with optimized prisma aggregations and mock fallback
   */
  static async getSalesReport(startDate?: Date, endDate?: Date): Promise<SalesReportData> {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = startDate;
        if (endDate) dateFilter.lte = endDate;

        const hasDateFilters = startDate || endDate;

        // 1. Fetch sales order and payment data in parallel
        const [payments, salesOrders, salesOrderItems] = await Promise.all([
          // Revenue inside date range
          prisma.payment.findMany({
            where: hasDateFilters ? { paymentDate: dateFilter } : undefined,
          }),
          // Sales orders inside date range
          prisma.salesOrder.findMany({
            where: hasDateFilters ? { createdAt: dateFilter } : undefined,
            include: {
              customer: true,
            },
            orderBy: { createdAt: "desc" },
          }),
          // Items to compute top product sales
          prisma.salesOrderItem.findMany({
            where: {
              salesOrder: {
                status: { in: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.SHIPPED] },
                ...(hasDateFilters ? { createdAt: dateFilter } : {}),
              },
            },
            include: {
              product: true,
            },
          }),
        ]);

        // Revenue calculation
        const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);

        // Sales Orders count and aggregates
        const totalInvoiceAmount = salesOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
        const totalOrdersCount = salesOrders.length;
        const confirmedOrdersCount = salesOrders.filter((o) => o.status === SalesOrderStatus.CONFIRMED).length;
        const shippedOrdersCount = salesOrders.filter((o) => o.status === SalesOrderStatus.SHIPPED).length;
        const cancelledOrdersCount = salesOrders.filter((o) => o.status === SalesOrderStatus.CANCELLED).length;

        // Calculate sales trends (group by day)
        const trendMap = new Map<string, { amount: number; count: number }>();
        salesOrders.forEach((so) => {
          const day = this.formatDateString(so.createdAt);
          const current = trendMap.get(day) || { amount: 0, count: 0 };
          trendMap.set(day, {
            amount: current.amount + Number(so.totalAmount),
            count: current.count + 1,
          });
        });

        const trend = Array.from(trendMap.entries())
          .map(([date, val]) => ({
            date,
            amount: Math.round(val.amount * 100) / 100,
            count: val.count,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Aggregate Product Sales
        const productSalesMap = new Map<string, { name: string; sku: string; qty: number; rev: number }>();
        salesOrderItems.forEach((item) => {
          if (!item.product) return;
          const current = productSalesMap.get(item.productId) || {
            name: item.product.name,
            sku: item.product.sku,
            qty: 0,
            rev: 0,
          };
          productSalesMap.set(item.productId, {
            name: current.name,
            sku: current.sku,
            qty: current.qty + Number(item.quantity),
            rev: current.rev + Number(item.totalPrice),
          });
        });

        const productSales = Array.from(productSalesMap.entries()).map(([id, val]) => ({
          productId: id,
          productName: val.name,
          sku: val.sku,
          quantitySold: val.qty,
          revenue: Math.round(val.rev * 100) / 100,
        })).sort((a, b) => b.revenue - a.revenue);

        const orders = salesOrders.map((so) => ({
          id: so.id,
          orderNumber: so.orderNumber,
          customerName: so.customer.companyName || so.customer.contactName,
          totalAmount: Number(so.totalAmount),
          status: so.status,
          createdAt: so.createdAt,
        }));

        return {
          summary: {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalInvoiceAmount: Math.round(totalInvoiceAmount * 100) / 100,
            totalOrdersCount,
            confirmedOrdersCount,
            shippedOrdersCount,
            cancelledOrdersCount,
          },
          trend,
          productSales,
          orders,
        };
      } catch (err) {
        console.error("Prisma Sales Report failed, falling back to mock:", err);
      }
    }

    // ==========================================
    // MOCK SALES REPORT
    // ==========================================
    const startSecs = startDate ? startDate.getTime() : 0;
    const endSecs = endDate ? endDate.getTime() : Infinity;

    // Filtered Payments
    const filteredPayments = mockPayments.filter((p) => {
      const ts = p.paymentDate.getTime();
      return ts >= startSecs && ts <= endSecs;
    });
    const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);

    // Filtered Orders
    const filteredOrders = mockSalesOrders.filter((so) => {
      const ts = so.createdAt.getTime();
      return ts >= startSecs && ts <= endSecs;
    });

    const totalInvoiceAmount = filteredOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalOrdersCount = filteredOrders.length;
    const confirmedOrdersCount = filteredOrders.filter((o) => (o.status as any) === SalesOrderStatus.CONFIRMED).length;
    const shippedOrdersCount = filteredOrders.filter((o) => (o.status as any) === SalesOrderStatus.SHIPPED).length;
    const cancelledOrdersCount = filteredOrders.filter((o) => (o.status as any) === SalesOrderStatus.CANCELLED).length;

    // Trend
    const trendMap = new Map<string, { amount: number; count: number }>();
    filteredOrders.forEach((so) => {
      const day = this.formatDateString(so.createdAt);
      const current = trendMap.get(day) || { amount: 0, count: 0 };
      trendMap.set(day, {
        amount: current.amount + Number(so.totalAmount),
        count: current.count + 1,
      });
    });

    const trend = Array.from(trendMap.entries())
      .map(([date, val]) => ({
        date,
        amount: Math.round(val.amount * 100) / 100,
        count: val.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Product Sales
    const productSalesMap = new Map<string, { name: string; sku: string; qty: number; rev: number }>();
    mockSalesOrderItems.forEach((item) => {
      const so = mockSalesOrders.find((o) => o.id === item.salesOrderId);
      if (!so || (so.status !== SalesOrderStatus.CONFIRMED && so.status !== SalesOrderStatus.SHIPPED)) {
        return;
      }
      const ts = so.createdAt.getTime();
      if (ts < startSecs || ts > endSecs) return;

      const prod = mockProducts.find((p) => p.id === item.productId);
      if (!prod) return;

      const current = productSalesMap.get(item.productId) || {
        name: prod.name,
        sku: prod.sku,
        qty: 0,
        rev: 0,
      };
      productSalesMap.set(item.productId, {
        name: current.name,
        sku: current.sku,
        qty: current.qty + Number(item.quantity),
        rev: current.rev + Number(item.totalPrice),
      });
    });

    const productSales = Array.from(productSalesMap.entries()).map(([id, val]) => ({
      productId: id,
      productName: val.name,
      sku: val.sku,
      quantitySold: val.qty,
      revenue: Math.round(val.rev * 100) / 100,
    })).sort((a, b) => b.revenue - a.revenue);

    const orders = filteredOrders.map((so) => {
      const customer = mockCustomers.find((c) => c.id === so.customerId);
      return {
        id: so.id,
        orderNumber: so.orderNumber,
        customerName: customer ? customer.companyName || customer.contactName : "Unknown Customer",
        totalAmount: Number(so.totalAmount),
        status: so.status,
        createdAt: so.createdAt,
      };
    });

    return {
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalInvoiceAmount: Math.round(totalInvoiceAmount * 100) / 100,
        totalOrdersCount,
        confirmedOrdersCount,
        shippedOrdersCount,
        cancelledOrdersCount,
      },
      trend,
      productSales,
      orders,
    };
  }

  /**
   * Generates Purchase Report with optimized query pipelines and mock fallback
   */
  static async getPurchaseReport(startDate?: Date, endDate?: Date): Promise<PurchaseReportData> {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = startDate;
        if (endDate) dateFilter.lte = endDate;

        const hasDateFilters = startDate || endDate;

        const purchaseOrders = await prisma.purchaseOrder.findMany({
          where: hasDateFilters ? { createdAt: dateFilter } : undefined,
          include: {
            supplier: true,
          },
          orderBy: { createdAt: "desc" },
        });

        const totalPurchaseAmount = purchaseOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
        const totalOrdersCount = purchaseOrders.length;
        const pendingOrdersCount = purchaseOrders.filter((o) => o.status === PurchaseOrderStatus.PENDING).length;
        const approvedOrdersCount = purchaseOrders.filter((o) => o.status === PurchaseOrderStatus.APPROVED).length;
        const receivedOrdersCount = purchaseOrders.filter((o) => o.status === PurchaseOrderStatus.RECEIVED).length;
        const cancelledOrdersCount = purchaseOrders.filter((o) => o.status === PurchaseOrderStatus.CANCELLED).length;

        // Daily/Monthly trend
        const trendMap = new Map<string, { amount: number; count: number }>();
        purchaseOrders.forEach((po) => {
          const day = this.formatDateString(po.createdAt);
          const current = trendMap.get(day) || { amount: 0, count: 0 };
          trendMap.set(day, {
            amount: current.amount + Number(po.totalAmount),
            count: current.count + 1,
          });
        });

        const trend = Array.from(trendMap.entries()).map(([date, val]) => ({
          date,
          amount: Math.round(val.amount * 100) / 100,
          count: val.count,
        })).sort((a, b) => a.date.localeCompare(b.date));

        // Supplier aggregates
        const supplierMap = new Map<string, { name: string; amount: number; count: number }>();
        purchaseOrders.forEach((po) => {
          const current = supplierMap.get(po.supplierId) || { name: po.supplier.companyName, amount: 0, count: 0 };
          supplierMap.set(po.supplierId, {
            name: current.name,
            amount: current.amount + Number(po.totalAmount),
            count: current.count + 1,
          });
        });

        const supplierPurchases = Array.from(supplierMap.entries()).map(([id, val]) => ({
          supplierId: id,
          supplierName: val.name,
          totalAmount: Math.round(val.amount * 100) / 100,
          orderCount: val.count,
        })).sort((a, b) => b.totalAmount - a.totalAmount);

        const orders = purchaseOrders.map((po) => ({
          id: po.id,
          poNumber: po.poNumber,
          supplierName: po.supplier.companyName,
          totalAmount: Number(po.totalAmount),
          status: po.status,
          createdAt: po.createdAt,
        }));

        return {
          summary: {
            totalPurchaseAmount: Math.round(totalPurchaseAmount * 100) / 100,
            totalOrdersCount,
            pendingOrdersCount,
            approvedOrdersCount,
            receivedOrdersCount,
            cancelledOrdersCount,
          },
          trend,
          supplierPurchases,
          orders,
        };
      } catch (err) {
        console.error("Prisma Purchase Report failed, falling back to mock:", err);
      }
    }

    // ==========================================
    // MOCK PURCHASE REPORT
    // ==========================================
    const startSecs = startDate ? startDate.getTime() : 0;
    const endSecs = endDate ? endDate.getTime() : Infinity;

    const filteredPOs = mockPurchaseOrders.filter((po) => {
      const ts = po.createdAt.getTime();
      return ts >= startSecs && ts <= endSecs;
    });

    const totalPurchaseAmount = filteredPOs.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalOrdersCount = filteredPOs.length;
    const pendingOrdersCount = filteredPOs.filter((o) => o.status === PurchaseOrderStatus.PENDING).length;
    const approvedOrdersCount = filteredPOs.filter((o) => o.status === PurchaseOrderStatus.APPROVED).length;
    const receivedOrdersCount = filteredPOs.filter((o) => o.status === PurchaseOrderStatus.RECEIVED).length;
    const cancelledOrdersCount = filteredPOs.filter((o) => o.status === PurchaseOrderStatus.CANCELLED).length;

    const trendMap = new Map<string, { amount: number; count: number }>();
    filteredPOs.forEach((po) => {
      const day = this.formatDateString(po.createdAt);
      const current = trendMap.get(day) || { amount: 0, count: 0 };
      trendMap.set(day, {
        amount: current.amount + Number(po.totalAmount),
        count: current.count + 1,
      });
    });

    const trend = Array.from(trendMap.entries()).map(([date, val]) => ({
      date,
      amount: Math.round(val.amount * 100) / 100,
      count: val.count,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const supplierMap = new Map<string, { name: string; amount: number; count: number }>();
    filteredPOs.forEach((po) => {
      const supplier = mockSuppliers.find((s) => s.id === po.supplierId);
      const sName = supplier ? supplier.companyName : "Unknown Supplier";
      const current = supplierMap.get(po.supplierId) || { name: sName, amount: 0, count: 0 };
      supplierMap.set(po.supplierId, {
        name: current.name,
        amount: current.amount + Number(po.totalAmount),
        count: current.count + 1,
      });
    });

    const supplierPurchases = Array.from(supplierMap.entries()).map(([id, val]) => ({
      supplierId: id,
      supplierName: val.name,
      totalAmount: Math.round(val.amount * 100) / 100,
      orderCount: val.count,
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    const orders = filteredPOs.map((po) => {
      const supplier = mockSuppliers.find((s) => s.id === po.supplierId);
      return {
        id: po.id,
        poNumber: po.poNumber,
        supplierName: supplier ? supplier.companyName : "Unknown Supplier",
        totalAmount: Number(po.totalAmount),
        status: po.status,
        createdAt: po.createdAt,
      };
    });

    return {
      summary: {
        totalPurchaseAmount: Math.round(totalPurchaseAmount * 100) / 100,
        totalOrdersCount,
        pendingOrdersCount,
        approvedOrdersCount,
        receivedOrdersCount,
        cancelledOrdersCount,
      },
      trend,
      supplierPurchases,
      orders,
    };
  }

  /**
   * Generates Inventory Report with real-time stock levels and valuation
   */
  static async getInventoryReport(): Promise<InventoryReportData> {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const [products, stockLevels, warehouses, categories] = await Promise.all([
          prisma.product.findMany({
            where: { isDeleted: false },
          }),
          prisma.stockLevel.findMany({
            include: {
              product: true,
              warehouse: true,
            },
          }),
          prisma.warehouse.findMany(),
          prisma.category.findMany(),
        ]);

        const totalUniqueProducts = products.length;
        const totalStockQuantity = stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0);

        // Sum quantity * unitCost and quantity * unitPrice
        let totalStockValueAtCost = 0;
        let totalStockValueAtPrice = 0;

        stockLevels.forEach((sl) => {
          const qty = Number(sl.quantity);
          const cost = sl.product ? Number(sl.product.cost) : 0;
          const price = sl.product ? Number(sl.product.price) : 0;
          totalStockValueAtCost += qty * cost;
          totalStockValueAtPrice += qty * price;
        });

        // Calculate warehouse breakdown
        const warehouseBreakdown = warehouses.map((wh) => {
          const whStocks = stockLevels.filter((sl) => sl.warehouseId === wh.id);
          const uniqueProds = new Set(whStocks.map((sl) => sl.productId)).size;
          const totalQty = whStocks.reduce((sum, sl) => sum + Number(sl.quantity), 0);
          const costVal = whStocks.reduce((sum, sl) => {
            const cost = sl.product ? Number(sl.product.cost) : 0;
            return sum + Number(sl.quantity) * cost;
          }, 0);

          return {
            warehouseId: wh.id,
            warehouseName: wh.name,
            totalUniqueProducts: uniqueProds,
            totalStockQuantity: totalQty,
            stockValueAtCost: Math.round(costVal * 100) / 100,
          };
        });

        // Category breakdown
        const categoryBreakdown = categories.map((cat) => {
          const catProducts = products.filter((p) => p.categoryId === cat.id);
          const pIds = catProducts.map((p) => p.id);
          const catStocks = stockLevels.filter((sl) => pIds.includes(sl.productId));
          const totalQty = catStocks.reduce((sum, sl) => sum + Number(sl.quantity), 0);

          return {
            categoryId: cat.id,
            categoryName: cat.name,
            productCount: catProducts.length,
            totalQuantity: totalQty,
          };
        });

        // Low stock calculation
        const lowStockLevels = stockLevels.filter((sl) => Number(sl.quantity) <= Number(sl.reorderPoint));
        const lowStockCount = lowStockLevels.length;

        const lowStockItems = lowStockLevels.map((sl) => ({
          productId: sl.productId,
          productName: sl.product ? sl.product.name : "Unknown",
          sku: sl.product ? sl.product.sku : "Unknown",
          quantity: Number(sl.quantity),
          reorderPoint: Number(sl.reorderPoint),
          minStock: Number(sl.minStock),
          warehouseName: sl.warehouse ? sl.warehouse.name : "Unknown Warehouse",
        }));

        return {
          summary: {
            totalUniqueProducts,
            totalStockQuantity,
            totalStockValueAtCost: Math.round(totalStockValueAtCost * 100) / 100,
            totalStockValueAtPrice: Math.round(totalStockValueAtPrice * 100) / 100,
            lowStockCount,
          },
          warehouseBreakdown,
          categoryBreakdown,
          lowStockItems,
        };
      } catch (err) {
        console.error("Prisma Inventory Report failed, falling back to mock:", err);
      }
    }

    // ==========================================
    // MOCK INVENTORY REPORT
    // ==========================================
    const products = mockProducts.filter((p) => !p.isDeleted);
    const totalUniqueProducts = products.length;
    const totalStockQuantity = mockStockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0);

    let totalStockValueAtCost = 0;
    let totalStockValueAtPrice = 0;

    mockStockLevels.forEach((sl) => {
      const prod = products.find((p) => p.id === sl.productId);
      if (!prod) return;
      const qty = Number(sl.quantity);
      totalStockValueAtCost += qty * Number(prod.cost);
      totalStockValueAtPrice += qty * Number(prod.price);
    });

    const warehouseBreakdown = mockWarehouses.map((wh) => {
      const whStocks = mockStockLevels.filter((sl) => sl.warehouseId === wh.id);
      const uniqueProds = new Set(whStocks.map((sl) => sl.productId)).size;
      const totalQty = whStocks.reduce((sum, sl) => sum + Number(sl.quantity), 0);
      const costVal = whStocks.reduce((sum, sl) => {
        const prod = products.find((p) => p.id === sl.productId);
        const cost = prod ? Number(prod.cost) : 0;
        return sum + Number(sl.quantity) * cost;
      }, 0);

      return {
        warehouseId: wh.id,
        warehouseName: wh.name,
        totalUniqueProducts: uniqueProds,
        totalStockQuantity: totalQty,
        stockValueAtCost: Math.round(costVal * 100) / 100,
      };
    });

    const categoryBreakdown = mockCategories.map((cat) => {
      const catProducts = products.filter((p) => p.categoryId === cat.id);
      const pIds = catProducts.map((p) => p.id);
      const catStocks = mockStockLevels.filter((sl) => pIds.includes(sl.productId));
      const totalQty = catStocks.reduce((sum, sl) => sum + Number(sl.quantity), 0);

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        productCount: catProducts.length,
        totalQuantity: totalQty,
      };
    });

    const lowStockLevels = mockStockLevels.filter((sl) => Number(sl.quantity) <= Number(sl.reorderPoint));
    const lowStockCount = lowStockLevels.length;

    const lowStockItems = lowStockLevels.map((sl) => {
      const prod = products.find((p) => p.id === sl.productId);
      const wh = mockWarehouses.find((w) => w.id === sl.warehouseId);
      return {
        productId: sl.productId,
        productName: prod ? prod.name : "Unknown",
        sku: prod ? prod.sku : "Unknown",
        quantity: Number(sl.quantity),
        reorderPoint: Number(sl.reorderPoint),
        minStock: Number(sl.minStock),
        warehouseName: wh ? wh.name : "Unknown Warehouse",
      };
    });

    return {
      summary: {
        totalUniqueProducts,
        totalStockQuantity,
        totalStockValueAtCost: Math.round(totalStockValueAtCost * 100) / 100,
        totalStockValueAtPrice: Math.round(totalStockValueAtPrice * 100) / 100,
        lowStockCount,
      },
      warehouseBreakdown,
      categoryBreakdown,
      lowStockItems,
    };
  }

  /**
   * Generates Customer Performance Report with sales volume and statistics
   */
  static async getCustomerReport(startDate?: Date, endDate?: Date): Promise<CustomerReportData> {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = startDate;
        if (endDate) dateFilter.lte = endDate;

        const hasDateFilters = startDate || endDate;

        const [customers, salesOrders] = await Promise.all([
          prisma.customer.findMany({
            where: { isDeleted: false },
          }),
          prisma.salesOrder.findMany({
            where: {
              status: { in: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.SHIPPED] },
              ...(hasDateFilters ? { createdAt: dateFilter } : {}),
            },
            orderBy: { createdAt: "desc" },
          }),
        ]);

        const totalCustomersCount = customers.length;

        // Map and compute metrics for each customer
        const customerMetricsMap = new Map<string, { spent: number; count: number; lastDate: Date | null }>();

        customers.forEach((c) => {
          customerMetricsMap.set(c.id, { spent: 0, count: 0, lastDate: null });
        });

        salesOrders.forEach((so) => {
          const current = customerMetricsMap.get(so.customerId) || { spent: 0, count: 0, lastDate: null };
          const spent = current.spent + Number(so.totalAmount);
          const count = current.count + 1;
          const lastDate = current.lastDate && current.lastDate.getTime() > so.createdAt.getTime()
            ? current.lastDate
            : so.createdAt;

          customerMetricsMap.set(so.customerId, { spent, count, lastDate });
        });

        const activeCustomersCount = Array.from(customerMetricsMap.values()).filter((c) => c.count > 0).length;
        const totalCustomerSpend = salesOrders.reduce((sum, so) => sum + Number(so.totalAmount), 0);
        const averageCustomerSpend = activeCustomersCount > 0 ? totalCustomerSpend / activeCustomersCount : 0;

        const customerMetrics = customers.map((c) => {
          const metrics = customerMetricsMap.get(c.id) || { spent: 0, count: 0, lastDate: null };
          return {
            customerId: c.id,
            companyName: c.companyName,
            contactName: c.contactName,
            email: c.email,
            totalSpent: Math.round(metrics.spent * 100) / 100,
            orderCount: metrics.count,
            averageOrderValue: metrics.count > 0 ? Math.round((metrics.spent / metrics.count) * 100) / 100 : 0,
            lastOrderDate: metrics.lastDate,
          };
        }).sort((a, b) => b.totalSpent - a.totalSpent);

        return {
          summary: {
            totalCustomersCount,
            activeCustomersCount,
            totalCustomerSpend: Math.round(totalCustomerSpend * 100) / 100,
            averageCustomerSpend: Math.round(averageCustomerSpend * 100) / 100,
          },
          customerMetrics,
        };
      } catch (err) {
        console.error("Prisma Customer Report failed, falling back to mock:", err);
      }
    }

    // ==========================================
    // MOCK CUSTOMER REPORT
    // ==========================================
    const startSecs = startDate ? startDate.getTime() : 0;
    const endSecs = endDate ? endDate.getTime() : Infinity;

    const customers = mockCustomers.filter((c) => !c.isDeleted);
    const totalCustomersCount = customers.length;

    const filteredOrders = mockSalesOrders.filter((so) => {
      if (so.status !== SalesOrderStatus.CONFIRMED && so.status !== SalesOrderStatus.SHIPPED) return false;
      const ts = so.createdAt.getTime();
      return ts >= startSecs && ts <= endSecs;
    });

    const customerMetricsMap = new Map<string, { spent: number; count: number; lastDate: Date | null }>();
    customers.forEach((c) => {
      customerMetricsMap.set(c.id, { spent: 0, count: 0, lastDate: null });
    });

    filteredOrders.forEach((so) => {
      const current = customerMetricsMap.get(so.customerId) || { spent: 0, count: 0, lastDate: null };
      const spent = current.spent + Number(so.totalAmount);
      const count = current.count + 1;
      const lastDate = current.lastDate && current.lastDate.getTime() > so.createdAt.getTime()
        ? current.lastDate
        : so.createdAt;

      customerMetricsMap.set(so.customerId, { spent, count, lastDate });
    });

    const activeCustomersCount = Array.from(customerMetricsMap.values()).filter((c) => c.count > 0).length;
    const totalCustomerSpend = filteredOrders.reduce((sum, so) => sum + Number(so.totalAmount), 0);
    const averageCustomerSpend = activeCustomersCount > 0 ? totalCustomerSpend / activeCustomersCount : 0;

    const customerMetrics = customers.map((c) => {
      const metrics = customerMetricsMap.get(c.id) || { spent: 0, count: 0, lastDate: null };
      return {
        customerId: c.id,
        companyName: c.companyName,
        contactName: c.contactName,
        email: c.email,
        totalSpent: Math.round(metrics.spent * 100) / 100,
        orderCount: metrics.count,
        averageOrderValue: metrics.count > 0 ? Math.round((metrics.spent / metrics.count) * 100) / 100 : 0,
        lastOrderDate: metrics.lastDate,
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);

    return {
      summary: {
        totalCustomersCount,
        activeCustomersCount,
        totalCustomerSpend: Math.round(totalCustomerSpend * 100) / 100,
        averageCustomerSpend: Math.round(averageCustomerSpend * 100) / 100,
      },
      customerMetrics,
    };
  }

  /**
   * Generates Employee Report with attendance logs and payroll aggregations
   */
  static async getEmployeeReport(startDate?: Date, endDate?: Date): Promise<EmployeeReportData> {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = startDate;
        if (endDate) dateFilter.lte = endDate;

        const hasDateFilters = startDate || endDate;

        const [employees, departments, attendances, salaryPayments] = await Promise.all([
          prisma.employee.findMany({
            include: {
              user: {
                include: { profile: true },
              },
            },
          }),
          prisma.department.findMany(),
          prisma.attendance.findMany({
            where: hasDateFilters ? { date: dateFilter } : undefined,
            include: {
              employee: {
                include: { user: { include: { profile: true } } },
              },
            },
          }),
          prisma.salaryPayment.findMany({
            where: hasDateFilters ? { payDate: dateFilter } : undefined,
            include: {
              employee: {
                include: { user: { include: { profile: true } } },
              },
            },
            orderBy: { payDate: "desc" },
          }),
        ]);

        const totalEmployeesCount = employees.length;
        const activeEmployeesCount = employees.filter((e) => e.status === EmployeeStatus.ACTIVE).length;
        const averageSalary = employees.length > 0
          ? employees.reduce((sum, e) => sum + Number(e.salary), 0) / employees.length
          : 0;

        const totalPayrollPaid = salaryPayments
          .filter((sp) => sp.status === "PAID")
          .reduce((sum, sp) => sum + Number(sp.amount), 0);

        // Attendance aggregates
        const attendanceMap = new Map<string, { present: number; total: number; absent: number; late: number; leave: number }>();
        employees.forEach((e) => {
          attendanceMap.set(e.id, { present: 0, total: 0, absent: 0, late: 0, leave: 0 });
        });

        attendances.forEach((att) => {
          const current = attendanceMap.get(att.employeeId) || { present: 0, total: 0, absent: 0, late: 0, leave: 0 };
          current.total++;
          if (att.status === AttendanceStatus.PRESENT) current.present++;
          else if (att.status === AttendanceStatus.ABSENT) current.absent++;
          else if (att.status === AttendanceStatus.LATE) current.late++;
          else if (att.status === AttendanceStatus.ON_LEAVE) current.leave++;

          attendanceMap.set(att.employeeId, current);
        });

        const totalDaysLogged = Array.from(attendanceMap.values()).reduce((sum, v) => sum + v.total, 0);
        const totalDaysPresent = Array.from(attendanceMap.values()).reduce((sum, v) => sum + v.present + v.late, 0); // Late is still physically present
        const averageAttendanceRate = totalDaysLogged > 0 ? (totalDaysPresent / totalDaysLogged) * 100 : 100;

        const attendanceStats = employees.map((e) => {
          const stats = attendanceMap.get(e.id) || { present: 0, total: 0, absent: 0, late: 0, leave: 0 };
          const pName = e.user && e.user.profile
            ? `${e.user.profile.firstName} ${e.user.profile.lastName}`
            : "Employee";

          const daysPresent = stats.present + stats.late;
          const rate = stats.total > 0 ? (daysPresent / stats.total) * 100 : 100;

          return {
            employeeId: e.id,
            employeeName: pName,
            daysPresent: stats.present,
            daysAbsent: stats.absent,
            daysLate: stats.late,
            daysOnLeave: stats.leave,
            attendanceRate: Math.round(rate * 10) / 10,
          };
        });

        // Department breakdown
        const departmentBreakdown = departments.map((dept) => {
          const deptEmployees = employees.filter((e) => e.departmentId === dept.id);
          const totalMonthlySalaries = deptEmployees.reduce((sum, e) => sum + Number(e.salary), 0) / 12;

          return {
            departmentId: dept.id,
            departmentName: dept.name,
            employeeCount: deptEmployees.length,
            totalMonthlySalaries: Math.round(totalMonthlySalaries * 100) / 100,
          };
        });

        const payrollHistory = salaryPayments.map((sp) => {
          const profile = sp.employee && sp.employee.user ? sp.employee.user.profile : null;
          return {
            id: sp.id,
            employeeName: profile ? `${profile.firstName} ${profile.lastName}` : "Unknown Employee",
            amount: Number(sp.amount),
            payDate: sp.payDate,
            paymentMethod: sp.paymentMethod,
            status: sp.status,
          };
        });

        return {
          summary: {
            totalEmployeesCount,
            activeEmployeesCount,
            averageSalary: Math.round(averageSalary * 100) / 100,
            totalPayrollPaid: Math.round(totalPayrollPaid * 100) / 100,
            averageAttendanceRate: Math.round(averageAttendanceRate * 10) / 10,
          },
          departmentBreakdown,
          attendanceStats,
          payrollHistory,
        };
      } catch (err) {
        console.error("Prisma Employee Report failed, falling back to mock:", err);
      }
    }

    // ==========================================
    // MOCK EMPLOYEE REPORT
    // ==========================================
    const startSecs = startDate ? startDate.getTime() : 0;
    const endSecs = endDate ? endDate.getTime() : Infinity;

    const employees = mockEmployees;
    const totalEmployeesCount = employees.length;
    const activeEmployeesCount = employees.filter((e) => e.status === EmployeeStatus.ACTIVE).length;
    const averageSalary = employees.length > 0
      ? employees.reduce((sum, e) => sum + Number(e.salary || 0), 0) / employees.length
      : 0;

    const filteredPayments = mockSalaryPayments.filter((sp) => {
      const ts = sp.payDate.getTime();
      return ts >= startSecs && ts <= endSecs;
    });

    const totalPayrollPaid = filteredPayments
      .filter((sp) => sp.status === "PAID")
      .reduce((sum, sp) => sum + Number(sp.amount || 0), 0);

    const filteredAttendance = mockAttendances.filter((att) => {
      const ts = att.date.getTime();
      return ts >= startSecs && ts <= endSecs;
    });

    const attendanceMap = new Map<string, { present: number; total: number; absent: number; late: number; leave: number }>();
    employees.forEach((e) => {
      attendanceMap.set(e.id, { present: 0, total: 0, absent: 0, late: 0, leave: 0 });
    });

    filteredAttendance.forEach((att) => {
      const current = attendanceMap.get(att.employeeId) || { present: 0, total: 0, absent: 0, late: 0, leave: 0 };
      current.total++;
      if (att.status === AttendanceStatus.PRESENT) current.present++;
      else if (att.status === AttendanceStatus.ABSENT) current.absent++;
      else if (att.status === AttendanceStatus.LATE) current.late++;
      else if (att.status === AttendanceStatus.ON_LEAVE) current.leave++;

      attendanceMap.set(att.employeeId, current);
    });

    const totalDaysLogged = Array.from(attendanceMap.values()).reduce((sum, v) => sum + v.total, 0);
    const totalDaysPresent = Array.from(attendanceMap.values()).reduce((sum, v) => sum + v.present + v.late, 0);
    const averageAttendanceRate = totalDaysLogged > 0 ? (totalDaysPresent / totalDaysLogged) * 100 : 100;

    const attendanceStats = employees.map((e) => {
      const stats = attendanceMap.get(e.id) || { present: 0, total: 0, absent: 0, late: 0, leave: 0 };
      const profile = mockProfiles.find((p) => p.userId === e.userId);
      const pName = profile ? `${profile.firstName} ${profile.lastName}` : "Employee";

      const daysPresent = stats.present + stats.late;
      const rate = stats.total > 0 ? (daysPresent / stats.total) * 100 : 100;

      return {
        employeeId: e.id,
        employeeName: pName,
        daysPresent: stats.present,
        daysAbsent: stats.absent,
        daysLate: stats.late,
        daysOnLeave: stats.leave,
        attendanceRate: Math.round(rate * 10) / 10,
      };
    });

    const departmentBreakdown = mockDepartments.map((dept) => {
      const deptEmployees = employees.filter((e) => e.departmentId === dept.id);
      const totalMonthlySalaries = deptEmployees.reduce((sum, e) => sum + Number(e.salary || 0), 0) / 12;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        employeeCount: deptEmployees.length,
        totalMonthlySalaries: Math.round(totalMonthlySalaries * 100) / 100,
      };
    });

    const payrollHistory = filteredPayments.map((sp) => {
      const emp = mockEmployees.find((e) => e.id === sp.employeeId);
      const profile = emp ? mockProfiles.find((p) => p.userId === emp.userId) : null;
      return {
        id: sp.id,
        employeeName: profile ? `${profile.firstName} ${profile.lastName}` : "Unknown Employee",
        amount: Number(sp.amount),
        payDate: sp.payDate,
        paymentMethod: sp.paymentMethod,
        status: sp.status,
      };
    });

    return {
      summary: {
        totalEmployeesCount,
        activeEmployeesCount,
        averageSalary: Math.round(averageSalary * 100) / 100,
        totalPayrollPaid: Math.round(totalPayrollPaid * 100) / 100,
        averageAttendanceRate: Math.round(averageAttendanceRate * 10) / 10,
      },
      departmentBreakdown,
      attendanceStats,
      payrollHistory,
    };
  }

  /**
   * Generates Profit & Loss Statement by mapping revenue, COGS, payroll, and purchasing expenses
   */
  static async getProfitReport(startDate?: Date, endDate?: Date): Promise<ProfitReportData> {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = startDate;
        if (endDate) dateFilter.lte = endDate;

        const hasDateFilters = startDate || endDate;

        // Fetch parallel streams
        const [payments, salesOrderItems, salaryPayments, purchaseOrders] = await Promise.all([
          // Revenue inside date range
          prisma.payment.findMany({
            where: hasDateFilters ? { paymentDate: dateFilter } : undefined,
          }),
          // COGS inside date range (sales order status must be confirmed or shipped)
          prisma.salesOrderItem.findMany({
            where: {
              salesOrder: {
                status: { in: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.SHIPPED] },
                ...(hasDateFilters ? { createdAt: dateFilter } : {}),
              },
            },
            include: {
              product: true,
              salesOrder: true,
            },
          }),
          // Operating Salaries paid in date range
          prisma.salaryPayment.findMany({
            where: {
              status: "PAID",
              ...(hasDateFilters ? { payDate: dateFilter } : {}),
            },
          }),
          // Purchase orders (costs) within date range
          prisma.purchaseOrder.findMany({
            where: {
              status: { in: [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.RECEIVED] },
              ...(hasDateFilters ? { createdAt: dateFilter } : {}),
            },
          }),
        ]);

        const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
        const totalCostOfGoodsSold = salesOrderItems.reduce((sum, item) => {
          const cost = item.product ? Number(item.product.cost) : 0;
          return sum + Number(item.quantity) * cost;
        }, 0);
        const totalOperatingPayroll = salaryPayments.reduce((sum, sp) => sum + Number(sp.amount), 0);
        const totalSupplierPurchases = purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount), 0);

        const grossProfit = totalRevenue - totalCostOfGoodsSold;
        const netProfit = grossProfit - totalOperatingPayroll; // COGS + Payroll are core deductions, purchases are assets/inventory costs but let's report it separately

        // Group Monthly Breakdown
        const monthMap = new Map<string, { rev: number; cogs: number; payroll: number; purch: number }>();

        payments.forEach((p) => {
          const m = this.formatMonthString(p.paymentDate);
          const current = monthMap.get(m) || { rev: 0, cogs: 0, payroll: 0, purch: 0 };
          current.rev += Number(p.amountPaid);
          monthMap.set(m, current);
        });

        salesOrderItems.forEach((item) => {
          if (!item.salesOrder) return;
          const m = this.formatMonthString(item.salesOrder.createdAt);
          const current = monthMap.get(m) || { rev: 0, cogs: 0, payroll: 0, purch: 0 };
          const cost = item.product ? Number(item.product.cost) : 0;
          current.cogs += Number(item.quantity) * cost;
          monthMap.set(m, current);
        });

        salaryPayments.forEach((sp) => {
          const m = this.formatMonthString(sp.payDate);
          const current = monthMap.get(m) || { rev: 0, cogs: 0, payroll: 0, purch: 0 };
          current.payroll += Number(sp.amount);
          monthMap.set(m, current);
        });

        purchaseOrders.forEach((po) => {
          const m = this.formatMonthString(po.createdAt);
          const current = monthMap.get(m) || { rev: 0, cogs: 0, payroll: 0, purch: 0 };
          current.purch += Number(po.totalAmount);
          monthMap.set(m, current);
        });

        const monthlyBreakdown = Array.from(monthMap.entries()).map(([month, val]) => {
          const gProf = val.rev - val.cogs;
          const nProf = gProf - val.payroll;
          return {
            month,
            revenue: Math.round(val.rev * 100) / 100,
            cogs: Math.round(val.cogs * 100) / 100,
            payroll: Math.round(val.payroll * 100) / 100,
            purchases: Math.round(val.purch * 100) / 100,
            grossProfit: Math.round(gProf * 100) / 100,
            netProfit: Math.round(nProf * 100) / 100,
          };
        }).sort((a, b) => a.month.localeCompare(b.month));

        return {
          summary: {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalCostOfGoodsSold: Math.round(totalCostOfGoodsSold * 100) / 100,
            totalOperatingPayroll: Math.round(totalOperatingPayroll * 100) / 100,
            totalSupplierPurchases: Math.round(totalSupplierPurchases * 100) / 100,
            grossProfit: Math.round(grossProfit * 100) / 100,
            netProfit: Math.round(netProfit * 100) / 100,
          },
          monthlyBreakdown,
        };
      } catch (err) {
        console.error("Prisma Profit Report failed, falling back to mock:", err);
      }
    }

    // ==========================================
    // MOCK PROFIT REPORT
    // ==========================================
    const startSecs = startDate ? startDate.getTime() : 0;
    const endSecs = endDate ? endDate.getTime() : Infinity;

    // Filter payments
    const filteredPayments = mockPayments.filter((p) => {
      const ts = p.paymentDate.getTime();
      return ts >= startSecs && ts <= endSecs;
    });
    const totalRevenue = filteredPayments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);

    // COGS
    const totalCostOfGoodsSold = mockSalesOrderItems.reduce((sum, item) => {
      const so = mockSalesOrders.find((o) => o.id === item.salesOrderId);
      if (!so || (so.status !== SalesOrderStatus.CONFIRMED && so.status !== SalesOrderStatus.SHIPPED)) {
        return sum;
      }
      const ts = so.createdAt.getTime();
      if (ts < startSecs || ts > endSecs) return sum;

      const prod = mockProducts.find((p) => p.id === item.productId);
      const cost = prod ? Number(prod.cost) : 0;
      return sum + Number(item.quantity) * cost;
    }, 0);

    // Payroll
    const filteredSalaries = mockSalaryPayments.filter((sp) => {
      const ts = sp.payDate.getTime();
      return sp.status === "PAID" && ts >= startSecs && ts <= endSecs;
    });
    const totalOperatingPayroll = filteredSalaries.reduce((sum, sp) => sum + Number(sp.amount || 0), 0);

    // Purchasing Costs
    const filteredPOs = mockPurchaseOrders.filter((po) => {
      const ts = po.createdAt.getTime();
      const isValidStatus = po.status === PurchaseOrderStatus.APPROVED || po.status === PurchaseOrderStatus.RECEIVED;
      return isValidStatus && ts >= startSecs && ts <= endSecs;
    });
    const totalSupplierPurchases = filteredPOs.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0);

    const grossProfit = totalRevenue - totalCostOfGoodsSold;
    const netProfit = grossProfit - totalOperatingPayroll;

    // Group Monthly Breakdown
    const monthMap = new Map<string, { rev: number; cogs: number; payroll: number; purch: number }>();

    filteredPayments.forEach((p) => {
      const m = this.formatMonthString(p.paymentDate);
      const current = monthMap.get(m) || { rev: 0, cogs: 0, payroll: 0, purch: 0 };
      current.rev += Number(p.amountPaid);
      monthMap.set(m, current);
    });

    mockSalesOrderItems.forEach((item) => {
      const so = mockSalesOrders.find((o) => o.id === item.salesOrderId);
      if (!so || (so.status !== SalesOrderStatus.CONFIRMED && so.status !== SalesOrderStatus.SHIPPED)) {
        return;
      }
      const ts = so.createdAt.getTime();
      if (ts < startSecs || ts > endSecs) return;

      const m = this.formatMonthString(so.createdAt);
      const current = monthMap.get(m) || { rev: 0, cogs: 0, payroll: 0, purch: 0 };
      const prod = mockProducts.find((p) => p.id === item.productId);
      const cost = prod ? Number(prod.cost) : 0;
      current.cogs += Number(item.quantity) * cost;
      monthMap.set(m, current);
    });

    filteredSalaries.forEach((sp) => {
      const m = this.formatMonthString(sp.payDate);
      const current = monthMap.get(m) || { rev: 0, cogs: 0, payroll: 0, purch: 0 };
      current.payroll += Number(sp.amount);
      monthMap.set(m, current);
    });

    filteredPOs.forEach((po) => {
      const m = this.formatMonthString(po.createdAt);
      const current = monthMap.get(m) || { rev: 0, cogs: 0, payroll: 0, purch: 0 };
      current.purch += Number(po.totalAmount);
      monthMap.set(m, current);
    });

    const monthlyBreakdown = Array.from(monthMap.entries()).map(([month, val]) => {
      const gProf = val.rev - val.cogs;
      const nProf = gProf - val.payroll;
      return {
        month,
        revenue: Math.round(val.rev * 100) / 100,
        cogs: Math.round(val.cogs * 100) / 100,
        payroll: Math.round(val.payroll * 100) / 100,
        purchases: Math.round(val.purch * 100) / 100,
        grossProfit: Math.round(gProf * 100) / 100,
        netProfit: Math.round(nProf * 100) / 100,
      };
    }).sort((a, b) => a.month.localeCompare(b.month));

    return {
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCostOfGoodsSold: Math.round(totalCostOfGoodsSold * 100) / 100,
        totalOperatingPayroll: Math.round(totalOperatingPayroll * 100) / 100,
        totalSupplierPurchases: Math.round(totalSupplierPurchases * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
      },
      monthlyBreakdown,
    };
  }
}
