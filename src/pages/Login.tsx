import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Lock, 
  Key, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle, 
  Fingerprint, 
  ChevronRight,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { api } from "../lib/api.ts";

export default function Login() {
  const navigate = useNavigate();
  
  // Auth Modes: "login" or "change_password"
  const [formMode, setFormMode] = useState<"login" | "change_password">("login");
  
  // Auth Inputs
  const [email, setEmail] = useState("admin@erp.com");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // First-Time Password Change Inputs
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedRoleUsers, setSelectedRoleUsers] = useState<any[]>([]);
  const [showUserSelectModal, setShowUserSelectModal] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const res = await api.get("/auth/quick-fill-users");
        if (res.data?.status === "success" && Array.isArray(res.data.data?.users)) {
          setAllUsers(res.data.data.users);
        }
      } catch (err) {
        console.warn("Failed to fetch dynamic seeds for quick fill", err);
      }
    };
    fetchAllUsers();
  }, []);

  const rolesList = [
    { name: "Super Admin", role: "ADMIN", desc: "Full executive rights" },
    { name: "Logistics Manager", role: "MANAGER", desc: "Warehouse operations control" },
    { name: "Standard Employee", role: "EMPLOYEE", desc: "General workspace staff" },
    { name: "Treasury Accountant", role: "ACCOUNTANT", desc: "Ledgers & corporate books" },
  ];

  const getUserCountForRole = (role: string) => {
    return allUsers.filter(u => u.role === role).length;
  };

  const handleQuickFill = (user: any) => {
    setEmail(user.email);
    setPassword("password123");
    setFormMode("login");
    setMessage({ 
      type: "success", 
      text: `Prefilled credentials for ${user.name}! Default/Initial password is 'password123'.` 
    });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleRoleClick = (roleItem: any) => {
    const matchingUsers = allUsers.filter(u => u.role === roleItem.role);
    if (matchingUsers.length === 0) {
      // Fallback if no user exists under this role
      const defaultEmail = roleItem.role === "ADMIN" ? "admin@erp.com" :
                           roleItem.role === "MANAGER" ? "manager@erp.com" :
                           roleItem.role === "ACCOUNTANT" ? "accountant@erp.com" :
                           "employee@erp.com";
      handleQuickFill({ name: roleItem.name, email: defaultEmail });
    } else if (matchingUsers.length === 1) {
      // Prefill immediately
      handleQuickFill(matchingUsers[0]);
    } else {
      // Show user selection modal/popover
      setSelectedRoleUsers(matchingUsers);
      setShowUserSelectModal(roleItem.role);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await api.post("/auth/login", { email, password });
      
      if (res.data?.status === "must_change_password") {
        // Intercept first-time login and switch forms
        setTempPassword(password);
        setFormMode("change_password");
        setMessage({
          type: "success",
          text: "First-time login detected. Please change your temporary password to secure your account."
        });
      } else if (res.data?.status === "success") {
        const { accessToken, refreshToken, user } = res.data.data;
        localStorage.setItem("erp_access_token", accessToken);
        localStorage.setItem("erp_refresh_token", refreshToken);
        localStorage.setItem("erp_user", JSON.stringify(user));
        
        setMessage({ type: "success", text: "Successfully authenticated!" });
        setTimeout(() => navigate("/"), 1000);
      } else {
        setMessage({ type: "error", text: res.data?.message || "Invalid credentials." });
      }
    } catch (err: any) {
      setMessage({ 
        type: "error", 
        text: err.response?.data?.message || "Connection refused or invalid credentials." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePasswordFirstTime = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match. Please verify." });
      return;
    }

    if (newPassword === tempPassword) {
      setMessage({ type: "error", text: "New password cannot be the same as your temporary password." });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const res = await api.post("/auth/change-password-first-time", {
        email,
        temporaryPassword: tempPassword,
        newPassword
      });

      if (res.data?.status === "success") {
        setMessage({
          type: "success",
          text: "Credentials successfully updated! You can now log in using your new secure password."
        });
        setFormMode("login");
        setPassword(newPassword);
        setNewPassword("");
        setConfirmPassword("");
        setTempPassword("");
      } else {
        setMessage({ type: "error", text: res.data?.message || "Failed to configure password." });
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Password does not meet corporate security requirements (Must contain 8+ characters, uppercase, lowercase, digit, and special symbol)."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 flex flex-col justify-center items-center p-6 transition-colors duration-200">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        
        {/* Left Side: Brand presentation */}
        <div className="md:col-span-5 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-md">
              <Fingerprint className="h-8 w-8 text-indigo-500 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Enterprise ERP</h1>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">Workspace Gateway</p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Seeded Corporate Sandbox</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Authenticate directly using secure single-use token rotation, RBAC rules, and validated schemas. Choose a persona profile below for instant access testing.
            </p>
          </div>

          <div className="space-y-2">
            {rolesList.map((roleItem, i) => {
              const count = getUserCountForRole(roleItem.role);
              return (
                <button
                  key={i}
                  onClick={() => handleRoleClick(roleItem)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-900 hover:border-indigo-500/30 hover:bg-slate-100/50 dark:hover:bg-zinc-900/60 text-left transition-all group cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-white truncate">{roleItem.name}</span>
                      <span className="text-[9px] font-mono font-bold bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded text-slate-500 dark:text-zinc-400">
                        {roleItem.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-500 truncate">
                      {count === 1 ? "1 registered user" : count > 1 ? `${count} registered users` : "No registered users (static fallback)"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Secure Login / Change password card */}
        <div className="md:col-span-7">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-900 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md"
          >
            <div className="flex border-b border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/20 py-4 px-8 items-center justify-between">
              {formMode === "login" ? (
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-700 dark:text-zinc-300">
                    Secure ERP Sign-In
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500 animate-bounce" />
                  <span className="text-xs font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                    Mandatory Security Setup
                  </span>
                </div>
              )}
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                SSL v3 Encrypted
              </span>
            </div>

            <div className="p-8">
              {message && (
                <div className={`p-4 mb-6 rounded-2xl border flex items-center gap-3 text-xs font-medium animate-fade-in ${
                  message.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                }`}>
                  {message.type === "success" ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                  <span>{message.text}</span>
                </div>
              )}

              {formMode === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                      Business Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. administrator@company.com"
                      className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 flex items-center gap-1 focus:outline-none cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-lg shadow-indigo-600/10 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {isLoading ? "Validating Cryptographic Identity..." : "Authenticate Session Node"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleChangePasswordFirstTime} className="space-y-4">
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 mb-4 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    <strong>Security Requirement:</strong> You must update your administrator-provisioned temporary password. Your new password must contain at least 8 characters, an uppercase letter, a lowercase letter, a digit, and a special character.
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                      Business Email
                    </label>
                    <input
                      type="email"
                      readOnly
                      disabled
                      value={email}
                      className="w-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-400 dark:text-zinc-500 select-none cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                      Temporary Password
                    </label>
                    <input
                      type="password"
                      required
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Enter the temporary password used to sign in"
                      className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                          New Secure Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 flex items-center gap-1 focus:outline-none cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {showNewPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                        Confirm New Password
                      </label>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormMode("login");
                        setMessage(null);
                      }}
                      className="flex-1 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs text-slate-700 dark:text-zinc-200 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-[2] py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white shadow-lg shadow-indigo-600/10 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoading ? "Configuring Access Credentials..." : "Configure New Password"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>

      </div>

      {/* Dynamic User Selection Modal */}
      {showUserSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setShowUserSelectModal(null)} />
          <div className="relative bg-white border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 overflow-hidden dark:bg-zinc-950 animate-fade-in">
            <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1">Select User Account</h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
              Multiple users are registered under the <span className="font-mono font-bold bg-slate-100 dark:bg-zinc-850 px-1 rounded">{showUserSelectModal}</span> role. Choose an account to prefill credentials:
            </p>
            
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {selectedRoleUsers.map((user, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleQuickFill(user);
                    setShowUserSelectModal(null);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-zinc-900 bg-slate-50 hover:bg-indigo-50/50 dark:bg-zinc-900/40 dark:hover:bg-indigo-950/20 text-left transition-all hover:border-indigo-500/20 group cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <span className="block text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-white truncate">
                      {user.name}
                    </span>
                    <span className="block text-[10px] text-slate-500 dark:text-zinc-500 font-mono truncate">
                      {user.email}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowUserSelectModal(null)}
                className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
