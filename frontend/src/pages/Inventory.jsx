/**
 * pages/Inventory.jsx
 * Full inventory management: list, search, filter, CRUD modal.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, Edit2, Trash2, Filter, Download,
  ChevronLeft, ChevronRight, Package, AlertTriangle
} from "lucide-react";
import { productsApi, metaApi, exportApi, fmt } from "../utils/api";
import toast from "react-hot-toast";
import clsx from "clsx";

const EMPTY_FORM = {
  sku:"", name:"", description:"", category_id:"", supplier_id:"",
  unit_price:"", cost_price:"", quantity_in_stock:"",
  reorder_level:"10", reorder_quantity:"50", unit_of_measure:"units",
};

function ProductModal({ product, categories, suppliers, onClose, onSaved }) {
  const [form,   setForm]   = useState(product ? { ...product } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (product?.id) {
        await productsApi.update(product.id, form);
        toast.success("Product updated");
      } else {
        await productsApi.create(form);
        toast.success("Product created");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const F = ({ label, name, type = "text", required, ...rest }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={form[name] ?? ""}
        onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
        className="input-field"
        {...rest}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-slate-800">
            {product?.id ? "Edit Product" : "Add New Product"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F label="SKU"          name="sku"          required placeholder="e.g. SKU0001" />
            <F label="Product Name" name="name"         required placeholder="e.g. Samsung Galaxy M14" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Category
              </label>
              <select
                value={form.category_id || ""}
                onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                className="input-field"
              >
                <option value="">Select category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Supplier</label>
              <select
                value={form.supplier_id || ""}
                onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}
                className="input-field"
              >
                <option value="">Select supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <F label="Unit Price (₹)" name="unit_price" type="number" required min="0" step="0.01" placeholder="0.00" />
            <F label="Cost Price (₹)" name="cost_price" type="number" required min="0" step="0.01" placeholder="0.00" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <F label="Stock Qty"       name="quantity_in_stock" type="number" min="0" placeholder="0" />
            <F label="Reorder Level"   name="reorder_level"     type="number" min="0" placeholder="10" />
            <F label="Reorder Qty"     name="reorder_quantity"  type="number" min="0" placeholder="50" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea
              value={form.description || ""}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="input-field resize-none"
              placeholder="Optional product description"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : product?.id ? "Update Product" : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inventory() {
  const [products,    setProducts]    = useState([]);
  const [meta,        setMeta]        = useState({ total: 0, pages: 1 });
  const [categories,  setCategories]  = useState([]);
  const [suppliers,   setSuppliers]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null); // null | "add" | product obj
  const [deleteId,    setDeleteId]    = useState(null);

  const [params, setParams] = useState({
    page: 1, limit: 15, search: "", category_id: "", abc_class: "", stock_status: "",
    sort_by: "name", sort_order: "ASC"
  });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.getAll(params);
      setProducts(res.data.data);
      setMeta(res.data.meta);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => {
    Promise.allSettled([metaApi.categories(), metaApi.suppliers()]).then(([c, s]) => {
      if (c.status === "fulfilled") setCategories(c.value.data.data);
      if (s.status === "fulfilled") setSuppliers(s.value.data.data);
    });
  }, []);

  const handleDelete = async () => {
    try {
      await productsApi.remove(deleteId);
      toast.success("Product removed");
      setDeleteId(null);
      loadProducts();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">{fmt.num(meta.total)} products total</p>
        </div>
        <div className="flex gap-2">
          <a
            href={exportApi.productsCsv()}
            download
            className="btn-secondary"
          >
            <Download size={15} /> Export CSV
          </a>
          <button onClick={() => setModal("add")} className="btn-primary">
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={15} className="text-slate-400" />
          <input
            value={params.search}
            onChange={e => setParams(p => ({ ...p, search: e.target.value, page: 1 }))}
            placeholder="Search name or SKU…"
            className="text-sm focus:outline-none flex-1 bg-transparent text-slate-700"
          />
        </div>
        <select
          value={params.category_id}
          onChange={e => setParams(p => ({ ...p, category_id: e.target.value, page: 1 }))}
          className="input-field w-40"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={params.abc_class}
          onChange={e => setParams(p => ({ ...p, abc_class: e.target.value, page: 1 }))}
          className="input-field w-32"
        >
          <option value="">ABC Class</option>
          {["A","B","C"].map(v => <option key={v} value={v}>Class {v}</option>)}
        </select>
        <select
          value={params.stock_status}
          onChange={e => setParams(p => ({ ...p, stock_status: e.target.value, page: 1 }))}
          className="input-field w-36"
        >
          <option value="">All Stock</option>
          <option value="low">Low Stock</option>
          <option value="dead">Dead Stock</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {["SKU","Product","Category","Supplier","Unit Price","Stock","Reorder","ABC","Status",""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
              : products.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-500">{p.sku}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700 max-w-[180px] truncate">{p.name}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.category || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{p.supplier || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{fmt.inr(p.unit_price)}</td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      "font-semibold",
                      p.is_low_stock ? "text-red-600" : "text-slate-700"
                    )}>
                      {fmt.num(p.quantity_in_stock)}
                      {p.is_low_stock && <AlertTriangle size={12} className="inline ml-1 text-red-500" />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.reorder_level}</td>
                  <td className="px-4 py-3">
                    {p.abc_class && (
                      <span className={`badge-${(p.abc_class||"").toLowerCase()}`}>
                        {p.abc_class}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.stock_classification && (
                      <span className={`badge-${p.stock_classification}`}>
                        {p.stock_classification}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setModal(p)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(p.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {params.page} of {meta.pages} · {meta.total} products
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setParams(p => ({ ...p, page: p.page - 1 }))}
              disabled={params.page <= 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setParams(p => ({ ...p, page: p.page + 1 }))}
              disabled={params.page >= meta.pages}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <ProductModal
          product={modal === "add" ? null : modal}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setModal(null)}
          onSaved={loadProducts}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-slate-800 mb-2">Remove Product</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will deactivate the product from inventory. Sales history will be preserved.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn-danger flex-1 justify-center">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
