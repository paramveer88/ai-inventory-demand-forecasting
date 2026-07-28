import React, { useState } from "react";
import Dashboard from "./components/Dashboard";
import Products from "./components/Products";
import Inventory from "./components/Inventory";
import Orders from "./components/Orders";
import Vendors from "./components/Vendors";
import { useTheme } from "./ThemeContext";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ClipboardList,
  Building2,
  Settings,
  Zap,
} from "lucide-react";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { theme, toggleTheme } = useTheme();

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":  return <Dashboard />;
      case "products":   return <Products />;
      case "vendors":    return <Vendors />;
      case "inventory":  return <Inventory />;
      case "orders":     return <Orders />;
      default:           return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--page-bg)" }}>
      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside
        className="w-60 flex flex-col flex-shrink-0"
        style={{
          backgroundColor: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--accent)", boxShadow: "0 0 14px var(--accent-glow)" }}
            >
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                SmartERP
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                AI Inventory System
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Main
          </p>
          <NavItem
            icon={<LayoutDashboard size={16} />}
            label="Dashboard"
            active={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
          />
          <NavItem
            icon={<Package size={16} />}
            label="Products"
            active={activeTab === "products"}
            onClick={() => setActiveTab("products")}
          />
          <NavItem
            icon={<Building2 size={16} />}
            label="Vendors"
            active={activeTab === "vendors"}
            onClick={() => setActiveTab("vendors")}
          />
          <NavItem
            icon={<Boxes size={16} />}
            label="Inventory"
            active={activeTab === "inventory"}
            onClick={() => setActiveTab("inventory")}
          />
          <NavItem
            icon={<ClipboardList size={16} />}
            label="Orders"
            active={activeTab === "orders"}
            onClick={() => setActiveTab("orders")}
          />
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4" style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
          <NavItem
            icon={<Settings size={16} />}
            label="Settings"
            onClick={() => {}}
          />

          {/* Theme toggle */}
          <div className="flex items-center justify-between px-3 pt-3 mt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              {theme === "dark" ? "Dark" : "Light"}
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
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`nav-item w-full text-left ${active ? "nav-item-active" : ""}`}
    style={active ? {} : {}}
  >
    <span style={{ opacity: active ? 1 : 0.6 }}>{icon}</span>
    {label}
  </button>
);

export default App;
