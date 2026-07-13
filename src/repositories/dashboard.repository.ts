import { prisma, isPrismaActive, checkDatabaseConnection } from "../lib/db.ts";
import {
  mockSalesOrders,
  mockSalesOrderItems,
  mockInvoices,
  mockPayments,
  mockCustomers,
  mockProducts,
  mockStockLevels,
  mockPurchaseOrders,
} from "../lib/db.ts";
import { SalesOrderStatus, InvoiceStatus, PurchaseOrderStatus } from "@prisma/client";

export interface DashboardMetrics {
  cards: {
    revenue: number;
    salesCount: number;
    salesVolume: number;
    customersCount: number;
    productsCount: number;
    lowStockCount: number;
    ordersCount: number;
  };
  recentSales: any[];
  topCustomers: {
    id: string;
    companyName: string | null;
    contactName: string;
    email: string;
    totalSpent: number;
    ordersCount: number;
  }[];
  topProducts: {
    id: string;
    name: string;
    sku: string;
    price: number;
    quantitySold: number;
    revenue: number;
  }[];
}

export class DashboardRepository {
  /**
   * Get all aggregated dashboard data
   */
  static async getDashboardMetrics(): Promise<DashboardMetrics> {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        // 1. Fetch DB metrics in parallel
        const [
          paymentsTotal,
          salesOrders,
          customersCount,
          productsCount,
          stockLevels,
          purchaseOrdersCount,
          recentSalesOrders,
          salesOrderItems,
        ] = await Promise.all([
          // Revenue: Sum of all completed payment amounts
          prisma.payment.aggregate({
            _sum: { amountPaid: true },
          }),
          // Sales orders count & total sum
          prisma.salesOrder.findMany({
            where: {
              status: { in: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.SHIPPED] },
            },
            select: { totalAmount: true },
          }),
          // Customers count
          prisma.customer.count({
            where: { isDeleted: false },
          }),
          // Products count
          prisma.product.count({
            where: { isDeleted: false },
          }),
          // Stock levels for low stock calculation
          prisma.stockLevel.findMany({
            select: { quantity: true, reorderPoint: true },
          }),
          // Purchase orders count
          prisma.purchaseOrder.count(),
          // Recent sales (top 5 recent orders)
          prisma.salesOrder.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
              customer: true,
              createdBy: { include: { profile: true } },
            },
          }),
          // Sales order items for top products/customers calculation
          prisma.salesOrderItem.findMany({
            where: {
              salesOrder: {
                status: { in: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.SHIPPED] },
              },
            },
            include: {
              product: true,
              salesOrder: {
                include: {
                  customer: true,
                },
              },
            },
          }),
        ]);

        // Calculate card metrics
        const revenue = Number(paymentsTotal._sum.amountPaid || 0);
        const salesCount = salesOrders.length;
        const salesVolume = salesOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
        const lowStockCount = stockLevels.filter(
          (s) => Number(s.quantity) <= Number(s.reorderPoint)
        ).length;
        const ordersCount = salesCount + purchaseOrdersCount;

        // Calculate Recent Sales formatting
        const recentSales = recentSalesOrders.map((so) => ({
          id: so.id,
          orderNumber: so.orderNumber,
          customerName: so.customer.companyName || so.customer.contactName,
          totalAmount: Number(so.totalAmount),
          status: so.status,
          createdAt: so.createdAt,
        }));

        // Calculate Top Customers
        const customerMap = new Map<string, { info: any; totalSpent: number; count: number }>();
        salesOrders.forEach(() => {}); // Prepare map from items
        salesOrderItems.forEach((item) => {
          const so = item.salesOrder;
          if (!so || !so.customer) return;
          const cust = so.customer;
          const current = customerMap.get(cust.id) || {
            info: cust,
            totalSpent: 0,
            count: 0,
          };
          customerMap.set(cust.id, {
            info: cust,
            totalSpent: current.totalSpent + Number(item.totalPrice),
            count: current.count, // will compute below per unique salesOrder
          });
        });

        // Track unique order count per customer
        const customerOrdersMap = new Map<string, Set<string>>();
        salesOrderItems.forEach((item) => {
          const so = item.salesOrder;
          if (!so || !so.customer) return;
          const set = customerOrdersMap.get(so.customerId) || new Set<string>();
          set.add(so.id);
          customerOrdersMap.set(so.customerId, set);
        });

        const topCustomers = Array.from(customerMap.values())
          .map((c) => ({
            id: c.info.id,
            companyName: c.info.companyName,
            contactName: c.info.contactName,
            email: c.info.email,
            totalSpent: Math.round(c.totalSpent * 100) / 100,
            ordersCount: customerOrdersMap.get(c.info.id)?.size || 0,
          }))
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, 5);

        // Calculate Top Products
        const productMap = new Map<string, { info: any; quantitySold: number; revenue: number }>();
        salesOrderItems.forEach((item) => {
          if (!item.product) return;
          const prod = item.product;
          const current = productMap.get(prod.id) || {
            info: prod,
            quantitySold: 0,
            revenue: 0,
          };
          productMap.set(prod.id, {
            info: prod,
            quantitySold: current.quantitySold + Number(item.quantity),
            revenue: current.revenue + Number(item.totalPrice),
          });
        });

        const topProducts = Array.from(productMap.values())
          .map((p) => ({
            id: p.info.id,
            name: p.info.name,
            sku: p.info.sku,
            price: Number(p.info.price),
            quantitySold: p.quantitySold,
            revenue: Math.round(p.revenue * 100) / 100,
          }))
          .sort((a, b) => b.quantitySold - a.quantitySold)
          .slice(0, 5);

        return {
          cards: {
            revenue: Math.round(revenue * 100) / 100,
            salesCount,
            salesVolume: Math.round(salesVolume * 100) / 100,
            customersCount,
            productsCount,
            lowStockCount,
            ordersCount,
          },
          recentSales,
          topCustomers,
          topProducts,
        };
      } catch (err) {
        console.error("Prisma error in DashboardRepository, using mock fallback:", err);
      }
    }

    // ==========================================
    // IN-MEMORY / MOCK FALLBACK
    // ==========================================

    // Revenue: sum of payments
    const revenue = mockPayments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);

    // Sales Orders (Confirmed/Shipped)
    const activeSalesOrders = mockSalesOrders.filter(
      (so) => so.status === SalesOrderStatus.CONFIRMED || so.status === SalesOrderStatus.SHIPPED
    );
    const salesCount = activeSalesOrders.length;
    const salesVolume = activeSalesOrders.reduce((sum, so) => sum + Number(so.totalAmount), 0);

    // Counts
    const customersCount = mockCustomers.filter((c) => !c.isDeleted).length;
    const productsCount = mockProducts.filter((p) => !p.isDeleted).length;
    const lowStockCount = mockStockLevels.filter(
      (s) => Number(s.quantity) <= Number(s.reorderPoint)
    ).length;
    const ordersCount = salesCount + mockPurchaseOrders.length;

    // Recent Sales (top 5)
    const recentSales = [...mockSalesOrders]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((so) => {
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

    // Top Customers in Mock
    const customerMap = new Map<string, { info: any; totalSpent: number; count: number }>();
    mockSalesOrderItems.forEach((item) => {
      const so = mockSalesOrders.find((o) => o.id === item.salesOrderId);
      if (!so || (so.status !== SalesOrderStatus.CONFIRMED && so.status !== SalesOrderStatus.SHIPPED)) {
        return;
      }
      const cust = mockCustomers.find((c) => c.id === so.customerId);
      if (!cust) return;

      const current = customerMap.get(cust.id) || {
        info: cust,
        totalSpent: 0,
        count: 0,
      };
      customerMap.set(cust.id, {
        info: cust,
        totalSpent: current.totalSpent + Number(item.totalPrice),
        count: current.count,
      });
    });

    const customerOrdersMap = new Map<string, Set<string>>();
    mockSalesOrderItems.forEach((item) => {
      const so = mockSalesOrders.find((o) => o.id === item.salesOrderId);
      if (!so || (so.status !== SalesOrderStatus.CONFIRMED && so.status !== SalesOrderStatus.SHIPPED)) {
        return;
      }
      const set = customerOrdersMap.get(so.customerId) || new Set<string>();
      set.add(so.id);
      customerOrdersMap.set(so.customerId, set);
    });

    const topCustomers = Array.from(customerMap.values())
      .map((c) => ({
        id: c.info.id,
        companyName: c.info.companyName,
        contactName: c.info.contactName,
        email: c.info.email,
        totalSpent: Math.round(c.totalSpent * 100) / 100,
        ordersCount: customerOrdersMap.get(c.info.id)?.size || 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    // Top Products in Mock
    const productMap = new Map<string, { info: any; quantitySold: number; revenue: number }>();
    mockSalesOrderItems.forEach((item) => {
      const so = mockSalesOrders.find((o) => o.id === item.salesOrderId);
      if (!so || (so.status !== SalesOrderStatus.CONFIRMED && so.status !== SalesOrderStatus.SHIPPED)) {
        return;
      }
      const prod = mockProducts.find((p) => p.id === item.productId);
      if (!prod) return;

      const current = productMap.get(prod.id) || {
        info: prod,
        quantitySold: 0,
        revenue: 0,
      };
      productMap.set(prod.id, {
        info: prod,
        quantitySold: current.quantitySold + Number(item.quantity),
        revenue: current.revenue + Number(item.totalPrice),
      });
    });

    const topProducts = Array.from(productMap.values())
      .map((p) => ({
        id: p.info.id,
        name: p.info.name,
        sku: p.info.sku,
        price: Number(p.info.price),
        quantitySold: p.quantitySold,
        revenue: Math.round(p.revenue * 100) / 100,
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    return {
      cards: {
        revenue: Math.round(revenue * 100) / 100,
        salesCount,
        salesVolume: Math.round(salesVolume * 100) / 100,
        customersCount,
        productsCount,
        lowStockCount,
        ordersCount,
      },
      recentSales,
      topCustomers,
      topProducts,
    };
  }
}
