import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Building2, 
  Clock, 
  Banknote, 
  Plus, 
  Search, 
  X, 
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle,
  CalendarDays,
  Shield,
  Briefcase
} from "lucide-react";
import { api } from "../lib/api.ts";
import { hasPermission } from "../lib/permissions.ts";

export default function HR() {
  const queryClient = useQueryClient();
  const [currentUser] = useState<any>(() => {
    const stored = localStorage.getItem("erp_user");
    try {
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<"employees" | "departments" | "attendance" | "payroll">(() => {
    const stored = localStorage.getItem("erp_user");
    try {
      if (stored) {
        const u = JSON.parse(stored);
        if (u.role === "ACCOUNTANT") return "payroll";
        if (u.role === "EMPLOYEE") return "attendance";
      }
    } catch (_) {}
    return "employees";
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Custom Iframe-safe confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Form states: Employees (Hire)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [position, setPosition] = useState("");
  const [salary, setSalary] = useState(4000);
  const [hireDate, setHireDate] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeStatus, setEmployeeStatus] = useState("ACTIVE");

  // Form states: Departments
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDesc, setDeptDesc] = useState("");

  // Form states: Attendance Clock
  const [employeeId, setEmployeeId] = useState("");
  const [attDate, setAttDate] = useState("");
  const [attStatus, setAttStatus] = useState("PRESENT");
  const [attNotes, setAttNotes] = useState("");

  // Form states: Payroll Ledger
  const [payAmount, setPayAmount] = useState(3000);
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER");

  const [formError, setFormError] = useState<string | null>(null);

  // Sync tab with URL search parameter
  React.useEffect(() => {
    if (currentUser?.role === "ACCOUNTANT") {
      setActiveTab("payroll");
      return;
    }
    if (currentUser?.role === "EMPLOYEE") {
      setActiveTab("attendance");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "employees" || tab === "departments" || tab === "attendance" || tab === "payroll") {
      setActiveTab(tab as any);
    }
  }, [window.location.search, currentUser]);

  // Queries
  const { data: employeesData, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await api.get("/hr/employees");
      return res.data.data.employees;
    }
  });

  const { data: departmentsData, isLoading: isLoadingDepts } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await api.get("/hr/departments");
      return res.data.data.departments;
    }
  });

  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      const res = await api.get("/hr/attendance");
      return res.data.data.attendances;
    }
  });

  const { data: salaryData, isLoading: isLoadingSalary } = useQuery({
    queryKey: ["salaries"],
    queryFn: async () => {
      const res = await api.get("/hr/salaries");
      return res.data.data.salaryPayments;
    }
  });

  // Mutations: Employees (CRUD)
  const hireEmployeeMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/hr/employees", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEmployeeModalOpen(false);
      resetEmployeeForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to catalog employee. Passwords require upper, lower, digits & symbols.");
    }
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      await api.patch(`/hr/employees/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEmployeeModalOpen(false);
      resetEmployeeForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to update employee.");
    }
  });

  const terminateEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    }
  });

  // Mutations: Departments
  const createDeptMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/hr/departments", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeptModalOpen(false);
      setDeptName("");
      setDeptCode("");
      setDeptDesc("");
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to create department. Code must be unique.");
    }
  });

  // Mutations: Attendance
  const logAttendanceMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/hr/attendance", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setAttendanceModalOpen(false);
      setAttNotes("");
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to log attendance check.");
    }
  });

  // Mutations: Payroll
  const issueSalaryMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/hr/salaries", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaries"] });
      setPayrollModalOpen(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to post payroll record.");
    }
  });

  const resetEmployeeForm = () => {
    setSelectedItem(null);
    setEmail("");
    setFirstName("");
    setLastName("");
    setPosition("");
    setSalary(4000);
    setHireDate(new Date().toISOString().split("T")[0]);
    setDepartmentId("");
    setEmployeeStatus("ACTIVE");
    setFormError(null);
  };

  const handleOpenHireModal = () => {
    resetEmployeeForm();
    if (departmentsData && departmentsData.length > 0) {
      setDepartmentId(departmentsData[0].id);
    }
    setEmployeeModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: any) => {
    setSelectedItem(emp);
    setEmail(emp.user?.email || "");
    setFirstName(emp.user?.profile?.firstName || "");
    setLastName(emp.user?.profile?.lastName || "");
    setRole(emp.user?.role || "EMPLOYEE");
    setPosition(emp.position);
    setSalary(Number(emp.salary));
    setHireDate(new Date(emp.hireDate).toISOString().split("T")[0]);
    setDepartmentId(emp.departmentId || "");
    setEmployeeStatus(emp.status);
    setFormError(null);
    setEmployeeModalOpen(true);
  };

  const handleEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItem) {
      // Update payload
      const payload = {
        position,
        salary: Number(salary),
        status: employeeStatus,
        departmentId: departmentId || null
      };
      updateEmployeeMutation.mutate({ id: selectedItem.id, payload });
    } else {
      // Create payload
      const payload = {
        email,
        password,
        role,
        firstName,
        lastName,
        position,
        salary: Number(salary),
        hireDate: new Date(hireDate).toISOString(),
        departmentId: departmentId || undefined
      };
      hireEmployeeMutation.mutate(payload);
    }
  };

  const handleOpenAttendanceModal = (emp?: any) => {
    setAttDate(new Date().toISOString().split("T")[0]);
    setAttNotes("");
    if (emp) {
      setEmployeeId(emp.id);
    } else if (employeesData && employeesData.length > 0) {
      setEmployeeId(employeesData[0].id);
    }
    setAttendanceModalOpen(true);
  };

  const handleAttendanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setFormError("An employee target is required.");
      return;
    }
    logAttendanceMutation.mutate({
      employeeId,
      date: new Date(attDate).toISOString(),
      status: attStatus,
      notes: attNotes || null
    });
  };

  const handleOpenPayrollModal = (emp?: any) => {
    if (emp) {
      setEmployeeId(emp.id);
      setPayAmount(Number(emp.salary));
    } else if (employeesData && employeesData.length > 0) {
      setEmployeeId(employeesData[0].id);
      setPayAmount(Number(employeesData[0].salary));
    }
    setPayrollModalOpen(true);
  };

  const handlePayrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setFormError("Employee payee target required.");
      return;
    }
    issueSalaryMutation.mutate({
      employeeId,
      amount: Number(payAmount),
      payDate: new Date().toISOString(),
      paymentMethod: payMethod,
      status: "PAID"
    });
  };

  const handleDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDeptMutation.mutate({ name: deptName, code: deptCode, description: deptDesc });
  };

  const filteredEmployees = (employeesData || []).filter((emp: any) => {
    const fn = emp.user?.profile?.firstName || "";
    const ln = emp.user?.profile?.lastName || "";
    const email = emp.user?.email || "";
    return fn.toLowerCase().includes(searchTerm.toLowerCase()) ||
           ln.toLowerCase().includes(searchTerm.toLowerCase()) ||
           email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           emp.position.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">HR & Payroll Suite</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Administer workforce contracts, monitor department nodes, and reconcile salaries payments.</p>
        </div>

        {activeTab === "employees" && hasPermission(currentUser, "hr.write") && (
          <button
            onClick={handleOpenHireModal}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer self-stretch sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Onboard Staff Contract
          </button>
        )}

        {activeTab === "departments" && hasPermission(currentUser, "hr.write") && (
          <button
            onClick={() => setDeptModalOpen(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer self-stretch sm:self-auto"
          >
            <Building2 className="h-4 w-4" /> Form Department Unit
          </button>
        )}

        {activeTab === "attendance" && hasPermission(currentUser, "hr.write") && (
          <button
            onClick={() => handleOpenAttendanceModal()}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer self-stretch sm:self-auto"
          >
            <Clock className="h-4 w-4" /> Clock Daily Attendance
          </button>
        )}

        {activeTab === "payroll" && hasPermission(currentUser, "payroll.write") && (
          <button
            onClick={() => handleOpenPayrollModal()}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer self-stretch sm:self-auto"
          >
            <Banknote className="h-4 w-4" /> Issue Payroll Salary
          </button>
        )}
      </div>

      {/* Segmented Tab Controls */}
      <div className="flex border border-slate-200 dark:border-zinc-900 bg-white dark:bg-zinc-900 p-1.5 rounded-2xl gap-2 overflow-x-auto">
        {(currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER") && (
          <>
            <button
              onClick={() => { setActiveTab("employees"); setSearchTerm(""); }}
              className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "employees" ? "bg-indigo-600 text-white shadow" : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users className="h-4 w-4" /> Staff Roster
            </button>

            <button
              onClick={() => { setActiveTab("departments"); setSearchTerm(""); }}
              className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "departments" ? "bg-indigo-600 text-white shadow" : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Building2 className="h-4 w-4" /> Department Units
            </button>
          </>
        )}

        {(currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER" || currentUser?.role === "EMPLOYEE") && (
          <button
            onClick={() => { setActiveTab("attendance"); setSearchTerm(""); }}
            className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "attendance" ? "bg-indigo-600 text-white shadow" : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Clock className="h-4 w-4" /> Attendance logs
          </button>
        )}

        {(currentUser?.role === "ADMIN" || currentUser?.role === "ACCOUNTANT") && (
          <button
            onClick={() => { setActiveTab("payroll"); setSearchTerm(""); }}
            className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "payroll" ? "bg-indigo-600 text-white shadow" : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Banknote className="h-4 w-4" /> Payroll ledger
          </button>
        )}
      </div>

      {/* Staff Roster Tab */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          <div className="relative bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200 dark:border-zinc-900">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff, position titles, business email addresses..."
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
            {isLoadingEmployees ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-500">Querying employees...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-4 px-6">Staff Member</th>
                      <th className="py-4 px-4">Role Title / Org Node</th>
                      <th className="py-4 px-4">Contract Salary</th>
                      <th className="py-4 px-4">Hire Date</th>
                      <th className="py-4 px-4">Status</th>
                      {(hasPermission(currentUser, "hr.write") || hasPermission(currentUser, "payroll.write")) && (
                        <th className="py-4 px-6 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {filteredEmployees.map((emp: any) => {
                      const profile = emp.user?.profile;
                      const fn = profile?.firstName || "";
                      const ln = profile?.lastName || "Operator";

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/30">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {profile?.profilePhotoUrl ? (
                                <img
                                  src={profile.profilePhotoUrl}
                                  alt={`${fn} ${ln}`}
                                  referrerPolicy="no-referrer"
                                  className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-zinc-800"
                                />
                              ) : (
                                <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center font-bold text-slate-600 dark:text-zinc-300 uppercase text-xs font-mono">
                                  {fn[0] || ""}{ln[0] || ""}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 dark:text-white block truncate">{fn} {ln}</span>
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block truncate">{emp.user?.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-semibold block">{emp.position}</span>
                            <span className="text-[9px] bg-indigo-50 text-indigo-600 font-mono px-1.5 py-0.2 rounded font-bold mt-0.5 inline-block uppercase">
                              {emp.department?.name || "Corporate Base"}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono font-bold text-slate-900 dark:text-white">${Number(emp.salary).toLocaleString()}/mo</td>
                          <td className="py-4 px-4 text-slate-400 font-mono">{new Date(emp.hireDate).toLocaleDateString()}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              emp.status === "ACTIVE" 
                                ? "bg-emerald-500/10 text-emerald-600" 
                                : emp.status === "ON_LEAVE" 
                                ? "bg-amber-500/10 text-amber-600" 
                                : "bg-red-500/10 text-red-600"
                            }`}>
                              {emp.status}
                            </span>
                          </td>
                          {(hasPermission(currentUser, "hr.write") || hasPermission(currentUser, "payroll.write")) && (
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {hasPermission(currentUser, "hr.write") && (
                                  <button
                                    onClick={() => handleOpenAttendanceModal(emp)}
                                    className="p-1.5 border hover:text-indigo-600 rounded cursor-pointer"
                                    title="Log Attendance"
                                  >
                                    <Clock className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                
                                {hasPermission(currentUser, "payroll.write") && (
                                  <button
                                    onClick={() => handleOpenPayrollModal(emp)}
                                    className="p-1.5 border hover:text-emerald-600 rounded cursor-pointer"
                                    title="Issue Salary"
                                  >
                                    <Banknote className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                {hasPermission(currentUser, "hr.write") && (
                                  <>
                                    <button
                                      onClick={() => handleOpenEditEmployee(emp)}
                                      className="p-1.5 border hover:text-indigo-600 rounded cursor-pointer"
                                      title="Modify Profile"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>

                                    <button
                                      onClick={() => {
                                        setConfirmDialog({
                                           title: "Terminate Staff Contract",
                                           message: `Are you sure you want to terminate the staff contract for ${fn} ${ln}?`,
                                           onConfirm: () => {
                                             terminateEmployeeMutation.mutate(emp.id);
                                             setConfirmDialog(null);
                                           }
                                         })
                                      }}
                                      className="p-1.5 border text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                      title="Terminate"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === "departments" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-4 px-6">Code Tag</th>
                    <th className="py-4 px-4">Department Title</th>
                    <th className="py-4 px-6">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs animate-fade-in">
                  {departmentsData?.map((dept: any) => (
                    <tr key={dept.id} className="hover:bg-slate-50/30">
                      <td className="py-4 px-6 font-mono font-bold text-indigo-600 dark:text-indigo-400">{dept.code}</td>
                      <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">{dept.name}</td>
                      <td className="py-4 px-6 text-slate-500">{dept.description || "Core organizational team"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 border rounded-2xl shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-4">Form Department Unit</h3>
            <form onSubmit={handleDeptSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Engineering"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Organizational Code</label>
                <input
                  type="text"
                  required
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  placeholder="e.g. ENG"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                <textarea
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  placeholder="Department focus areas..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <button type="submit" className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md">
                Form Org Department
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-4 px-6">Employee Name</th>
                  <th className="py-4 px-4">Duty Date</th>
                  <th className="py-4 px-4">Attendance Status</th>
                  <th className="py-4 px-6">Logs notes</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs animate-fade-in">
                {(attendanceData || [])
                  .filter((att: any) => {
                    if (currentUser?.role === "EMPLOYEE") {
                      return att.employee?.user?.email === currentUser?.email;
                    }
                    return true;
                  })
                  .map((att: any) => (
                  <tr key={att.id} className="hover:bg-slate-50/30">
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                      {att.employee?.user?.profile ? `${att.employee.user.profile.firstName} ${att.employee.user.profile.lastName}` : "Contractor Employee"}
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-400">{new Date(att.date).toLocaleDateString()}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        att.status === "PRESENT" 
                          ? "bg-emerald-500/10 text-emerald-600" 
                          : att.status === "LATE" 
                          ? "bg-amber-500/10 text-amber-600" 
                          : "bg-red-500/10 text-red-600"
                      }`}>
                        {att.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-500">{att.notes || "No notes logged."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll Tab */}
      {activeTab === "payroll" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-4 px-6">Payee Staff Member</th>
                  <th className="py-4 px-4">Payment Method</th>
                  <th className="py-4 px-4">Release Date</th>
                  <th className="py-4 px-4">Processing Status</th>
                  <th className="py-4 px-6 text-right">Amount Disbursed</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs animate-fade-in">
                {salaryData?.map((sal: any) => (
                  <tr key={sal.id} className="hover:bg-slate-50/30">
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                      {sal.employee?.user?.profile ? `${sal.employee.user.profile.firstName} ${sal.employee.user.profile.lastName}` : "Direct Payee"}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-slate-500">{sal.paymentMethod}</td>
                    <td className="py-4 px-4 text-slate-400 font-mono">{new Date(sal.payDate).toLocaleDateString()}</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[9px] font-bold uppercase tracking-widest">{sal.status}</span>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">${Number(sal.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: STAFF HIRE / EDIT */}
      {employeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setEmployeeModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                {selectedItem ? "Modify Staff Contract" : "Onboard Corporate Staff Contract"}
              </h3>
              <button onClick={() => setEmployeeModalOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && <div className="p-3 mb-4 rounded-xl bg-red-500/10 border text-red-600 text-xs">{formError}</div>}

            <form onSubmit={handleEmployeeSubmit} className="space-y-4">
              {!selectedItem && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">First Name</label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Dwight"
                        className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Last Name</label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Schrute"
                        className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Work Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="dwight@dundermifflin.com"
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gate Pass System Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                      >
                        <option value="EMPLOYEE">EMPLOYEE</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="ACCOUNTANT">ACCOUNTANT</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Temporary Password</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Position / Title</label>
                  <input
                    type="text"
                    required
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Sales Director"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Monthly Salary ($)</label>
                  <input
                    type="number"
                    required
                    value={salary}
                    onChange={(e) => setSalary(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Department unit</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  >
                    <option value="">No department affiliation</option>
                    {departmentsData?.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                {selectedItem ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
                    <select
                      value={employeeStatus}
                      onChange={(e) => setEmployeeStatus(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                    >
                      <option value="ACTIVE">ACTIVE Affiliation</option>
                      <option value="ON_LEAVE">ON MEDICAL LEAVE</option>
                      <option value="TERMINATED">CONTRACT CONCLUDED</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Onboarding Date</label>
                    <input
                      type="date"
                      required
                      value={hireDate}
                      onChange={(e) => setHireDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                )}
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all">
                Commit Onboard contract details
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DAILY ATTENDANCE CHECK */}
      {attendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setAttendanceModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                Clock Daily Attendance
              </h3>
              <button onClick={() => setAttendanceModalOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && <div className="p-3 mb-4 rounded-xl bg-red-500/10 border text-red-600 text-xs">{formError}</div>}

            <form onSubmit={handleAttendanceSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select staff Affiliation</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                >
                  {employeesData?.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.profile ? `${emp.user.profile.firstName} ${emp.user.profile.lastName}` : emp.user?.email} - {emp.position}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Calendar Duty Date</label>
                  <input
                    type="date"
                    required
                    value={attDate}
                    onChange={(e) => setAttDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Attendance Status</label>
                  <select
                    value={attStatus}
                    onChange={(e) => setAttStatus(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  >
                    <option value="PRESENT">Nominally PRESENT</option>
                    <option value="ABSENT">Unexcused ABSENT</option>
                    <option value="LATE">LATE check-in</option>
                    <option value="HALF_DAY">HALF_DAY clock</option>
                    <option value="ON_LEAVE">EXCUSED ON LEAVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Audit notes</label>
                <textarea
                  value={attNotes}
                  onChange={(e) => setAttNotes(e.target.value)}
                  placeholder="Reasoning, medical excuse tag, holiday details..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all">
                Commit Attendance Log Check
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAYROLL EMISSION */}
      {payrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setPayrollModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-500" />
                Issue Payroll Salary Disbursement
              </h3>
              <button onClick={() => setPayrollModalOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && <div className="p-3 mb-4 rounded-xl bg-red-500/10 border text-red-600 text-xs">{formError}</div>}

            <form onSubmit={handlePayrollSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Payee Staff Affiliation</label>
                <select
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value);
                    const emp = employeesData?.find((em: any) => em.id === e.target.value);
                    if (emp) setPayAmount(Number(emp.salary));
                  }}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                >
                  {employeesData?.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.profile ? `${emp.user.profile.firstName} ${emp.user.profile.lastName}` : emp.user?.email} - Current Base: ${Number(emp.salary).toLocaleString()}/mo
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Net Payoff Disbursed ($)</label>
                  <input
                    type="number"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Corporate bank Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  >
                    <option value="BANK_TRANSFER">CORPORATE WIRE WIRE</option>
                    <option value="MOBILE_PAYMENT">MOBILE SALARY APP</option>
                    <option value="CASH">PETTY CASH DRAW</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all">
                Disburse and Reconcile Payroll
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG */}
      {confirmDialog && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setConfirmDialog(null)} />
          <div className="relative bg-white border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 overflow-hidden animate-fade-in dark:bg-zinc-950">
            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2">{confirmDialog.title}</h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
