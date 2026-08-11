import React, { useState } from "react";
import Dashboard from "./components/Dashboard";
import Products from "./components/Products";
import Inventory from "./components/Inventory";
import Orders from "./components/Orders";
import Vendors from "./components/Vendors";
import ForecastLab from "./components/ForecastLab";
import LandingPage from "./components/LandingPage";
import { useTheme } from "./ThemeContext";
import {
  LayoutDashboard,
  Package,
  Home,
  Boxes,
  ClipboardList,
  LineChart,
  Settings,
  Zap,
} from "lucide-react";

function App() {
  const [activeTab, setActiveTab] = useState("landing");
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  // Landing page renders full-screen without the sidebar layout
  if (activeTab === "landing") {
    return <LandingPage onEnter={() => setActiveTab("dashboard")} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":    return <Dashboard />;
      case "products":     return <Products />;
      case "vendors":      return <Vendors />;
      case "inventory":    return <Inventory />;
      case "orders":       return <Orders />;
      case "forecastLab":  return <ForecastLab />;
      default:             return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--page-bg)" }}>
      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside
        className={`w-60 flex flex-col flex-shrink-0 border-r transition-colors duration-250 ${
          isDark 
            ? 'bg-[#111318] border-slate-900' 
            : 'bg-white border-slate-200'
        }`}
      >
        {/* Logo Section */}
        <div className="px-6 py-6 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_0_14px_rgba(245,158,11,0.4)]"
            style={{ backgroundColor: "#f59e0b" }}
          >
            <Zap className="w-5 h-5 text-slate-950 fill-slate-950" />
          </div>
          <div>
            <p className={`text-base font-extrabold tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
              SmartERP
            </p>
            <p className={`text-[9px] font-bold tracking-widest mt-1.5 uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              AI INVENTORY
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-3 space-y-1.5 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <p className={`px-3 mb-3.5 text-[9px] font-extrabold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            MAIN
          </p>
          <NavItem
            icon={<LayoutDashboard size={16} />}
            label="Dashboard"
            active={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
            isDark={isDark}
          />
          <NavItem
            icon={<Package size={16} />}
            label="Products"
            active={activeTab === "products"}
            onClick={() => setActiveTab("products")}
            isDark={isDark}
          />
          <NavItem
            icon={<Home size={16} />}
            label="Vendors"
            active={activeTab === "vendors"}
            onClick={() => setActiveTab("vendors")}
            isDark={isDark}
          />
          <NavItem
            icon={<Boxes size={16} />}
            label="Inventory"
            active={activeTab === "inventory"}
            onClick={() => setActiveTab("inventory")}
            isDark={isDark}
          />
          <NavItem
            icon={<ClipboardList size={16} />}
            label="Orders"
            active={activeTab === "orders"}
            onClick={() => setActiveTab("orders")}
            isDark={isDark}
          />
          <NavItem
            icon={<LineChart size={16} />}
            label="Forecasting Lab"
            active={activeTab === "forecastLab"}
            onClick={() => setActiveTab("forecastLab")}
            isDark={isDark}
          />
        </nav>

        {/* Bottom Footer Section */}
        <div className="px-4 pb-6 space-y-4">
          <NavItem
            icon={<Settings size={16} />}
            label="Settings"
            onClick={() => {}}
            isDark={isDark}
          />

          {/* Theme toggle switch */}
          <div className={`flex items-center justify-between px-3 pt-4 border-t ${isDark ? 'border-slate-900/60' : 'border-slate-100'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Theme
            </span>
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label="Toggle theme"
            >
              <div className="theme-toggle__knob" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--page-bg)" }}>
        {renderContent()}
      </main>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  isDark: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, isDark }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
      active
        ? isDark
          ? "bg-[#d97706]/10 border border-[#f59e0b]/30 text-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.03)]"
          : "bg-[#fdf6e2] border border-[#b45309]/20 text-[#b45309]"
        : isDark
          ? "border border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-white"
          : "border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-950"
    }`}
  >
    <span className="flex-shrink-0">{icon}</span>
    {label}
  </button>
);

export default App;
