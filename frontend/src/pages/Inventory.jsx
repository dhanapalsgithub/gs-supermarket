import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchProducts, fetchCategories, createProduct, updateProduct, deleteProduct, importProductsCsv, money } from "../lib/api";
import { Plus, Pencil, Trash2, Package, Search, Upload, Download, X, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

const empty = { name: "", category: "GROCERY", price: 0, stock: 0, barcode: "", unit: "pcs", image_hint: "" };
const LOW_STOCK_THRESHOLD = 10; 
const PAGE_SIZE = 10; 

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const fileRef = useRef(null);

  const load = () => {
    fetchProducts().then(setProducts).catch(() => {});
    fetchCategories().then(setCats).catch(() => {});
  };
  useEffect(load, []);

  const filtered = products.filter((p) => {
    const t = q.trim().toLowerCase();
    return !t || p.name.toLowerCase().includes(t) || (p.barcode || "").includes(t);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedProducts = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const openNew = () => { setEditing(null); setForm(empty); setShowForm(true); };
  const openEdit = (p) => { 
    setEditing(p); 
    setForm({ 
      name: p.name, 
      category: p.category, 
      price: p.price, 
      stock: p.stock, 
      barcode: p.barcode || "", 
      unit: p.unit || "pcs",
      image_hint: p.image_hint || "" 
    }); 
    setShowForm(true); 
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
      if (editing) {
        await updateProduct(editing.id, payload);
      } else {
        await createProduct(payload);
      }
      toast.success(editing ? "Product updated successfully" : "Product added successfully");
      setShowForm(false); 
      load();
    } catch (err) { 
      toast.error("Failed to save product"); 
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    try {
      await deleteProduct(p.id);
      toast.success("Product deleted successfully"); 
      load();
    } catch {
      toast.error("Failed to delete product");
    }
  };

  const handleAutoDeductStock = async (productId, soldQuantity) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      
      const newStock = Math.max(0, product.stock - soldQuantity);
      await updateProduct(productId, { ...product, stock: newStock });
      
      if (newStock <= LOW_STOCK_THRESHOLD) {
        toast.warning(`Low stock alert for ${product.name}! Remaining: ${newStock}`);
      }
      load();
    } catch {
      toast.error("Failed to auto-deduct stock");
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importProductsCsv(file);
      toast.success(`Imported: ${res.created} added, ${res.updated} updated${res.errors ? `, ${res.errors} errors` : ""}`);
      load();
    } catch { toast.error("Import failed. Ensure CSV has correct columns"); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const downloadTemplate = () => {
    const csv = "name,category,price,stock,barcode,unit,image_hint\nSample Product,GROCERY,50.00,25,123456,PC,https://example.com/image.jpg\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "product_template.csv"; a.click();
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-cap">Manage</div>
          <h1 className="text-3xl font-extrabold">Inventory</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button data-testid="dl-template" onClick={downloadTemplate} className="btn-ghost h-11 px-4 rounded-xl flex items-center gap-2">
            <Download className="w-4 h-4" /> CSV Template
          </button>
          <button data-testid="import-csv-btn" onClick={() => fileRef.current?.click()} className="btn-ghost h-11 px-4 rounded-xl flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" onChange={onImport} className="hidden" data-testid="import-csv-input" />
          <button data-testid="new-product-btn" onClick={openNew} className="btn-primary h-11 px-4 rounded-xl flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Product
          </button>
        </div>
      </header>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or barcode…" className="field pl-10" />
      </div>

      <div className="glass overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-3 label-cap border-b border-white/50">
          <div className="col-span-4">Product</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2 font-mono-num">Barcode</div>
          <div className="col-span-1 text-right">Stock</div>
          <div className="col-span-1 text-right">Price</div>
          <div className="col-span-2 text-center">Actions</div>
        </div>
        <div className="divide-y divide-white/60">
          {paginatedProducts.map((p) => {
            const isLowStock = p.stock <= LOW_STOCK_THRESHOLD;
            return (
              <div key={p.id} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-white/50">
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center relative overflow-hidden">
                    {p.image_hint ? (
                      <img src={p.image_hint} alt={p.name} className="w-full h-full object-cover" onError={(e)=>{e.target.style.display='none'}} />
                    ) : (
                      <Package className="w-4 h-4 text-slate-400" />
                    )}
                    {isLowStock && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" title="Low Stock"></span>
                    )}
                  </div>
                  <div className="truncate">
                    <span className="text-sm font-medium truncate block">{p.name}</span>
                    {isLowStock && (
                      <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Low Stock ({p.stock})
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-xs text-slate-500">{p.category}</div>
                <div className="col-span-2 text-xs font-mono-num text-slate-500 truncate">{p.barcode}</div>
                <div className={`col-span-1 text-right text-sm font-mono-num ${isLowStock ? 'text-rose-600 font-bold' : ''}`}>
                  {Math.floor(p.stock)}
                </div>
                <div className="col-span-1 text-right text-sm font-mono-num font-bold text-indigo-600">{money(p.price)}</div>
                <div className="col-span-2 flex justify-end gap-1">
                  <button 
                    onClick={() => handleAutoDeductStock(p.id, 1)} 
                    className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 font-medium"
                    title="Simulate Billing Deduction"
                  >
                    Sell 1
                  </button>
                  <button onClick={() => openEdit(p)} data-testid={`edit-${p.id}`} className="p-2 rounded-lg hover:bg-white text-slate-500"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(p)} data-testid={`del-${p.id}`} className="p-2 rounded-lg hover:bg-white text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
          {paginatedProducts.length === 0 && <div className="p-10 text-center text-slate-500">No products</div>}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-xs text-slate-500">
            Showing page {page} of {totalPages} ({filtered.length} products total)
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(p - 1, 1))} 
              disabled={page === 1}
              className="btn-ghost h-9 px-3 rounded-lg flex items-center gap-1 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button 
              onClick={() => setPage(p => Math.min(p + 1, totalPages))} 
              disabled={page === totalPages}
              className="btn-ghost h-9 px-3 rounded-lg flex items-center gap-1 disabled:opacity-50"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div data-testid="product-form-modal" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={save} className="w-full max-w-md glass-strong p-6 space-y-3 relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setShowForm(false)} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            <div className="text-lg font-extrabold mb-2">{editing ? "Edit Product" : "New Product"}</div>
            
            <Field label="Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" data-testid="form-name" /></Field>
            
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="field" data-testid="form-category">
                  {(cats.length ? cats : ["GROCERY","SNACKS","BEVERAGES","PERSONAL_CARE","HOME_CLEANING","STATIONERY","HEALTH_CARE","FOOD_PRODUCTS","ADHESIVES"]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Unit"><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="field" /></Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (₹)"><input required type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="field font-mono-num" data-testid="form-price" /></Field>
              <Field label="Stock"><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="field font-mono-num" /></Field>
            </div>

            <Field label="Barcode"><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="field font-mono-num" data-testid="form-barcode" /></Field>

            <Field label="Image URL / Hint">
              <input 
                value={form.image_hint} 
                onChange={(e) => setForm({ ...form, image_hint: e.target.value })} 
                placeholder="Enter image URL or filename" 
                className="field" 
              />
            </Field>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 h-11 rounded-lg">Cancel</button>
              <button type="submit" data-testid="form-save" className="btn-primary flex-1 h-11 rounded-lg">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (<label className="block"><span className="label-cap">{label}</span><div className="mt-1">{children}</div></label>);
}