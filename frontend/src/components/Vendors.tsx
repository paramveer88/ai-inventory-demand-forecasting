import React, { useState, useEffect, useRef } from "react";
import {
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  importVendors,
  exportVendors,
  getVendorSampleFile,
  Vendor,
} from "../api";
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  Mail,
  Calendar,
  Package,
  FileUp,
  FileDown,
  Download,
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import { LoaderThree } from "./ui/loader";

const Vendors = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newVendor, setNewVendor] = useState({ name: "", contactEmail: "" });
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme Context
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await getVendors();
      setVendors(res.data);
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
      const res = await importVendors(file);
      alert(`Import complete. ${res.data.success} vendors processed. ${res.data.errors.length} errors.`);
      fetchVendors();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error importing vendors");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportVendors();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `vendors_export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const res = await getVendorSampleFile();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "vendors_sample.csv");
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createVendor(newVendor);
      setNewVendor({ name: "", contactEmail: "" });
      fetchVendors();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error creating vendor");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;
    try {
      await updateVendor(editingVendor.id, {
        name: editingVendor.name,
        contactEmail: editingVendor.contactEmail,
      });
      setEditingVendor(null);
      fetchVendors();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error updating vendor");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Delete this vendor? This will NOT delete products but will remove the association.",
      )
    )
      return;
    try {
      await deleteVendor(id);
      fetchVendors();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error deleting vendor");
    }
  };

  return (
    <div className="page animate-fade-in space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
        <div>
          <p className="text-[10px] font-bold text-amber-500 tracking-wider uppercase">PARTNERS / VENDORS</p>
          <h1 className={`text-3xl font-bold tracking-tight mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Vendors</h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Manage supplier accounts and partner relationships</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="badge badge-neutral font-semibold text-xs py-1.5 px-3 mr-2">
            {vendors.length} Registered
          </span>
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Registration Form ────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className={`card p-6 sticky top-6 animate-slide-up ${isDark ? 'bg-[#141720] border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center gap-2 mb-5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: isDark ? "rgba(124,92,252,0.1)" : "rgba(124,92,252,0.08)",
                  border: `1px solid ${isDark ? "rgba(124,92,252,0.2)" : "rgba(124,92,252,0.15)"}`,
                }}
              >
                <Building2 className="w-3.5 h-3.5" style={{ color: "#f3aa56ff" }} />
              </div>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Register New Vendor
              </h2>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className={`form-label text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Vendor Name</label>
                <input
                  type="text"
                  placeholder="e.g. Cyberdyne Systems"
                  value={newVendor.name}
                  onChange={(e) =>
                    setNewVendor({ ...newVendor, name: e.target.value })
                  }
                  className={`w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none focus:ring-1 ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-amber-500 focus:ring-amber-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600 focus:ring-amber-600'
                  }`}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className={`form-label text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Contact Email</label>
                <div className="relative">
                  <Mail
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  />
                  <input
                    type="email"
                    placeholder="contact@vendor.com"
                    value={newVendor.contactEmail}
                    onChange={(e) =>
                      setNewVendor({
                        ...newVendor,
                        contactEmail: e.target.value,
                      })
                    }
                    className={`w-full rounded-lg pl-9 pr-3.5 py-2.5 text-sm border focus:outline-none focus:ring-1 ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-amber-500 focus:ring-amber-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600 focus:ring-amber-600'
                    }`}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className={`w-full py-2.5 font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-1.5 mt-2 ${
                  isDark 
                    ? 'bg-[#f59e0b] hover:bg-[#d97706] text-slate-950' 
                    : 'bg-[#F28F1D] hover:bg-[#d97706] text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                Add Vendor
              </button>
            </form>
          </div>
        </div>

        {/* ── Vendor Grid ────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoaderThree />
            </div>
          ) : vendors.length === 0 ? (
            <div className={`card p-12 text-center flex flex-col items-center justify-center gap-3 ${isDark ? 'bg-[#141720] border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
              <Building2 className="w-10 h-10 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                No vendors registered in the system yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vendors.map((vendor, idx) => (
                <div
                  key={vendor.id}
                  className={`card p-5 animate-slide-up relative group flex flex-col justify-between ${
                    isDark 
                      ? 'bg-[#141720] border-slate-800/80 hover:border-slate-700/80' 
                      : 'bg-white border-slate-200 hover:border-slate-350 shadow-sm'
                  }`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  {/* Action buttons on card hover */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <button
                      onClick={() => setEditingVendor(vendor)}
                      className={`p-1.5 rounded-lg transition-all ${
                        isDark 
                          ? 'text-slate-500 hover:bg-violet-500/10 hover:text-violet-400' 
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                      title="Edit vendor"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      className={`p-1.5 rounded-lg transition-all ${
                        isDark 
                          ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400' 
                          : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                      }`}
                      title="Delete vendor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Header info */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDark ? "rgba(124,92,252,0.08)" : "rgba(124,92,252,0.06)",
                        border: `1px solid ${isDark ? "rgba(124,92,252,0.15)" : "rgba(124,92,252,0.1)"}`,
                      }}
                    >
                      <Building2 className="w-5 h-5" style={{ color: "#f3aa56ff" }} />
                    </div>
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {vendor.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Mail className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <span className={`truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{vendor.contactEmail || "No email provided"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer details */}
                  <div
                    className={`mt-5 pt-3.5 flex items-center justify-between text-xs border-t ${
                      isDark ? 'border-slate-800/85' : 'border-slate-200'
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <Package className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <span>{vendor._count?.products || 0} Products</span>
                    </div>

                    <div className={`flex items-center gap-1.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(vendor.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal Overlay ────────────────────────────────────────── */}
      {editingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
          <div className={`card w-full max-w-md border rounded-2xl overflow-hidden animate-scale-in ${
            isDark ? 'bg-[#141720] border-slate-800' : 'bg-white border-slate-200 shadow-2xl'
          }`}>
            {/* Modal header */}
            <div className={`px-6 py-4 flex justify-between items-center border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: isDark ? "rgba(124,92,252,0.12)" : "rgba(124,92,252,0.08)",
                    border: `1px solid ${isDark ? "rgba(124,92,252,0.2)" : "rgba(124,92,252,0.15)"}`,
                  }}
                >
                  <Edit2 className="w-3.5 h-3.5" style={{ color: "#7c5cfc" }} />
                </div>
                <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Edit Vendor
                </h2>
              </div>
              <button
                onClick={() => setEditingVendor(null)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                  isDark ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className={`form-label text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Vendor Name</label>
                <input
                  type="text"
                  value={editingVendor.name}
                  onChange={(e) =>
                    setEditingVendor({ ...editingVendor, name: e.target.value })
                  }
                  className={`w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none focus:ring-1 ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-amber-500 focus:ring-amber-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600 focus:ring-amber-600'
                  }`}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className={`form-label text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Contact Email</label>
                <div className="relative">
                  <Mail
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  />
                  <input
                    type="email"
                    value={editingVendor.contactEmail || ""}
                    onChange={(e) =>
                      setEditingVendor({
                        ...editingVendor,
                        contactEmail: e.target.value,
                      })
                    }
                    className={`w-full rounded-lg pl-9 pr-3.5 py-2.5 text-sm border focus:outline-none focus:ring-1 ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-amber-500 focus:ring-amber-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600 focus:ring-amber-600'
                    }`}
                    placeholder="contact@vendor.com"
                  />
                </div>
              </div>

              <div className={`flex gap-2.5 pt-4 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setEditingVendor(null)}
                  className={`flex-1 py-2.5 border rounded-lg text-sm font-semibold transition-all justify-center ${
                    isDark 
                      ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                      : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-1.5 ${
                    isDark 
                      ? 'bg-[#f59e0b] hover:bg-[#d97706] text-slate-950' 
                      : 'bg-[#d97706] hover:bg-[#b45309] text-white'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;
