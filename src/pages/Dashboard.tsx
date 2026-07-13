import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Package, 
  AlertTriangle, 
  ShoppingCart, 
  RefreshCw, 
  TrendingDown, 
  Sparkles, 
  Clock,
  Building2,
  CheckCircle,
  FileText,
  ShieldAlert,
  Coins,
  UserCheck,
  Calendar,
  ArrowUpDown,
  Layers,
  ArrowRightLeft,
  ClipboardList,
  Wallet,
  CreditCard,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  PieChart,
  ListTodo,
  CalendarDays,
  Bell,
  User,
  CheckSquare,
  AlertCircle,
  Edit3
} from "lucide-react";
import { api } from "../lib/api.ts";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  Legend,
  AreaChart,
  Area
} from "recharts";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(() => {
    const stored = localStorage.getItem("erp_user");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (err) {
        return null;
      }
    }
    return null;
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  // SCM Sourced Real-Time Tasks & Leaves states (React Query)
  const { data: tasksData } = useQuery({
    queryKey: ["employeeTasks"],
    queryFn: async () => {
      const res = await api.get("/hr/tasks");
      return res?.data?.data?.tasks ?? [];
    },
    enabled: !!user,
  });
  const tasks = tasksData ?? [];

  const { data: leaveRequestsData } = useQuery({
    queryKey: ["employeeLeaves"],
    queryFn: async () => {
      const res = await api.get("/hr/leaves");
      return res?.data?.data?.leaves ?? [];
    },
    enabled: !!user,
  });
  const leaveRequests = leaveRequestsData ?? [];

  const [leaveType, setLeaveType] = useState("ANNUAL");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  const [notifications, setNotifications] = useState<any[]>([
    { id: "notif-1", title: "Q3 Strategy Meeting", msg: "Townhall scheduled next Monday at 14:00 UTC.", type: "system", date: "Today" },
    { id: "notif-2", title: "Payroll Ledger Notice", msg: "Monthly payroll processing initialized. Keep attendance updated.", type: "finance", date: "Yesterday" }
  ]);

  // Logistics Manager states
  const [managerActiveTab, setManagerActiveTab] = useState<"leaves" | "tasks" | "attendance">("leaves");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");

  // Mutations for SCM Staff Integration
  const toggleTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/hr/tasks/${id}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeTasks"] });
    }
  });

  const toggleTask = (id: string) => {
    toggleTaskMutation.mutate(id);
  };

  const requestLeaveMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/hr/leaves", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeLeaves"] });
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveReason("");
    }
  });

  const handleRequestLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd || !leaveReason) return;
    requestLeaveMutation.mutate({
      type: leaveType,
      start: leaveStart,
      end: leaveEnd,
      reason: leaveReason
    });
  };

  const dismissNotif = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const leaveStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "APPROVED" | "REJECTED" }) => {
      await api.patch(`/hr/leaves/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeLeaves"] });
    }
  });

  const handleApproveLeave = (id: string) => {
    leaveStatusMutation.mutate({ id, status: "APPROVED" });
  };

  const handleRejectLeave = (id: string) => {
    leaveStatusMutation.mutate({ id, status: "REJECTED" });
  };

  const createTaskMutation = useMutation({
    mutationFn: async (payload: { title: string; desc: string }) => {
      await api.post("/hr/tasks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeTasks"] });
      setNewTaskTitle("");
      setNewTaskDesc("");
    }
  });

  const handleCreateTaskByManager = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !newTaskDesc) return;
    createTaskMutation.mutate({ title: newTaskTitle, desc: newTaskDesc });
  };

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeTasks"] });
    }
  });

  const handleDeleteTaskByManager = (id: string) => {
    deleteTaskMutation.mutate(id);
  };

  // Tick the clock and sync user updates
  useEffect(() => {
    const fetchLatestUser = async () => {
      try {
        const res = await api.get("/auth/me");
        if (res.data?.status === "success") {
          const u = res.data.data.user;
          setUser(u);
          localStorage.setItem("erp_user", JSON.stringify(u));
        }
      } catch (err) {
        // Safe fallback
      }
    };

    fetchLatestUser();

    const handleUserUpdated = () => {
      const stored = localStorage.getItem("erp_user");
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch (err) {
          // Safe fallback
        }
      }
    };

    window.addEventListener("erp_user_updated", handleUserUpdated);

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      window.removeEventListener("erp_user_updated", handleUserUpdated);
      clearInterval(timer);
    };
  }, []);

  const role = user?.role || "EMPLOYEE";

  const renderDashboardWelcomeHeader = (title: string, subtitle: string, gradientFrom: string = "from-indigo-600", gradientTo: string = "to-violet-600") => {
    const displayName = user?.profile?.firstName 
      ? `${user.profile.firstName} ${user.profile.lastName}` 
      : user?.firstName 
      ? `${user.firstName} ${user.lastName}` 
      : user?.email?.split("@")[0] || "Operator";

    return (
      <div className={`relative overflow-hidden bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-3xl p-6 text-white shadow-xl shadow-indigo-600/5 mb-6`}>
        {/* Abstract Background Tech Decor */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute -right-20 -bottom-20 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -top-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: User Profile Avatar & Info */}
          <div className="flex items-center gap-4.5">
            {/* Beautiful Profile Avatar */}
            <div 
              onClick={() => window.dispatchEvent(new Event("open_profile_modal"))}
              className="relative group shrink-0 cursor-pointer"
              title="Click to edit profile"
            >
              {/* Outer double ring gradient border */}
              <div className="absolute -inset-1 bg-gradient-to-tr from-yellow-400 via-pink-500 to-indigo-500 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-500" />
              
              <div className="relative overflow-hidden rounded-2xl border-2 border-white/80 dark:border-zinc-900/80 shadow-md h-16 w-16 bg-white/10">
                {user?.profile?.profilePhotoUrl ? (
                  <img
                    src={user.profile.profilePhotoUrl}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover group-hover:scale-110 transition duration-500"
                  />
                ) : (
                  <div className="h-full w-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white">
                    <User className="h-7 w-7" />
                  </div>
                )}
                
                {/* Hover overlay with Edit action */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-[10px] font-bold text-white uppercase tracking-wider gap-1">
                  <Edit3 className="h-4 w-4 text-emerald-400" />
                  <span className="scale-90">Edit</span>
                </div>
              </div>

              {/* Status Indicator Dot */}
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 z-20">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 bg-white rounded-full"></div>
                </span>
              </span>
            </div>

            {/* Profile Info Details */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-200 bg-white/15 px-2.5 py-0.5 rounded-full backdrop-blur-md border border-white/5">
                  {role} AUTHORITY
                </span>
                <span className="text-[9px] font-mono font-bold text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Node
                </span>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-white leading-tight flex items-center gap-2">
                  Welcome back, {displayName}!
                </h2>
                <p className="text-[11px] text-indigo-100/70 mt-0.5">
                  Secure Enterprise Resource Management Operator
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-indigo-100/90 font-medium">
                <span className="font-mono text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">ID: {user?.id?.slice(0, 8) || "N/A"}</span>
                <span className="h-1 w-1 rounded-full bg-indigo-200 opacity-50"></span>
                <span className="opacity-90">{title}</span>
                <span className="h-1 w-1 rounded-full bg-indigo-200 opacity-50"></span>
                <button 
                  onClick={() => window.dispatchEvent(new Event("open_profile_modal"))}
                  className="text-[11px] text-emerald-300 hover:text-emerald-200 font-bold underline transition-colors cursor-pointer"
                >
                  Edit Profile Card
                </button>
              </div>
            </div>
          </div>

          {/* Right: Dynamic Interactive Clock & Date Widget */}
          <div className="bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-4.5 flex items-center gap-4 shrink-0 shadow-inner">
            <div className="space-y-0.5 text-right font-sans">
              <div className="text-[9px] font-mono font-bold tracking-widest text-indigo-200 uppercase">SYS-TIME SEQUENCE</div>
              <div className="text-2xl font-black font-mono tracking-widest text-white leading-none">
                {currentTime.toLocaleTimeString()}
              </div>
              <div className="text-[10px] font-mono font-bold text-indigo-100/80 mt-0.5">
                {currentTime.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
              </div>
            </div>
            
            {/* Visual ticking clock graphic */}
            <div className="p-2.5 bg-white/15 rounded-xl border border-white/10 shadow-sm flex items-center justify-center animate-pulse">
              <Clock className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 1. GENERAL QUERIES
  // ==========================================
  const { data: metrics, isLoading: isLoadingMetrics, refetch: refetchMetrics, isFetching: isFetchingMetrics } = useQuery({
    queryKey: ["dashboardMetrics"],
    queryFn: async () => {
      try {
        const res = await api.get("/dashboard/metrics");
        return res?.data?.data ?? { cards: { revenue: 0, salesVolume: 0, salesCount: 0 }, topProducts: [] };
      } catch (err) {
        console.error("Error fetching dashboard metrics:", err);
        return { cards: { revenue: 0, salesVolume: 0, salesCount: 0 }, topProducts: [] };
      }
    },
    enabled: role !== "EMPLOYEE",
    staleTime: 15000,
  });

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      await api.post("/dashboard/cache/clear");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
    },
  });

  // ==========================================
  // 2. LOGISTICS MANAGER QUERIES
  // ==========================================
  const { data: movements, isLoading: isLoadingMovements } = useQuery({
    queryKey: ["dashboardMovements"],
    queryFn: async () => {
      try {
        const res = await api.get("/inventory/movements");
        return res?.data?.data?.movements ?? [];
      } catch (err) {
        console.error("Error fetching movements:", err);
        return [];
      }
    },
    enabled: role === "MANAGER" || role === "ADMIN",
  });

  const { data: purchaseOrders, isLoading: isLoadingPO } = useQuery({
    queryKey: ["dashboardPurchaseOrders"],
    queryFn: async () => {
      try {
        const res = await api.get("/purchasing/orders");
        return res?.data?.data?.orders ?? [];
      } catch (err) {
        console.error("Error fetching purchase orders:", err);
        return [];
      }
    },
    enabled: role === "MANAGER" || role === "ADMIN",
  });

  const { data: warehouses } = useQuery({
    queryKey: ["dashboardWarehouses"],
    queryFn: async () => {
      try {
        const res = await api.get("/inventory/warehouses");
        return res?.data?.data?.warehouses ?? [];
      } catch (err) {
        console.error("Error fetching warehouses:", err);
        return [];
      }
    },
    enabled: role === "MANAGER" || role === "ADMIN",
  });

  const { data: productsList } = useQuery({
    queryKey: ["dashboardProducts"],
    queryFn: async () => {
      try {
        const res = await api.get("/products");
        return res?.data?.data?.products ?? [];
      } catch (err) {
        console.error("Error fetching products list:", err);
        return [];
      }
    },
    enabled: role === "MANAGER" || role === "ADMIN",
  });

  // ==========================================
  // 3. TREASURY ACCOUNTANT QUERIES
  // ==========================================
  const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ["dashboardAccounts"],
    queryFn: async () => {
      try {
        const res = await api.get("/finance/accounts");
        return res?.data?.data?.accounts ?? [];
      } catch (err) {
        console.error("Error fetching accounts:", err);
        return [];
      }
    },
    enabled: role === "ACCOUNTANT" || role === "ADMIN",
  });

  const { data: journals, isLoading: isLoadingJournals } = useQuery({
    queryKey: ["dashboardJournals"],
    queryFn: async () => {
      try {
        const res = await api.get("/finance/journals");
        return res?.data?.data?.journals ?? [];
      } catch (err) {
        console.error("Error fetching journals:", err);
        return [];
      }
    },
    enabled: role === "ACCOUNTANT" || role === "ADMIN",
  });

  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ["dashboardInvoices"],
    queryFn: async () => {
      try {
        const res = await api.get("/sales/invoices");
        return res?.data?.data?.invoices ?? [];
      } catch (err) {
        console.error("Error fetching invoices:", err);
        return [];
      }
    },
    enabled: role === "ACCOUNTANT" || role === "ADMIN",
  });

  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ["dashboardPayments"],
    queryFn: async () => {
      try {
        const res = await api.get("/payments");
        return res?.data?.data?.payments ?? [];
      } catch (err) {
        console.error("Error fetching payments:", err);
        return [];
      }
    },
    enabled: role === "ACCOUNTANT" || role === "ADMIN",
  });

  // ==========================================
  // 4. STANDARD EMPLOYEE QUERIES & MUTATIONS
  // ==========================================
  const { data: employees } = useQuery({
    queryKey: ["dashboardEmployees"],
    queryFn: async () => {
      try {
        const res = await api.get("/hr/employees");
        return res?.data?.data?.employees ?? [];
      } catch (err) {
        console.error("Error fetching employees:", err);
        return [];
      }
    },
    enabled: role === "EMPLOYEE",
  });

  const { data: attendances, refetch: refetchAttendance } = useQuery({
    queryKey: ["dashboardAttendance"],
    queryFn: async () => {
      try {
        const res = await api.get("/hr/attendance");
        return res?.data?.data?.attendances ?? [];
      } catch (err) {
        console.error("Error fetching attendance:", err);
        return [];
      }
    },
    enabled: role === "EMPLOYEE" || role === "MANAGER" || role === "ADMIN",
  });

  const { data: salaryPayments } = useQuery({
    queryKey: ["dashboardSalaryPayments"],
    queryFn: async () => {
      try {
        const res = await api.get("/hr/salaries");
        return res?.data?.data?.payments ?? [];
      } catch (err) {
        console.error("Error fetching salaries:", err);
        return [];
      }
    },
    enabled: role === "EMPLOYEE",
  });

  const currentEmployee = employees?.find((emp: any) => emp.userId === user?.id);

  const clockMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/hr/attendance", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardAttendance"] });
      refetchAttendance();
    }
  });

  const handleClockIn = () => {
    if (!currentEmployee) return;
    clockMutation.mutate({
      employeeId: currentEmployee.id,
      date: new Date().toISOString().split("T")[0],
      status: "PRESENT",
      checkIn: new Date().toISOString(),
      notes: "Auto clock-in registered from Operations Portal."
    });
  };

  // Safe checks for layout loading
  if (role !== "EMPLOYEE" && isLoadingMetrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
        <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">Assembling ERP role matrix stream...</p>
      </div>
    );
  }

  // =========================================================================
  // RENDER INTERFACES BY ACTIVE ROLE
  // =========================================================================

  // -------------------------------------------------------------------------
  // ROLE 1: ADMIN (Full Control Dashboard)
  // -------------------------------------------------------------------------
  if (role === "ADMIN") {
    const chartData = [
      { name: "Rev (Actual)", value: metrics?.cards.revenue || 0 },
      { name: "Est Vol", value: metrics?.cards.salesVolume || 0 },
      { name: "Avg/Order", value: (metrics?.cards.salesCount || 0) > 0 ? Math.round(metrics.cards.salesVolume / metrics.cards.salesCount) : 0 },
    ];

    const productData = (metrics?.topProducts || []).map((p: any) => ({
      name: p.name.length > 10 ? p.sku : p.name,
      sold: p.quantitySold,
      revenue: p.revenue,
    }));

    return (
      <div className="space-y-6">
        {/* Modern Welcome Header Banner */}
        {renderDashboardWelcomeHeader(
          "Executive Control Suite • Active Administration Command Desk",
          "Complete platform telemetry, database configuration controls, and role authorizations.",
          "from-slate-900",
          "to-zinc-800"
        )}

        {/* Upper Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-zinc-800/50 pb-5">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-indigo-500 animate-pulse" />
              Strategic Analytics Control
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Real-time enterprise balance sheets, automated logs, and ledger indices.</p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => refetchMetrics()}
              disabled={isFetchingMetrics}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-850 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetchingMetrics ? "animate-spin" : ""}`} />
              Sync Stream
            </button>
            <button
              onClick={() => clearCacheMutation.mutate()}
              disabled={clearCacheMutation.isPending}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              Flush Cache
            </button>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest font-mono">Gross Revenue</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono">${(metrics?.cards.revenue || 0).toLocaleString()}</h3>
            <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ Audit Confirmed</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest font-mono">Booked Sales</span>
              <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono">${(metrics?.cards.salesVolume || 0).toLocaleString()}</h3>
            <p className="text-[10px] text-indigo-500 font-bold mt-1">{metrics?.cards.salesCount || 0} Complete Orders</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest font-mono">Product SKUs</span>
              <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
                <Package className="h-4.5 w-4.5" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono">{metrics?.cards.productsCount || 0} Items</h3>
            <p className="text-[10px] text-blue-500 font-bold mt-1">Across all facilities</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest font-mono">Stock Warnings</span>
              <div className={`p-2 rounded-xl border ${metrics?.cards.lowStockCount > 0 ? "bg-red-500/10 text-red-600 border-red-500/20 animate-pulse" : "bg-slate-100 text-slate-500"}`}>
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono">{metrics?.cards.lowStockCount || 0} SKU Alerts</h3>
            <p className="text-[10px] text-red-500 font-bold mt-1">Requires Purchasing</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4">Revenue vs Sales Volume</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#A0AEC0" fontSize={10} tickLine={false} />
                  <YAxis stroke="#A0AEC0" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#1F2937", border: "none", borderRadius: "12px", color: "#FFF", fontSize: "11px" }} />
                  <Bar dataKey="value" fill="#4F46E5" radius={[8, 8, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4">Top Performing SKUs</h3>
            <div className="h-64">
              {productData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={productData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#A0AEC0" fontSize={9} />
                    <YAxis stroke="#A0AEC0" fontSize={9} />
                    <Tooltip contentStyle={{ background: "#1F2937", border: "none", color: "#FFF", fontSize: "11px" }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Line type="monotone" dataKey="sold" name="Units" stroke="#10B981" strokeWidth={2} />
                    <Line type="monotone" dataKey="revenue" name="Rev ($)" stroke="#4F46E5" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">No Sales Recorded.</div>
              )}
            </div>
          </div>
        </div>

        {/* Tables Column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">Recent Sales Orders</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-zinc-800 text-slate-400 font-mono">
                    <th className="py-2">Order No</th>
                    <th className="py-2">Customer</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Total Amount</th>
                    <th className="py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {(metrics?.recentSales || []).map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                      <td className="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{sale.orderNumber}</td>
                      <td className="py-3 font-semibold">{sale.customerName}</td>
                      <td className="py-3 text-slate-400">{new Date(sale.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 font-mono font-bold">${sale.totalAmount.toLocaleString()}</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600">
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">Top Accounts</h3>
            <div className="space-y-4">
              {(metrics?.topCustomers || []).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold truncate">{c.companyName || c.contactName}</h4>
                    <p className="text-[10px] text-slate-400">{c.ordersCount} Completed Orders</p>
                  </div>
                  <span className="text-xs font-mono font-black text-indigo-600">${c.totalSpent.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // ROLE 2: LOGISTIC MANAGER (Logistics & Inventory)
  // -------------------------------------------------------------------------
  if (role === "MANAGER") {
    // Compile Warehouses Utilization
    const utilizationData = (warehouses || []).map((wh: any) => {
      // Find matching stock level amounts
      const matchingStocks = (productsList || []).reduce((acc: number, p: any) => {
        const whStock = p.stockLevels?.find((sl: any) => sl.warehouseId === wh.id);
        return acc + (whStock ? Number(whStock.quantity) : 0);
      }, 0);

      return {
        name: wh.code,
        units: matchingStocks,
        utilization: matchingStocks > 0 ? Math.min(100, Math.round((matchingStocks / 5000) * 100)) : 0,
      };
    });

    const incomingFreightCount = (purchaseOrders || []).filter((o: any) => o.status === "ORDERED" || o.status === "PENDING").length;
    const outgoingDispatchesCount = (metrics?.recentSales || []).filter((so: any) => so.status === "CONFIRMED" || so.status === "SHIPPED").length;

    const lowStockDetails = (productsList || []).filter((p: any) => {
      const totalQty = p.stockLevels?.reduce((sum: number, s: any) => sum + Number(s.quantity), 0) || 0;
      const reorder = p.stockLevels?.[0]?.reorderPoint || 10;
      return totalQty <= reorder;
    });

    return (
      <div className="space-y-6">
        {/* Modern Welcome Header Banner */}
        {renderDashboardWelcomeHeader(
          "SCM & Logistics Control Center • Operational Fulfillment Hub",
          "Track warehouse stock levels, purchase orders, incoming freight, and dispatch statuses.",
          "from-blue-700",
          "to-indigo-800"
        )}

        {/* Upper Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-zinc-800/50 pb-5">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              SCM & Logistics Control Grid
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Inventory volume, warehousing utilization, purchase requisitions, and supply chain tracking.</p>
          </div>
          <button
            onClick={() => refetchMetrics()}
            className="flex items-center gap-2 py-2 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-850 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh Logistics Data
          </button>
        </div>

        {/* 6 Grid KPIs for Logistics */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Products Catalog</span>
            <h3 className="text-lg font-black font-mono text-slate-900 dark:text-white">{metrics?.cards.productsCount || 0} SKUs</h3>
            <span className="text-[9px] text-indigo-500 font-semibold">Active Directory</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Warehouse Nodes</span>
            <h3 className="text-lg font-black font-mono text-slate-900 dark:text-white">{(warehouses || []).length || 2} Nodes</h3>
            <span className="text-[9px] text-emerald-500 font-semibold">All Systems Nominal</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Critical Alerts</span>
            <h3 className="text-lg font-black font-mono text-red-600">{metrics?.cards.lowStockCount || 0} SKUs</h3>
            <span className="text-[9px] text-red-400 font-semibold">Requires Attention</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pending POs</span>
            <h3 className="text-lg font-black font-mono text-slate-900 dark:text-white">{(purchaseOrders || []).filter((o: any) => o.status === "PENDING" || o.status === "ORDERED").length || 1} Orders</h3>
            <span className="text-[9px] text-amber-500 font-semibold">Awaiting Delivery</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Incoming Freight</span>
            <h3 className="text-lg font-black font-mono text-slate-900 dark:text-white">{incomingFreightCount} scheduled</h3>
            <span className="text-[9px] text-blue-500 font-semibold">Lead-time tracked</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Outgoing Dispatches</span>
            <h3 className="text-lg font-black font-mono text-slate-900 dark:text-white">{outgoingDispatchesCount} Queued</h3>
            <span className="text-[9px] text-purple-500 font-semibold">Ready to route</span>
          </div>
        </div>

        {/* Visualizers Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4">Warehouse Space Utilization %</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationData.length > 0 ? utilizationData : [
                  { name: "WH-MAIN", utilization: 82 },
                  { name: "WH-EAST", utilization: 61 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={10} unit="%" />
                  <Tooltip />
                  <Bar dataKey="utilization" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-3">Critical Supply Alerts</h3>
            <div className="space-y-3 overflow-y-auto max-h-[240px]">
              {lowStockDetails.map((p: any) => (
                <div key={p.id} className="p-3 border border-red-200/20 bg-red-500/5 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold">{p.name}</h4>
                    <span className="text-[10px] font-mono text-slate-400">{p.sku}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-red-600 block">Critical</span>
                    <span className="text-[9px] text-slate-400">Reorder Required</span>
                  </div>
                </div>
              ))}
              {lowStockDetails.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400 italic">No low-stock alerts detected. All warehouse bins nominal.</div>
              )}
            </div>
          </div>
        </div>

        {/* Inventory & PO Data Rows */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">Recent Stock Movements</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {(movements || []).slice(0, 5).map((move: any) => (
                <div key={move.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-850">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${move.quantityChange > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                      <ArrowRightLeft className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold">{move.product?.name || "Product Item"}</h4>
                      <p className="text-[9px] font-mono text-slate-400">{move.type} • {move.referenceNumber || "Manual"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-bold text-xs ${move.quantityChange > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {move.quantityChange > 0 ? `+${move.quantityChange}` : move.quantityChange}
                    </span>
                    <span className="block text-[9px] text-slate-400 font-mono">{move.product?.unitOfMeasure}</span>
                  </div>
                </div>
              ))}
              {(movements || []).length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400 italic">No inventory movements recorded yet.</div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4">Recent Purchase Orders</h3>
            <div className="space-y-3">
              {(purchaseOrders || []).slice(0, 5).map((po: any) => (
                <div key={po.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-850">
                  <div>
                    <h4 className="text-xs font-bold font-mono text-indigo-600">{po.poNumber}</h4>
                    <p className="text-[10px] text-slate-400">Supplier: {po.supplier?.companyName || "Vendor Corp"}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold block">${Number(po.totalAmount).toLocaleString()}</span>
                    <span className="px-2 py-0.2 rounded-full text-[8px] font-bold bg-amber-500/10 text-amber-600">
                      {po.status}
                    </span>
                  </div>
                </div>
              ))}
              {(purchaseOrders || []).length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400 italic">No purchase orders drafted.</div>
              )}
            </div>
          </div>
        </div>

        {/* Workforce Operations & Scheduling Hub */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-6 shadow-sm mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4 mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Workforce Operations Hub (Staff Logistics)
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Coordinate logistics staff, approve leave requests, and dispatch daily operational tasks.</p>
            </div>
            {/* Tabs selector */}
            <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl shrink-0 gap-1 border border-slate-200/20">
              <button
                type="button"
                onClick={() => setManagerActiveTab("leaves")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  managerActiveTab === "leaves"
                    ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Leave Planner ({leaveRequests.filter(l => l.status === "PENDING").length} Pending)
              </button>
              <button
                type="button"
                onClick={() => setManagerActiveTab("tasks")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  managerActiveTab === "tasks"
                    ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Task Dispatches ({tasks.length})
              </button>
              <button
                type="button"
                onClick={() => setManagerActiveTab("attendance")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  managerActiveTab === "attendance"
                    ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Shift Registry
              </button>
            </div>
          </div>

          {/* Leave Planner Tab Content */}
          {managerActiveTab === "leaves" && (
            <div className="space-y-4 animate-fade-in">
              <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50/50 dark:bg-zinc-950/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4">Employee Type</th>
                      <th className="py-3 px-4">Leave Range</th>
                      <th className="py-3 px-4">Reason Details</th>
                      <th className="py-3 px-4">Current Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {leaveRequests.map((leave) => (
                      <tr key={leave.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-white block uppercase text-[10px] tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded w-fit">
                            {leave.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {leave.start} to {leave.end}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700 dark:text-zinc-300">
                          {leave.reason}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                            leave.status === "APPROVED" 
                              ? "bg-emerald-500/10 text-emerald-600" 
                              : leave.status === "REJECTED"
                              ? "bg-red-500/10 text-red-600"
                              : "bg-amber-500/10 text-amber-600"
                          }`}>
                            {leave.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {leave.status === "PENDING" ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveLeave(leave.id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow cursor-pointer transition-all"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectLeave(leave.id)}
                                className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] shadow cursor-pointer transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold italic">Decision Committed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {leaveRequests.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-slate-400 italic">No leave planner records submitted by staff yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Task Dispatches Tab Content */}
          {managerActiveTab === "tasks" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in">
              {/* Left Column: List of tasks */}
              <div className="md:col-span-7 space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 font-mono mb-2">Active Task Dispatches</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-850 rounded-xl hover:border-slate-300 dark:hover:border-zinc-800 transition-all">
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs font-bold block ${task.completed ? "line-through text-slate-400" : "text-slate-950 dark:text-white"}`}>{task.title}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{task.desc}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold font-mono ${
                          task.completed ? "bg-emerald-500/10 text-emerald-600" : "bg-indigo-500/10 text-indigo-600"
                        }`}>
                          {task.completed ? "COMPLETED" : "ASSIGNED"}
                        </span>
                        <button
                          onClick={() => handleDeleteTaskByManager(task.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer transition-colors"
                          title="Revoke Task"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {tasks.length === 0 && (
                    <div className="py-12 text-center text-xs text-slate-400 italic">No active task dispatches. Staff is waiting for orders!</div>
                  )}
                </div>
              </div>

              {/* Right Column: Form to create tasks */}
              <div className="md:col-span-5 bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-100 dark:border-zinc-850 h-fit">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3">Create Operational Dispatch</h4>
                <form onSubmit={handleCreateTaskByManager} className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Task Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Audit East-Wing shelf stock levels"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Task Details / Instructions</label>
                    <textarea
                      required
                      placeholder="Specify focus points, bins, or safety EHS guidelines..."
                      value={newTaskDesc}
                      onChange={(e) => setNewTaskDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer"
                  >
                    Dispatch Task
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Shift Registry Tab Content */}
          {managerActiveTab === "attendance" && (
            <div className="space-y-4 animate-fade-in">
              <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50/50 dark:bg-zinc-950/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4">Log Date</th>
                      <th className="py-3 px-4">Shift Employee ID</th>
                      <th className="py-3 px-4">Attendance Status</th>
                      <th className="py-3 px-4">Time Record</th>
                      <th className="py-3 px-4">Registry Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {(attendances || []).map((att: any) => (
                      <tr key={att.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30">
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {att.date}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {att.employeeId || "Contractor Staff"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono ${
                            att.status === "PRESENT" 
                              ? "bg-emerald-500/10 text-emerald-600" 
                              : "bg-red-500/10 text-red-600"
                          }`}>
                            {att.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {att.checkIn ? new Date(att.checkIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : "Manual Entry"}
                        </td>
                        <td className="py-3 px-4 text-slate-400 truncate max-w-[200px]">
                          {att.notes || "Auto clock-in registry."}
                        </td>
                      </tr>
                    ))}
                    {(attendances || []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-slate-400 italic">No attendance shift records logged in database yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // ROLE 3: TREASURY ACCOUNTANT (Financial Control Hub)
  // -------------------------------------------------------------------------
  if (role === "ACCOUNTANT") {
    // 1. Calculations for Accountant KPIs
    // Use the real metrics cards' revenue if it exists (even if it's 0)
    const revenueVal = metrics ? (metrics.cards?.revenue ?? 0) : 485000;
    
    // Sum of accounts with type === "EXPENSE"
    const calculatedExpenses = (accounts || [])
      .filter((a: any) => a.type === "EXPENSE")
      .reduce((sum: number, a: any) => sum + Number(a.balance), 0);
    const expensesVal = accounts && accounts.length > 0 ? calculatedExpenses : 142000;
    const monthlyProfitVal = revenueVal - expensesVal;

    // Operating Bank Balance (code 1010)
    const bankAccount = (accounts || []).find((a: any) => a.code === "1010");
    const bankBalanceVal = bankAccount ? Number(bankAccount.balance) : 500000;

    // Accounts Receivable (A/R, code 1200 or computed unpaid invoices sum)
    const unpaidInvoices = (invoicesData || []).filter(
      (inv: any) => inv.status === "UNPAID" || inv.status === "PARTIALLY_PAID" || inv.status === "OVERDUE"
    );
    const calculatedAR = unpaidInvoices.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
    const arAccount = (accounts || []).find((a: any) => a.code === "1200");
    const accountsReceivableVal = invoicesData && invoicesData.length > 0 
      ? calculatedAR 
      : (arAccount ? Number(arAccount.balance) : 35400);

    // Calculate real payment status mix
    let clearedPct = 88.5;
    let awaitingPct = 9.0;
    let overduePct = 2.5;

    if (invoicesData && invoicesData.length > 0) {
      const totalAmount = invoicesData.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
      if (totalAmount > 0) {
        const paidAmount = invoicesData
          .filter((inv: any) => inv.status === "PAID")
          .reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
        const pendingAmount = invoicesData
          .filter((inv: any) => inv.status === "UNPAID" || inv.status === "PARTIALLY_PAID")
          .reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
        const overdueAmount = invoicesData
          .filter((inv: any) => inv.status === "OVERDUE")
          .reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);

        clearedPct = Math.round((paidAmount / totalAmount) * 1000) / 10;
        awaitingPct = Math.round((pendingAmount / totalAmount) * 1000) / 10;
        overduePct = Math.round((overdueAmount / totalAmount) * 1000) / 10;

        // adjust to sum up to exactly 100% in case of rounding differences
        const sum = clearedPct + awaitingPct + overduePct;
        if (sum > 0 && Math.abs(sum - 100) > 0.1) {
          clearedPct = Math.round((100 - awaitingPct - overduePct) * 10) / 10;
        }
      } else {
        clearedPct = 0;
        awaitingPct = 0;
        overduePct = 0;
      }
    }

    // Dynamic monthly trends for the last 6 months or specific calendar year
    const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const cashFlowData = monthsList.map((m, idx) => {
      // Filter payments for this month in 2026
      const monthPayments = (paymentsData || []).filter((p: any) => {
        const d = new Date(p.paymentDate);
        return d.getMonth() === idx && d.getFullYear() === 2026;
      });
      const realInflow = monthPayments.reduce((sum: number, p: any) => sum + Number(p.amountPaid), 0);

      // Filter journal lines for expense accounts in this month
      const realOutflow = (journals || [])
        .filter((j: any) => {
          const d = new Date(j.createdAt);
          return d.getMonth() === idx && d.getFullYear() === 2026;
        })
        .reduce((sum: number, j: any) => {
          const linesSum = (j.lines || []).reduce((lSum: number, line: any) => {
            if (line.account?.type === "EXPENSE") {
              return lSum + Number(line.debit);
            }
            return lSum;
          }, 0);
          return sum + linesSum;
        }, 0);

      // Baseline historical fallbacks for pre-July months if no real transactions are recorded
      const baselines: Record<string, { Inflow: number, Outflow: number }> = {
        Jan: { Inflow: 110000, Outflow: 45000 },
        Feb: { Inflow: 130000, Outflow: 50000 },
        Mar: { Inflow: 125000, Outflow: 48000 },
        Apr: { Inflow: 140000, Outflow: 52000 },
        May: { Inflow: 155000, Outflow: 58000 },
        Jun: { Inflow: 165000, Outflow: 62000 },
      };

      const inflow = realInflow || (idx < 6 ? baselines[m]?.Inflow : 0);
      const outflow = realOutflow || (idx < 6 ? baselines[m]?.Outflow : 0);

      return {
        month: m,
        Inflow: inflow,
        Outflow: outflow,
        net: inflow - outflow
      };
    });

    const dbRevenueData = (accounts || [])
      .filter((a: any) => a.type === "REVENUE" && Number(a.balance) > 0)
      .map((a: any) => ({
        name: a.name,
        amount: Number(a.balance),
      }));

    const revenueChartData = dbRevenueData.length > 0 
      ? dbRevenueData 
      : [
          { name: "Product Sales Revenues", amount: Number((accounts || []).find((a: any) => a.code === "4000")?.balance || 0) },
          { name: "Services Rev (Est)", amount: 98000 },
          { name: "Interest Earned (Est)", amount: 12000 },
        ];

    const dbExpenseData = (accounts || [])
      .filter((a: any) => a.type === "EXPENSE" && Number(a.balance) > 0)
      .map((a: any) => ({
        category: a.name,
        amount: Number(a.balance),
      }));

    const expenseBreakdownData = dbExpenseData.length > 0
      ? dbExpenseData
      : [
          { category: "COGS / Stock (Est)", amount: expensesVal * 0.45 },
          { category: "Payroll Disb (Est)", amount: expensesVal * 0.30 },
          { category: "Facilities Rent (Est)", amount: expensesVal * 0.15 },
          { category: "Utilities / IT (Est)", amount: expensesVal * 0.10 },
        ];

    return (
      <div className="space-y-6">
        {/* Modern Welcome Header Banner */}
        {renderDashboardWelcomeHeader(
          "Corporate Treasury Ledger Suite • Financial Audit Desk",
          "Manage company accounts, authorize trial balances, execute double-entry ledger journals, and audit revenues.",
          "from-emerald-700",
          "to-teal-800"
        )}

        {/* Upper Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-zinc-800/50 pb-5">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Coins className="h-5 w-5 text-indigo-500" />
              Corporate Treasury & Ledgers
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Treasury accountant authorization: Active ledger books, balance accounts, double-entry reconciliations, and financial reporting.
            </p>
          </div>
          <button
            onClick={() => {
              refetchMetrics();
              queryClient.invalidateQueries({ queryKey: ["dashboardAccounts"] });
              queryClient.invalidateQueries({ queryKey: ["dashboardJournals"] });
            }}
            className="flex items-center gap-2 py-2 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-850 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Sync Financial Matrix
          </button>
        </div>

        {/* 10 WIDGETS ENTERPRISE GRID */}
        
        {/* ROW 1: CORE STATS (Widgets 2, 3, 4, 7) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Widget 2: Revenue */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Gross Revenue</span>
              <span className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-bold flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> 12%
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono">${revenueVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
            <span className="text-[9px] text-slate-400 font-mono">Sales & Services aggregate</span>
          </div>

          {/* Widget 3: Expenses */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Total Expenses</span>
              <span className="p-1.5 bg-red-500/10 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1">
                <ArrowDownRight className="h-3 w-3" /> 4%
              </span>
            </div>
            <h3 className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">${expensesVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
            <span className="text-[9px] text-slate-400 font-mono">Accounts & Payroll liability</span>
          </div>

          {/* Widget 4: Monthly Profit */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Monthly Profit</span>
              <div className="p-1 bg-indigo-500/10 text-indigo-600 rounded-lg">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono">${monthlyProfitVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
            <span className="text-[9px] text-emerald-500 font-bold">Net Operating Surplus</span>
          </div>

          {/* Widget 7: Bank Balance */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Operating Bank Balance</span>
              <div className="p-1 bg-blue-500/10 text-blue-600 rounded-lg">
                <Landmark className="h-3.5 w-3.5" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">${bankBalanceVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
            <span className="text-[9px] text-slate-400 font-mono">Liquid asset ledger node [1010]</span>
          </div>
        </div>

        {/* ROW 2: VISUAL ANALYTICS CHARTS (Widgets 1, 8, 9, 10) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Widget 1: Cash Flow (AreaChart) */}
          <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider font-mono">Cash Flow - Receipts vs Disbursements</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" fontSize={10} stroke="#94A3B8" />
                  <YAxis fontSize={10} stroke="#94A3B8" />
                  <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "10px" }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="Inflow" name="Cash Inflow ($)" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" />
                  <Area type="monotone" dataKey="Outflow" name="Cash Outflow ($)" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Widget 8: Payment Status Breakdown */}
          <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-3 uppercase tracking-wider font-mono">Payment Status Mix</h3>
              <p className="text-[10px] text-slate-400 mb-4">Breakdown of customer sales invoices & collections cycle.</p>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Cleared & Reconciled</span>
                <span className="font-mono text-xs font-bold">{clearedPct}%</span>
              </div>
              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Awaiting Settlement</span>
                <span className="font-mono text-xs font-bold">{awaitingPct}%</span>
              </div>
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-bold text-red-700 dark:text-red-400">Overdue / Delinquent</span>
                <span className="font-mono text-xs font-bold">{overduePct}%</span>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 text-center">
              <span className="text-[10px] font-mono text-indigo-500 font-bold">Reconciliation Health Status: {overduePct > 10 ? "ATTENTION" : "EXCELLENT"}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Widget 9: Revenue Chart */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider font-mono">Revenue Streams Allocation</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} />
                  <YAxis stroke="#94A3B8" fontSize={9} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#4F46E5" name="Revenue Amount ($)" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Widget 10: Expense Chart */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider font-mono">Disbursements & Expense Category Allocation</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseBreakdownData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" stroke="#94A3B8" fontSize={9} />
                  <YAxis dataKey="category" type="category" stroke="#94A3B8" fontSize={9} width={90} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#F43F5E" name="Expense Share ($)" radius={[0, 4, 4, 0]} maxBarSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ROW 3: LISTS & LOGS (Widgets 5, 6) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Widget 5: Pending Payments & Outstanding Invoices */}
          <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4 uppercase tracking-wider font-mono">
              Outstanding Accounts Receivable (A/R)
            </h3>
            <div className="space-y-3 overflow-y-auto max-h-[200px]">
              {unpaidInvoices.map((inv: any) => {
                const dueDateObj = new Date(inv.dueDate);
                const daysLeftOrOverdue = Math.ceil((dueDateObj.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                const customerName = inv.salesOrder?.customer?.companyName || inv.salesOrder?.customer?.contactName || "Acme Industrial Corp";
                return (
                  <div key={inv.id} className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-850 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 font-mono">{inv.invoiceNumber}</span>
                      <p className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">{customerName}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">${Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className={`block text-[8px] uppercase font-bold ${daysLeftOrOverdue < 0 ? "text-red-500" : "text-slate-400"}`}>
                        {daysLeftOrOverdue < 0 ? `Overdue by ${Math.abs(daysLeftOrOverdue)} days` : `Due in ${daysLeftOrOverdue} days`}
                      </span>
                    </div>
                  </div>
                );
              })}
              {unpaidInvoices.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400 italic">No outstanding accounts receivable. All settled!</div>
              )}
            </div>
            <div className="mt-4 p-3.5 bg-indigo-50/50 dark:bg-zinc-950 border border-indigo-200/20 rounded-xl flex items-center justify-between text-xs font-bold text-indigo-950 dark:text-indigo-200">
              <span>Total Outstanding Receivables</span>
              <span className="font-mono text-indigo-600">${accountsReceivableVal.toLocaleString()}</span>
            </div>
          </div>

          {/* Widget 6: Recent Transactions */}
          <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4 uppercase tracking-wider font-mono">
              Recent General Ledger Postings
            </h3>
            <div className="space-y-3 overflow-y-auto max-h-[290px]">
              {(journals || []).slice(0, 3).map((j: any) => (
                <div key={j.id} className="p-3 border border-slate-100 dark:border-zinc-850 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-950">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black font-mono text-indigo-600">{j.journalNumber}</span>
                    <span className="text-[9px] text-slate-400 font-mono">{new Date(j.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold mb-2">{j.description}</p>
                  <div className="space-y-1 pl-2 border-l border-indigo-500/20">
                    {j.lines?.map((line: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400 truncate max-w-[180px]">{line.account?.name}</span>
                        <span className="font-bold shrink-0">
                          {Number(line.debit) > 0 ? `Dr $${Number(line.debit).toLocaleString()}` : `Cr $${Number(line.credit).toLocaleString()}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(journals || []).length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400 italic">No transactions recorded.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // ROLE 4: STANDARD EMPLOYEE (Simplified Operations Portal)
  // -------------------------------------------------------------------------
  if (role === "EMPLOYEE") {
    // 1. Determine clock in state for today
    const todayStr = new Date().toISOString().split("T")[0];
    const clockedToday = (attendances || []).find((att: any) => att.date?.startsWith(todayStr));

    // 2. Recent actions for employee activities widget using shared state
    const recentActivities = [
      { text: "Logged into Enterprise Portal", time: "09:15" },
      clockedToday ? { text: `Checked-in for Shift (${new Date(clockedToday.checkIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })})`, time: "09:18" } : null,
      { text: "Refreshed operational tasks board", time: "09:19" }
    ].filter(Boolean);

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Modern Welcome Header Banner */}
        {renderDashboardWelcomeHeader(
          "Employee Operations Workspace • Personal Operations Hub",
          "Track your daily attendance shifts, manage assigned team tasks, submit leave requests, and view payslips.",
          "from-indigo-600",
          "to-violet-600"
        )}

        {/* SIX WIDGETS BALANCED GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Widget 1: Attendance Today (Daily Shift Clock-In) */}
          <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-[320px]">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-indigo-500" />
                  Attendance Today
                </h3>
                <span className="text-[10px] font-mono font-bold text-indigo-600">UTC CLOCK</span>
              </div>
              
              <div className="text-center py-2">
                <h2 className="text-3xl font-black font-mono text-slate-900 dark:text-white tracking-widest">{currentTime.toLocaleTimeString()}</h2>
                <p className="text-[10px] text-slate-400 font-mono mt-1">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850 text-center">
                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Today's Shift Registry</span>
                {clockedToday ? (
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 mt-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Present ({new Date(clockedToday.checkIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })})
                  </div>
                ) : (
                  <div className="text-xs font-bold text-slate-500 mt-1">
                    Awaiting Daily Shift Registration
                  </div>
                )}
              </div>

              <button
                onClick={handleClockIn}
                disabled={!!clockedToday || clockMutation.isPending}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed transition-all"
              >
                {clockMutation.isPending ? "Registering..." : clockedToday ? "Shift Successfully Clocked In" : "Register Shift Clock-In"}
              </button>
            </div>
          </div>

          {/* Widget 2: Assigned Tasks Checklist */}
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm h-[320px] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-3 flex items-center gap-2">
                <ListTodo className="h-4.5 w-4.5 text-indigo-500" />
                Assigned Operational Tasks
              </h3>
              
              <div className="space-y-2 overflow-y-auto max-h-[190px] pr-1">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-2 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-850 rounded-xl">
                    <button onClick={() => toggleTask(task.id)} className="mt-0.5 cursor-pointer text-indigo-600 dark:text-indigo-400">
                      <CheckSquare className={`h-4.5 w-4.5 ${task.completed ? "fill-indigo-600 text-white dark:fill-indigo-400" : ""}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs font-bold block ${task.completed ? "line-through text-slate-400" : ""}`}>{task.title}</span>
                      <span className="text-[10px] text-slate-400 font-medium block">{task.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-zinc-850 flex items-center justify-between text-[10px] text-slate-400 font-bold">
              <span>Task Progress</span>
              <span>{tasks.filter(t => t.completed).length} of {tasks.length} Completed</span>
            </div>
          </div>

          {/* Widget 4: Personal Notifications Feed */}
          <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm h-[320px] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-3 flex items-center gap-2">
                <Bell className="h-4.5 w-4.5 text-indigo-500" />
                Personal Notifications
              </h3>

              <div className="space-y-2.5 overflow-y-auto max-h-[200px]">
                {notifications.map((n) => (
                  <div key={n.id} className="p-2.5 border border-indigo-200/10 bg-indigo-500/5 dark:bg-zinc-950 rounded-xl relative group">
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{n.title}</span>
                      <span className="text-[8px] text-slate-400 font-mono font-bold">{n.date}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">{n.msg}</p>
                    <button onClick={() => dismissNotif(n.id)} className="absolute right-2 top-2 text-[9px] text-slate-400 hover:text-slate-600 cursor-pointer hidden group-hover:block">
                      Dismiss
                    </button>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-12 italic">All caught up! No notifications.</p>
                )}
              </div>
            </div>
            
            <span className="text-[9px] font-bold font-mono text-slate-400 block text-center">Auto-purged after 30 days</span>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Widget 3: Upcoming Leave & Leave Planner */}
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm h-[350px] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4 flex items-center gap-2">
                <CalendarDays className="h-4.5 w-4.5 text-indigo-500" />
                Upcoming Leave Requests
              </h3>

              {/* Leave request form */}
              <form onSubmit={handleRequestLeave} className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="col-span-2">
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-lg px-2 py-1.5 text-[11px] text-slate-900 dark:text-zinc-100"
                  >
                    <option value="ANNUAL">Annual Leave / Vacation</option>
                    <option value="SICK">Sick Leave</option>
                    <option value="CASUAL">Personal / Casual</option>
                  </select>
                </div>
                <div>
                  <input
                    type="date"
                    required
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-lg px-2 py-1 text-[11px] text-slate-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    required
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-lg px-2 py-1 text-[11px] text-slate-900 dark:text-zinc-100 font-mono"
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Reason for requesting leave..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-lg px-2 py-1 text-[11px] text-slate-900 dark:text-zinc-100"
                  />
                  <button type="submit" className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold cursor-pointer">
                    Apply
                  </button>
                </div>
              </form>
            </div>

            {/* Leave history */}
            <div className="space-y-1.5 overflow-y-auto max-h-[140px] border-t border-dashed border-slate-100 dark:border-zinc-800 pt-3">
              {leaveRequests.map((leave) => (
                <div key={leave.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-850">
                  <div>
                    <span className="text-[10px] font-bold text-slate-900 dark:text-white uppercase block">{leave.type} LEAVE</span>
                    <span className="text-[9px] text-slate-400 font-mono">{leave.start} to {leave.end}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${
                    leave.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                  }`}>
                    {leave.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Widget 5: Quick Actions (Operational macro shortcuts) */}
          <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm h-[350px] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4 uppercase tracking-wider font-mono">
                Quick Actions
              </h3>
              <p className="text-[10px] text-slate-400 mb-4">Launch standard actions instantly to self-update databases.</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleClockIn}
                  disabled={!!clockedToday}
                  className="p-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 border border-slate-200 dark:border-zinc-800 rounded-xl text-center cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Clock className="h-5 w-5 text-indigo-600 mx-auto mb-1.5" />
                  <span className="text-[10px] font-bold block text-slate-700 dark:text-zinc-200">Clock In</span>
                </button>
                <button
                  onClick={() => {
                    const nextTask = tasks.find(t => !t.completed);
                    if (nextTask) toggleTask(nextTask.id);
                  }}
                  className="p-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 border border-slate-200 dark:border-zinc-800 rounded-xl text-center cursor-pointer transition-all"
                >
                  <CheckSquare className="h-5 w-5 text-emerald-600 mx-auto mb-1.5" />
                  <span className="text-[10px] font-bold block text-slate-700 dark:text-zinc-200">Solve Task</span>
                </button>
                <button
                  onClick={() => {
                    setLeaveType("ANNUAL");
                    setLeaveStart("2026-12-24");
                    setLeaveEnd("2026-12-31");
                    setLeaveReason("Christmas Vacation");
                  }}
                  className="p-3 bg-amber-50 hover:bg-amber-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 border border-slate-200 dark:border-zinc-800 rounded-xl text-center cursor-pointer transition-all"
                >
                  <CalendarDays className="h-5 w-5 text-amber-600 mx-auto mb-1.5" />
                  <span className="text-[10px] font-bold block text-slate-700 dark:text-zinc-200">Plan Holidays</span>
                </button>
                <button
                  onClick={() => {
                    alert("Pay slip records can be downloaded in detail inside the attendance portal.");
                  }}
                  className="p-3 bg-purple-50 hover:bg-purple-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 border border-slate-200 dark:border-zinc-800 rounded-xl text-center cursor-pointer transition-all"
                >
                  <FileSpreadsheet className="h-5 w-5 text-purple-600 mx-auto mb-1.5" />
                  <span className="text-[10px] font-bold block text-slate-700 dark:text-zinc-200">Salary Sheet</span>
                </button>
              </div>
            </div>

            <p className="text-[9px] text-slate-400 font-medium italic text-center">All actions are verified and logged in the enterprise audit ledger.</p>
          </div>

          {/* Widget 6: Recent Self Activities */}
          <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl p-5 shadow-sm h-[350px] flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-zinc-800 pb-3 mb-4 uppercase tracking-wider font-mono">
                Recent Activities
              </h3>

              <div className="space-y-4">
                {recentActivities.map((act, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 block leading-tight">{act.text}</span>
                      <span className="text-[9px] text-slate-400 font-mono font-semibold">{act.time} today</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
              <span className="text-[10px] font-bold text-indigo-950 dark:text-indigo-300 block">Assigned Node:</span>
              <p className="text-[9px] text-indigo-900/60 dark:text-indigo-400 font-mono mt-0.5 truncate">{user?.id}</p>
            </div>
          </div>

        </div>

      </div>
    );
  }

  // Final generic fallback
  return null;
}
