import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  DollarSign, 
  Layers, 
  Plus, 
  Search, 
  X, 
  RefreshCw,
  Scale,
  PlusCircle,
  AlertTriangle,
  MinusCircle,
  Coins
} from "lucide-react";
import { api } from "../lib/api.ts";
import { hasPermission } from "../lib/permissions.ts";

export default function Finance() {
  const queryClient = useQueryClient();
  const [currentUser] = useState<any>(() => {
    const stored = localStorage.getItem("erp_user");
    try {
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<"accounts" | "journals">("accounts");
  const [searchTerm, setSearchTerm] = useState("");

  // Journal creation state
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<any[]>([
    { accountId: "", debit: 0, credit: 0, description: "" },
    { accountId: "", debit: 0, credit: 0, description: "" }
  ]);

  const [formError, setFormError] = useState<string | null>(null);

  // Sync tab with URL search parameter
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "accounts" || tab === "journals") {
      setActiveTab(tab as any);
    }
  }, [window.location.search]);

  // Queries
  const { data: accountsData, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.get("/finance/accounts");
      return res.data.data.accounts;
    }
  });

  const { data: journalsData, isLoading: isLoadingJournals } = useQuery({
    queryKey: ["journals"],
    queryFn: async () => {
      const res = await api.get("/finance/journals");
      return res.data.data.journals;
    }
  });

  // Mutations
  const createJournalMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post("/finance/journals", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardMetrics"] });
      setJournalModalOpen(false);
      resetJournalForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || "Posting failed. Ensure debits equal credits.");
    }
  });

  const resetJournalForm = () => {
    setDescription("");
    setLines([
      { accountId: "", debit: 0, credit: 0, description: "" },
      { accountId: "", debit: 0, credit: 0, description: "" }
    ]);
    setFormError(null);
  };

  const handleOpenJournalModal = () => {
    resetJournalForm();
    if (accountsData && accountsData.length > 1) {
      setLines([
        { accountId: accountsData[0].id, debit: 100, credit: 0, description: "Office lease debit" },
        { accountId: accountsData[1].id, debit: 0, credit: 100, description: "Operating reserve cash credit" }
      ]);
    }
    setJournalModalOpen(true);
  };

  const handleAddLine = () => {
    setLines([...lines, { accountId: accountsData?.[0]?.id || "", debit: 0, credit: 0, description: "" }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      setFormError("At least two accounts are required to satisfy double-entry criteria.");
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...lines];
    if (field === "debit") {
      updated[index].debit = Number(value);
      if (Number(value) > 0) updated[index].credit = 0; // standard lock
    } else if (field === "credit") {
      updated[index].credit = Number(value);
      if (Number(value) > 0) updated[index].debit = 0; // standard lock
    } else {
      updated[index][field] = value;
    }
    setLines(updated);
  };

  const handleJournalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const totalDebits = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const totalCredits = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

    if (totalDebits !== totalCredits) {
      setFormError(`Accounting rule validation failed: Debits ($${totalDebits}) must match Credits ($${totalCredits}). Balance gap of $${Math.abs(totalDebits - totalCredits)}.`);
      return;
    }

    if (totalDebits === 0) {
      setFormError("Disbursed general ledger amounts must exceed zero.");
      return;
    }

    createJournalMutation.mutate({
      description,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        description: l.description || null
      }))
    });
  };

  const filteredAccounts = (accountsData || []).filter((acc: any) => {
    return acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           acc.code.includes(searchTerm) ||
           acc.type.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">General Ledgers & Books</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Reconcile assets, post balanced general journal items, and review Trial Balances.</p>
        </div>

        {activeTab === "journals" && hasPermission(currentUser, "finance.write") && (
          <button
            onClick={handleOpenJournalModal}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md cursor-pointer self-stretch sm:self-auto"
          >
            <Plus className="h-4 w-4" /> Draft Journal Post
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 rounded-2xl gap-2">
        <button
          onClick={() => { setActiveTab("accounts"); setSearchTerm(""); }}
          className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "accounts"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Scale className="h-4 w-4" /> Chart of Accounts
        </button>

        <button
          onClick={() => { setActiveTab("journals"); setSearchTerm(""); }}
          className={`flex-1 sm:flex-initial py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "journals"
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Layers className="h-4 w-4" /> Journal Entries ledger
        </button>
      </div>

      {/* Tab A: Chart of Accounts */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="relative bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by code, account name, asset/liability types..."
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl pl-12 pr-4 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
            {isLoadingAccounts ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                <span className="text-xs text-slate-500">Querying ledgers...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-4 px-6">Account Code</th>
                      <th className="py-4 px-4">Account name</th>
                      <th className="py-4 px-4">Type Class</th>
                      <th className="py-4 px-6 text-right">Ledger Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-850 text-xs">
                    {filteredAccounts.map((acc: any) => (
                      <tr key={acc.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30">
                        <td className="py-4 px-6 font-mono font-bold text-slate-600 dark:text-zinc-400">{acc.code}</td>
                        <td className="py-4 px-4 font-bold text-slate-900 dark:text-zinc-100">{acc.name}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            acc.type === "ASSET" 
                              ? "bg-emerald-500/10 text-emerald-600" 
                              : acc.type === "LIABILITY" 
                              ? "bg-red-500/10 text-red-600" 
                              : acc.type === "EQUITY"
                              ? "bg-indigo-500/10 text-indigo-600"
                              : "bg-blue-500/10 text-blue-600"
                          }`}>
                            {acc.type}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-black text-slate-900 dark:text-zinc-100">${Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400 italic">No ledger accounts created yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab B: Journals Ledger */}
      {activeTab === "journals" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
          {isLoadingJournals ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-500">Querying general books...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-4 px-6">Entry Number</th>
                    <th className="py-4 px-4">Ledger description</th>
                    <th className="py-4 px-4">Double-entry Lines</th>
                    <th className="py-4 px-4">Date posted</th>
                    <th className="py-4 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-850 text-xs">
                  {journalsData?.map((j: any) => (
                    <tr key={j.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/30 align-top">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-zinc-100">{j.entryNumber}</td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-800 dark:text-zinc-200 block">{j.description}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">Audit Node: {j.id}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1 bg-slate-50 dark:bg-zinc-950 p-2 rounded-xl border border-slate-200 dark:border-zinc-850 max-w-sm">
                          {j.lines?.map((line: any) => (
                            <div key={line.id} className="flex justify-between gap-4 text-[10px] border-b border-dashed border-slate-200 dark:border-zinc-800 pb-1">
                              <div>
                                <span className="font-bold font-mono text-slate-500 dark:text-zinc-400">{line.account?.code}</span>
                                <span className="text-slate-600 dark:text-zinc-300 font-semibold ml-1.5">{line.account?.name}</span>
                              </div>
                              <div className="font-mono font-bold">
                                {Number(line.debit) > 0 ? (
                                  <span className="text-emerald-600">DR ${Number(line.debit).toLocaleString()}</span>
                                ) : (
                                  <span className="text-indigo-600">CR ${Number(line.credit).toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-400">{new Date(j.createdAt).toLocaleDateString()}</td>
                      <td className="py-4 px-6 text-right">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[9px] font-bold uppercase tracking-widest">{j.status}</span>
                      </td>
                    </tr>
                  ))}
                  {journalsData?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 italic">No general journal ledgers posted.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: JOURNAL POSTING */}
      {journalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setJournalModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-4 mb-4 shrink-0 border-slate-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Coins className="h-4 w-4 text-indigo-500" />
                Draft Double-Entry General Journal
              </h3>
              <button onClick={() => setJournalModalOpen(false)} className="text-slate-400 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs shrink-0 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleJournalSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Entry description / explanation</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Accrued monthly workspace lease and depreciation adjustments"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Debit and credit distribution rows</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Add Distribution Line
                  </button>
                </div>

                <div className="space-y-2">
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                      
                      {/* Select Account */}
                      <div className="col-span-4">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Account Ledger</label>
                        <select
                          value={line.accountId}
                          onChange={(e) => handleLineChange(i, "accountId", e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-zinc-100"
                        >
                          {accountsData?.map((a: any) => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name} (${Number(a.balance).toFixed(0)})</option>
                          ))}
                        </select>
                      </div>

                      {/* DR */}
                      <div className="col-span-2.5">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Debit DR ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) => handleLineChange(i, "debit", e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-emerald-600"
                        />
                      </div>

                      {/* CR */}
                      <div className="col-span-2.5">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Credit CR ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) => handleLineChange(i, "credit", e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-indigo-600"
                        />
                      </div>

                      {/* Detail */}
                      <div className="col-span-2.5">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Explanation</label>
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleLineChange(i, "description", e.target.value)}
                          placeholder="Line detail..."
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-zinc-100"
                        />
                      </div>

                      <div className="col-span-0.5 text-right mt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(i)}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <MinusCircle className="h-4 w-4" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Total Box */}
              <div className="p-4 bg-slate-100 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-850 flex justify-between items-center text-xs font-bold shrink-0">
                <div className="flex gap-4">
                  <span className="text-slate-500 dark:text-zinc-400">Net Debits: <span className="text-emerald-600 font-mono font-black">${lines.reduce((s,l)=>s+Number(l.debit||0), 0)}</span></span>
                  <span className="text-slate-500 dark:text-zinc-400">Net Credits: <span className="text-indigo-600 font-mono font-black">${lines.reduce((s,l)=>s+Number(l.credit||0), 0)}</span></span>
                </div>
                <div>
                  {lines.reduce((s,l)=>s+Number(l.debit||0), 0) === lines.reduce((s,l)=>s+Number(l.credit||0), 0) && lines.reduce((s,l)=>s+Number(l.debit||0), 0) > 0 ? (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-full font-black">Balanced</span>
                  ) : (
                    <span className="text-[10px] bg-red-500/10 text-red-600 uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-full font-black">Out of balance</span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={createJournalMutation.isPending}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
              >
                Post General Books Journal Entry
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
