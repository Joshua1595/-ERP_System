import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Shield, 
  Lock, 
  Unlock, 
  Edit2, 
  Search, 
  Key, 
  RefreshCw, 
  Check, 
  X, 
  ShieldAlert, 
  Plus, 
  AlertTriangle,
  UserCheck,
  UserX,
  Mail,
  UserPlus
} from "lucide-react";
import { api } from "../lib/api.ts";

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modals & Action States
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  
  // Create User Form State
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState("EMPLOYEE");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Edit User Form State
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editRole, setEditRole] = useState("EMPLOYEE");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset Password Form State
  const [resetPassVal, setResetPassVal] = useState("");
  const [resetForceChange, setResetForceChange] = useState(true);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Custom Iframe-safe confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Query: Get All Users
  const { data: usersData, isLoading: isLoadingUsers, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      try {
        const res = await api.get("/auth/users");
        return res?.data?.data?.users ?? [];
      } catch (err) {
        console.error("Error fetching users:", err);
        return [];
      }
    }
  });

  // Mutation: Register User (Create User)
  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await api.post("/auth/register", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setCreateSuccess("New user account created successfully!");
      setCreateError(null);
      setTimeout(() => {
        setCreateUserOpen(false);
        resetCreateForm();
      }, 1500);
    },
    onError: (err: any) => {
      setCreateSuccess(null);
      setCreateError(err.response?.data?.message || "Failed to create user account.");
    }
  });

  // Mutation: Update User (Edit Role, Status, Profile details)
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      return await api.put(`/auth/users/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
      setEditError(null);
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.message || "Failed to update user.");
    }
  });

  // Mutation: Reset Password
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      return await api.put(`/auth/users/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setResetSuccess("User password updated successfully!");
      setResetError(null);
      setTimeout(() => {
        setResetPasswordUser(null);
        resetPasswordForm();
      }, 1500);
    },
    onError: (err: any) => {
      setResetSuccess(null);
      setResetError(err.response?.data?.message || "Failed to reset password.");
    }
  });

  // Helper Functions
  const resetCreateForm = () => {
    setNewEmail("");
    setNewPassword("");
    setNewFirstName("");
    setNewLastName("");
    setNewRole("EMPLOYEE");
    setCreateError(null);
    setCreateSuccess(null);
  };

  const resetPasswordForm = () => {
    setResetPassVal("");
    setResetForceChange(true);
    setResetError(null);
    setResetSuccess(null);
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newFirstName || !newLastName) {
      setCreateError("All fields are required.");
      return;
    }
    createUserMutation.mutate({
      email: newEmail,
      password: newPassword,
      firstName: newFirstName,
      lastName: newLastName,
      role: newRole
    });
  };

  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    updateUserMutation.mutate({
      id: editUser.id,
      payload: {
        firstName: editFirstName,
        lastName: editLastName,
        role: editRole,
        isActive: editIsActive
      }
    });
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    if (resetPassVal.length < 8) {
      setResetError("Password must be at least 8 characters long.");
      return;
    }
    resetPasswordMutation.mutate({
      id: resetPasswordUser.id,
      payload: {
        password: resetPassVal,
        mustChangePassword: resetForceChange
      }
    });
  };

  // Toggle user block/unblock state directly from table
  const handleToggleBlock = (user: any) => {
    const actionStr = user.isActive ? "Block" : "Unblock";
    setConfirmDialog({
      title: `${actionStr} User Account`,
      message: `Are you sure you want to ${actionStr.toLowerCase()} the account for ${user.email}?`,
      onConfirm: () => {
        updateUserMutation.mutate({
          id: user.id,
          payload: {
            isActive: !user.isActive
          }
        });
        setConfirmDialog(null);
      }
    });
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let generated = "";
    // Ensure we satisfy validation: uppercase, lowercase, digit, special char
    generated += "A";
    generated += "a";
    generated += "1";
    generated += "!";
    for (let i = 0; i < 8; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Shuffle
    generated = generated.split('').sort(() => 0.5 - Math.random()).join('');
    setResetPassVal(generated);
  };

  const generateRandomCreatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let generated = "";
    generated += "A";
    generated += "a";
    generated += "1";
    generated += "!";
    for (let i = 0; i < 8; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    generated = generated.split('').sort(() => 0.5 - Math.random()).join('');
    setNewPassword(generated);
  };

  // Filter and compute stats
  const filteredUsers = (usersData || []).filter((u: any) => {
    const fullName = `${u.profile?.firstName || ""} ${u.profile?.lastName || ""}`.toLowerCase();
    const email = (u.email || "").toLowerCase();
    const role = (u.role || "").toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search) || role.includes(search);
  });

  const totalUsers = usersData?.length || 0;
  const activeUsers = usersData?.filter((u: any) => u.isActive).length || 0;
  const blockedUsers = usersData?.filter((u: any) => !u.isActive).length || 0;
  const adminUsers = usersData?.filter((u: any) => u.role === "ADMIN").length || 0;

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-sans">User Management</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Provision new enterprise operator logins, adjust role privileges, reset passwords, or suspend access.</p>
        </div>

        <button
          onClick={() => {
            resetCreateForm();
            setCreateUserOpen(true);
          }}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer self-stretch sm:self-auto"
        >
          <UserPlus className="h-4 w-4" /> Provision New User
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-mono">Total Operators</span>
            <span className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-1 block">{isLoadingUsers ? "..." : totalUsers}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-mono">Active Access</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{isLoadingUsers ? "..." : activeUsers}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-mono">Blocked / Suspended</span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{isLoadingUsers ? "..." : blockedUsers}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400">
            <UserX className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-mono">Admins</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">{isLoadingUsers ? "..." : adminUsers}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
            <Shield className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Filter & Table Area */}
      <div className="space-y-4">
        
        {/* Search */}
        <div className="relative bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search operator accounts by full name, email login, or specific system role..."
            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-12 pr-4 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
          />
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          {isLoadingUsers ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-500 dark:text-zinc-400">Querying enterprise operators ledger...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-mono">
                    <th className="py-4 px-6">Operator Full Name</th>
                    <th className="py-4 px-4">Login Email</th>
                    <th className="py-4 px-4">Privilege Role</th>
                    <th className="py-4 px-4">Account Status</th>
                    <th className="py-4 px-4">Must Change Password</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 text-xs">
                  {filteredUsers.map((user: any) => (
                    <tr key={user.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30">
                      
                      {/* Name / Profile */}
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-900 dark:text-zinc-100 block">
                          {user.profile?.firstName || user.profile?.lastName 
                            ? `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}` 
                            : <span className="text-slate-400 dark:text-zinc-500 italic">No profile linked</span>
                          }
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5 block">ID: {user.id}</span>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-4 font-semibold text-slate-700 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                          <span>{user.email}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          user.role === "ADMIN" 
                            ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800" 
                            : user.role === "MANAGER"
                            ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                            : user.role === "ACCOUNTANT"
                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700"
                        }`}>
                          <Shield className="h-2.5 w-2.5" />
                          {user.role}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          user.isActive 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                          {user.isActive ? "Active" : "Suspended"}
                        </span>
                      </td>

                      {/* Force Password Change */}
                      <td className="py-4 px-4">
                        {user.mustChangePassword ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">
                            <AlertTriangle className="h-3 w-3" /> Yes (Pending)
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500 font-medium">No</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          
                          {/* Toggle Suspend/Block Button */}
                          <button
                            onClick={() => handleToggleBlock(user)}
                            title={user.isActive ? "Block user login" : "Unblock user login"}
                            className={`p-1.5 rounded-lg border transition-all hover:scale-105 cursor-pointer ${
                              user.isActive 
                                ? "text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-900/60" 
                                : "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                            }`}
                          >
                            {user.isActive ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              resetPasswordForm();
                              setResetPasswordUser(user);
                            }}
                            title="Reset password"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-850 hover:bg-slate-100 dark:hover:bg-zinc-750 hover:text-slate-900 dark:hover:text-zinc-100 transition-all hover:scale-105 cursor-pointer"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit User Details */}
                          <button
                            onClick={() => {
                              setEditUser(user);
                              setEditFirstName(user.profile?.firstName || "");
                              setEditLastName(user.profile?.lastName || "");
                              setEditRole(user.role);
                              setEditIsActive(user.isActive);
                              setEditError(null);
                            }}
                            title="Edit profile & role"
                            className="p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 transition-all hover:scale-105 cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-zinc-500 italic">No operators located matching your current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: PROVISION NEW USER */}
      {createUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setCreateUserOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-600" />
                Provision Enterprise Operator
              </h3>
              <button onClick={() => setCreateUserOpen(false)} className="text-slate-400 dark:text-zinc-500 cursor-pointer hover:text-slate-600 dark:hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {createError && <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-semibold">{createError}</div>}
            {createSuccess && <div className="p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">{createSuccess}</div>}

            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. David"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="e.g. Miller"
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Access Login Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="david.miller@enterprise-erp.com"
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1 flex items-center justify-between">
                  <span>Initial Access Password</span>
                  <button 
                    type="button" 
                    onClick={generateRandomCreatePassword}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 lowercase font-semibold font-sans tracking-normal cursor-pointer"
                  >
                    Auto-Generate Password
                  </button>
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set initial credential password"
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Access Privilege Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 font-semibold"
                >
                  <option value="EMPLOYEE">EMPLOYEE (Standard Operator)</option>
                  <option value="ACCOUNTANT">ACCOUNTANT (Finance Ledger)</option>
                  <option value="MANAGER">MANAGER (Logistics Coordinator)</option>
                  <option value="ADMIN">ADMIN (System Administrator)</option>
                </select>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={createUserMutation.isPending}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {createUserMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Publish Operator Credentials"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER DETAILS */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setEditUser(null)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-indigo-600" />
                Modify Operator Profile
              </h3>
              <button onClick={() => setEditUser(null)} className="text-slate-400 dark:text-zinc-500 cursor-pointer hover:text-slate-600 dark:hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {editError && <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-semibold">{editError}</div>}

            <form onSubmit={handleEditUserSubmit} className="space-y-4">
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-indigo-600" />
                <div>
                  <span className="block text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-wider font-mono">Editing Login</span>
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">{editUser.email}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">System Role Privilege</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 font-semibold"
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="ACCOUNTANT">ACCOUNTANT</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Account Activation Status</label>
                <select
                  value={editIsActive ? "active" : "suspended"}
                  onChange={(e) => setEditIsActive(e.target.value === "active")}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 font-semibold"
                >
                  <option value="active">ACTIVE (Allowed to login)</option>
                  <option value="suspended">SUSPENDED / BLOCKED (Denied logins)</option>
                </select>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={updateUserMutation.isPending}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {updateUserMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Profile Modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setResetPasswordUser(null)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Key className="h-4 w-4 text-indigo-600" />
                Reset User Password
              </h3>
              <button onClick={() => setResetPasswordUser(null)} className="text-slate-400 dark:text-zinc-500 cursor-pointer hover:text-slate-600 dark:hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {resetError && <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-semibold">{resetError}</div>}
            {resetSuccess && <div className="p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">{resetSuccess}</div>}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/40 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <span className="block text-[10px] font-bold text-amber-500 dark:text-amber-500 uppercase tracking-wider font-mono">Resetting Credentials</span>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">{resetPasswordUser.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1 flex items-center justify-between">
                  <span>New Password</span>
                  <button 
                    type="button" 
                    onClick={generateRandomPassword}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 lowercase font-semibold font-sans tracking-normal cursor-pointer"
                  >
                    Auto-Generate Password
                  </button>
                </label>
                <input
                  type="text"
                  required
                  value={resetPassVal}
                  onChange={(e) => setResetPassVal(e.target.value)}
                  placeholder="Enter custom password or click Auto-Generate"
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl border border-slate-100 dark:border-zinc-700">
                <input
                  type="checkbox"
                  id="forceChange"
                  checked={resetForceChange}
                  onChange={(e) => setResetForceChange(e.target.checked)}
                  className="rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="forceChange" className="text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer select-none">
                  Force operator to change password upon next login attempt
                </label>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={resetPasswordMutation.isPending}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {resetPasswordMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Deploy New Credentials"}
                </button>
              </div>
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
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
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
