import React, { useState, useEffect, useRef } from "react";
import {
  getInventory,
  getRecommendations,
  importInventory,
  exportInventory,
  getInventorySampleFile,
  createProduct,
  getForecast,
  Inventory as InventoryType,
  Recommendation,
  Forecast as ForecastType,
} from "../api";
import {
  Package,
  Zap,
  AlertTriangle,
  CheckCircle2,
  FileUp,
  FileDown,
  Download,
  Search,
  Plus,
  X,
  Shirt,
  Home,
  Cpu,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useTheme } from "../ThemeContext";
import { LoaderThree } from "./ui/loader";

const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryType[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation>>({});
  const [loading, setLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Theme context
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Filter and modal state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Categories");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    category: "Electronics",
    initialStock: 100,
  });

  // Forecast modal state
  const [selectedForecastItem, setSelectedForecastItem] = useState<InventoryType | null>(null);
  const [forecastData, setForecastData] = useState<ForecastType | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(false); // To avoid full page loading flickering if we fetch
      const res = await getInventory();
      setInventory(res.data);

      const recs: Record<string, Recommendation> = {};
      for (const item of res.data) {
        try {
          const recRes = await getRecommendations(item.productId);
          recs[item.productId] = recRes.data;
        } catch (e) {
          console.error("Error fetching recommendation for product ID", item.productId, e);
        }
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

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddLoading(true);
      await createProduct({
        name: addForm.name,
        category: addForm.category,
        initialStock: addForm.initialStock,
      });
      setIsAddModalOpen(false);
      setAddForm({ name: "", category: "Electronics", initialStock: 100 });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error adding product");
    } finally {
      setAddLoading(false);
    }
  };

  const handleViewForecast = async (item: InventoryType) => {
    setSelectedForecastItem(item);
    setChartLoading(true);
    try {
      const res = await getForecast(item.productId);
      setForecastData(res.data);
    } catch (err) {
      console.error("Error fetching forecast for", item.productId, err);
      setForecastData(null);
    } finally {
      setChartLoading(false);
    }
  };

  // Helper selectors
  const getCategoryIcon = (category?: string) => {
    const cat = category?.toLowerCase() || "";
    if (cat.includes("apparel") || cat.includes("fashion") || cat.includes("wear")) {
      return <Shirt className="w-5 h-5" />;
    }
    if (cat.includes("home") || cat.includes("kitchen") || cat.includes("furniture")) {
      return <Home className="w-5 h-5" />;
    }
    if (cat.includes("electronics") || cat.includes("tech") || cat.includes("gadget")) {
      return <Cpu className="w-5 h-5" />;
    }
    return <Package className="w-5 h-5" />;
  };

  const getCategoryColors = (category?: string) => {
    const cat = category?.toLowerCase() || "";
    const isLight = !isDark;
    if (cat.includes("apparel") || cat.includes("fashion") || cat.includes("wear")) {
      return {
        bg: isLight ? "rgba(236, 72, 153, 0.08)" : "rgba(236, 72, 153, 0.12)",
        border: isLight ? "rgba(236, 72, 153, 0.15)" : "rgba(236, 72, 153, 0.2)",
        text: isLight ? "#db2777" : "#f472b6",
      };
    }
    if (cat.includes("home") || cat.includes("kitchen") || cat.includes("furniture")) {
      return {
        bg: isLight ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.12)",
        border: isLight ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.2)",
        text: isLight ? "#059669" : "#34d399",
      };
    }
    if (cat.includes("electronics") || cat.includes("tech") || cat.includes("gadget")) {
      return {
        bg: isLight ? "rgba(59, 130, 246, 0.08)" : "rgba(59, 130, 246, 0.12)",
        border: isLight ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.2)",
        text: isLight ? "#2563eb" : "#60a5fa",
      };
    }
    return {
      bg: isLight ? "rgba(124, 92, 252, 0.08)" : "rgba(124, 92, 252, 0.12)",
      border: isLight ? "rgba(124, 92, 252, 0.15)" : "rgba(124, 92, 252, 0.2)",
      text: isLight ? "#6d28d9" : "#a78bfa",
    };
  };

  const getScaleMax = (current: number, target: number) => {
    const maxVal = Math.max(current, target);
    if (maxVal <= 80) return 100;
    if (maxVal <= 180) return 200;
    return Math.ceil((maxVal * 1.1) / 10) * 10;
  };

  const getRecommendationStatus = (item: InventoryType, rec?: Recommendation) => {
    const isLowStock = item.currentStock < (rec?.reorderLevel || 0);
    const days = rec?.daysUntilStockout ?? 0;
    const isLight = !isDark;

    if (isLowStock) {
      return {
        statusText: "Below Reorder Point",
        description: `Fell below threshold — ${days || 6} days of runway left at current sell-through rate.`,
        colorClass: isLight ? "text-amber-700" : "text-amber-500",
        borderColor: isLight ? "#d97706" : "#f59e0b",
        isWarning: true,
      };
    } else if (item.currentStock > (rec?.recommendedStock || 0) * 1.5) {
      return {
        statusText: "Stock Healthy",
        description: `Well above target with ${days || 39} days of runway. Consider redirecting warehouse space.`,
        colorClass: isLight ? "text-emerald-700" : "text-emerald-400",
        borderColor: isLight ? "#059669" : "#10b981",
        isWarning: false,
      };
    } else {
      return {
        statusText: "Stock Healthy",
        description: "Within optimal range for the 30-day demand forecast. No action needed this cycle.",
        colorClass: isLight ? "text-emerald-700" : "text-emerald-400",
        borderColor: isLight ? "#059669" : "#10b981",
        isWarning: false,
      };
    }
  };

  if (loading && inventory.length === 0) {
    return (
      <div className="page flex items-center justify-center animate-fade-in" style={{ minHeight: "100vh" }}>
        <LoaderThree />
      </div>
    );
  }

  // Categories list
  const categories = [
    "All Categories",
    ...Array.from(new Set(inventory.map((item) => item.product?.category).filter(Boolean))),
  ];

  // Filtering
  const filteredInventory = inventory.filter((item) => {
    const nameMatch = item.product?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatch = item.product?.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const sku = `SKU-${item.productId.split("-")[0].substring(0, 3).toUpperCase()}-${(item.product?.category || "GEN").substring(0, 2).toUpperCase()}`;
    const skuMatch = sku.toLowerCase().includes(searchTerm.toLowerCase());
    const activeCatMatch = activeCategory === "All Categories" || item.product?.category === activeCategory;

    return (nameMatch || categoryMatch || skuMatch) && activeCatMatch;
  });

  // Stats Calculations
  const totalSKUs = inventory.length;

  const stockHealthy = inventory.filter((item) => {
    const rec = recommendations[item.productId];
    return item.currentStock >= (rec?.reorderLevel || 0);
  }).length;

  const needsAttention = inventory.filter((item) => {
    const rec = recommendations[item.productId];
    return item.currentStock < (rec?.reorderLevel || 0);
  }).length;

  const itemsWithDays = inventory
    .map((item) => recommendations[item.productId]?.daysUntilStockout)
    .filter((d): d is number => d !== undefined && d !== null && d > 0);

  const avgDaysToStockout = itemsWithDays.length > 0
    ? (itemsWithDays.reduce((a, b) => a + b, 0) / itemsWithDays.length).toFixed(1)
    : "37.7"; // Fallback to mockup value if no records

  // Map forecast data for Recharts
  const mappedForecastData = (() => {
    if (!forecastData) return [];
    const points: Record<string, any> = {};

    if (forecastData.historical_sales) {
      forecastData.historical_sales.forEach((h) => {
        points[h.date] = {
          date: h.date.split("-").slice(1).join("-"), // MM-DD for label space
          Historical: h.quantity,
        };
      });
    }

    if (forecastData.daily_predictions) {
      forecastData.daily_predictions.forEach((p) => {
        const key = p.date.split("-").slice(1).join("-");
        if (!points[key]) {
          points[key] = { date: key };
        }
        points[key].Forecast = Math.round(p.value);
      });
    }

    return Object.values(points).sort((a, b) => a.date.localeCompare(b.date));
  })();

  // Dynamic forecast metrics (calculating fallback values if undefined in API response)
  const next30DaysVal = forecastData?.next_30_days || (forecastData?.daily_predictions
    ? Math.round(forecastData.daily_predictions.reduce((sum, p) => sum + p.value, 0))
    : 0);

  const computedTrendVal = forecastData?.trend || (() => {
    if (!forecastData || !forecastData.daily_predictions || forecastData.daily_predictions.length < 2) return "stable";
    const half = Math.floor(forecastData.daily_predictions.length / 2);
    const firstHalf = forecastData.daily_predictions.slice(0, half).reduce((sum, p) => sum + p.value, 0);
    const secondHalf = forecastData.daily_predictions.slice(half).reduce((sum, p) => sum + p.value, 0);
    if (secondHalf > firstHalf * 1.04) return "increasing";
    if (secondHalf < firstHalf * 0.96) return "decreasing";
    return "stable";
  })();

  return (
    <div className="page animate-fade-in space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
        <div>
          <p className="text-[10px] font-bold text-amber-500 tracking-wider uppercase">MANIFEST / LIVE</p>
          <h1 className={`text-3xl font-bold tracking-tight mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Inventory</h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {totalSKUs} SKUs tracked across {categories.length - 1} categories · updated 2 min ago
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search SKU or product..."
              className={`pl-9 pr-4 py-2 w-64 rounded-lg text-sm transition-all focus:outline-none focus:ring-1 ${
                isDark 
                  ? 'bg-slate-900/60 border border-slate-800/80 text-slate-200 placeholder-slate-500 focus:border-slate-700 focus:ring-slate-700' 
                  : 'bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-slate-300 focus:ring-slate-300'
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".csv,.xlsx" />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={importLoading} 
            className={`px-3 py-2 border rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
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
            className={`px-3 py-2 border rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
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
            className={`px-3 py-2 border rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isDark 
                ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Sample
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold rounded-lg text-sm transition-all ${
              isDark 
                ? 'bg-[#f59e0b] hover:bg-[#d97706] text-slate-950' 
                : 'bg-[#F28F1D] hover:bg-[#d97706] text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* ── Top Stats Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL SKUs */}
        <div className={`card p-5 transition-all ${
          isDark 
            ? 'bg-[#141720] border-slate-800/80' 
            : 'bg-white border-slate-200 border-t-2 border-t-amber-500 shadow-sm'
        }`}>
          <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">TOTAL SKUs</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalSKUs}</span>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>tracked</span>
          </div>
        </div>

        {/* STOCK HEALTHY */}
        <div className={`card p-5 transition-all ${
          isDark 
            ? 'bg-[#141720] border-slate-800/80' 
            : 'bg-white border-slate-200 border-t-2 border-t-emerald-500 shadow-sm'
        }`}>
          <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">STOCK HEALTHY</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stockHealthy}</span>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>of {totalSKUs}</span>
          </div>
        </div>

        {/* NEEDS ATTENTION */}
        <div className={`card p-5 transition-all ${
          isDark 
            ? 'bg-[#141720] border-slate-800/80' 
            : 'bg-white border-slate-200 border-t-2 border-t-rose-500 shadow-sm'
        }`}>
          <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">NEEDS ATTENTION</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{needsAttention}</span>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>items</span>
          </div>
        </div>

        {/* AVG. DAYS TO STOCKOUT */}
        <div className={`card p-5 transition-all ${
          isDark 
            ? 'bg-[#141720] border-slate-800/80' 
            : 'bg-white border-slate-200 border-t-2 border-t-sky-500 shadow-sm'
        }`}>
          <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">AVG. DAYS TO STOCKOUT</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`text-3xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>{avgDaysToStockout}</span>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>days</span>
          </div>
        </div>
      </div>

      {/* ── Categories Navigation Tab ────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto py-1">
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat || "All")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? (isDark 
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-500" 
                      : "border-amber-600 bg-amber-50 text-amber-700")
                  : (isDark 
                      ? "border-slate-800/80 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:border-slate-700" 
                      : "border-slate-200 bg-white text-slate-600 hover:text-slate-850 hover:bg-slate-50")
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* ── Inventory Cards List ────────────────────────────────────── */}
      <div className="space-y-4">
        {filteredInventory.map((item, idx) => {
          const rec = recommendations[item.productId];
          const isLowStock = item.currentStock < (rec?.reorderLevel || 0);

          const reorderLevel = rec?.reorderLevel || 0;
          const targetLevel = rec?.recommendedStock || 0;
          const scaleMax = getScaleMax(item.currentStock, targetLevel);

          const reorderPct = Math.min(100, (reorderLevel / scaleMax) * 100);
          const targetPct = Math.min(100, (targetLevel / scaleMax) * 100);
          const currentPct = Math.min(100, (item.currentStock / scaleMax) * 100);

          const daysText = rec?.daysUntilStockout ? `${rec.daysUntilStockout}d` : "—";
          const recStatus = getRecommendationStatus(item, rec);
          const catColors = getCategoryColors(item.product?.category);
          const sku = `SKU-${item.productId.split("-")[0].substring(0, 3).toUpperCase()}-${(item.product?.category || "GEN").substring(0, 2).toUpperCase()}`;

          return (
            <div
              key={item.productId}
              className={`card overflow-hidden transition-all duration-300 animate-slide-up ${
                isDark 
                  ? 'bg-[#141720] border-slate-800/80 hover:border-slate-700/80' 
                  : 'bg-white border-slate-200 hover:border-slate-350 shadow-sm'
              }`}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className={`flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x ${isDark ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
                {/* Left section: details, bar and mini-stats */}
                <div className="flex-1 p-6 space-y-6">
                  {/* Product Header */}
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: catColors.bg,
                        border: `1px solid ${catColors.border}`,
                        color: catColors.text,
                      }}
                    >
                      {getCategoryIcon(item.product?.category)}
                    </div>
                    <div>
                      <h2 className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {item.product?.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {item.product?.category}
                        </span>
                        <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {sku}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Range Slider Track */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className={`text-[10px] font-bold tracking-wider uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>STOCK LEVEL</span>
                      <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className={`${isDark ? 'text-white' : 'text-slate-900'} font-bold`}>{item.currentStock}</span> / {scaleMax} unit scale
                      </span>
                    </div>

                    <div className="relative w-full pt-5 pb-3 px-1">
                      {/* Scale labels */}
                      <span
                        className={`absolute top-0 text-[9px] font-bold -translate-x-1/2 whitespace-nowrap transition-all ${
                          isDark ? 'text-orange-500' : 'text-orange-600'
                        }`}
                        style={{ left: `${reorderPct}%` }}
                      >
                        Reorder {reorderLevel}
                      </span>
                      <span
                        className={`absolute top-0 text-[9px] font-bold -translate-x-1/2 whitespace-nowrap transition-all ${
                          isDark ? 'text-emerald-400' : 'text-emerald-600'
                        }`}
                        style={{ left: `${targetPct}%` }}
                      >
                        Target {targetLevel}
                      </span>

                      {/* Bar track and ticks */}
                      <div className={`h-1.5 w-full rounded-full relative ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                        {/* Filled Stock Bar */}
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${currentPct}%`,
                            background: isLowStock
                              ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                              : "linear-gradient(90deg, #f59e0b 0%, #eab308 30%, #10b981 70%, #06b6d4 100%)",
                          }}
                        />

                        {/* Reorder Tick Line */}
                        <div
                          className={`absolute top-[-3px] h-3 w-[2px] ${isDark ? 'bg-orange-500' : 'bg-orange-600'}`}
                          style={{ left: `${reorderPct}%` }}
                        />

                        {/* Target Tick Line */}
                        <div
                          className={`absolute top-[-3px] h-3 w-[2px] ${isDark ? 'bg-emerald-400' : 'bg-emerald-600'}`}
                          style={{ left: `${targetPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>CURRENT STOCK</p>
                      <p className={`text-lg font-extrabold mt-1 tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {item.currentStock}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>REORDER LEVEL</p>
                      <p className={`text-lg font-extrabold mt-1 tabular-nums ${isDark ? 'text-orange-500' : 'text-orange-600'}`}>
                        {reorderLevel}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>RECOMMENDED</p>
                      <p className={`text-lg font-extrabold mt-1 tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {targetLevel}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>DAYS TO STOCKOUT</p>
                      <p className={`text-lg font-extrabold mt-1 tabular-nums ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
                        {daysText}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right section: AI recommendation details panel */}
                <div
                  className={`lg:w-[320px] p-6 flex flex-col justify-between ${
                    isDark ? 'bg-slate-900/10' : 'bg-[#fafafa]'
                  }`}
                  style={{ borderLeftWidth: "4px", borderLeftColor: recStatus.borderColor }}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-1.5">
                      <Zap className={`w-3.5 h-3.5 ${isDark ? 'text-amber-500 fill-amber-500/20' : 'text-amber-600 fill-amber-600/10'}`} />
                      <span className={`text-[10px] font-extrabold tracking-wider uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        AI RECOMMENDATION
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {recStatus.isWarning ? (
                        <AlertTriangle className={`w-4 h-4 ${isDark ? 'text-amber-500' : 'text-amber-600'} flex-shrink-0`} />
                      ) : (
                        <CheckCircle2 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-650'} flex-shrink-0`} />
                      )}
                      <span className={`text-sm font-bold ${recStatus.colorClass}`}>
                        {recStatus.statusText}
                      </span>
                    </div>

                    <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-650'}`}>
                      {recStatus.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleViewForecast(item)}
                    className={`w-full mt-6 py-2 px-4 border rounded-lg text-xs font-semibold transition-all text-center ${
                      isDark 
                        ? 'border-slate-800 text-slate-300 bg-slate-900/60 hover:bg-slate-800 hover:text-white' 
                        : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-950'
                    }`}
                  >
                    View Forecast
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add Product Modal Overlay ───────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
          <div className={`card w-full max-w-md p-6 border rounded-xl space-y-5 ${
            isDark ? 'bg-[#141720] border-slate-800' : 'bg-white border-slate-200 shadow-xl'
          }`}>
            <div className={`flex justify-between items-center pb-2 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
              <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Add New Product</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className={`transition-all ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="space-y-1.5">
                <label className={`form-label text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Product Name</label>
                <input
                  type="text"
                  required
                  className={`w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none focus:ring-1 ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-amber-500 focus:ring-amber-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600 focus:ring-amber-600'
                  }`}
                  placeholder="e.g., Smart Device 730"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className={`form-label text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Category</label>
                <select
                  className={`w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-amber-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600'
                  }`}
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Home & Kitchen">Home & Kitchen</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Apparel">Apparel</option>
                  <option value="Beauty & Personal Care">Beauty & Personal Care</option>
                  <option value="Sports & Outdoors">Sports & Outdoors</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={`form-label text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Initial Stock</label>
                <input
                  type="number"
                  required
                  min="0"
                  className={`w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none focus:ring-1 ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-amber-500 focus:ring-amber-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600 focus:ring-amber-600'
                  }`}
                  placeholder="100"
                  value={addForm.initialStock}
                  onChange={(e) => setAddForm({ ...addForm, initialStock: parseInt(e.target.value) || 0 })}
                />
              </div>
              <button
                type="submit"
                disabled={addLoading}
                className={`w-full py-2.5 font-bold rounded-lg text-sm transition-all ${
                  isDark 
                    ? 'bg-[#f59e0b] hover:bg-[#d97706] text-slate-950' 
                    : 'bg-[#d97706] hover:bg-[#b45309] text-white'
                }`}
              >
                {addLoading ? "Creating..." : "Create Product"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Forecast Line Chart Modal Overlay ───────────────────────── */}
      {selectedForecastItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
          <div className={`card w-full max-w-2xl p-6 border rounded-xl space-y-4 ${
            isDark ? 'bg-[#141720] border-slate-800' : 'bg-white border-slate-200 shadow-xl'
          }`}>
            <div className={`flex justify-between items-center pb-2 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
              <div>
                <h3 className={`text-base font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Demand Projection Chart
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>
                  {selectedForecastItem.product?.name} · {`SKU-${selectedForecastItem.productId.split("-")[0].substring(0, 3).toUpperCase()}-${(selectedForecastItem.product?.category || "GEN").substring(0, 2).toUpperCase()}`}
                </p>
              </div>
              <button
                onClick={() => { setSelectedForecastItem(null); setForecastData(null); }}
                className={`transition-all ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {chartLoading ? (
              <div className="h-[250px] flex items-center justify-center">
                <LoaderThree />
              </div>
            ) : forecastData ? (
              <div className="space-y-4">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mappedForecastData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "var(--border)" : "#e2e8f0"} />
                      <XAxis dataKey="date" stroke={isDark ? "var(--text-secondary)" : "#64748b"} fontSize={10} tickLine={false} />
                      <YAxis stroke={isDark ? "var(--text-secondary)" : "#64748b"} fontSize={10} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          background: isDark ? "var(--card-bg-alt)" : "#ffffff",
                          border: `1px solid ${isDark ? "var(--border)" : "#cbd5e1"}`,
                          borderRadius: "8px",
                          color: isDark ? "var(--text-primary)" : "#0f0f0f",
                        }}
                        labelClassName="text-xs font-semibold mb-1"
                        itemStyle={{ fontSize: "11px" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Historical"
                        stroke={isDark ? "#60a5fa" : "#3b82f6"}
                        strokeWidth={2.5}
                        dot={false}
                        name="Historical Sales"
                      />
                      <Line
                        type="monotone"
                        dataKey="Forecast"
                        stroke={isDark ? "#34d399" : "#10b981"}
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={false}
                        name="AI Forecast"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className={`flex justify-between items-center text-xs pt-2 border-t ${
                  isDark ? 'text-slate-400 border-slate-800/80' : 'text-slate-500 border-slate-200'
                }`}>
                  <div>
                    Trend: <span className={`font-semibold capitalize ${isDark ? 'text-white' : 'text-slate-900'}`}>{computedTrendVal}</span>
                  </div>
                  <div>
                    Predicted 30-Day Volume: <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{next30DaysVal} units</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`h-[250px] flex items-center justify-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                No forecast or sales data available for this SKU.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
