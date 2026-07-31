import React, { useState, useEffect, useRef } from "react";
import { getOrders, importOrders, exportOrders, getOrderSampleFile, Order } from "../api";
import {
  ClipboardList,
  Calendar,
  Package,
  ChevronRight,
  ChevronLeft,
  Hash,
  FileUp,
  FileDown,
  Download,
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import { LoaderThree } from "./ui/loader";

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme Context
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => { fetchOrders(); }, [page]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await getOrders(page, 10);
      setOrders(res.data.orders);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportLoading(true);
      const res = await importOrders(file);
      alert(`Import complete. ${res.data.success} orders processed. ${res.data.errors.length} errors.`);
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error importing orders");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportOrders();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `orders_export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const res = await getOrderSampleFile();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "orders_sample.csv");
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="page animate-fade-in space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
        <div>
          <p className="text-[10px] font-bold text-amber-500 tracking-wider uppercase">COMMERCE / ORDERS</p>
          <h1 className={`text-3xl font-bold tracking-tight mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Orders</h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Purchase order history and item breakdown</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".csv,.xlsx" />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={importLoading} 
            className={`px-3 py-2.5 border rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isDark 
                ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            {importLoading ? "Importing…" : "Import"}
          </button>
          <button 
            onClick={handleExport} 
            className={`px-3 py-2.5 border rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isDark 
                ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <FileDown className="w-3.5 h-3.5" />
            Export
          </button>
          <button 
            onClick={handleDownloadSample} 
            className={`px-3 py-2.5 border rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isDark 
                ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Sample
          </button>

          <div
            className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${
              isDark ? 'bg-[#141720] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: isDark ? "rgba(124,92,252,0.1)" : "rgba(124,92,252,0.06)" }}
            >
              <ClipboardList className="w-3.5 h-3.5" style={{ color: "#f78a0dff" }} />
            </div>
            <div>
              <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total Orders</p>
              <p className={`text-base font-extrabold tabular-nums leading-none mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content Area ────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoaderThree />
        </div>
      ) : orders.length === 0 ? (
        <div
          className={`flex flex-col items-center justify-center h-64 gap-4 rounded-xl border ${
            isDark ? 'bg-[#141720] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-slate-900' : 'bg-slate-50'
            }`}
          >
            <ClipboardList className={`w-6 h-6 ${isDark ? 'text-slate-650' : 'text-slate-400'}`} />
          </div>
          <div className="text-center">
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>No orders yet</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Run a simulation on the Dashboard to generate orders.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, idx) => (
            <div
              key={order.id}
              className={`card overflow-hidden transition-all duration-300 animate-slide-up ${
                isDark 
                  ? 'bg-[#141720] border-slate-800/80 hover:border-slate-700/80' 
                  : 'bg-white border-slate-200 hover:border-slate-350 shadow-sm'
              }`}
              style={{ animationDelay: `${Math.min(idx, 5) * 40}ms` }}
            >
              {/* Order header row */}
              <div className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b ${
                isDark ? 'border-slate-800/80' : 'border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isDark ? "rgba(124,92,252,0.08)" : "rgba(124,92,252,0.06)",
                      border: `1px solid ${isDark ? "rgba(124,92,252,0.15)" : "rgba(124,92,252,0.1)"}`
                    }}
                  >
                    <Hash className="w-3.5 h-3.5" style={{ color: "#f3aa56ff" }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Order
                      </span>
                      <span className="badge badge-neutral font-mono text-[10px]">
                        {order.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1.5 mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(order.date)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total Amount</p>
                    <p className={`text-xl font-extrabold tabular-nums mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      ${order.totalAmount.toLocaleString()}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 hidden sm:block ${isDark ? 'text-slate-650' : 'text-slate-400'}`} />
                </div>
              </div>

              {/* Order items grid */}
              <div className={`px-5 py-4 ${isDark ? 'bg-slate-900/10' : 'bg-[#fafafa]'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Package className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Items List
                  </span>
                  <span className="ml-auto badge badge-neutral text-[10px]">
                    {order.items.length} SKUs
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                        isDark 
                          ? 'bg-[#141720] border-slate-800 hover:border-slate-700' 
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {item.product.name}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {item.product.category}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold flex-shrink-0 border ${
                        isDark 
                          ? 'bg-slate-900 text-slate-400 border-slate-800' 
                          : 'bg-slate-50 text-slate-650 border-slate-200'
                      }`}>
                        ×{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {!loading && orders.length > 0 && (
        <div className={`card flex items-center justify-between px-5 py-3.5 border transition-all ${
          isDark 
            ? 'bg-[#141720] border-slate-800' 
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>
            Showing{" "}
            <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{(page - 1) * 10 + 1}</span>–
            <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{Math.min(page * 10, total)}</span>
            {" "}of{" "}
            <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{total}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              className={`p-1.5 border rounded-lg transition-all disabled:opacity-30 ${
                isDark 
                  ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                  : 'border-slate-200 text-slate-650 bg-white hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {[...Array(totalPages)]
              .map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold border transition-all ${
                    page === i + 1 
                      ? (isDark ? "bg-[#7c5cfc] border-none text-white" : "bg-[#d97706] border-none text-white") 
                      : (isDark ? "border-slate-800 text-slate-400 hover:text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")
                  }`}
                >
                  {i + 1}
                </button>
              ))
              .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))}
              
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
              className={`p-1.5 border rounded-lg transition-all disabled:opacity-30 ${
                isDark 
                  ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                  : 'border-slate-200 text-slate-650 bg-white hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
