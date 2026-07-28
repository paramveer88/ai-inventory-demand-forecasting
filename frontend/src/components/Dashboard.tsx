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

const Dashboard = () => {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation>>({});
  const [forecasts, setForecasts] = useState<Record<string, Forecast>>({});
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [seeding, setSeeding] = useState(false);

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

    // ── Step 2: Past predictions from history, AVERAGED across runs ───────────
    // Track unique (date, productId, runId) to avoid double-counting
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

    // ── Step 3: Future predictions from current ML forecast runs ──────────────
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

  // Chart tooltip style
  const tooltipStyle = {
    backgroundColor: "#141720",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    padding: "8px 12px",
  };

  const gridColor = "rgba(255,255,255,0.04)";
  const axisColor = "#4a4f66";

  if (loading) {
    return (
      <div className="page flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="spinner w-8 h-8" />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page animate-fade-in">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time demand forecasting & inventory control</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedHistory}
            disabled={seeding}
            title="Seed 14 days of forecast history"
            className="btn-ghost disabled:opacity-40"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${seeding ? "animate-spin" : ""}`} />
            {seeding ? "Seeding…" : "Seed History"}
          </button>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="btn-primary disabled:opacity-40"
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
          icon={<Database className="w-4 h-4" style={{ color: "#7c5cfc" }} />}
          iconBg="rgba(124,92,252,0.1)"
          trend="+4.2%"
          trendUp
          delay="stagger-1"
        />
        <StatCard
          title="Active SKUs"
          value={inventory.length}
          icon={<Package className="w-4 h-4" style={{ color: "#22c55e" }} />}
          iconBg="rgba(34,197,94,0.1)"
          delay="stagger-2"
        />
        <StatCard
          title="Low Stock Alerts"
          value={lowStockItems.length}
          icon={<AlertTriangle className="w-4 h-4" style={{ color: lowStockItems.length > 0 ? "#ef4444" : "#8b8fa8" }} />}
          iconBg={lowStockItems.length > 0 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)"}
          valueColor={lowStockItems.length > 0 ? "#ef4444" : undefined}
          delay="stagger-3"
        />
        <StatCard
          title="AI Confidence"
          value="94.8%"
          icon={<Activity className="w-4 h-4" style={{ color: "#38bdf8" }} />}
          iconBg="rgba(56,189,248,0.1)"
          trend="Model stable"
          delay="stagger-4"
        />
      </div>

      {/* ── Charts ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Demand Timeline */}
        <div className="card p-5">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="section-header">
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Demand Timeline
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Historical vs AI forecast
              </p>
            </div>
            <div className="flex gap-4 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-0.5 rounded-full bg-violet-500" />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-0.5 rounded-full bg-emerald-400 opacity-70" style={{ backgroundImage: "repeating-linear-gradient(90deg, #34d399 0 4px, transparent 4px 7px)" }} />
                Predicted
              </span>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aggregatedData}>
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c5cfc" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c5cfc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ fontSize: "12px", color: "var(--text-primary)" }}
                  labelStyle={{ color: "var(--text-secondary)", fontSize: "11px", marginBottom: "4px" }}
                />
                <Area
                  connectNulls
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke="#7c5cfc"
                  strokeWidth={2}
                  fill="url(#actualGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#7c5cfc", strokeWidth: 0 }}
                />
                <Line
                  connectNulls
                  type="monotone"
                  dataKey="predicted"
                  name="Predicted"
                  stroke="#34d399"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 3, fill: "#34d399", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stock vs Reorder Levels */}
        <div className="card p-5">
          <div className="section-header mb-1">
            <Package className="w-4 h-4" style={{ color: "#22c55e" }} />
            Stock vs Reorder Levels
          </div>
          <p className="text-xs mb-6" style={{ color: "var(--text-secondary)" }}>
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
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={tooltipStyle}
                  itemStyle={{ fontSize: "12px", color: "var(--text-primary)" }}
                  labelStyle={{ color: "var(--text-secondary)", fontSize: "11px", marginBottom: "4px" }}
                />
                <Bar dataKey="stock" name="Current Stock" fill="#7c5cfc" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="min" name="Reorder Level" fill="rgba(255,255,255,0.06)" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Alerts & Insights ───────────────────────────────────────── */}
      <div className="card p-5">
        <div className="section-header mb-5">
          <AlertCircle className="w-4 h-4" style={{ color: "var(--accent)" }} />
          Alerts & Insights
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lowStockItems.length > 0 ? (
            lowStockItems.map((i) => (
              <div
                key={i.productId}
                className="p-4 rounded-lg animate-pulse-subtle"
                style={{
                  background: "rgba(239,68,68,0.05)",
                  border: "1px solid rgba(239,68,68,0.15)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="icon-box mt-0.5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-400">Reorder Needed</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{i.product?.name}</span> is below reorder level ({recommendations[i.productId]?.reorderLevel} units).{" "}
                      Stockout risk in <span className="font-semibold text-red-400">{recommendations[i.productId]?.daysUntilStockout}d</span>.
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div
              className="p-4 rounded-lg"
              style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}
            >
              <div className="flex items-start gap-3">
                <div className="icon-box" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-400">All Systems Nominal</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                    All SKU levels are within optimal parameters. No immediate action required.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div
            className="p-4 rounded-lg"
            style={{ background: "rgba(124,92,252,0.04)", border: "1px solid rgba(124,92,252,0.12)" }}
          >
            <div className="flex items-start gap-3">
              <div className="icon-box" style={{ background: "rgba(124,92,252,0.1)", border: "1px solid rgba(124,92,252,0.2)" }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "#a78bfa" }}>Supply Optimization</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  Using <span className="font-medium" style={{ color: "var(--text-primary)" }}>{Object.values(recommendations)[0]?.leadTime || 7} day</span> lead time.{" "}
                  Avg daily demand:{" "}
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{Object.values(recommendations)[0]?.avgDailyDemand || 0} units</span>.
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
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg?: string;
  trend?: string;
  trendUp?: boolean;
  valueColor?: string;
  delay?: string;
}) => (
  <div className={`stat-card ${delay ?? ""}`}>
    <div className="flex items-start justify-between">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg ?? "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
      >
        {icon}
      </div>
      {trend && (
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-md"
          style={{
            background: trendUp ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
            color: trendUp ? "#22c55e" : "var(--text-secondary)",
          }}
        >
          {trend}
        </span>
      )}
    </div>
    <div className="mt-4">
      <p className="stat-label">{title}</p>
      <p className="stat-value" style={valueColor ? { color: valueColor } : {}}>
        {value}
      </p>
    </div>
  </div>
);

export default Dashboard;
