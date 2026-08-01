import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Area,
  AreaChart,
} from "recharts";
import {
  AlertCircle,
  TrendingUp,
  Package,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Database,
  Trophy,
  Cpu,
  Info,
} from "lucide-react";
import {
  getInventory,
  simulateData,
  seedForecastHistory,
  getRecommendations,
  getForecastComparison,
  Inventory,
  Recommendation,
  CompareForecastResult,
} from "../api";
import { useTheme } from "../ThemeContext";
import { LoaderThree } from "./ui/loader";

// ── Model Registry ─────────────────────────────────────────────────────────
interface ModelMeta {
  name: string;
  color: string;
  strokeDash: string;
  description: string;
}

const MODEL_METADATA: Record<string, ModelMeta> = {
  lr: {
    name: "Linear Regression",
    color: "#94a3b8",
    strokeDash: "5 4",
    description: "Fits a straight trend line — fastest & most transparent.",
  },
  xgboost: {
    name: "XGBoost",
    color: "#3b82f6",
    strokeDash: "0",
    description: "Gradient-boosted trees capturing complex lag correlations.",
  },
  lightgbm: {
    name: "LightGBM",
    color: "#06b6d4",
    strokeDash: "4 2",
    description: "High-speed histogram tree booster for large-scale data.",
  },
  prophet: {
    name: "Prophet",
    color: "#ec4899",
    strokeDash: "6 3",
    description: "Meta's additive model — excels at weekly & seasonal cycles.",
  },
  lstm: {
    name: "LSTM",
    color: "#8b5cf6",
    strokeDash: "3 2",
    description: "Deep learning recurrent network with long-term memory.",
  },
  tft: {
    name: "TFT",
    color: "#10b981",
    strokeDash: "7 2",
    description: "Transformer network for multi-horizon forecasting.",
  },
  timesfm: {
    name: "TimesFM",
    color: "#f59e0b",
    strokeDash: "0",
    description: "Google's pre-trained zero-shot foundation model.",
  },
};

const MODEL_KEYS = ["lr", "xgboost", "lightgbm", "prophet", "lstm", "tft", "timesfm"];

// ── Dashboard Component ────────────────────────────────────────────────────
const Dashboard = () => {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation>>({});
  const [comparisons, setComparisons] = useState<Record<string, CompareForecastResult>>({});
  const [selectedModelKey, setSelectedModelKey] = useState<string>("lr");
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getInventory();
      const invData = res.data;
      setInventory(invData);

      const recs: Record<string, Recommendation> = {};
      const comps: Record<string, CompareForecastResult> = {};

      await Promise.all(
        invData.map(async (item) => {
          try {
            const [recRes, compRes] = await Promise.all([
              getRecommendations(item.productId),
              getForecastComparison(item.productId),
            ]);
            recs[item.productId] = recRes.data;
            comps[item.productId] = compRes.data;
          } catch (e) {
            console.error(`Error fetching data for ${item.productId}`, e);
          }
        }),
      );

      setRecommendations(recs);
      setComparisons(comps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      await simulateData();
      await fetchData();
    } finally {
      setSimulating(false);
    }
  };

  const handleSeedHistory = async () => {
    setSeeding(true);
    try {
      await seedForecastHistory(14);
      await fetchData();
    } finally {
      setSeeding(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getModelAvgMae = (modelKey: string): number | null => {
    const maes: number[] = [];
    Object.values(comparisons).forEach((comp) => {
      const m = comp.models.find((m) => m.model_key === modelKey);
      if (m) maes.push(m.metrics.mae);
    });
    if (maes.length === 0) return null;
    return parseFloat((maes.reduce((a, b) => a + b, 0) / maes.length).toFixed(1));
  };

  const getBestModelKey = (): string => {
    let bestKey = "lr";
    let bestAvg = Infinity;
    MODEL_KEYS.forEach((key) => {
      const avg = getModelAvgMae(key);
      if (avg !== null && avg < bestAvg) {
        bestAvg = avg;
        bestKey = key;
      }
    });
    return bestKey;
  };

  const hasComparisons = Object.keys(comparisons).length > 0;
  const bestModelKey = hasComparisons ? getBestModelKey() : "";

  // ── Chart data builder ───────────────────────────────────────────────────
  const getAccuracyData = () => {
    if (!hasComparisons) return [];

    const actualMap = new Map<string, number>();
    Object.values(comparisons).forEach((comp) => {
      comp.historical_sales.forEach((h) => {
        actualMap.set(h.date, (actualMap.get(h.date) || 0) + h.quantity);
      });
    });

    const futurePredMap = new Map<string, number>();
    Object.values(comparisons).forEach((comp) => {
      const modelResult = comp.models.find((m) => m.model_key === selectedModelKey);
      if (modelResult) {
        modelResult.daily_predictions.forEach((p) => {
          futurePredMap.set(p.date, (futurePredMap.get(p.date) || 0) + p.value);
        });
      }
    });

    const todayStr = new Date().toISOString().split("T")[0]!;
    const allDates = new Set<string>([...actualMap.keys(), ...futurePredMap.keys()]);
    const sorted = Array.from(allDates).sort();

    let todayIdx = sorted.findIndex((d) => d >= todayStr);
    if (todayIdx === -1) todayIdx = sorted.length - 1;
    const start = Math.max(0, todayIdx - 14);
    const end = Math.min(sorted.length, todayIdx + 16);

    return sorted.slice(start, end).map((date) => {
      const isPast = date <= todayStr;
      return {
        date,
        name: new Date(date + "T00:00:00").toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
        }),
        actual: isPast ? Math.ceil(actualMap.get(date) || 0) : null,
        predicted: !isPast ? Math.ceil(futurePredMap.get(date) || 0) : null,
      };
    });
  };

  const aggregatedData = getAccuracyData();
  const activeMeta = MODEL_METADATA[selectedModelKey] ?? MODEL_METADATA["lr"]!;
  const activeAvgMae = getModelAvgMae(selectedModelKey);

  const lowStockItems = inventory.filter(
    (i) => i.currentStock < (recommendations[i.productId]?.reorderLevel || 100),
  );

  const tooltipStyle = {
    backgroundColor: isDark ? "#141720" : "#ffffff",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#cbd5e1"}`,
    borderRadius: "10px",
    boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.08)",
    padding: "8px 12px",
    color: isDark ? "var(--text-primary)" : "#0f0f0f",
  };

  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "#e2e8f0";
  const axisColor = isDark ? "#4a4f66" : "#64748b";

  if (loading) {
    return (
      <div className="page flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="flex flex-col items-center gap-4">
          <LoaderThree />
          <p className="text-sm animate-pulse" style={{ color: "var(--text-secondary)" }}>
            Loading data & running AI models…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page animate-fade-in space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b ${isDark ? "border-slate-800/80" : "border-slate-200"}`}>
        <div>
          <p className="text-[10px] font-bold text-amber-500 tracking-wider uppercase">MANIFEST / DASHBOARD</p>
          <h1 className={`text-3xl font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>Dashboard</h1>
          <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Real-time demand forecasting &amp; inventory control
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSeedHistory}
            disabled={seeding}
            className={`px-3 py-2.5 border rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isDark
                ? "border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white"
                : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${seeding ? "animate-spin" : ""}`} />
            {seeding ? "Seeding…" : "Seed History"}
          </button>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-bold rounded-lg text-sm transition-all ${
              isDark
                ? "bg-[#f59e0b] hover:bg-[#d97706] text-slate-950"
                : "bg-[#F28F1D] hover:bg-[#b45309] text-white"
            }`}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${simulating ? "animate-spin" : ""}`} />
            {simulating ? "Processing…" : "Run Simulation"}
          </button>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Global Stock"
          value={inventory.reduce((acc, item) => acc + item.currentStock, 0).toLocaleString()}
          icon={<Database className="w-4 h-4" style={{ color: isDark ? "#7c5cfc" : "#2563eb" }} />}
          iconBg={isDark ? "rgba(124,92,252,0.1)" : "rgba(37,99,235,0.08)"}
          trend="+4.2%"
          trendUp
          delay="stagger-1"
          theme={theme}
          borderTopColor="border-t-amber-500"
        />
        <StatCard
          title="Active SKUs"
          value={inventory.length}
          icon={<Package className="w-4 h-4" style={{ color: isDark ? "#22c55e" : "#059669" }} />}
          iconBg={isDark ? "rgba(34,197,94,0.1)" : "rgba(5,150,105,0.08)"}
          delay="stagger-2"
          theme={theme}
          borderTopColor="border-t-emerald-500"
        />
        <StatCard
          title="Low Stock Alerts"
          value={lowStockItems.length}
          icon={
            <AlertTriangle
              className="w-4 h-4"
              style={{ color: lowStockItems.length > 0 ? (isDark ? "#ef4444" : "#dc2626") : (isDark ? "#8b8fa8" : "#64748b") }}
            />
          }
          iconBg={
            lowStockItems.length > 0
              ? isDark ? "rgba(239,68,68,0.1)" : "rgba(220,38,38,0.08)"
              : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"
          }
          valueColor={lowStockItems.length > 0 ? (isDark ? "#ef4444" : "#dc2626") : undefined}
          delay="stagger-3"
          theme={theme}
          borderTopColor="border-t-rose-500"
        />
        <StatCard
          title="AI Confidence"
          value="94.8%"
          icon={<Activity className="w-4 h-4" style={{ color: isDark ? "#38bdf8" : "#0284c7" }} />}
          iconBg={isDark ? "rgba(56,189,248,0.1)" : "rgba(2,132,199,0.08)"}
          trend="Model stable"
          delay="stagger-4"
          theme={theme}
          borderTopColor="border-t-sky-500"
        />
      </div>

      {/* ── Charts ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Demand Timeline with Multi-Model Selector ────────────── */}
        <div className={`card p-5 ${isDark ? "bg-[#141720] border-slate-800/80" : "bg-white border-slate-200 shadow-sm"}`}>

          {/* Card Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className={`section-header flex items-center gap-1.5 text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                <TrendingUp className="w-4 h-4" style={{ color: isDark ? "var(--accent)" : "#2563eb" }} />
                Demand Timeline
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Historical sales vs. AI forecast — switch models below
              </p>
            </div>
            <div className={`flex gap-4 text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-0.5 rounded-full ${isDark ? "bg-violet-500" : "bg-blue-500"}`} />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-0.5 rounded-full opacity-80 transition-colors duration-300"
                  style={{ background: activeMeta.color }}
                />
                Predicted
              </span>
            </div>
          </div>

          {/* ── Model Selector ──────────────────────────────────────── */}
          <div className={`rounded-xl p-3 mb-4 border ${isDark ? "bg-slate-900/50 border-slate-800/80" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-2 mb-2.5">
              <Cpu className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-slate-500" : "text-slate-400"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Forecast Model
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {MODEL_KEYS.map((key) => {
                const meta = MODEL_METADATA[key]!;
                const isSelected = key === selectedModelKey;
                const isBest = key === bestModelKey && hasComparisons;
                const avgMae = getModelAvgMae(key);

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedModelKey(key)}
                    title={meta.description}
                    className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 border ${
                      isSelected
                        ? "shadow-sm scale-[1.03]"
                        : isDark
                          ? "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 bg-transparent"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 bg-white"
                    }`}
                    style={
                      isSelected
                        ? { color: meta.color, borderColor: meta.color, background: `${meta.color}18` }
                        : {}
                    }
                  >
                    {isBest && <span title="Best model by MAE" className="text-[10px]">👑</span>}
                    <span>{meta.name}</span>
                    {avgMae !== null && (
                      <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${isSelected ? "opacity-60" : isDark ? "text-slate-600" : "text-slate-400"}`}>
                        {avgMae}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active model description strip */}
            <div className={`mt-2.5 flex items-start gap-1.5 text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0 transition-colors duration-300" style={{ color: activeMeta.color }} />
              <span>
                <span className="font-semibold transition-colors duration-300" style={{ color: activeMeta.color }}>
                  {activeMeta.name}
                </span>
                {" "}— {activeMeta.description}
                {activeAvgMae !== null && (
                  <span className={`ml-1.5 font-mono text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-600"}`}>
                    Avg MAE {activeAvgMae}
                  </span>
                )}
                {bestModelKey === selectedModelKey && hasComparisons && (
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-semibold ${isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-700"}`}>
                    👑 Best Model
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aggregatedData}>
                <defs>
                  <linearGradient id="actualGradDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isDark ? "#7c5cfc" : "#3b82f6"} stopOpacity={isDark ? 0.15 : 0.2} />
                    <stop offset="95%" stopColor={isDark ? "#7c5cfc" : "#3b82f6"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ fontSize: "12px", color: isDark ? "var(--text-primary)" : "#0f0f0f" }}
                  labelStyle={{ color: isDark ? "var(--text-secondary)" : "#64748b", fontSize: "11px", marginBottom: "4px" }}
                />
                <Area
                  connectNulls
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke={isDark ? "#7c5cfc" : "#3b82f6"}
                  strokeWidth={2}
                  fill="url(#actualGradDash)"
                  dot={false}
                  activeDot={{ r: 4, fill: isDark ? "#7c5cfc" : "#3b82f6", strokeWidth: 0 }}
                />
                <Line
                  connectNulls
                  type="monotone"
                  dataKey="predicted"
                  name={`Predicted (${activeMeta.name})`}
                  stroke={activeMeta.color}
                  strokeWidth={2}
                  strokeDasharray={activeMeta.strokeDash}
                  dot={false}
                  activeDot={{ r: 3, fill: activeMeta.color, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stock vs Reorder Levels */}
        <div className={`card p-5 ${isDark ? "bg-[#141720] border-slate-800/80" : "bg-white border-slate-200 shadow-sm"}`}>
          <div className={`section-header mb-1 flex items-center gap-1.5 text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
            <Package className="w-4 h-4" style={{ color: isDark ? "#22c55e" : "#059669" }} />
            Stock vs Reorder Levels
          </div>
          <p className={`text-xs mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Current inventory against strategy thresholds
          </p>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={inventory.map((i) => ({
                  name: i.product?.name.split(" ")[0],
                  stock: i.currentStock,
                  min: recommendations[i.productId]?.reorderLevel || 20,
                }))}
                barGap={4}
              >
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}
                  contentStyle={tooltipStyle}
                  itemStyle={{ fontSize: "12px", color: isDark ? "var(--text-primary)" : "#0f0f0f" }}
                  labelStyle={{ color: isDark ? "var(--text-secondary)" : "#64748b", fontSize: "11px", marginBottom: "4px" }}
                />
                <Bar dataKey="stock" name="Current Stock" fill={isDark ? "#7c5cfc" : "#3b82f6"} radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="min" name="Reorder Level" fill={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"} radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Alerts & Insights ───────────────────────────────────────── */}
      <div className={`card p-5 ${isDark ? "bg-[#141720] border-slate-800/80" : "bg-white border-slate-200 shadow-sm"}`}>
        <div className={`section-header mb-5 flex items-center gap-1.5 text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
          <AlertCircle className="w-4 h-4" style={{ color: isDark ? "var(--accent)" : "#2563eb" }} />
          Alerts &amp; Insights
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lowStockItems.length > 0 ? (
            lowStockItems.map((i) => (
              <div
                key={i.productId}
                className="p-4 rounded-lg"
                style={{
                  background: isDark ? "rgba(239,68,68,0.05)" : "rgba(220,38,38,0.04)",
                  border: `1px solid ${isDark ? "rgba(239,68,68,0.15)" : "rgba(220,38,38,0.12)"}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="icon-box mt-0.5" style={{ background: isDark ? "rgba(239,68,68,0.1)" : "rgba(220,38,38,0.08)", border: `1px solid ${isDark ? "rgba(239,68,68,0.2)" : "rgba(220,38,38,0.12)"}` }}>
                    <AlertTriangle className={`w-3.5 h-3.5 ${isDark ? "text-red-400" : "text-red-600"}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${isDark ? "text-red-400" : "text-red-600"}`}>Reorder Needed</p>
                    <p className={`text-xs mt-1 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-650"}`}>
                      <span className="font-semibold" style={{ color: isDark ? "var(--text-primary)" : "#0f0f0f" }}>{i.product?.name}</span> is below reorder level ({recommendations[i.productId]?.reorderLevel} units).{" "}
                      Stockout risk in <span className={`font-bold ${isDark ? "text-red-400" : "text-red-600"}`}>{recommendations[i.productId]?.daysUntilStockout}d</span>.
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-lg" style={{ background: isDark ? "rgba(34,197,94,0.04)" : "rgba(5,150,105,0.03)", border: `1px solid ${isDark ? "rgba(34,197,94,0.12)" : "rgba(5,150,105,0.1)"}` }}>
              <div className="flex items-start gap-3">
                <div className="icon-box" style={{ background: isDark ? "rgba(34,197,94,0.1)" : "rgba(5,150,105,0.08)", border: `1px solid ${isDark ? "rgba(34,197,94,0.2)" : "rgba(5,150,105,0.1)"}` }}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>All Systems Nominal</p>
                  <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    All SKU levels are within optimal parameters. No immediate action required.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Supply Optimization */}
          <div className="p-4 rounded-lg" style={{ background: isDark ? "rgba(124,92,252,0.04)" : "rgba(37,99,235,0.03)", border: `1px solid ${isDark ? "rgba(124,92,252,0.12)" : "rgba(37,99,235,0.1)"}` }}>
            <div className="flex items-start gap-3">
              <div className="icon-box" style={{ background: isDark ? "rgba(124,92,252,0.1)" : "rgba(37,99,235,0.08)", border: `1px solid ${isDark ? "rgba(124,92,252,0.2)" : "rgba(37,99,235,0.1)"}` }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: isDark ? "var(--accent)" : "#2563eb" }} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? "text-violet-400" : "text-blue-600"}`}>Supply Optimization</p>
                <p className={`text-xs mt-1 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-650"}`}>
                  Using <span className="font-semibold" style={{ color: isDark ? "var(--text-primary)" : "#0f0f0f" }}>{Object.values(recommendations)[0]?.leadTime || 7} day</span> lead time.{" "}
                  Avg daily demand: <span className="font-semibold" style={{ color: isDark ? "var(--text-primary)" : "#0f0f0f" }}>{Object.values(recommendations)[0]?.avgDailyDemand || 0} units</span>.
                </p>
              </div>
            </div>
          </div>

          {/* Active Model Insight */}
          {hasComparisons && (
            <div className="p-4 rounded-lg transition-all duration-300" style={{ background: `${activeMeta.color}08`, border: `1px solid ${activeMeta.color}28` }}>
              <div className="flex items-start gap-3">
                <div className="icon-box transition-all duration-300" style={{ background: `${activeMeta.color}15`, border: `1px solid ${activeMeta.color}35` }}>
                  <Trophy className="w-3.5 h-3.5 transition-colors duration-300" style={{ color: activeMeta.color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold transition-colors duration-300" style={{ color: activeMeta.color }}>
                    Active Forecast Model
                  </p>
                  <p className={`text-xs mt-1 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-650"}`}>
                    Chart is using{" "}
                    <span className="font-semibold" style={{ color: isDark ? "var(--text-primary)" : "#0f0f0f" }}>{activeMeta.name}</span>
                    {activeAvgMae !== null && <> with avg MAE of <span className="font-semibold" style={{ color: isDark ? "var(--text-primary)" : "#0f0f0f" }}>{activeAvgMae}</span></>}.{" "}
                    {bestModelKey === selectedModelKey
                      ? "This is the best performing model for your data."
                      : `Switch to ${MODEL_METADATA[bestModelKey]?.name ?? ""} for higher accuracy.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── StatCard ────────────────────────────────────────────────────────────────
const StatCard = ({
  title, value, icon, iconBg, trend, trendUp, valueColor, delay, theme, borderTopColor,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg?: string;
  trend?: string;
  trendUp?: boolean;
  valueColor?: string;
  delay?: string;
  theme?: string;
  borderTopColor?: string;
}) => {
  const isDark = theme === "dark";
  return (
    <div className={`card p-5 transition-all animate-slide-up ${delay ?? ""} ${
      isDark
        ? "bg-[#141720] border-slate-800/80 hover:border-slate-700/80"
        : `bg-white border-slate-200 border-t-2 ${borderTopColor || "border-t-slate-350"} shadow-sm hover:shadow-md`
    }`}>
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg ?? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"), border: `1px solid ${isDark ? "var(--border)" : "rgba(0,0,0,0.08)"}` }}>
          {icon}
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
            trendUp
              ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"
              : isDark ? "bg-slate-800/40 text-slate-400" : "bg-slate-100 text-slate-500"
          }`}>
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-450"}`}>{title}</p>
        <p className={`text-3xl font-extrabold tracking-tight tabular-nums mt-1 ${valueColor || (isDark ? "text-white" : "text-slate-900")}`}
          style={valueColor ? { color: valueColor } : {}}>
          {value}
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
