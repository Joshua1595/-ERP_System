import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  DollarSign, 
  FileText, 
  LogOut, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Bell, 
  User as UserIcon,
  Shield,
  Activity,
  Upload,
  Check,
  Loader2,
  Phone,
  MapPin,
  Mail,
  Fingerprint,
  Lock,
  Briefcase
} from "lucide-react";
import { useTheme } from "./ThemeContext.tsx";
import { api } from "../lib/api.ts";
import { SIDEBAR_CONFIG, Role } from "../lib/permissions.ts";

const iconMap: Record<string, any> = {
  LayoutDashboard: LayoutDashboard,
  Package: Package,
  TrendingUp: TrendingUp,
  ShoppingCart: ShoppingCart,
  Users: Users,
  DollarSign: DollarSign,
  FileText: FileText,
  Shield: Shield,
};

export default function Layout() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Profile modal states
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
    profilePhotoUrl: ""
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);

  useEffect(() => {
    // Load local storage user info
    const storedUser = localStorage.getItem("erp_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        // Safe to ignore
      }
    }
    fetchCurrentUser();
    fetchNotificationsCount();

    // Event listener to open profile modal dynamically from other components (like Dashboard)
    const handleOpenProfileModal = () => {
      setProfileModalOpen(true);
    };
    window.addEventListener("open_profile_modal", handleOpenProfileModal);
    return () => {
      window.removeEventListener("open_profile_modal", handleOpenProfileModal);
    };
  }, []);

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.profile?.firstName || "",
        lastName: user.profile?.lastName || "",
        phone: user.profile?.phone || "",
        address: user.profile?.address || "",
        profilePhotoUrl: user.profile?.profilePhotoUrl || ""
      });
    }
  }, [user, profileModalOpen]);

  const handlePhotoUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setProfileMessage({ type: "error", text: "Please upload an image file." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileMessage({ type: "error", text: "Image size must be less than 2MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setProfileData(prev => ({
          ...prev,
          profilePhotoUrl: e.target!.result as string
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await api.put("/auth/profile", profileData);
      if (res.data?.status === "success") {
        const updated = res.data.data.user;
        const newUser = {
          ...user,
          profile: updated.profile
        };
        setUser(newUser);
        localStorage.setItem("erp_user", JSON.stringify(newUser));
        window.dispatchEvent(new Event("erp_user_updated"));
        setProfileMessage({ type: "success", text: "Profile updated successfully!" });
        setTimeout(() => {
          setProfileModalOpen(false);
          setProfileMessage(null);
        }, 1200);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || "Failed to update profile. Please try again.";
      setProfileMessage({ type: "error", text: errMsg });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get("/auth/me");
      if (res.data?.status === "success") {
        const u = res.data.data.user;
        setUser(u);
        localStorage.setItem("erp_user", JSON.stringify(u));
        window.dispatchEvent(new Event("erp_user_updated"));
      }
    } catch (err) {
      // Handled by API interceptor
    }
  };

  const fetchNotificationsCount = async () => {
    try {
      const res = await api.get("/notifications");
      if (res.data?.status === "success") {
        const unread = res.data.data.filter((n: any) => !n.isRead).length;
        setUnreadNotifications(unread);
      }
    } catch (err) {
      // Ignore
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("erp_refresh_token");
      await api.post("/auth/logout", { refreshToken });
    } catch (err) {
      // Clean up locally anyway
    } finally {
      localStorage.removeItem("erp_access_token");
      localStorage.removeItem("erp_refresh_token");
      localStorage.removeItem("erp_user");
      navigate("/login");
    }
  };

  const getNavItems = () => {
    if (!user) return [];
    const role = user.role as Role;
    const configItems = SIDEBAR_CONFIG[role] || [];
    return configItems.map(item => ({
      ...item,
      icon: iconMap[item.iconName] || LayoutDashboard
    }));
  };

  const activeNavItems = getNavItems();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 flex font-sans transition-colors duration-200">
      
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 dark:border-zinc-900 bg-white dark:bg-zinc-900/60 backdrop-blur-md sticky top-0 h-screen z-20">
        <div className="p-6 border-b border-slate-200 dark:border-zinc-900 flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 shadow-sm">
            <Activity className="h-6 w-6 text-indigo-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Enterprise ERP</h1>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Suite v2026</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {activeNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon className={`h-4.5 w-4.5 transition-colors ${isActive ? "text-white" : "text-slate-400 dark:text-zinc-500 group-hover:text-slate-900 dark:group-hover:text-white"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Profile Box */}
        {user && (
          <div className="p-4 border-t border-slate-200 dark:border-zinc-900 bg-slate-100/50 dark:bg-zinc-900/30">
            <button
              onClick={() => setProfileModalOpen(true)}
              className="w-full text-left flex items-center gap-3 mb-3 hover:bg-slate-200/30 dark:hover:bg-zinc-800/30 p-1.5 rounded-xl transition-all cursor-pointer group"
            >
              {user.profile?.profilePhotoUrl ? (
                <img
                  src={user.profile.profilePhotoUrl}
                  alt="Profile"
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-zinc-800 group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                  <UserIcon className="h-4.5 w-4.5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {user.profile?.firstName 
                    ? `${user.profile.firstName} ${user.profile.lastName}` 
                    : user.firstName 
                    ? `${user.firstName} ${user.lastName}` 
                    : user.email.split("@")[0]}
                </p>
                <div className="flex items-center gap-1">
                  <Shield className="h-3 w-3 text-indigo-500 shrink-0" />
                  <span className="text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 rounded">
                    {user.role}
                  </span>
                </div>
              </div>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-red-500/20 dark:hover:border-red-500/30 text-slate-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/5 dark:hover:bg-red-500/10 text-xs font-semibold transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out Session
            </button>
          </div>
        )}
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Top Floating Navbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
             
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 transition-all cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Notifications Alert */}
            <div className="relative">
              <button
                onClick={() => {
                  if (user?.role === "ADMIN") {
                    navigate("/admin/logs");
                  }
                }}
                className={`p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 transition-all ${user?.role === "ADMIN" ? "hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && user?.role === "ADMIN" && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 border-2 border-white dark:border-zinc-950 flex items-center justify-center text-[8px] font-bold text-white">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Workspace Dynamic Content Container */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer Navigation overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-900 z-50 p-6 flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-indigo-500" />
                  <span className="font-bold text-slate-900 dark:text-white">Enterprise ERP</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 space-y-1">
                {activeNavItems.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              {user && (
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      setProfileModalOpen(true);
                    }}
                    className="w-full text-left flex items-center gap-3 mb-4 hover:bg-slate-100 dark:hover:bg-zinc-800/50 p-1.5 rounded-xl transition-all"
                  >
                    {user.profile?.profilePhotoUrl ? (
                      <img
                        src={user.profile.profilePhotoUrl}
                        alt="Profile"
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-zinc-800"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <UserIcon className="h-4.5 w-4.5" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {user.profile?.firstName 
                          ? `${user.profile.firstName} ${user.profile.lastName}` 
                          : user.firstName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user.email.split("@")[0]}
                      </p>
                      <span className="text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 rounded">
                        {user.role}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-red-500/20 text-slate-600 dark:text-zinc-400 hover:text-red-400 text-xs font-semibold cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Profile Editing Modal */}
      <AnimatePresence>
        {profileModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSavingProfile && setProfileModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed inset-x-4 top-10 md:top-20 md:max-w-2xl md:mx-auto bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl z-50 overflow-hidden max-h-[85vh] flex flex-col"
            >
              {/* Cover Banner */}
              <div className="h-28 w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 relative overflow-hidden shrink-0">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -left-10 -top-10 w-40 h-40 bg-indigo-500/30 rounded-full blur-2xl" />
                
                {/* Close Button on Banner */}
                <button
                  type="button"
                  disabled={isSavingProfile}
                  onClick={() => setProfileModalOpen(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-all cursor-pointer disabled:opacity-50 z-20"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="absolute bottom-3 left-6 flex items-center gap-2 text-white">
                  <Fingerprint className="h-4.5 w-4.5 text-indigo-200 animate-pulse" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-200 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-md">
                    System Identity Core
                  </span>
                </div>
              </div>

              {/* Floating Avatar & Header Meta */}
              <div className="px-6 pb-2 -mt-10 relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0">
                <div className="flex items-end gap-4">
                  {/* Avatar upload */}
                  <div className="relative group shrink-0">
                    {profileData.profilePhotoUrl ? (
                      <img
                        src={profileData.profilePhotoUrl}
                        alt="Profile Preview"
                        referrerPolicy="no-referrer"
                        className="h-20 w-20 rounded-2xl object-cover border-4 border-white dark:border-zinc-900 shadow-xl"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border-4 border-white dark:border-zinc-900 shadow-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <UserIcon className="h-9 w-9" />
                      </div>
                    )}
                    {profileData.profilePhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setProfileData(prev => ({ ...prev, profilePhotoUrl: "" }))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:scale-110 transition-transform shadow-md z-20"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white leading-none mb-1">
                      {profileData.firstName || profileData.lastName 
                        ? `${profileData.firstName} ${profileData.lastName}` 
                        : user?.email?.split("@")[0] || "Operator"}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                      ID: {user?.id?.slice(0, 8) || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Security Badge */}
                <div className="shrink-0 pb-1">
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                    <Shield className="h-3 w-3" />
                    {user?.role} AUTHORITY
                  </span>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto p-6 space-y-6">
                {profileMessage && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs font-semibold border ${
                      profileMessage.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                    }`}
                  >
                    {profileMessage.text}
                  </div>
                )}

                {/* Grid container to arrange visual badge & photo uploader */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Card Section 1: Holographic Access Badge Preview */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Live Credentials Preview</label>
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950/40 dark:to-zinc-900/40 border border-slate-200/60 dark:border-zinc-800/60 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between h-40 shadow-inner">
                      {/* Holographic background fingerprint icon */}
                      <div className="absolute right-3 top-3 opacity-10 dark:opacity-20 pointer-events-none">
                        <Fingerprint className="h-20 w-20 text-indigo-500" />
                      </div>
                      
                      <div className="flex justify-between items-start">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
                            <span className="text-[8px] font-mono font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">
                              SECURE KEY PROVISIONED
                            </span>
                          </div>
                          <div>
                            <div className="text-[8px] text-slate-400 dark:text-zinc-500 font-bold tracking-wider uppercase">OPERATOR LICENSE</div>
                            <div className="text-sm font-extrabold text-slate-800 dark:text-white truncate max-w-[180px]">
                              {profileData.firstName || "Jane"} {profileData.lastName || "Doe"}
                            </div>
                          </div>
                        </div>
                        
                        {/* Microchip emblem */}
                        <div className="h-8 w-11 bg-amber-400/20 border border-amber-400/50 rounded-lg flex flex-col justify-between p-1 shadow-inner relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/10 via-transparent to-amber-400/20" />
                          <div className="flex justify-between"><div className="h-1 w-1 bg-amber-400/50 rounded-sm"></div><div className="h-1 w-1 bg-amber-400/50 rounded-sm"></div></div>
                          <div className="h-1 bg-amber-400/30 rounded-sm w-full"></div>
                          <div className="flex justify-between"><div className="h-1 w-1 bg-amber-400/50 rounded-sm"></div><div className="h-1 w-1 bg-amber-400/50 rounded-sm"></div></div>
                        </div>
                      </div>

                      <div className="flex justify-between items-end border-t border-slate-200/50 dark:border-zinc-800/50 pt-2.5">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">ROLE</div>
                            <div className="text-[10px] font-mono font-bold text-slate-700 dark:text-zinc-300">
                              {user?.role || "EMPLOYEE"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">SIGNATURE</div>
                            <div className="text-[10px] font-mono font-bold text-slate-700 dark:text-zinc-300 uppercase">
                              {user?.id?.slice(0, 4) || "NODE"}-KEY
                            </div>
                          </div>
                        </div>

                        {/* Barcode */}
                        <div className="flex flex-col items-center">
                          <div className="flex gap-[1px] h-5 opacity-50 dark:opacity-75">
                            <div className="w-[1px] bg-slate-800 dark:bg-white h-full"></div>
                            <div className="w-[2px] bg-slate-800 dark:bg-white h-full"></div>
                            <div className="w-[1px] bg-slate-800 dark:bg-white h-full"></div>
                            <div className="w-[3px] bg-slate-800 dark:bg-white h-full"></div>
                            <div className="w-[1px] bg-slate-800 dark:bg-white h-full"></div>
                            <div className="w-[2px] bg-slate-800 dark:bg-white h-full"></div>
                            <div className="w-[1px] bg-slate-800 dark:bg-white h-full"></div>
                          </div>
                          <span className="text-[7px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5">ERP-{user?.id?.slice(0,6).toUpperCase()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Photo Drag & Drop Zone */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Update Profile Photo</label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingPhoto(true);
                      }}
                      onDragLeave={() => setIsDraggingPhoto(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingPhoto(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                      className={`h-40 w-full border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                        isDraggingPhoto
                          ? "border-indigo-500 bg-indigo-500/5"
                          : "border-slate-200 dark:border-zinc-800 hover:border-indigo-500/50 bg-slate-50/50 dark:bg-zinc-950/20"
                      }`}
                    >
                      <Upload className="h-6 w-6 text-indigo-500/80 mb-2" />
                      <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Drag & drop photo here, or{" "}
                        <label className="text-indigo-600 dark:text-indigo-400 font-bold cursor-pointer hover:underline">
                          browse
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePhotoUpload(file);
                            }}
                            className="hidden"
                          />
                        </label>
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5">PNG, JPG, or WEBP up to 2MB</p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Contact & Identity Credentials */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-zinc-800 pb-1.5">
                    <Fingerprint className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Operator Details Configuration</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">First Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                        <input
                          type="text"
                          required
                          value={profileData.firstName}
                          onChange={(e) => setProfileData(p => ({ ...p, firstName: e.target.value }))}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="Jane"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Last Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                        <input
                          type="text"
                          required
                          value={profileData.lastName}
                          onChange={(e) => setProfileData(p => ({ ...p, lastName: e.target.value }))}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                        <input
                          type="tel"
                          value={profileData.phone}
                          onChange={(e) => setProfileData(p => ({ ...p, phone: e.target.value }))}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="+1 (555) 019-2834"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Physical Address</label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                        <input
                          type="text"
                          value={profileData.address}
                          onChange={(e) => setProfileData(p => ({ ...p, address: e.target.value }))}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="100 Enterprise Way, Suite A"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Immutable System Identifiers (Read-only) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-zinc-800 pb-1.5">
                    <Lock className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Immutable System Attributes</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200/50 dark:border-zinc-800/50">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Email Address Signatures</label>
                        <Lock className="h-3 w-3 text-slate-400" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                        <span className="text-xs font-mono font-medium text-slate-500 dark:text-zinc-400">{user?.email || ""}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200/50 dark:border-zinc-800/50">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Security Clearance Level</label>
                        <Lock className="h-3 w-3 text-slate-400" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                        <span className="text-xs font-mono font-medium text-slate-500 dark:text-zinc-400">{user?.role || "EMPLOYEE"} Authority</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Actions footer */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-zinc-800 shrink-0">
                  <button
                    type="button"
                    disabled={isSavingProfile}
                    onClick={() => setProfileModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-md shadow-indigo-600/10 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Committing Keys...
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Apply Profile Configuration
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
