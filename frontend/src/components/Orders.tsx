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

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="page animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Purchase order history and item breakdown</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".csv,.xlsx" />
          <button onClick={() => fileInputRef.current?.click()} disabled={importLoading} className="btn-ghost">
            <FileUp className="w-3.5 h-3.5" />
            {importLoading ? "Importing…" : "Import"}
          </button>
          <button onClick={handleExport} className="btn-ghost">
            <FileDown className="w-3.5 h-3.5" />
            Export
          </button>
          <button onClick={handleDownloadSample} className="btn-ghost">
            <Download className="w-3.5 h-3.5" />
            Sample
          </button>
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-lg"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "rgba(124,92,252,0.1)" }}
            >
              <ClipboardList className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Total Orders</p>
              <p className="text-base font-bold tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>{total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-7 h-7" />
        </div>
      ) : orders.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-64 gap-4 rounded-xl"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "var(--surface)" }}
          >
            <ClipboardList className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No orders yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Run a simulation on the Dashboard to generate orders.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, idx) => (
            <div
              key={order.id}
              className="card overflow-hidden animate-slide-up"
              style={{ animationDelay: `${Math.min(idx, 5) * 40}ms` }}
            >
              {/* Order header row */}
              <div
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.15)" }}
                  >
                    <Hash className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        Order
                      </span>
                      <span
                        className="badge badge-neutral font-mono text-[10px]"
                      >
                        {order.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <Calendar className="w-3 h-3" />
                      {formatDate(order.date)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] mb-0.5" style={{ color: "var(--text-secondary)" }}>Total Amount</p>
                    <p className="text-xl font-bold tabular-nums text-emerald-400">
                      ${order.totalAmount.toLocaleString()}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 hidden sm:block" style={{ color: "var(--text-muted)" }} />
                </div>
              </div>

              {/* Order items */}
              <div className="px-5 py-4" style={{ background: "var(--card-bg-alt)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Items
                  </span>
                  <span className="ml-auto badge badge-neutral text-[10px]">
                    {order.items.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
                      style={{
                        background: "var(--card-bg)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {item.product.name}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {item.product.category}
                        </p>
                      </div>
                      <span
                        className="ml-2 px-2 py-0.5 rounded-md text-xs font-semibold flex-shrink-0"
                        style={{
                          background: "var(--surface)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border)",
                        }}
                      >
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
        <div
          className="flex items-center justify-between px-5 py-3 rounded-xl"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Showing{" "}
            <span style={{ color: "var(--text-primary)" }}>{(page - 1) * 10 + 1}</span>–
            <span style={{ color: "var(--text-primary)" }}>{Math.min(page * 10, total)}</span>
            {" "}of{" "}
            <span style={{ color: "var(--text-primary)" }}>{total}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              className="btn-ghost p-1.5 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(totalPages)]
              .map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className="w-7 h-7 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: page === i + 1 ? "var(--accent)" : "transparent",
                    color: page === i + 1 ? "#fff" : "var(--text-secondary)",
                    border: page === i + 1 ? "none" : "1px solid var(--border)",
                  }}
                >
                  {i + 1}
                </button>
              ))
              .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))}
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
              className="btn-ghost p-1.5 disabled:opacity-30"
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
