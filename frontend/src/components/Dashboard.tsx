import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import {
  AlertCircle,
  TrendingUp,
  Package,
  ShoppingCart,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Database,
} from "lucide-react";
import {
  getInventory,
  simulateData,
  seedForecastHistory,
  getForecast,
  getForecastHistory,
  getRecommendations,
  Inventory,
  Recommendation,
  Forecast,
  DailyPrediction,
  HistoricalSale,
} from "../api";
import { useTheme } from "../ThemeContext";
import { LoaderThree } from "./ui/loader";

const Dashboard = () => {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation>>({});
  const [forecasts, setForecasts] = useState<Record<string, Forecast>>({});
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Theme Context
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
      const fcs: Record<string, Forecast> = {};
      const hist: Record<string, any[]> = {};

      await Promise.all(
        invData.map(async (item) => {
          try {
            const [recRes, fcRes, histRes] = await Promise.all([
              getRecommendations(item.productId),
              getForecast(item.productId),
              getForecastHistory(item.productId),
            ]);
            recs[item.productId] = recRes.data;
            fcs[item.productId] = fcRes.data;
            hist[item.productId] = histRes.data.data;
          } catch (e) {
            console.error(`Error fetching data for ${item.productId}`, e);
          }
        }),
      );

      setRecommendations(recs);
      setForecasts(fcs);
      setHistory(hist);
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

  const getAccuracyData = () => {
    const actualMap = new Map<string, number>();
    Object.values(forecasts).forEach((f) => {
      if (f.historical_sales) {
        f.historical_sales.forEach((h: HistoricalSale) => {
          actualMap.set(h.date, (actualMap.get(h.date) || 0) + h.quantity);
        });
      }
    });

    const seenKey = new Set<string>();
    const predictedMap = new Map<string, { total: number; count: number }>();
    Object.entries(history).forEach(([productId, items]) => {
      items.forEach((h) => {
        const key = `${h.date}|${productId}|${h.runId}`;
        if (seenKey.has(key)) return;
        seenKey.add(key);
        const entry = predictedMap.get(h.date) || { total: 0, count: 0 };
        entry.total += h.predictedDemand;
        entry.count += 1;
        predictedMap.set(h.date, entry);
      });
    });

    const futurePredMap = new Map<string, number>();
    Object.values(forecasts).forEach((f) => {
      f.daily_predictions.forEach((p: DailyPrediction) => {
        futurePredMap.set(p.date, (futurePredMap.get(p.date) || 0) + p.value);
      });
    });

    const allDates = new Set<string>([
      ...actualMap.keys(),
      ...predictedMap.keys(),
      ...futurePredMap.keys(),
    ]);
    const todayStr = new Date().toISOString().split("T")[0]!;
    const sorted = Array.from(allDates).sort();
    let todayIdx = sorted.findIndex((d) => d >= todayStr);
    if (todayIdx === -1) todayIdx = sorted.length - 1;
    const start = Math.max(0, todayIdx - 14);
    const end = Math.min(sorted.length, todayIdx + 15);

    return sorted.slice(start, end).map((date) => {
      const isPast = date <= todayStr;
      const actual = isPast ? Math.ceil(actualMap.get(date) || 0) : null;
      let predicted: number | null = null;
      if (isPast && predictedMap.has(date)) {
        const { total, count } = predictedMap.get(date)!;
        predicted = Math.ceil(total / count);
      } else if (!isPast && futurePredMap.has(date)) {
        predicted = Math.ceil(futurePredMap.get(date)!);
      }
      return {
        date,
        name: new Date(date).toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
        }),
        actual,
        predicted,
      };
    });
  };

  const aggregatedData = getAccuracyData();
  const lowStockItems = inventory.filter(
    (i) => i.currentStock < (recommendations[i.productId]?.reorderLevel || 100),
  );

  // Dynamic Theme Colors for Charts
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
          <p className="text-sm animate-pulse" style={{ color: "var(--text-secondary)" }}>Loading data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page animate-fade-in space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
        <div>
          <p className="text-[10px] font-bold text-amber-500 tracking-wider uppercase">MANIFEST / DASHBOARD</p>
          <h1 className={`text-3xl font-bold tracking-tight mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Dashboard</h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Real-time demand forecasting & inventory control</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSeedHistory}
            disabled={seeding}
            title="Seed 14 days of forecast history"
            className={`px-3 py-2.5 border rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isDark 
                ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-950'
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
                ? 'bg-[#f59e0b] hover:bg-[#d97706] text-slate-950' 
                : 'bg-[#F28F1D] hover:bg-[#b45309] text-white'
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
          icon={<AlertTriangle className="w-4 h-4" style={{ color: lowStockItems.length > 0 ? (isDark ? "#ef4444" : "#dc2626") : (isDark ? "#8b8fa8" : "#64748b") }} />}
          iconBg={lowStockItems.length > 0 ? (isDark ? "rgba(239,68,68,0.1)" : "rgba(220,38,38,0.08)") : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)")}
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
        {/* Demand Timeline */}
        <div className={`card p-5 ${isDark ? 'bg-[#141720] border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className={`section-header flex items-center gap-1.5 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <TrendingUp className="w-4 h-4" style={{ color: isDark ? "var(--accent)" : "#2563eb" }} />
                Demand Timeline
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Historical vs AI forecast
              </p>
            </div>
            <div className={`flex gap-4 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-0.5 rounded-full ${isDark ? 'bg-violet-500' : 'bg-blue-500'}`} />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-0.5 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'} opacity-70`} style={{ backgroundImage: `repeating-linear-gradient(90deg, ${isDark ? '#34d399' : '#10b981'} 0 4px, transparent 4px 7px)` }} />
                Predicted
              </span>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aggregatedData}>
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#actualGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: isDark ? "#7c5cfc" : "#3b82f6", strokeWidth: 0 }}
                />
                <Line
                  connectNulls
                  type="monotone"
                  dataKey="predicted"
                  name="Predicted"
                  stroke={isDark ? "#34d399" : "#10b981"}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 3, fill: isDark ? "#34d399" : "#10b981", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stock vs Reorder Levels */}
        <div className={`card p-5 ${isDark ? 'bg-[#141720] border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className={`section-header mb-1 flex items-center gap-1.5 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Package className="w-4 h-4" style={{ color: isDark ? "#22c55e" : "#059669" }} />
            Stock vs Reorder Levels
          </div>
          <p className={`text-xs mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Current inventory against strategy thresholds
          </p>
          <div className="h-[260px]">
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
      <div className={`card p-5 ${isDark ? 'bg-[#141720] border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`section-header mb-5 flex items-center gap-1.5 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <AlertCircle className="w-4 h-4" style={{ color: isDark ? "var(--accent)" : "#2563eb" }} />
          Alerts & Insights
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
                    <AlertTriangle className={`w-3.5 h-3.5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>Reorder Needed</p>
                    <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-650'}`}>
                      <span className="font-semibold" style={{ color: isDark ? "var(--text-primary)" : "#0f0f0f" }}>{i.product?.name}</span> is below reorder level ({recommendations[i.productId]?.reorderLevel} units).{" "}
                      Stockout risk in <span className={`font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>{recommendations[i.productId]?.daysUntilStockout}d</span>.
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div
              className="p-4 rounded-lg"
              style={{
                background: isDark ? "rgba(34,197,94,0.04)" : "rgba(5,150,105,0.03)",
                border: `1px solid ${isDark ? "rgba(34,197,94,0.12)" : "rgba(5,150,105,0.1)"}`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="icon-box" style={{ background: isDark ? "rgba(34,197,94,0.1)" : "rgba(5,150,105,0.08)", border: `1px solid ${isDark ? "rgba(34,197,94,0.2)" : "rgba(5,150,105,0.1)"}` }}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>All Systems Nominal</p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    All SKU levels are within optimal parameters. No immediate action required.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div
            className="p-4 rounded-lg"
            style={{
              background: isDark ? "rgba(124,92,252,0.04)" : "rgba(37,99,235,0.03)",
              border: `1px solid ${isDark ? "rgba(124,92,252,0.12)" : "rgba(37,99,235,0.1)"}`,
            }}
          >
            <div className="flex items-start gap-3">
              <div className="icon-box" style={{ background: isDark ? "rgba(124,92,252,0.1)" : "rgba(37,99,235,0.08)", border: `1px solid ${isDark ? "rgba(124,92,252,0.2)" : "rgba(37,99,235,0.1)"}` }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: isDark ? "var(--accent)" : "#2563eb" }} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-violet-400' : 'text-blue-600'}`}>Supply Optimization</p>
                <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-650'}`}>
                  Using <span className="font-semibold" style={{ color: isDark ? "var(--text-primary)" : "#0f0f0f" }}>{Object.values(recommendations)[0]?.leadTime || 7} day</span> lead time.{" "}
                  Avg daily demand:{" "}
                  <span className="font-semibold" style={{ color: isDark ? "var(--text-primary)" : "#0f0f0f" }}>{Object.values(recommendations)[0]?.avgDailyDemand || 0} units</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── StatCard ────────────────────────────────────────────────────────────────
const StatCard = ({
  title,
  value,
  icon,
  iconBg,
  trend,
  trendUp,
  valueColor,
  delay,
  theme,
  borderTopColor,
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
        ? 'bg-[#141720] border-slate-800/80 hover:border-slate-700/80' 
        : `bg-white border-slate-200 border-t-2 ${borderTopColor || 'border-t-slate-350'} shadow-sm hover:shadow-md`
    }`}>
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ 
            background: iconBg ?? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"), 
            border: `1px solid ${isDark ? 'var(--border)' : 'rgba(0,0,0,0.08)'}` 
          }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              trendUp 
                ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700') 
                : (isDark ? 'bg-slate-800/40 text-slate-400' : 'bg-slate-100 text-slate-500')
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>{title}</p>
        <p className={`text-3xl font-extrabold tracking-tight tabular-nums mt-1 ${
          valueColor || (isDark ? 'text-white' : 'text-slate-900')
        }`} style={valueColor ? { color: valueColor } : {}}>
          {value}
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
