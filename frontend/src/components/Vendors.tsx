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

const Vendors = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newVendor, setNewVendor] = useState({ name: "", contactEmail: "" });
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="page animate-fade-in">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendors</h1>
          <p className="page-subtitle">Manage supplier accounts and partner relationships</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-neutral font-medium mr-2">
            {vendors.length} Vendors Registered
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Registration Form ────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(124,92,252,0.1)",
                  border: "1px solid rgba(124,92,252,0.2)",
                }}
              >
                <Building2 className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Register New Vendor
              </h2>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="form-label">Vendor Name</label>
                <input
                  type="text"
                  placeholder="e.g. Cyberdyne Systems"
                  value={newVendor.name}
                  onChange={(e) =>
                    setNewVendor({ ...newVendor, name: e.target.value })
                  }
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Contact Email</label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                    style={{ color: "var(--text-muted)" }}
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
                    className="form-input pl-9"
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary w-full justify-center py-2.5 mt-2">
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
              <div className="spinner w-7 h-7" />
            </div>
          ) : vendors.length === 0 ? (
            <div className="card p-12 text-center flex flex-col items-center justify-center gap-3">
              <Building2 className="w-10 h-10 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No vendors registered in the system yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vendors.map((vendor, idx) => (
                <div
                  key={vendor.id}
                  className="card p-5 animate-slide-up relative group flex flex-col justify-between"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  {/* Action buttons on card hover */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <button
                      onClick={() => setEditingVendor(vendor)}
                      className="p-1.5 rounded-lg transition-all hover:bg-violet-500/10 hover:text-violet-400"
                      style={{ color: "var(--text-muted)" }}
                      title="Edit vendor"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 hover:text-red-400"
                      style={{ color: "var(--text-muted)" }}
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
                        background: "rgba(124,92,252,0.08)",
                        border: "1px solid rgba(124,92,252,0.15)",
                      }}
                    >
                      <Building2 className="w-5 h-5" style={{ color: "var(--accent)" }} />
                    </div>
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                        {vendor.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{vendor.contactEmail || "No email provided"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer details */}
                  <div
                    className="mt-5 pt-3.5 flex items-center justify-between text-xs"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                      <Package className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      <span>{vendor._count?.products || 0} Products</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(vendor.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal ────────────────────────────────────────────────── */}
      {editingVendor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden animate-scale-in"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border-strong)" }}
          >
            {/* Modal header */}
            <div
              className="px-6 py-4 flex justify-between items-center"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: "rgba(124,92,252,0.12)",
                    border: "1px solid rgba(124,92,252,0.2)",
                  }}
                >
                  <Edit2 className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                </div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Edit Vendor
                </h2>
              </div>
              <button
                onClick={() => setEditingVendor(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="form-label">Vendor Name</label>
                <input
                  type="text"
                  value={editingVendor.name}
                  onChange={(e) =>
                    setEditingVendor({ ...editingVendor, name: e.target.value })
                  }
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Contact Email</label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                    style={{ color: "var(--text-muted)" }}
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
                    className="form-input pl-9"
                    placeholder="contact@vendor.com"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setEditingVendor(null)}
                  className="btn-ghost flex-1 justify-center py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 justify-center py-2.5"
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
