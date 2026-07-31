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
import { useTheme } from "../ThemeContext";
import { LoaderThree } from "./ui/loader";

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
    category: CATEGORIES[1]!,
    initialStock: 100,
    vendors: [],
  });

  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme Context
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    fetchProducts();
    fetchVendors();
  }, [page, category, sortBy, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchProducts();
    }, 550);
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
    setEditForm({ name: "", category: CATEGORIES[1]!, initialStock: 100, vendors: [] });
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
    <div className="page animate-fade-in space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
        <div>
          <p className="text-[10px] font-bold text-amber-500 tracking-wider uppercase">PRODUCT CATALOG / LIVE</p>
          <h1 className={`text-3xl font-bold tracking-tight mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Products</h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Manage your product catalog and vendor relationships</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
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
          <button 
            onClick={handleCreateClick} 
            className={`flex items-center gap-1.5 px-4 py-2.5 font-bold rounded-lg text-sm transition-all ${
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

      {/* ── Catalog Table Wrapper ────────────────────────────────────── */}
      <div className={`card overflow-hidden animate-slide-up ${isDark ? 'bg-[#141720] border-slate-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
        {/* Toolbar */}
        <div className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <ShoppingCart className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Product Catalog
            </span>
            <span className="badge badge-neutral ml-1">
              {total} items
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-9 pr-4 py-2 w-52 rounded-lg text-xs transition-all focus:outline-none focus:ring-1 ${
                  isDark 
                    ? 'bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-slate-700 focus:ring-slate-700' 
                    : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-slate-350 focus:ring-slate-300'
                }`}
              />
            </div>

            {/* Category filter select */}
            <div className="relative">
              <Filter className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`pl-9 pr-8 py-2 rounded-lg text-xs transition-all focus:outline-none appearance-none cursor-pointer ${
                  isDark 
                    ? 'bg-slate-900 border border-slate-800 text-slate-200 focus:border-slate-700' 
                    : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-slate-350'
                }`}
                style={{ minWidth: "160px" }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} style={{ background: isDark ? "#141720" : "#ffffff", color: isDark ? "#e4e6ef" : "#0f0f0f" }}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto" style={{ minHeight: "350px" }}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoaderThree />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Package className="w-10 h-10 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No products found</p>
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
                {products.map((p) => {
                  const stock = p.inventory?.currentStock ?? 0;
                  const reorder = p.inventory?.reorderLevel ?? 0;
                  const isLow = stock < reorder;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {p.name}
                          </span>
                          <span className="badge badge-neutral w-fit text-[10px]">{p.category}</span>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-20 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, stock)}%`,
                                  background: isLow 
                                    ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                                    : "linear-gradient(90deg, #fa9733ff, #fa8f1dff)",
                                }}
                              />
                            </div>
                            <span className={`text-sm font-semibold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {stock}
                            </span>
                          </div>
                          <div className={`flex gap-2 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            <span>Min: {reorder}</span>
                            <span>·</span>
                            <span>Safe: {p.inventory?.safetyStock ?? 0}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {p.vendors?.map((pv) => (
                            <div key={pv.id} className="flex items-center gap-1.5 text-xs">
                              <Building2 className={`w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                              <span className={`${isDark ? 'text-slate-400' : 'text-slate-600'} truncate max-w-[120px]`}>{pv.vendor.name}</span>
                              <span className="ml-auto font-bold text-emerald-450">${pv.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditClick(p)}
                            className={`p-1.5 rounded-lg transition-all ${
                              isDark 
                                ? 'text-slate-500 hover:bg-violet-500/10 hover:text-violet-400' 
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
                            }`}
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className={`p-1.5 rounded-lg transition-all ${
                              isDark 
                                ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400' 
                                : 'text-slate-400 hover:bg-red-50/80 hover:text-red-650'
                            }`}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && products.length > 0 && (
          <div className={`px-5 py-3 flex items-center justify-between border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                className={`p-1.5 border rounded-lg transition-all disabled:opacity-30 ${
                  isDark 
                    ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                    : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                className={`p-1.5 border rounded-lg transition-all disabled:opacity-30 ${
                  isDark 
                    ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                    : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal Overlay ────────────────────────────────── */}
      {(editingProduct || isAddModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
          <div className={`card w-full max-w-xl border rounded-2xl overflow-hidden animate-scale-in ${
            isDark ? 'bg-[#141720] border-slate-800' : 'bg-white border-slate-200 shadow-2xl'
          }`}>
            {/* Header */}
            <div className={`px-6 py-4 flex justify-between items-center border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: editingProduct 
                      ? (isDark ? "rgba(124,92,252,0.12)" : "rgba(124,92,252,0.08)") 
                      : (isDark ? "rgba(34,197,94,0.1)" : "rgba(16,185,129,0.08)"),
                    border: `1px solid ${
                      editingProduct 
                        ? (isDark ? "rgba(124,92,252,0.2)" : "rgba(124,92,252,0.15)") 
                        : (isDark ? "rgba(34,197,94,0.2)" : "rgba(16,185,129,0.15)")
                    }`,
                  }}
                >
                  {editingProduct ? (
                    <Edit2 className="w-3.5 h-3.5" style={{ color: isDark ? "var(--accent)" : "#7c5cfc" }} />
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                </div>
                <div>
                  <h2 className={`text-base font-semibold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {editingProduct ? "Edit Product" : "Add New Product"}
                  </h2>
                  {editingProduct && (
                    <p className={`text-xs mt-0.5 leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {editingProduct.name}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={closeModal}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                  isDark ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form body */}
            <form
              onSubmit={editingProduct ? handleUpdate : handleCreate}
              className="p-6 space-y-5 max-h-[75vh] overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: isDark ? "var(--surface) transparent" : "#e2e8f0 transparent" }}
            >
              {/* Name + Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={`form-label text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Product Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className={`w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none focus:ring-1 ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-amber-500 focus:ring-amber-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600 focus:ring-amber-600'
                    }`}
                    placeholder="e.g. Wireless Headphones"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={`form-label text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Category</label>
                  <div className="relative">
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className={`w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none appearance-none cursor-pointer pr-9 ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-white focus:border-amber-500' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600'
                      }`}
                      required
                    >
                      {CATEGORIES.slice(1).map((c) => (
                        <option
                          key={c}
                          value={c}
                          style={{ background: isDark ? "#141720" : "#ffffff", color: isDark ? "#e4e6ef" : "#0f0f0f" }}
                        >
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                    />
                  </div>
                </div>
              </div>

              {/* Initial Stock (create mode only) */}
              {!editingProduct && (
                <div className="space-y-1.5">
                  <label className={`form-label text-xs font-semibold uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Initial Stock</label>
                  <input
                    type="number"
                    value={editForm.initialStock}
                    onChange={(e) => setEditForm({ ...editForm, initialStock: parseInt(e.target.value) || 0 })}
                    className={`w-full rounded-lg px-3.5 py-2.5 text-sm border focus:outline-none focus:ring-1 ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-amber-500 focus:ring-amber-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-600 focus:ring-amber-600'
                    }`}
                    placeholder="100"
                    required
                  />
                </div>
              )}

              {/* Vendors */}
              <div className={`pt-4 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Vendors &amp; Pricing</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>At least one vendor required</p>
                  </div>
                  <button
                    type="button"
                    onClick={addVendorToEdit}
                    className={`px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isDark 
                        ? 'border-slate-800/80 text-slate-400 bg-slate-900/40 hover:bg-slate-800/80 hover:text-white' 
                        : 'border-slate-200 text-slate-650 bg-white hover:bg-slate-50 hover:text-slate-950'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    Add Vendor
                  </button>
                </div>

                <div className="space-y-2">
                  {editForm.vendors.length === 0 ? (
                    <div
                      className={`flex flex-col items-center justify-center py-8 rounded-xl border border-dashed ${
                        isDark ? 'bg-slate-900 border-slate-850' : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <Building2 className={`w-7 h-7 mb-2 opacity-20 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No vendors added yet</p>
                      <button
                        type="button"
                        onClick={addVendorToEdit}
                        className={`text-xs mt-2 font-semibold ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-850'}`}
                      >
                        + Add your first vendor
                      </button>
                    </div>
                  ) : (
                    editForm.vendors.map((v, idx) => (
                      <div
                        key={idx}
                        className={`flex items-stretch rounded-xl overflow-hidden border ${
                          isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* Vendor select */}
                        <div className="relative flex-1 min-w-0 px-3 flex items-center">
                          <select
                            value={v.vendorId}
                            onChange={(e) => updateEditVendor(idx, "vendorId", e.target.value)}
                            className="w-full py-2.5 text-sm appearance-none cursor-pointer border-none focus:ring-0 outline-none pr-5 bg-transparent"
                            style={{
                              color: v.vendorId ? (isDark ? "var(--text-primary)" : "var(--text-primary)") : (isDark ? "var(--text-muted)" : "#94a3b8"),
                            }}
                            required
                          >
                            <option value="" style={{ background: isDark ? "#141720" : "#ffffff", color: isDark ? "#4a4f66" : "#94a3b8" }}>Select vendor…</option>
                            {vendors.map((vendor) => (
                              <option key={vendor.id} value={vendor.id} style={{ background: isDark ? "#141720" : "#ffffff", color: isDark ? "#e4e6ef" : "#0f0f0f" }}>
                                {vendor.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className={`absolute right-2 w-3.5 h-3.5 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        </div>

                        {/* Vertical divider */}
                        <div className={`w-px flex-shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

                        {/* Price */}
                        <div className="flex items-center gap-1.5 px-3 w-28 flex-shrink-0 bg-transparent">
                          <span className={`text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={v.price}
                            onChange={(e) => updateEditVendor(idx, "price", parseFloat(e.target.value) || 0)}
                            className="w-full py-2.5 text-sm border-none outline-none focus:ring-0 tabular-nums bg-transparent"
                            style={{ color: isDark ? "var(--text-primary)" : "var(--text-primary)" }}
                            placeholder="0.00"
                            required
                          />
                        </div>

                        {/* Vertical divider */}
                        <div className={`w-px flex-shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeVendorFromEdit(idx)}
                          className={`px-3 flex items-center transition-colors ${
                            isDark ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                          }`}
                          title="Remove vendor"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className={`flex gap-2.5 pt-4 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={closeModal}
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
