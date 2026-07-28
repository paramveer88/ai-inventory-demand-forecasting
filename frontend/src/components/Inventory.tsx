import React, { useState, useEffect, useRef } from "react";
import {
  getInventory,
  getRecommendations,
  importInventory,
  exportInventory,
  getInventorySampleFile,
  Inventory as InventoryType,
  Recommendation,
} from "../api";
import { Package, Zap, AlertTriangle, CheckCircle2, FileUp, FileDown, Download } from "lucide-react";

const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryType[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation>>({});
  const [loading, setLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await getInventory();
      setInventory(res.data);

      const recs: Record<string, Recommendation> = {};
      for (const item of res.data) {
        const recRes = await getRecommendations(item.productId);
        recs[item.productId] = recRes.data;
      }
      setRecommendations(recs);
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
      const res = await importInventory(file);
      alert(`Import complete. ${res.data.success} inventory records processed. ${res.data.errors.length} errors.`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error importing inventory");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportInventory();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `inventory_export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const res = await getInventorySampleFile();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "inventory_sample.csv");
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="page flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="spinner w-7 h-7" />
      </div>
    );
  }

  return (
    <div className="page animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">AI-powered reorder recommendations per SKU</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-neutral mr-2">
            {inventory.length} SKUs
          </span>
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
        </div>
      </div>

      {/* ── Items ───────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {inventory.map((item, idx) => {
          const rec = recommendations[item.productId];
          const isLowStock = item.currentStock < (rec?.reorderLevel || 0);
          const stockPct = rec?.reorderLevel
            ? Math.min(100, Math.round((item.currentStock / (rec.reorderLevel * 2)) * 100))
            : 50;

          return (
            <div
              key={item.productId}
              className="card overflow-hidden animate-slide-up"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="p-5 flex flex-col lg:flex-row gap-6">
                {/* ── Left: Product info + stats ─────────────── */}
                <div className="flex-1 flex gap-4">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: isLowStock ? "rgba(239,68,68,0.1)" : "rgba(124,92,252,0.1)",
                      border: `1px solid ${isLowStock ? "rgba(239,68,68,0.2)" : "rgba(124,92,252,0.15)"}`,
                    }}
                  >
                    <Package
                      className="w-5 h-5"
                      style={{ color: isLowStock ? "#ef4444" : "var(--accent)" }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Product name & category */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                        {item.product?.name}
                      </h2>
                      <span className="badge badge-neutral">{item.product?.category}</span>
                      {isLowStock && (
                        <span className="badge badge-danger flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Low Stock
                        </span>
                      )}
                    </div>

                    {/* Stock bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span>Stock level</span>
                        <span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                          {item.currentStock} units
                        </span>
                      </div>
                      <div
                        className="w-full h-1.5 rounded-full overflow-hidden"
                        style={{ background: "var(--surface)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${stockPct}%`,
                            background: isLowStock
                              ? "linear-gradient(90deg, #ef4444, #f87171)"
                              : "linear-gradient(90deg, #7c5cfc, #a78bfa)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Stat grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <StatMini
                        label="Current Stock"
                        value={item.currentStock}
                        color={isLowStock ? "#ef4444" : undefined}
                      />
                      <StatMini
                        label="Reorder Level"
                        value={rec?.reorderLevel ?? "—"}
                        color="#f59e0b"
                      />
                      <StatMini
                        label="Recommended"
                        value={rec?.recommendedStock ?? "—"}
                        color="#22c55e"
                      />
                      <StatMini
                        label="Days to Stockout"
                        value={rec?.daysUntilStockout ? `${rec.daysUntilStockout}d` : "—"}
                        color="#38bdf8"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Right: Recommendation panel ────────────── */}
                <div
                  className="rounded-xl p-4 flex flex-col justify-between lg:w-72 flex-shrink-0"
                  style={{ background: "var(--card-bg-alt)", border: "1px solid var(--border)" }}
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Zap className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                        AI Recommendation
                      </span>
                    </div>

                    <div
                      className="p-3 rounded-lg"
                      style={{
                        background: isLowStock ? "rgba(239,68,68,0.05)" : "rgba(34,197,94,0.04)",
                        borderLeft: `3px solid ${isLowStock ? "#ef4444" : "#22c55e"}`,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {isLowStock ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        )}
                        <p className="text-xs font-semibold" style={{ color: isLowStock ? "#f87171" : "#4ade80" }}>
                          {isLowStock ? "Action Required" : "Stock Healthy"}
                        </p>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {isLowStock
                          ? `Order ${rec?.recommendedStock ? rec.recommendedStock - item.currentStock : "more"} units to meet forecasted demand.`
                          : "Inventory is within optimal 30-day forecast parameters."}
                      </p>
                    </div>
                  </div>

                  <button
                    className="btn-primary w-full justify-center mt-4"
                    style={{ fontSize: "13px" }}
                  >
                    Generate Purchase Order
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── StatMini ────────────────────────────────────────────────────────────────
const StatMini = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) => (
  <div>
    <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
      {label}
    </p>
    <p
      className="text-xl font-bold tabular-nums"
      style={{ color: color ?? "var(--text-primary)" }}
    >
      {value}
    </p>
  </div>
);

export default Inventory;
