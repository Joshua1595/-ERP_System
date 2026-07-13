import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/ThemeContext.tsx";
import Layout from "./components/Layout.tsx";
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Products from "./pages/Products.tsx";
import Sales from "./pages/Sales.tsx";
import Purchasing from "./pages/Purchasing.tsx";
import HR from "./pages/HR.tsx";
import Finance from "./pages/Finance.tsx";
import ActivityLogs from "./pages/ActivityLogs.tsx";
import UserManagement from "./pages/UserManagement.tsx";
import { getDefaultDashboardPath } from "./lib/permissions.ts";

// Initialize the Query Client for optimized enterprise state queries
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000, // 5 seconds stale time before caching triggers
    },
  },
});

// Route Guard to verify session presence
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("erp_access_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Route Guard to verify role permissions for professional RBAC
function RoleGate({ allowedRoles, children }: { allowedRoles: string[]; children: React.ReactNode }) {
  const storedUser = localStorage.getItem("erp_user");
  if (!storedUser) {
    return <Navigate to="/login" replace />;
  }
  try {
    const user = JSON.parse(storedUser);
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to={getDefaultDashboardPath(user.role)} replace />;
    }
  } catch (err) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RootRedirect() {
  const storedUser = localStorage.getItem("erp_user");
  if (!storedUser) return <Navigate to="/login" replace />;
  try {
    const user = JSON.parse(storedUser);
    return <Navigate to={getDefaultDashboardPath(user.role)} replace />;
  } catch (_) {
    return <Navigate to="/login" replace />;
  }
}

function FallbackRedirect() {
  const storedUser = localStorage.getItem("erp_user");
  if (!storedUser) return <Navigate to="/login" replace />;
  try {
    const user = JSON.parse(storedUser);
    return <Navigate to={getDefaultDashboardPath(user.role)} replace />;
  } catch (_) {
    return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Gateway */}
            <Route path="/login" element={<Login />} />

            {/* Root redirect based on role */}
            <Route path="/" element={<RequireAuth><RootRedirect /></RequireAuth>} />

            {/* Admin Protected Routes */}
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RoleGate allowedRoles={["ADMIN"]}>
                    <Layout />
                  </RoleGate>
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="sales" element={<Sales />} />
              <Route path="purchasing" element={<Purchasing />} />
              <Route path="hr" element={<HR />} />
              <Route path="finance" element={<Finance />} />
              <Route path="logs" element={<ActivityLogs />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="*" element={<FallbackRedirect />} />
            </Route>

            {/* Logistics Manager Protected Routes */}
            <Route
              path="/logistics"
              element={
                <RequireAuth>
                  <RoleGate allowedRoles={["MANAGER"]}>
                    <Layout />
                  </RoleGate>
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/logistics/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="purchasing" element={<Purchasing />} />
              <Route path="*" element={<FallbackRedirect />} />
            </Route>

            {/* Treasury Accountant Protected Routes */}
            <Route
              path="/finance"
              element={
                <RequireAuth>
                  <RoleGate allowedRoles={["ACCOUNTANT"]}>
                    <Layout />
                  </RoleGate>
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/finance/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="sales" element={<Sales />} />
              <Route path="finance" element={<Finance />} />
              <Route path="hr" element={<HR />} />
              <Route path="*" element={<FallbackRedirect />} />
            </Route>

            {/* Standard Employee Protected Routes */}
            <Route
              path="/employee"
              element={
                <RequireAuth>
                  <RoleGate allowedRoles={["EMPLOYEE"]}>
                    <Layout />
                  </RoleGate>
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/employee/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="hr" element={<HR />} />
              <Route path="*" element={<FallbackRedirect />} />
            </Route>

            {/* Universal Fallback */}
            <Route path="*" element={<FallbackRedirect />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
