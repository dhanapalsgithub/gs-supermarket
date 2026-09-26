import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchProducts, fetchCategories, createProduct, updateProduct, deleteProduct, money } from "../lib/api";
import { Plus, Pencil, Trash2, Package, Search } from "lucide-react";

const emptyForm = { name: "", category: "GROCERY", price: 0, stock: 0, barcode: "", unit: "pcs" };

export default function Admin() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    fetchProducts().then(setProducts).catch(() => {});
    fetchCategories().then(setCategories).catch(() => {});
  };
  useEffect(load, []);

  const filtered = products.filter((p) => {
    const q = query.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.barcode || "").includes(q);
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (p) => { setEditing(p); setForm({ name: p.name, category: p.category, price: p.price, stock: p.stock, barcode: p.barcode || "", unit: p.unit || "pcs" }); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
      if (editing) await updateProduct(editing.id, payload);
      else await createProduct(payload);
      toast.success(editing ? "Product updated" : "Product added");
      setShowForm(false); load();
    } catch { toast.error("Failed to save"); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    await deleteProduct(p.id);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="h-screen overflow-y-auto p-6 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400">Manage</div>
          <h1 className="text-3xl font-extrabold tracking-tight">Inventory</h1>
        </div>
        <button data-testid="new-product-btn" onClick={openNew} className="h-11 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Product
        </button>
      </header>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products or barcode..."
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#12121F] border border-white/10 outline-none focus:border-indigo-400/50 text-sm"
        />
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#12121F] overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-3 text-[10px] uppercase tracking-widest text-slate-400 border-b border-white/5">
          <div className="col-span-5">Product</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2 font-mono-num">Barcode</div>
          <div className="col-span-1 text-right">Stock</div>
          <div className="col-span-1 text-right">Price</div>
          <div className="col-span-1"></div>
        </div>
        <div className="divide-y divide-white/5 max-h-[65vh] overflow-y-auto">
          {filtered.map((p) => (
            <div key={p.id} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-white/[0.03]">
              <div className="col-span-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center">
                  <Package className="w-4 h-4 text-white/40" />
                </div>
                <span className="text-sm font-medium truncate">{p.name}</span>
              </div>
              <div className="col-span-2 text-xs text-slate-400">{p.category}</div>
              <div className="col-span-2 text-xs font-mono-num text-slate-400 truncate">{p.barcode}</div>
              <div className="col-span-1 text-right text-sm font-mono-num">{Math.floor(p.stock)}</div>
              <div className="col-span-1 text-right text-sm font-mono-num font-bold text-indigo-300">{money(p.price)}</div>
              <div className="col-span-1 flex justify-end gap-1">
                <button onClick={() => openEdit(p)} data-testid={`edit-${p.id}`} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(p)} data-testid={`del-${p.id}`} className="p-2 rounded-lg hover:bg-white/5 text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="p-10 text-center text-slate-500">No products</div>}
        </div>
      </div>

      {showForm && (
        <div data-testid="product-form-modal" className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={save} className="w-full max-w-md bg-[#12121F] border border-white/10 rounded-2xl p-6 space-y-3">
            <div className="text-lg font-bold mb-2">{editing ? "Edit Product" : "New Product"}</div>
            <Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" data-testid="form-name" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" data-testid="form-category">
                  {(categories.length ? categories : ["GROCERY","SNACKS","BEVERAGES","PERSONAL_CARE","HOME_CLEANING","STATIONERY","HEALTH_CARE","FOOD_PRODUCTS","ADHESIVES"]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Unit">
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (₹)"><input required type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input font-mono-num" data-testid="form-price" /></Field>
              <Field label="Stock"><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input font-mono-num" /></Field>
            </div>
            <Field label="Barcode"><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="input font-mono-num" data-testid="form-barcode" /></Field>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 h-11 rounded-lg bg-white/5 border border-white/10 hover:border-white/20">Cancel</button>
              <button type="submit" data-testid="form-save" className="flex-1 h-11 rounded-lg bg-indigo-500 hover:bg-indigo-400 font-semibold">Save</button>
            </div>
          </form>
        </div>
      )}
      <style>{`.input{width:100%;height:40px;padding:0 10px;border-radius:8px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;outline:none} .input:focus{border-color:rgba(129,140,248,0.5)}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
