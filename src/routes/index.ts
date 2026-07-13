import { Router } from "express";
import authRoutes from "./auth.ts";
import hrRoutes from "./hr.ts";
import inventoryRoutes from "./inventory.ts";
import productRoutes from "./product.route.ts";
import salesRoutes from "./sales.ts";
import purchasingRoutes from "./purchasing.ts";
import financeRoutes from "./finance.ts";
import supplierRoutes from "./supplier.ts";
import customerRoutes from "./customer.ts";
import paymentRoutes from "./payment.ts";
import dashboardRoutes from "./dashboard.ts";
import reportsRoutes from "./reports.ts";
import notificationsRoutes from "./notifications.ts";
import storageRoutes from "./storage.ts";
import activityLogRoutes from "./activity-log.ts";

const apiRouter = Router();

// Mount modules onto distinct namespace paths
apiRouter.use("/auth", authRoutes);
apiRouter.use("/hr", hrRoutes);
apiRouter.use("/inventory", inventoryRoutes);
apiRouter.use("/products", productRoutes);
apiRouter.use("/sales", salesRoutes);
apiRouter.use("/purchasing", purchasingRoutes);
apiRouter.use("/finance", financeRoutes);
apiRouter.use("/suppliers", supplierRoutes);
apiRouter.use("/customers", customerRoutes);
apiRouter.use("/payments", paymentRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/reports", reportsRoutes);
apiRouter.use("/notifications", notificationsRoutes);
apiRouter.use("/storage", storageRoutes);
apiRouter.use("/activity-logs", activityLogRoutes);

export default apiRouter;
