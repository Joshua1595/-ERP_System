import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ShieldAlert, 
  Bell, 
  Trash2, 
  RefreshCw, 
  Search, 
  CheckCircle,
  Plus,
  Play,
  X,
  User,
  AlertTriangle,
  Flame
} from "lucide-react";
import { api } from "../lib/api.ts";
import { hasPermission } from "../lib/permissions.ts";

export default function ActivityLogs() {
  const queryClient = useQueryClient();
  const [currentUser] = useState<any>(() => {
    const stored = localStorage.getItem("erp_user");
    try {
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<"logs" | "notifications">("logs");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals / forms state
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [purgDays, setPurgeDays] = useState(30);

  // Custom notification form
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifType, setNotifType] = useState("INFO");
  const [notifRole, setNotifRole] = useState("ALL");

  const [formError, setFormError] = useState<string | null>(null);

  // Custom Iframe-safe confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Queries
  const { data: logsData, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["activityLogs"],
    queryFn: async () => {
      try {
        const res = await api.get("/activity-logs");
        return res?.data?.data?.logs ?? [];
      } catch (err) {
        console.error("Error fetching activity logs:", err);
        return [];
      }
    }
  });

  const { data: notificationsData, isLoading: isLoadingNotifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      try {
        const res = await api.get("/notifications");
        return res?.data?.data?.notifications ?? [];
      } catch (err) {
        console.error("Error fetching notifications:", err);
        return [];
      }
    }
  });

  // Mutations: Logs purge
  const purgeLogsMutation = useMutation({
    mutationFn: async (days: number) => {
      await api.post("/activity-logs/purge", { olderThanDays: days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activityLogs"] });
      alert("Successfully purged audit trial logs.");
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Purging failed. Restricted to ADMIN.");
    }
  });

  // Mutations: Notifications Mark Read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post("/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
    }
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
    }
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const triggerScanMutation = useMutation({
    mutationFn: async () => {
      await api.post("/notifications/generate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      alert("ERP scanner completed successfully. Any alerts generated are now listed.");
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to trigger system scanner.");
    }
  });

  const createManualNotificationMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/notifications", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setNotificationModalOpen(false);
      resetNotificationForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to post system announcement.");
    }
  });

  const resetNotificationForm = () => {
    setNotifTitle("");
    setNotifMessage("");
    setNotifType("INFO");
    setNotifRole("ALL");
    setFormError(null);
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    createManualNotificationMutation.mutate({
      title: notifTitle,
      message: notifMessage,
      type: notifType,
      targetRole: notifRole === "ALL" ? null : notifRole
    });
  };

  const filteredLogs = (logsData || []).filter((l: any) => {
    return l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
           l.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
           l.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (l.user?.email && l.user.email.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-sans">Audit Trail & Alerts</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Verify system action trails, review compliance, and manage network-wide alerts.</p>
        </div>

        {activeTab === "logs" && hasPermission(currentUser, "system.admin") && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => {
                setConfirmDialog({
                   title: "Purge System Logs",
                   message: `Are you sure you want to purge system logs older than ${purgDays} days? This operation is irreversible.`,
                   onConfirm: () => {
                     purgeLogsMutation.mutate(purgDays);
                     setConfirmDialog(null);
                   }
                 })
              }}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-md cursor-pointer flex-1 sm:flex-initial"
            >
              <Flame className="h-4 w-4" /> Purge Logs ({purgDays}d)
            </button>
            <input
              type="number"
              min="1"
              value={purgDays}
              onChange={(e) => setPurgeDays(Number(e.target.value))}
              className="w-14 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl py-2 px-1 text-center font-mono text-xs font-bold text-slate-900 dark:text-zinc-100"
            />
          </div>
        )}

        {activeTab === "notifications" && hasPermission(currentUser, "system.admin") && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => triggerScanMutation.mutate()}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white shadow-md cursor-pointer flex-1 sm:flex-initial"
            >
              <Play className="h-4 w-4 text-emerald-400" /> Trigger System Scan
            </button>
            
            <button
              onClick={() => {
                resetNotificationForm();
                setNotificationModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4" /> Broadcast Announcement
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 rounded-2xl gap-2">
        <button
          onClick={() => { setActiveTab("logs"); setSearchTerm(""); }}
          className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === "logs"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <ShieldAlert className="h-4 w-4" /> Security Audit trail
        </button>

        <button
          onClick={() => { setActiveTab("notifications"); setSearchTerm(""); }}
          className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === "notifications"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Bell className="h-4 w-4" /> System Alerts & Notifications
        </button>
      </div>

      {/* Tab A: Logs Trail */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="relative bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by action, target module, description details, or user IP addresses..."
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-12 pr-4 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
            />
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
            {isLoadingLogs ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-500 dark:text-zinc-400">Querying security books...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-mono">
                      <th className="py-4 px-6">Timestamp</th>
                      <th className="py-4 px-4">Officer User</th>
                      <th className="py-4 px-4">Action Node</th>
                      <th className="py-4 px-4">Module Class</th>
                      <th className="py-4 px-4">Audit Description</th>
                      <th className="py-4 px-6 text-right">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 text-xs">
                    {filteredLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30">
                        <td className="py-4 px-6 font-mono text-slate-400 dark:text-zinc-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="py-4 px-4">
                          <span className="font-bold text-slate-900 dark:text-zinc-100 block">{log.user?.profile ? `${log.user.profile.firstName} ${log.user.profile.lastName}` : "System service"}</span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5 block">{log.user?.email || "Service Account"}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            log.action === "LOGIN" 
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                              : log.action === "LOGOUT" 
                              ? "bg-slate-500/10 text-slate-600 dark:text-zinc-400" 
                              : log.action === "CREATE"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : log.action === "DELETE"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-500 dark:text-zinc-400">{log.module}</td>
                        <td className="py-4 px-4 text-slate-700 dark:text-zinc-300 font-semibold max-w-sm truncate" title={log.description}>{log.description}</td>
                        <td className="py-4 px-6 text-right font-mono text-slate-500 dark:text-zinc-400">{log.ipAddress || "::1"}</td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-zinc-500 italic">No access logs located in security database.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab B: Alerts */}
      {activeTab === "notifications" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-bounce" />
              <div>
                <span className="font-bold text-indigo-900 dark:text-indigo-200 block text-xs">Awaiting broadcast alert notifications</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">Clear items or run the automated scanner.</span>
              </div>
            </div>
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="py-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Clear All Alerts
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
            {isLoadingNotifs ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-500 dark:text-zinc-400">Querying alert boards...</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-zinc-800">
                {notificationsData?.map((n: any) => (
                  <div key={n.id} className={`p-4 flex items-start justify-between gap-4 transition-all hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 ${!n.isRead ? "bg-indigo-50/25 dark:bg-indigo-950/10 border-l-4 border-indigo-600" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {n.type === "WARNING" || n.type === "LOW_STOCK" ? (
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        ) : (
                          <Bell className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-zinc-100 block text-xs">{n.title}</span>
                        <p className="text-slate-600 dark:text-zinc-300 text-xs mt-0.5">{n.message}</p>
                        <div className="flex items-center gap-2 mt-2 text-[9px] font-mono text-slate-400 dark:text-zinc-500 font-bold">
                          <span>POSTED {new Date(n.createdAt).toLocaleString()}</span>
                          <span>•</span>
                          <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded uppercase">{n.type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!n.isRead && (
                        <button
                          onClick={() => markReadMutation.mutate(n.id)}
                          className="p-1 border border-slate-200 dark:border-zinc-700 hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400 rounded text-xs font-bold cursor-pointer"
                        >
                          Mark as Read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotificationMutation.mutate(n.id)}
                        className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {notificationsData?.length === 0 && (
                  <div className="py-16 text-center text-slate-400 dark:text-zinc-500 italic text-xs">No notifications logged. Run system scan above.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: BROADCAST ANNOUNCEMENT */}
      {notificationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setNotificationModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-500" />
                Broadcast Enterprise Announcement
              </h3>
              <button onClick={() => setNotificationModalOpen(false)} className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">{formError}</div>}

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Alert Title</label>
                <input
                  type="text"
                  required
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="e.g. Planned General Ledger System Audit"
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Message content</label>
                <textarea
                  required
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="Detailed guidance instructions or announcements to system operators..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Message type classification</label>
                  <select
                    value={notifType}
                    onChange={(e) => setNotifType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
                  >
                    <option value="INFO">GENERAL INFORMATIONAL</option>
                    <option value="WARNING">CRITICAL WARNING ALERT</option>
                    <option value="LOW_STOCK">INVENTORY ALERT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1">Target Authority Role</label>
                  <select
                    value={notifRole}
                    onChange={(e) => setNotifRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
                  >
                    <option value="ALL">ALL OPERATORS (BROADCAST)</option>
                    <option value="ADMIN">ADMINS ONLY</option>
                    <option value="MANAGER">MANAGERS AND ADMINS</option>
                    <option value="ACCOUNTANT">ACCOUNTANTS ONLY</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer">
                Publish Broadcast Alert
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG */}
      {confirmDialog && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setConfirmDialog(null)} />
          <div className="relative bg-white border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-sm p-6 overflow-hidden animate-fade-in dark:bg-zinc-950">
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
