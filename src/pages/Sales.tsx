import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Receipt, 
  DollarSign, 
  Plus, 
  Search, 
  PlusCircle, 
  X, 
  RefreshCw,
  TrendingUp,
  CreditCard,
  Edit,
  Trash2,
  Calendar,
  Layers
} from "lucide-react";
import { api } from "../lib/api.ts";
import { hasPermission } from "../lib/permissions.ts";

export default function Sales() {
  const queryClient = useQueryClient();
  const [currentUser] = useState<any>(() => {
    const stored = localStorage.getItem("erp_user");
    try {
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<"customers" | "invoices" | "payments">("customers");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Form states: Customers
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Form states: Invoices
  const [customerId, setCustomerId] = useState("");
  const [subtotal, setSubtotal] = useState(0);
  const [taxRate, setTaxRate] = useState(10); // 10% default
  const [discountRate, setDiscountRate] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [invoiceItems, setInvoiceItems] = useState<{ productId: string; quantity: number }[]>([
    { productId: "", quantity: 1 }
  ]);

  // Form states: Payments
  const [invoiceId, setInvoiceId] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [referenceNo, setReferenceNo] = useState("");

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
    if (tab === "customers" || tab === "invoices" || tab === "payments") {
      setActiveTab(tab as any);
    }
  }, [window.location.search]);

  // Queries
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await api.get("/customers");
      return res.data.data.customers;
    }
  });

  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await api.get("/sales/invoices");
      return res.data.data.invoices;
    }
  });

  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const res = await api.get("/payments");
      return res.data.data.payments;
    }
  });

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      try {
        const res = await api.get("/products");
        return res?.data?.data?.products ?? [];
      } catch (err) {
        console.error("Error fetching products:", err);
        return [];
      }
    }
  });

  // Calculate Subtotal dynamically when line items or products change
  React.useEffect(() => {
    if (productsData && productsData.length > 0) {
      let calculated = 0;
      invoiceItems.forEach((item) => {
        const prod = productsData.find((p: any) => p.id === item.productId);
        if (prod) {
          calculated += Number(prod.price) * item.quantity;
        }
      });
      setSubtotal(calculated);
    }
  }, [invoiceItems, productsData]);

  // Mutations: Customers
  const createCustomerMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/customers", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCustomerModalOpen(false);
      resetCustomerForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to create customer.");
    }
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      await api.put(`/customers/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCustomerModalOpen(false);
      resetCustomerForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to update customer.");
    }
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  // Mutations: Invoices
  const createInvoiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/sales/invoices", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
      setInvoiceModalOpen(false);
      resetInvoiceForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to issue sales invoice.");
    }
  });

  // Mutations: Payments
  const createPaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/payments", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
      setPaymentModalOpen(false);
      resetPaymentForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to post client payment transaction.");
    }
  });

  const resetCustomerForm = () => {
    setSelectedItem(null);
    setCompanyName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setFormError(null);
  };

  const resetInvoiceForm = () => {
    setCustomerId("");
    setSubtotal(0);
    setTaxRate(10);
    setDiscountRate(0);
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    setDueDate(in30Days.toISOString().split("T")[0]);
    if (productsData && productsData.length > 0) {
      setInvoiceItems([{ productId: productsData[0].id, quantity: 1 }]);
    } else {
      setInvoiceItems([{ productId: "", quantity: 1 }]);
    }
    setFormError(null);
  };

  const resetPaymentForm = () => {
    setInvoiceId("");
    setAmountPaid(0);
    setPaymentMethod("BANK_TRANSFER");
    setReferenceNo("");
    setFormError(null);
  };

  const handleOpenCreateCustomer = () => {
    resetCustomerForm();
    setCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (c: any) => {
    setSelectedItem(c);
    setCompanyName(c.companyName || "");
    setContactName(c.contactName);
    setEmail(c.email);
    setPhone(c.phone || "");
    setAddress(c.address || "");
    setFormError(null);
    setCustomerModalOpen(true);
  };

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { companyName, contactName, email, phone, address };
    if (selectedItem) {
      updateCustomerMutation.mutate({ id: selectedItem.id, payload });
    } else {
      createCustomerMutation.mutate(payload);
    }
  };

  const handleOpenCreateInvoice = () => {
    setCustomerId("");
    setSubtotal(0);
    setTaxRate(10);
    setDiscountRate(0);
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    setDueDate(in30Days.toISOString().split("T")[0]);

    if (customersData && customersData.length > 0) {
      setCustomerId(customersData[0].id);
    }
    if (productsData && productsData.length > 0) {
      setInvoiceItems([{ productId: productsData[0].id, quantity: 1 }]);
    } else {
      setInvoiceItems([{ productId: "", quantity: 1 }]);
    }
    setFormError(null);
    setInvoiceModalOpen(true);
  };

  const handleInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setFormError("A customer must be specified.");
      return;
    }
    const validItems = invoiceItems
      .filter((item) => item.productId !== "")
      .map((item) => ({
        productId: item.productId,
        quantity: Math.max(1, Number(item.quantity) || 1),
      }));

    if (validItems.length === 0) {
      setFormError("At least one product line item is required.");
      return;
    }

    const tRate = Number(taxRate);
    const dRate = Number(discountRate);

    createInvoiceMutation.mutate({
      customerId,
      items: validItems,
      taxRate: isNaN(tRate) ? 0 : tRate,
      discountRate: isNaN(dRate) ? 0 : dRate,
    });
  };

  const handleOpenCreatePayment = (inv?: any) => {
    resetPaymentForm();
    if (inv) {
      setInvoiceId(inv.id);
      const outstanding = Number(inv.amount) - (inv.payments?.reduce((sum: number, p: any) => sum + Number(p.amountPaid), 0) || 0);
      setAmountPaid(outstanding > 0 ? outstanding : 0);
    } else if (invoicesData && invoicesData.length > 0) {
      setInvoiceId(invoicesData[0].id);
      const firstInv = invoicesData[0];
      const outstanding = Number(firstInv.amount) - (firstInv.payments?.reduce((sum: number, p: any) => sum + Number(p.amountPaid), 0) || 0);
      setAmountPaid(outstanding > 0 ? outstanding : 0);
    }
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId) {
      setFormError("Invoice target is required.");
      return;
    }
    createPaymentMutation.mutate({
      invoiceId,
      amountPaid: Number(amountPaid),
      paymentMethod,
      referenceNo: referenceNo || null
    });
  };

  // Searching logic
  const filteredCustomers = (customersData || []).filter((c: any) => {
    return c.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (c.companyName && c.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
           c.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Sales & Customer CRM</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Manage client corporate accounts, issue certified sales invoices, and reconcile cash receipts.</p>
        </div>

        {activeTab === "customers" && hasPermission(currentUser, "sales.write") && (
          <button
            onClick={handleOpenCreateCustomer}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer self-stretch sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Add Corporate Client
          </button>
        )}

        {activeTab === "invoices" && hasPermission(currentUser, "sales.write") && (
          <button
            onClick={handleOpenCreateInvoice}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer self-stretch sm:self-auto"
          >
            <Receipt className="h-4 w-4" /> Issue Billing Invoice
          </button>
        )}

        {activeTab === "payments" && hasPermission(currentUser, "sales.write") && (
          <button
            onClick={() => handleOpenCreatePayment()}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer self-stretch sm:self-auto"
          >
            <DollarSign className="h-4 w-4" /> Reconcile Receipt
          </button>
        )}
      </div>

      {/* Segmented Controller Tab Selection */}
      <div className="flex border-b border-slate-200 dark:border-zinc-900 bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border gap-2">
        <button
          onClick={() => { setActiveTab("customers"); setSearchTerm(""); }}
          className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "customers"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Users className="h-4 w-4" /> Accounts Directory
        </button>

        <button
          onClick={() => { setActiveTab("invoices"); setSearchTerm(""); }}
          className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "invoices"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Receipt className="h-4 w-4" /> Sales Invoices
        </button>

        <button
          onClick={() => { setActiveTab("payments"); setSearchTerm(""); }}
          className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "payments"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <DollarSign className="h-4 w-4" /> Cash Payments Ledger
        </button>
      </div>

      {/* Render customers directory */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          <div className="relative bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200 dark:border-zinc-900">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter customer names, emails, contacts..."
              className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-850 rounded-xl pl-12 pr-4 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl shadow-sm overflow-hidden">
            {isLoadingCustomers ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-500">Querying accounts...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/40">
                      <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Company Details</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Contact Name</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Email Address</th>
                      <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Phone No.</th>
                      {hasPermission(currentUser, "sales.write") && (
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-xs">
                    {filteredCustomers.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30">
                        <td className="py-4 px-6">
                          <span className="font-bold text-slate-950 dark:text-white block">{c.companyName || "Private Account"}</span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{c.address || "No address supplied"}</span>
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-700 dark:text-zinc-300">{c.contactName}</td>
                        <td className="py-4 px-4 font-mono text-slate-500">{c.email}</td>
                        <td className="py-4 px-4 text-slate-500">{c.phone || "N/A"}</td>
                        {hasPermission(currentUser, "sales.write") && (
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEditCustomer(c)}
                                className="p-2 border border-slate-200 dark:border-zinc-850 text-slate-500 hover:text-indigo-600 rounded-lg cursor-pointer"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                   title: "Archive Corporate Client",
                                   message: `Are you sure you want to archive the corporate client "${c.companyName || c.contactName}"?`,
                                   onConfirm: () => {
                                     deleteCustomerMutation.mutate(c.id);
                                     setConfirmDialog(null);
                                   }
                                 })
                                }}
                                className="p-2 border border-slate-200 dark:border-zinc-850 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <tr>
                        <td colSpan={hasPermission(currentUser, "sales.write") ? 5 : 4} className="py-12 text-center text-slate-400 italic">No corporate accounts registered in the database.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render Sales Invoices */}
      {activeTab === "invoices" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl shadow-sm overflow-hidden">
          {isLoadingInvoices ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-500">Querying invoices...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/40">
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Invoice Number</th>
                    <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Billed Client Account</th>
                    <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Issue Date</th>
                    <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Maturity Date</th>
                    <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Subtotal</th>
                    <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Gross Total</th>
                    <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Status</th>
                    {hasPermission(currentUser, "sales.write") && (
                      <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono text-right">Receipt Reconcile</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-xs">
                  {invoicesData?.map((inv: any) => {
                    const totalPaid = inv.payments?.reduce((sum: number, p: any) => sum + Number(p.amountPaid), 0) || 0;
                    const outstanding = Number(inv.amount) - totalPaid;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30">
                        <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-white">{inv.invoiceNumber}</td>
                        <td className="py-4 px-4 font-semibold text-slate-700 dark:text-zinc-300">
                          {inv.salesOrder?.customer?.companyName || inv.salesOrder?.customer?.contactName || "Direct Billed client"}
                        </td>
                        <td className="py-4 px-4 text-slate-500 font-mono">{new Date(inv.createdAt).toLocaleDateString()}</td>
                        <td className="py-4 px-4 text-slate-500 font-mono">{new Date(inv.dueDate).toLocaleDateString()}</td>
                        <td className="py-4 px-4 font-mono text-slate-500">${Number(inv.subtotal).toLocaleString()}</td>
                        <td className="py-4 px-4 font-mono font-black text-slate-900 dark:text-white">${Number(inv.amount).toLocaleString()}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            inv.status === "PAID" 
                              ? "bg-emerald-500/10 text-emerald-600" 
                              : inv.status === "PARTIALLY_PAID" 
                              ? "bg-blue-500/10 text-blue-600" 
                              : "bg-red-500/10 text-red-600"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        {hasPermission(currentUser, "sales.write") && (
                          <td className="py-4 px-6 text-right">
                            {outstanding > 0 ? (
                              <button
                                onClick={() => handleOpenCreatePayment(inv)}
                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                              >
                                <DollarSign className="h-3 w-3" /> Reconcile Receipt
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cleared</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {invoicesData?.length === 0 && (
                    <tr>
                      <td colSpan={hasPermission(currentUser, "sales.write") ? 8 : 7} className="py-12 text-center text-slate-400 italic">No sales invoices drafted.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Render Reconciled Cash Receipts */}
      {activeTab === "payments" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl shadow-sm overflow-hidden">
          {isLoadingPayments ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-500">Querying ledgers...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/40">
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Transaction ID</th>
                    <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Invoice reference</th>
                    <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Wire Reference No</th>
                    <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Payment Node Method</th>
                    <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Date Received</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono text-right">Amount Reconciled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-xs">
                  {paymentsData?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30">
                      <td className="py-4 px-6 font-mono font-bold text-slate-500 truncate max-w-[120px]">{p.id}</td>
                      <td className="py-4 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{p.invoice?.invoiceNumber || "External Invoice Reference"}</td>
                      <td className="py-4 px-4 font-mono font-semibold text-slate-700 dark:text-zinc-300">{p.referenceNo || "Direct deposit"}</td>
                      <td className="py-4 px-4">
                        <span className="bg-slate-100 dark:bg-zinc-800 text-slate-500 font-mono font-bold uppercase text-[9px] px-1.5 py-0.5 rounded">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-400 font-mono">{new Date(p.paymentDate).toLocaleString()}</td>
                      <td className="py-4 px-6 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">${Number(p.amountPaid).toLocaleString()}</td>
                    </tr>
                  ))}
                  {paymentsData?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 italic">No cash receipt logs matched.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CUSTOMER CREATE/EDIT */}
      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setCustomerModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-105 pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                {selectedItem ? "Modify Client Account" : "Register New Client Account"}
              </h3>
              <button onClick={() => setCustomerModalOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && <div className="p-3 mb-4 rounded-xl bg-red-500/10 border text-red-600 text-xs">{formError}</div>}

            <form onSubmit={handleCustomerSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Company legal title</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme SCM Corp"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lead officer Name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Michael Scott"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Billing Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="acme@corp.com"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Corporate headquarters location..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all">
                Commit Client Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ISSUE INVOICE */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setInvoiceModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="h-4 w-4 text-indigo-500" />
                Issue Sales Billing Invoice
              </h3>
              <button onClick={() => setInvoiceModalOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && <div className="p-3 mb-4 rounded-xl bg-red-500/10 border text-red-600 text-xs">{formError}</div>}

            <form onSubmit={handleInvoiceSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Customer Account</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                >
                  {customersData?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.companyName || c.contactName}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-850 pb-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase">Invoice Line Items</label>
                  <button
                    type="button"
                    onClick={() => setInvoiceItems([...invoiceItems, { productId: productsData?.[0]?.id || "", quantity: 1 }])}
                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    + Add Product Line
                  </button>
                </div>

                <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1">
                  {invoiceItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1">
                        <select
                          value={item.productId}
                          onChange={(e) => {
                            const newItems = [...invoiceItems];
                            newItems[index].productId = e.target.value;
                            setInvoiceItems(newItems);
                          }}
                          className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-zinc-100"
                        >
                          <option value="">-- Select Product --</option>
                          {productsData?.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} - {p.name} (${p.price})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...invoiceItems];
                            newItems[index].quantity = Math.max(1, parseInt(e.target.value) || 1);
                            setInvoiceItems(newItems);
                          }}
                          className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-2.5 py-1.5 text-xs font-mono text-center text-slate-900 dark:text-zinc-100"
                          placeholder="Qty"
                        />
                      </div>
                      {invoiceItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
                          }}
                          className="text-red-500 hover:text-red-400 p-1 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={discountRate}
                    onChange={(e) => setDiscountRate(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Live calculations view */}
              <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-850 rounded-2xl p-4.5 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-400">Order Subtotal</span>
                  <span className="font-bold font-mono text-slate-700 dark:text-zinc-300">
                    ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-400">Discount ({discountRate}%)</span>
                  <span className="font-bold font-mono text-green-600">
                    -${(subtotal * (discountRate / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-400">Tax Amount ({taxRate}%)</span>
                  <span className="font-bold font-mono text-slate-700 dark:text-zinc-300">
                    +${((subtotal - (subtotal * (discountRate / 100))) * (taxRate / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-slate-200/50 dark:border-zinc-800 pt-2.5">
                  <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">Grand Total Due</span>
                  <span className="font-black font-mono text-indigo-600 dark:text-indigo-400 text-base">
                    ${((subtotal - (subtotal * (discountRate / 100))) * (1 + taxRate / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all">
                Certify and Post Sales Invoice
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE PAYMENT */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setPaymentModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Reconcile Client Cash Receipt
              </h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && <div className="p-3 mb-4 rounded-xl bg-red-500/10 border text-red-600 text-xs">{formError}</div>}

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Invoice Reference</label>
                <select
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                >
                  {invoicesData?.map((inv: any) => (
                    <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - Total ${Number(inv.amount).toLocaleString()}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount Reconciled ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Channel</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  >
                    <option value="BANK_TRANSFER">BANK WIRE TRANSFER</option>
                    <option value="CASH">CASH RECEIPT</option>
                    <option value="MOBILE_PAYMENT">MOBILE PAYMENT GATEWAY</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Deposit reference No.</label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. TXN-12948123-DEP"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all">
                Commit & Post General Ledger Receipt
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
