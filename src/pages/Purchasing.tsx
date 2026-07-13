import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ShoppingCart, 
  Users, 
  Plus, 
  Search, 
  X, 
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle,
  PackageCheck,
  Ban,
  Tag
} from "lucide-react";
import { api } from "../lib/api.ts";
import { hasPermission } from "../lib/permissions.ts";

export default function Purchasing() {
  const queryClient = useQueryClient();
  const [currentUser] = useState<any>(() => {
    const stored = localStorage.getItem("erp_user");
    try {
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<"suppliers" | "orders">("suppliers");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Form states: Suppliers
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Form states: Purchase Orders
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);

  const [formError, setFormError] = useState<string | null>(null);

  // Custom Iframe-safe confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Sync tab with URL search parameter
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "suppliers" || tab === "orders") {
      setActiveTab(tab as any);
    }
  }, [window.location.search]);

  // Queries
  const { data: suppliersData, isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await api.get("/suppliers");
      return res.data.data.suppliers;
    }
  });

  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: async () => {
      const res = await api.get("/purchasing/orders");
      return res.data.data.orders;
    }
  });

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await api.get("/products");
      return res.data.data.products;
    }
  });

  // Mutations: Suppliers
  const createSupplierMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/suppliers", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSupplierModalOpen(false);
      resetSupplierForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to catalog supplier.");
    }
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      await api.put(`/suppliers/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSupplierModalOpen(false);
      resetSupplierForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to update supplier.");
    }
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    }
  });

  // Mutations: Purchase Orders
  const createPOMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/purchasing/orders", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
      setPoModalOpen(false);
      resetPoForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to record Purchase Order.");
    }
  });

  const updatePOStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.put(`/purchasing/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
    }
  });

  const receivePOMutation = useMutation({
    mutationFn: async (id: string) => {
      // Find the warehouse to receive into (default to first warehouse)
      const whRes = await api.get("/inventory/warehouses");
      const warehouseId = whRes.data.data.warehouses[0]?.id;
      if (!warehouseId) throw new Error("No warehouse facilities initialized.");

      await api.post(`/purchasing/orders/${id}/receive`, { warehouseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to process warehouse restocking receipt.");
    }
  });

  const resetSupplierForm = () => {
    setSelectedItem(null);
    setCompanyName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setFormError(null);
  };

  const resetPoForm = () => {
    setSupplierId("");
    setProductId("");
    setQuantity(10);
    setUnitCost(5);
    setFormError(null);
  };

  const handleOpenCreateSupplier = () => {
    resetSupplierForm();
    setSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (s: any) => {
    setSelectedItem(s);
    setCompanyName(s.companyName);
    setContactName(s.contactName || "");
    setEmail(s.email);
    setPhone(s.phone || "");
    setAddress(s.address || "");
    setFormError(null);
    setSupplierModalOpen(true);
  };

  const handleSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { companyName, contactName, email, phone, address };
    if (selectedItem) {
      updateSupplierMutation.mutate({ id: selectedItem.id, payload });
    } else {
      createSupplierMutation.mutate(payload);
    }
  };

  const handleOpenCreatePo = () => {
    resetPoForm();
    if (suppliersData && suppliersData.length > 0) {
      setSupplierId(suppliersData[0].id);
    }
    if (productsData && productsData.length > 0) {
      setProductId(productsData[0].id);
      setUnitCost(Number(productsData[0].cost));
    }
    setPoModalOpen(true);
  };

  const handleProductChange = (prodId: string) => {
    setProductId(prodId);
    const prod = productsData?.find((p: any) => p.id === prodId);
    if (prod) {
      setUnitCost(Number(prod.cost));
    }
  };

  const handlePoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !productId) {
      setFormError("A valid vendor and product catalog SKU must be chosen.");
      return;
    }
    createPOMutation.mutate({
      supplierId,
      items: [{
        productId,
        quantity: Number(quantity),
        unitCost: Number(unitCost)
      }]
    });
  };

  const filteredSuppliers = (suppliersData || []).filter((s: any) => {
    return s.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (s.contactName && s.contactName.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Vendor & Purchasing</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Draft purchase orders, register wholesale vendors, and reconcile inbound cargo restocking.</p>
        </div>

        {activeTab === "suppliers" && hasPermission(currentUser, "purchasing.write") && (
          <button
            onClick={handleOpenCreateSupplier}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer self-stretch sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Add Vendor Partner
          </button>
        )}

        {activeTab === "orders" && hasPermission(currentUser, "purchasing.write") && (
          <button
            onClick={handleOpenCreatePo}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer self-stretch sm:self-auto"
          >
            <ShoppingCart className="h-4 w-4" /> Draft Purchase Order
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-900 bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border gap-2">
        <button
          onClick={() => { setActiveTab("suppliers"); setSearchTerm(""); }}
          className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "suppliers"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Users className="h-4 w-4" /> Vendor Directory
        </button>

        <button
          onClick={() => { setActiveTab("orders"); setSearchTerm(""); }}
          className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "orders"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ShoppingCart className="h-4 w-4" /> Purchase Orders (PO)
        </button>
      </div>

      {/* Tab Content: Vendors */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="relative bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200 dark:border-zinc-900">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vendor company, emails, accounts..."
              className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-850 rounded-xl pl-12 pr-4 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-2xl shadow-sm overflow-hidden">
            {isLoadingSuppliers ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-500">Querying vendors...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-850 bg-slate-50/50 dark:bg-zinc-900/40 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-mono">
                      <th className="py-4 px-6">Company Title</th>
                      <th className="py-4 px-4">Contact Agent</th>
                      <th className="py-4 px-4">Email</th>
                      <th className="py-4 px-4">Phone</th>
                      {hasPermission(currentUser, "purchasing.write") && (
                        <th className="py-4 px-6 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-xs">
                    {filteredSuppliers.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-850/30">
                        <td className="py-4 px-6 font-bold text-slate-950 dark:text-white">{s.companyName}</td>
                        <td className="py-4 px-4 text-slate-700 dark:text-zinc-300 font-semibold">{s.contactName || "N/A"}</td>
                        <td className="py-4 px-4 font-mono text-slate-500 dark:text-zinc-400">{s.email}</td>
                        <td className="py-4 px-4 text-slate-500 dark:text-zinc-400">{s.phone || "N/A"}</td>
                        {hasPermission(currentUser, "purchasing.write") && (
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEditSupplier(s)}
                                className="p-2 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg cursor-pointer"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                   title: "Archive Supplier",
                                   message: `Are you sure you want to archive the supplier "${s.companyName}"?`,
                                   onConfirm: () => {
                                     deleteSupplierMutation.mutate(s.id);
                                     setConfirmDialog(null);
                                   }
                                 })
                                }}
                                className="p-2 border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <tr>
                        <td colSpan={hasPermission(currentUser, "purchasing.write") ? 5 : 4} className="py-12 text-center text-slate-400 italic">No suppliers found in registry.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Purchase Orders */}
      {activeTab === "orders" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl shadow-sm overflow-hidden">
          {isLoadingOrders ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-500">Querying procurement orders...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-4 px-6">PO Number</th>
                    <th className="py-4 px-4">Supplier Partner</th>
                    <th className="py-4 px-4">Inbound SKU Items</th>
                    <th className="py-4 px-4">Total Cost</th>
                    <th className="py-4 px-4">Date Placed</th>
                    <th className="py-4 px-4">Order Status</th>
                    {hasPermission(currentUser, "purchasing.write") && (
                      <th className="py-4 px-6 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {ordersData?.map((po: any) => (
                    <tr key={po.id} className="hover:bg-slate-50/30">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-white">{po.poNumber}</td>
                      <td className="py-4 px-4 font-semibold text-slate-700 dark:text-zinc-300">{po.supplier?.companyName}</td>
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          {po.items?.map((item: any) => (
                            <div key={item.id} className="font-mono text-[10px] text-slate-500">
                              {item.product?.name} x {Number(item.quantity)} {item.product?.unitOfMeasure}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">${Number(po.totalAmount).toLocaleString()}</td>
                      <td className="py-4 px-4 text-slate-400 font-mono">{new Date(po.createdAt).toLocaleDateString()}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          po.status === "RECEIVED" 
                            ? "bg-emerald-500/10 text-emerald-600" 
                            : po.status === "APPROVED" 
                            ? "bg-blue-500/10 text-blue-600" 
                            : po.status === "CANCELLED"
                            ? "bg-red-500/10 text-red-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      {hasPermission(currentUser, "purchasing.write") && (
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {po.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => updatePOStatusMutation.mutate({ id: po.id, status: "APPROVED" })}
                                  className="p-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => updatePOStatusMutation.mutate({ id: po.id, status: "CANCELLED" })}
                                  className="p-1 px-2 text-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {po.status === "APPROVED" && (
                              <button
                                onClick={() => receivePOMutation.mutate(po.id)}
                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg cursor-pointer"
                              >
                                <PackageCheck className="h-3.5 w-3.5" /> Reconcile Restock
                              </button>
                            )}
                            {po.status === "RECEIVED" && (
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Restocked</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {ordersData?.length === 0 && (
                    <tr>
                      <td colSpan={hasPermission(currentUser, "purchasing.write") ? 7 : 6} className="py-12 text-center text-slate-400 italic">No purchase orders drafted yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREATE SUPPLIER */}
      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSupplierModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                {selectedItem ? "Modify Vendor Profile" : "Register Vendor Partner"}
              </h3>
              <button onClick={() => setSupplierModalOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && <div className="p-3 mb-4 rounded-xl bg-red-500/10 border text-red-600 text-xs">{formError}</div>}

            <form onSubmit={handleSupplierSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Company Legal Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Pacific SCM Limited"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 animate-fade-in"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Manager Name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Pam Beesly"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier Business Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="wholesale@vendor.com"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 321-4567"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier Warehouse / Office address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Logistics depot, city, zipcode..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md">
                Record Vendor Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DRAFT PO */}
      {poModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setPoModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-indigo-500" />
                Draft Corporate Purchase Order
              </h3>
              <button onClick={() => setPoModalOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && <div className="p-3 mb-4 rounded-xl bg-red-500/10 border text-red-600 text-xs">{formError}</div>}

            <form onSubmit={handlePoSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Wholesale Vendor Partner</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                >
                  {suppliersData?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.companyName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Catalog SKU Item</label>
                <select
                  value={productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                >
                  {productsData?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity Requested</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Wholesale Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50/50 dark:bg-zinc-950/40 rounded-xl border border-slate-100 dark:border-zinc-850">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Draft PO Net total</span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-black font-mono">${(quantity * unitCost).toFixed(2)}</span>
                </div>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all">
                Certify and Post Purchase Order
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
