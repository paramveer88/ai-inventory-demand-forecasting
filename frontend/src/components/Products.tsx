import React, { useState, useEffect, useRef } from "react";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getVendors,
  importProducts,
  exportProducts,
  getSampleFile,
  Product,
  Vendor,
  VendorInput,
} from "../api";

import {
  Package,
  Search,
  Plus,
  Trash2,
  FileUp,
  FileDown,
  Download,
  Building2,
  Edit2,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  ShoppingCart,
} from "lucide-react";

const CATEGORIES = [
  "All Categories",
  "Electronics",
  "Home & Kitchen",
  "Fashion",
  "Beauty & Personal Care",
  "Sports & Outdoors",
  "Automotive",
  "Books",
  "Office Supplies",
];

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [sortBy] = useState("createdAt");
  const [sortOrder] = useState<"asc" | "desc">("desc");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    category: string;
    initialStock: number;
    vendors: VendorInput[];
  }>({
    name: "",
    category: CATEGORIES[1],
    initialStock: 100,
    vendors: [],
  });

  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchVendors();
  }, [page, category, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await getProducts({
        page,
        limit: 10,
        search: search || undefined,
        category: category === "All Categories" ? undefined : category,
        sortBy,
        sortOrder,
      });
      setProducts(res.data.products);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await getVendors();
      setVendors(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editForm.vendors.length === 0) {
      alert("At least one vendor is required");
      return;
    }
    try {
      await createProduct({
        name: editForm.name,
        category: editForm.category,
        initialStock: editForm.initialStock || 100,
        vendors: editForm.vendors,
      });
      setIsAddModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error creating product");
    }
  };

  const resetForm = () => {
    setEditForm({ name: "", category: CATEGORIES[1], initialStock: 100, vendors: [] });
  };

  const handleCreateClick = () => { resetForm(); setIsAddModalOpen(true); };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct(id);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error deleting product");
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      category: product.category,
      initialStock: product.inventory?.currentStock ?? 0,
      vendors: (product.vendors || []).map((v) => ({ vendorId: v.vendorId, price: v.price })),
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      await updateProduct(editingProduct.id, {
        name: editForm.name,
        category: editForm.category,
        vendors: editForm.vendors,
      });
      setEditingProduct(null);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error updating product");
    }
  };

  const updateEditVendor = (index: number, field: string, value: any) => {
    const list = [...editForm.vendors];
    (list[index] as any)[field] = value;
    setEditForm({ ...editForm, vendors: list });
  };

  const addVendorToEdit = () => {
    setEditForm({ ...editForm, vendors: [...editForm.vendors, { vendorId: "", price: 0 }] });
  };

  const removeVendorFromEdit = (index: number) => {
    setEditForm({ ...editForm, vendors: editForm.vendors.filter((_, i) => i !== index) });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportLoading(true);
      const res = await importProducts(file);
      alert(`Import complete. ${res.data.success} products processed. ${res.data.errors.length} errors.`);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error importing products");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportProducts();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `products_export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const res = await getSampleFile();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "products_sample.csv");
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const closeModal = () => { setEditingProduct(null); setIsAddModalOpen(false); };

  return (
    <div className="page animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Manage your product catalog and vendor relationships</p>
        </div>
        <div className="flex items-center gap-2">
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
          <button onClick={handleCreateClick} className="btn-primary">
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </button>
        </div>
      </div>

      {/* ── Catalog Table ────────────────────────────────────────────── */}
      <div className="card overflow-hidden animate-slide-up">
        {/* Toolbar */}
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Product Catalog
            </span>
            <span
              className="badge badge-neutral ml-1"
            >
              {total} items
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input pl-9 w-52"
              />
            </div>

            {/* Category filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-input pl-9 pr-8 appearance-none cursor-pointer"
                style={{ minWidth: "160px" }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table body */}
        <div className="overflow-x-auto" style={{ minHeight: "420px" }}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner w-7 h-7" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Package className="w-10 h-10 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No products found</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock Status</th>
                  <th>Vendors & Pricing</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                          {p.name}
                        </span>
                        <span className="badge badge-neutral w-fit text-[10px]">{p.category}</span>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-20 h-1 rounded-full overflow-hidden"
                            style={{ background: "var(--surface)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, p.inventory?.currentStock ?? 0)}%`,
                                background: (p.inventory?.currentStock ?? 0) > 20 ? "#22c55e" : "#ef4444",
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>
                            {p.inventory?.currentStock ?? 0}
                          </span>
                        </div>
                        <div className="flex gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                          <span>Min: {p.inventory?.reorderLevel ?? 0}</span>
                          <span>·</span>
                          <span>Safe: {p.inventory?.safetyStock ?? 0}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {p.vendors?.map((pv) => (
                          <div key={pv.id} className="flex items-center gap-1.5 text-xs">
                            <Building2 className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                            <span style={{ color: "var(--text-secondary)" }} className="truncate max-w-[120px]">{pv.vendor.name}</span>
                            <span className="ml-auto font-medium text-emerald-400">${pv.price}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(p)}
                          className="p-1.5 rounded-lg transition-all hover:bg-violet-500/10 hover:text-violet-400"
                          style={{ color: "var(--text-muted)" }}
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 hover:text-red-400"
                          style={{ color: "var(--text-muted)" }}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && products.length > 0 && (
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                className="btn-ghost p-1.5 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
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

      {/* ── Modal ───────────────────────────────────────────────────── */}
      {(editingProduct || isAddModalOpen) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" }}
        >
          <div
            className="w-full max-w-xl rounded-2xl overflow-hidden animate-scale-in"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border-strong)" }}
          >
            {/* ── Modal Header ──────────────────────────────────────── */}
            <div
              className="px-6 py-4 flex justify-between items-center"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: editingProduct ? "rgba(124,92,252,0.12)" : "rgba(34,197,94,0.1)",
                    border: `1px solid ${editingProduct ? "rgba(124,92,252,0.2)" : "rgba(34,197,94,0.2)"}`,
                  }}
                >
                  {editingProduct ? (
                    <Edit2 className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                    {editingProduct ? "Edit Product" : "Add New Product"}
                  </h2>
                  {editingProduct && (
                    <p className="text-xs mt-0.5 leading-tight" style={{ color: "var(--text-secondary)" }}>
                      {editingProduct.name}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Modal Body ────────────────────────────────────────── */}
            <form
              onSubmit={editingProduct ? handleUpdate : handleCreate}
              className="p-6 space-y-5 max-h-[75vh] overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: "var(--surface) transparent" }}
            >
              {/* Name + Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Product Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="form-input"
                    placeholder="e.g. Wireless Headphones"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <div className="relative">
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="form-input appearance-none cursor-pointer pr-9"
                      style={{ backgroundColor: "var(--surface)", color: "var(--text-primary)" }}
                      required
                    >
                      {CATEGORIES.slice(1).map((c) => (
                        <option
                          key={c}
                          value={c}
                          style={{ background: "#1a1d27", color: "#e4e6ef" }}
                        >
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                      style={{ color: "var(--text-muted)" }}
                    />
                  </div>
                </div>
              </div>

              {/* Initial Stock (create mode only) */}
              {!editingProduct && (
                <div>
                  <label className="form-label">Initial Stock</label>
                  <input
                    type="number"
                    value={editForm.initialStock}
                    onChange={(e) => setEditForm({ ...editForm, initialStock: parseInt(e.target.value) })}
                    className="form-input"
                    placeholder="100"
                    required
                  />
                </div>
              )}

              {/* Vendors */}
              <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Vendors &amp; Pricing</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>At least one vendor required</p>
                  </div>
                  <button
                    type="button"
                    onClick={addVendorToEdit}
                    className="btn-ghost text-xs py-1.5 px-3"
                  >
                    <Plus className="w-3 h-3" />
                    Add Vendor
                  </button>
                </div>

                <div className="space-y-2">
                  {editForm.vendors.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center py-8 rounded-xl"
                      style={{ background: "var(--surface)", border: "1px dashed var(--border-strong)" }}
                    >
                      <Building2 className="w-7 h-7 mb-2 opacity-20" style={{ color: "var(--text-secondary)" }} />
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>No vendors added yet</p>
                      <button
                        type="button"
                        onClick={addVendorToEdit}
                        className="text-xs mt-2 font-medium"
                        style={{ color: "var(--accent)" }}
                      >
                        + Add your first vendor
                      </button>
                    </div>
                  ) : (
                    editForm.vendors.map((v, idx) => (
                      <div
                        key={idx}
                        className="flex items-stretch rounded-xl overflow-hidden"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                      >
                        {/* Vendor select */}
                        <div className="relative flex-1 min-w-0 px-3 flex items-center">
                          <select
                            value={v.vendorId}
                            onChange={(e) => updateEditVendor(idx, "vendorId", e.target.value)}
                            className="w-full py-2.5 text-sm appearance-none cursor-pointer border-none focus:ring-0 outline-none pr-5"
                            style={{
                              background: "transparent",
                              color: v.vendorId ? "var(--text-primary)" : "var(--text-muted)",
                            }}
                            required
                          >
                            <option value="" style={{ background: "#1a1d27", color: "#4a4f66" }}>Select vendor…</option>
                            {vendors.map((vendor) => (
                              <option key={vendor.id} value={vendor.id} style={{ background: "#1a1d27", color: "#e4e6ef" }}>
                                {vendor.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 w-3 h-3 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                        </div>

                        {/* Vertical divider */}
                        <div className="w-px flex-shrink-0" style={{ background: "var(--border-strong)" }} />

                        {/* Price */}
                        <div className="flex items-center gap-1.5 px-3 w-28 flex-shrink-0">
                          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={v.price}
                            onChange={(e) => updateEditVendor(idx, "price", parseFloat(e.target.value))}
                            className="w-full py-2.5 text-sm border-none outline-none focus:ring-0 tabular-nums"
                            style={{ background: "transparent", color: "var(--text-primary)" }}
                            placeholder="0.00"
                            required
                          />
                        </div>

                        {/* Vertical divider */}
                        <div className="w-px flex-shrink-0" style={{ background: "var(--border-strong)" }} />

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeVendorFromEdit(idx)}
                          className="px-3 flex items-center transition-colors hover:bg-red-500/10"
                          style={{ color: "var(--text-muted)" }}
                          title="Remove vendor"
                        >
                          <X className="w-3.5 h-3.5 hover:text-red-400" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div
                className="flex gap-2.5 pt-4"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-ghost flex-1 justify-center py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn justify-center py-2.5 font-semibold text-white"
                  style={{
                    background: "var(--accent)",
                    boxShadow: "0 2px 16px var(--accent-glow)",
                  }}
                >
                  <Check className="w-4 h-4" />
                  {editingProduct ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
