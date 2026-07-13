import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Boxes, 
  ArrowUpDown, 
  Check, 
  AlertTriangle,
  CornerDownRight,
  RefreshCw,
  TrendingUp,
  X,
  PlusCircle,
  Warehouse as WhIcon,
  Tag
} from "lucide-react";
import { api } from "../lib/api.ts";
import { hasPermission } from "../lib/permissions.ts";

export default function Products() {
  const queryClient = useQueryClient();
  const [currentUser] = useState<any>(() => {
    const stored = localStorage.getItem("erp_user");
    try {
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  
  // Modals state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Form states for Product Add/Edit
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [unitOfMeasure, setUnitOfMeasure] = useState("PCS");

  // Form states for Stock Actions
  const [actionType, setActionType] = useState<"IN" | "OUT" | "TRANSFER">("IN");
  const [warehouseId, setWarehouseId] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState(""); // For transfers
  const [quantity, setQuantity] = useState(1);
  const [refNo, setRefNo] = useState("");
  const [notes, setNotes] = useState("");

  const [formError, setFormError] = useState<string | null>(null);

  // Custom Iframe-safe confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // 1. Fetch Products List
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await api.get("/products");
      return res.data.data.products;
    },
  });

  // 2. Fetch Categories
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.get("/inventory/categories");
      return res.data.data.categories;
    },
  });

  // 3. Fetch Warehouses
  const { data: warehousesData } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await api.get("/inventory/warehouses");
      return res.data.data.warehouses;
    },
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/products", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setProductModalOpen(false);
      resetProductForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to create product. Confirm that SKU code is unique.");
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      await api.put(`/products/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setProductModalOpen(false);
      resetProductForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to update product details.");
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const stockMutation = useMutation({
    mutationFn: async () => {
      if (actionType === "IN") {
        await api.post("/inventory/stock-in", {
          productId: selectedProduct.id,
          warehouseId,
          quantity,
          referenceNumber: refNo,
          description: notes
        });
      } else if (actionType === "OUT") {
        await api.post("/inventory/stock-out", {
          productId: selectedProduct.id,
          warehouseId,
          quantity,
          referenceNumber: refNo,
          description: notes
        });
      } else {
        await api.post("/inventory/transfer", {
          productId: selectedProduct.id,
          fromWarehouseId: warehouseId,
          toWarehouseId: targetWarehouseId,
          quantity,
          referenceNumber: refNo,
          description: notes
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
      setStockModalOpen(false);
      resetStockForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Failed to post inventory movement transactions.");
    }
  });

  const resetProductForm = () => {
    setSelectedProduct(null);
    setName("");
    setSku("");
    setDescription("");
    setCategoryId("");
    setPrice(0);
    setCost(0);
    setUnitOfMeasure("PCS");
    setFormError(null);
  };

  const resetStockForm = () => {
    setQuantity(1);
    setRefNo("");
    setNotes("");
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    resetProductForm();
    if (categoriesData && categoriesData.length > 0) {
      setCategoryId(categoriesData[0].id);
    }
    setProductModalOpen(true);
  };

  const handleOpenEditModal = (p: any) => {
    setSelectedProduct(p);
    setName(p.name);
    setSku(p.sku);
    setDescription(p.description || "");
    setCategoryId(p.categoryId);
    setPrice(Number(p.price));
    setCost(Number(p.cost));
    setUnitOfMeasure(p.unitOfMeasure);
    setFormError(null);
    setProductModalOpen(true);
  };

  const handleOpenStockModal = (p: any) => {
    setSelectedProduct(p);
    setStockModalOpen(true);
    if (warehousesData && warehousesData.length > 0) {
      setWarehouseId(warehousesData[0].id);
      if (warehousesData.length > 1) {
        setTargetWarehouseId(warehousesData[1].id);
      } else {
        setTargetWarehouseId(warehousesData[0].id);
      }
    }
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      sku,
      description,
      categoryId,
      price: Number(price),
      cost: Number(cost),
      unitOfMeasure
    };

    if (selectedProduct) {
      updateProductMutation.mutate({ id: selectedProduct.id, payload });
    } else {
      createProductMutation.mutate(payload);
    }
  };

  const handleStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      setFormError("Please select an active warehouse facility.");
      return;
    }
    if (actionType === "TRANSFER" && warehouseId === targetWarehouseId) {
      setFormError("Source and target warehouse nodes must differ.");
      return;
    }
    stockMutation.mutate();
  };

  // Filtering products list
  const filteredProducts = (productsData || []).filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Products & Inventory</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Manage SKU catalogs, unit pricing, margins, and process inventory adjustments.</p>
        </div>

        {hasPermission(currentUser, "inventory.update") && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md shadow-indigo-600/10 cursor-pointer self-stretch sm:self-auto transition-all"
          >
            <Plus className="h-4 w-4" /> Add New SKU Item
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-900 shadow-sm">
        
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by SKU, product title, barcode..."
            className="w-full bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Category Dropdown Filter */}
        <div className="w-full md:w-64 flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 transition-all"
          >
            <option value="ALL">All Categories</option>
            {categoriesData?.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-900 rounded-2xl shadow-sm overflow-hidden">
        {isLoadingProducts ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Streaming product catalogs...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/45">
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Product Item & Category</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">SKU Code</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Purchase Cost</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Retail Price</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Warehouse stock</th>
                  {hasPermission(currentUser, "inventory.update") && (
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-xs">
                {filteredProducts.map((p: any) => {
                  // Sum stock levels
                  const totalStock = p.stockLevels?.reduce((sum: number, sl: any) => sum + Number(sl.quantity), 0) || 0;
                  const needsReorder = p.stockLevels?.some((sl: any) => Number(sl.quantity) <= Number(sl.reorderPoint));

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-all">
                      
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
                            <Boxes className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{p.name}</span>
                            <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 px-1.5 py-0.2 rounded font-semibold mt-0.5 inline-block">
                              {p.category?.name || "Uncategorized"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 font-mono font-bold text-slate-500 dark:text-zinc-400">
                        {p.sku}
                      </td>

                      <td className="py-4 px-4 font-mono font-semibold text-slate-600 dark:text-zinc-300">
                        ${Number(p.cost).toFixed(2)}
                      </td>

                      <td className="py-4 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        ${Number(p.price).toFixed(2)}
                      </td>

                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 dark:text-white">{totalStock}</span>
                            <span className="text-[10px] text-slate-400 uppercase">{p.unitOfMeasure}</span>
                          </div>
                          
                          {/* Warehouse sub-pills */}
                          <div className="flex flex-wrap gap-1">
                            {p.stockLevels?.map((sl: any) => (
                              <span 
                                key={sl.id} 
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                  Number(sl.quantity) <= Number(sl.reorderPoint)
                                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                    : "bg-slate-100 dark:bg-zinc-800 text-slate-500"
                                }`}
                              >
                                {sl.warehouse?.code || "WH"}: {Number(sl.quantity)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>

                      {hasPermission(currentUser, "inventory.update") && (
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenStockModal(p)}
                              title="Adjust Stocks"
                              className="p-2 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-indigo-600 hover:border-indigo-500/30 rounded-lg cursor-pointer transition-all"
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                            </button>
                            
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              title="Edit Product"
                              className="p-2 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-emerald-600 hover:border-emerald-500/30 rounded-lg cursor-pointer transition-all"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                setConfirmDialog({
                                   title: "Archive Product",
                                   message: `Are you sure you want to archive the product "${p.name}"?`,
                                   onConfirm: () => {
                                     deleteProductMutation.mutate(p.id);
                                     setConfirmDialog(null);
                                   }
                                 })
                              }}
                              title="Delete"
                              className="p-2 border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-red-600 hover:border-red-500/20 rounded-lg cursor-pointer transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}

                    </tr>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={hasPermission(currentUser, "inventory.update") ? 6 : 5} className="py-12 text-center text-slate-400 dark:text-zinc-500 italic">No inventory records match current search or category boundaries.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD / EDIT PRODUCT */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setProductModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-xl p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-850 pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="h-4 w-4 text-indigo-500" />
                {selectedProduct ? `Edit ${selectedProduct.name}` : "Catalog New Product SKU"}
              </h3>
              <button onClick={() => setProductModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Copper Wire Harness"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. ELEC-0012"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    required
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    placeholder="e.g. PCS, KG, LTRS"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Manufacturing Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={cost}
                    onChange={(e) => setCost(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Retail Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category Group</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    {categoriesData?.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Technical specifications or notes..."
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createProductMutation.isPending || updateProductMutation.isPending}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                {selectedProduct ? "Update Catalog SKU Details" : "Record New SKU Entry"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INVENTORY STOCK ADJUSTMENT */}
      {stockModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setStockModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-850 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <WhIcon className="h-4 w-4 text-indigo-500" />
                  Inventory SCM Operations
                </h3>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{selectedProduct.name} ({selectedProduct.sku})</span>
              </div>
              <button onClick={() => setStockModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                {formError}
              </div>
            )}

            <div className="flex bg-slate-100 dark:bg-zinc-950/80 p-1.5 rounded-xl border border-slate-200 dark:border-zinc-850 mb-4">
              {(["IN", "OUT", "TRANSFER"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setActionType(type); setFormError(null); }}
                  className={`flex-1 py-1.5 text-center text-[10px] font-bold uppercase rounded-lg transition-all ${
                    actionType === type
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {type === "IN" ? "Stock In" : type === "OUT" ? "Stock Out" : "Transfer"}
                </button>
              ))}
            </div>

            <form onSubmit={handleStockSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  {actionType === "TRANSFER" ? "Source Warehouse" : "Warehouse facility"}
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                >
                  {warehousesData?.map((wh: any) => (
                    <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
                  ))}
                </select>
              </div>

              {actionType === "TRANSFER" && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Warehouse Destination</label>
                  <select
                    value={targetWarehouseId}
                    onChange={(e) => setTargetWarehouseId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                  >
                    {warehousesData?.map((wh: any) => (
                      <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity Change</label>
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
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ref Document No.</label>
                  <input
                    type="text"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    placeholder="e.g. PO-2026-003"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Movement Logs Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Audit reason, adjust description, returns status..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <button
                type="submit"
                disabled={stockMutation.isPending}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                {stockMutation.isPending ? "Posting Transaction Node..." : "Commit SCM Log Entry"}
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
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
