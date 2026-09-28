import React, { useEffect, useState, useMemo } from 'react';
import { fetchPurchases, createPurchase, updatePurchase, deletePurchase, fetchSuppliers, fetchProducts, money } from '../lib/api';

export default function Purchases() {
    const [purchases, setPurchases] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [productsCatalog, setProductsCatalog] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search, Filters & Pagination
    const [search, setSearch] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedProductFilter, setSelectedProductFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form State with Multi-item support
    const [form, setForm] = useState({
        supplier_name: '',
        date: new Date().toISOString().split('T')[0],
        items: [
            { product_code: '', product_name: '', rate: '', closing_qty: '' }
        ]
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [purchasesData, suppliersData, productsData] = await Promise.all([
                fetchPurchases(),
                fetchSuppliers(),
                fetchProducts()
            ]);
            setPurchases(purchasesData || []);
            setSuppliers(suppliersData || []);
            setProductsCatalog(productsData || []);
        } catch (err) {
            console.error("Failed to load purchase data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleItemChange = (index, field, value) => {
        const updatedItems = [...form.items];
        updatedItems[index][field] = value;

        // If product code changes, auto-fill product name & rate if matched in catalog
        if (field === 'product_code') {
            const matched = productsCatalog.find(p => p.barcode === value || p.id === value || p.name.toLowerCase() === value.toLowerCase());
            if (matched) {
                updatedItems[index].product_name = matched.name;
                updatedItems[index].rate = matched.price || '';
            }
        }

        setForm({ ...form, items: updatedItems });
    };

    const addItemRow = () => {
        setForm({
            ...form,
            items: [...form.items, { product_code: '', product_name: '', rate: '', closing_qty: '' }]
        });
    };

    const removeItemRow = (index) => {
        if (form.items.length === 1) return;
        const updatedItems = form.items.filter((_, i) => i !== index);
        setForm({ ...form, items: updatedItems });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.supplier_name) {
            alert("Please select a valid supplier from the supplier menu.");
            return;
        }

        try {
            if (editingId) {
                const singleItem = form.items[0];
                const payload = {
                    supplier_name: form.supplier_name,
                    date: form.date,
                    product_code: singleItem.product_code,
                    product_name: singleItem.product_name,
                    rate: parseFloat(singleItem.rate) || 0,
                    closing_qty: parseFloat(singleItem.closing_qty) || 0
                };
                await updatePurchase(editingId, payload);
            } else {
                for (const item of form.items) {
                    const payload = {
                        supplier_name: form.supplier_name,
                        date: form.date,
                        product_code: item.product_code,
                        product_name: item.product_name,
                        rate: parseFloat(item.rate) || 0,
                        closing_qty: parseFloat(item.closing_qty) || 0
                    };
                    await createPurchase(payload);
                }
            }

            setIsModalOpen(false);
            resetForm();
            loadData();
        } catch (err) {
            console.error("Error saving purchase", err);
            alert("Failed to save purchase entry.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this purchase entry?")) return;
        try {
            await deletePurchase(id);
            loadData();
        } catch (err) {
            console.error("Error deleting purchase", err);
        }
    };

    const handleEdit = (item) => {
        setEditingId(item.id);
        setForm({
            supplier_name: item.supplier_name,
            date: item.date,
            items: [
                {
                    product_code: item.product_code,
                    product_name: item.product_name,
                    rate: item.rate,
                    closing_qty: item.closing_qty
                }
            ]
        });
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setForm({
            supplier_name: suppliers.length > 0 ? suppliers[0].name : '',
            date: new Date().toISOString().split('T')[0],
            items: [
                { product_code: '', product_name: '', rate: '', closing_qty: '' }
            ]
        });
    };

    // Filter Logic
    const filtered = useMemo(() => {
        return purchases.filter(item => {
            const matchesSearch =
                (item.supplier_name || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
                (item.product_code || '').toLowerCase().includes(search.toLowerCase());

            const matchesDate = selectedDate ? item.date === selectedDate : true;
            const matchesProduct = selectedProductFilter ? (item.product_name === selectedProductFilter || item.product_code === selectedProductFilter) : true;
            
            return matchesSearch && matchesDate && matchesProduct;
        });
    }, [purchases, search, selectedDate, selectedProductFilter]);

    // Top Overview Metrics Calculation
    const topMetrics = useMemo(() => {
        let totalCost = 0;
        const uniqueSuppliers = new Set();

        filtered.forEach(item => {
            totalCost += Number(item.closing_value || 0);
            if (item.supplier_name) {
                uniqueSuppliers.add(item.supplier_name.trim());
            }
        });

        return {
            totalProducts: filtered.length,
            totalCost,
            totalSuppliers: uniqueSuppliers.size
        };
    }, [filtered]);

    // Unique list of product names for the product selector dropdown
    const productNamesList = useMemo(() => {
        const names = new Set();
        purchases.forEach(p => {
            if (p.product_name) names.add(p.product_name);
        });
        return Array.from(names);
    }, [purchases]);

    // Pagination Logic
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filtered.slice(start, start + itemsPerPage);
    }, [filtered, currentPage]);

    // Supplier-wise Summary Footer Calculation
    const supplierSummary = useMemo(() => {
        const summary = {};
        filtered.forEach(item => {
            const sup = item.supplier_name || 'Unknown';
            if (!summary[sup]) {
                summary[sup] = { qty: 0, value: 0 };
            }
            summary[sup].qty += Number(item.closing_qty || 0);
            summary[sup].value += Number(item.closing_value || 0);
        });
        return summary;
    }, [filtered]);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Purchase Management</h1>
                    <p className="text-sm text-slate-500">Manage stock purchases from active suppliers, rates, and inventories</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 font-semibold text-sm hover:opacity-90 transition"
                >
                    + Add Purchase Entry
                </button>
            </div>

            {/* Top Key Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="glass p-4 rounded-2xl shadow-sm border border-slate-100 bg-white/70">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Purchase Entries</p>
                    <p className="text-2xl font-extrabold text-slate-800">{topMetrics.totalProducts}</p>
                </div>
                <div className="glass p-4 rounded-2xl shadow-sm border border-slate-100 bg-white/70">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Purchase Cost</p>
                    <p className="text-2xl font-extrabold text-indigo-600">{money(topMetrics.totalCost)}</p>
                </div>
                <div className="glass p-4 rounded-2xl shadow-sm border border-slate-100 bg-white/70">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Suppliers</p>
                    <p className="text-2xl font-extrabold text-slate-800">{topMetrics.totalSuppliers}</p>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="glass p-4 rounded-2xl mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between shadow-sm">
                <input
                    type="text"
                    placeholder="Search by supplier, product name, or code..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full lg:w-1/3 px-4 py-2 bg-white/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* Product Selection Dropdown Filter */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Product:</label>
                        <select
                            value={selectedProductFilter}
                            onChange={(e) => { setSelectedProductFilter(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2 bg-white/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Products</option>
                            {productNamesList.map((prodName, idx) => (
                                <option key={idx} value={prodName}>{prodName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Filter */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2 bg-white/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {(selectedDate || selectedProductFilter || search) && (
                        <button
                            onClick={() => { setSelectedDate(''); setSelectedProductFilter(''); setSearch(''); }}
                            className="text-xs text-rose-500 font-semibold hover:underline px-2"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Table Section */}
            <div className="glass rounded-2xl shadow-sm overflow-hidden mb-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                                <th className="p-4 w-16 text-center">Sl No</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Supplier Name</th>
                                <th className="p-4">Product Code</th>
                                <th className="p-4">Product Name</th>
                                <th className="p-4 text-right">Rate</th>
                                <th className="p-4 text-right">Closing Qty</th>
                                <th className="p-4 text-right">Closing Value</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                <tr><td colSpan="9" className="text-center p-8 text-slate-400">Loading purchase entries...</td></tr>
                            ) : paginatedData.length > 0 ? (
                                paginatedData.map((item, idx) => {
                                    const slNo = (currentPage - 1) * itemsPerPage + idx + 1;
                                    return (
                                        <tr key={item.id} className="hover:bg-white/50 transition">
                                            <td className="p-4 text-center font-semibold text-slate-500">{slNo}</td>
                                            <td className="p-4 text-slate-600">{item.date}</td>
                                            <td className="p-4 font-semibold text-slate-800">{item.supplier_name}</td>
                                            <td className="p-4 font-mono text-xs text-slate-500">{item.product_code}</td>
                                            <td className="p-4 text-slate-700">{item.product_name}</td>
                                            <td className="p-4 text-right font-medium">{money(item.rate)}</td>
                                            <td className="p-4 text-right">{item.closing_qty}</td>
                                            <td className="p-4 text-right font-bold text-indigo-600">{money(item.closing_value)}</td>
                                            <td className="p-4 text-center space-x-3">
                                                <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs">Edit</button>
                                                <button onClick={() => handleDelete(item.id)} className="text-rose-500 hover:text-rose-700 font-semibold text-xs">Delete</button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan="9" className="text-center p-8 text-slate-400">No purchase records found matching your criteria.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Supplier-wise Summary Footer */}
                <div className="bg-indigo-50/60 p-5 border-t border-indigo-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-3">Supplier-wise Summary Breakdown:</h3>
                    {Object.keys(supplierSummary).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {Object.entries(supplierSummary).map(([sup, data]) => (
                                <div key={sup} className="bg-white p-3.5 rounded-xl shadow-sm border border-indigo-100">
                                    <div className="font-bold text-slate-800 truncate mb-1">{sup}</div>
                                    <div className="text-xs text-slate-500 flex justify-between">
                                        <span>Total Qty:</span>
                                        <span className="font-semibold text-slate-700">{data.qty}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex justify-between mt-0.5">
                                        <span>Total Value:</span>
                                        <span className="font-bold text-indigo-600">{money(data.value)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500">No supplier data available for summary.</p>
                    )}
                </div>
            </div>

            {/* Pagination Controls */}
            {!loading && filtered.length > itemsPerPage && (
                <div className="glass p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <span className="text-xs text-slate-500">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${currentPage === 1 ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-indigo-600 border-slate-200 hover:bg-indigo-50'}`}
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1.5 text-xs font-bold text-slate-700 flex items-center">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${currentPage === totalPages ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-indigo-600 border-slate-200 hover:bg-indigo-50'}`}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Add / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 my-8">
                        <h2 className="text-lg font-extrabold text-slate-800 mb-4">{editingId ? 'Edit Purchase Entry' : 'New Purchase Entry'}</h2>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Date</label>
                                    <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Supplier Name (From Supplier Menu)</label>
                                    <select
                                        value={form.supplier_name}
                                        onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                                        required
                                    >
                                        <option value="">-- Select Registered Supplier --</option>
                                        {suppliers.map(sup => (
                                            <option key={sup.id || sup.name} value={sup.name}>{sup.name} {sup.company ? `(${sup.company})` : ''}</option>
                                        ))}
                                    </select>
                                    {suppliers.length === 0 && (
                                        <p className="text-[11px] text-rose-500 mt-1">No suppliers found. Please add a supplier in the Supplier menu first.</p>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                    {form.items.map((item, idx) => {
                                        const rowVal = (parseFloat(item.rate) || 0) * (parseFloat(item.closing_qty) || 0);
                                        return (
                                            <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 relative space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-500">Item #{idx + 1}</span>
                                                    {!editingId && form.items.length > 1 && (
                                                        <button type="button" onClick={() => removeItemRow(idx)} className="text-rose-500 hover:text-rose-700 text-xs font-semibold">Remove</button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Product Code / Barcode</label>
                                                        <input type="text" placeholder="e.g. PRD-001" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={item.product_code} onChange={e => handleItemChange(idx, 'product_code', e.target.value)} required />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Product Name</label>
                                                        <input type="text" placeholder="e.g. Basmati Rice" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={item.product_name} onChange={e => handleItemChange(idx, 'product_name', e.target.value)} required />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Rate (₹)</label>
                                                        <input type="number" step="0.01" placeholder="0.00" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={item.rate} onChange={e => handleItemChange(idx, 'rate', e.target.value)} required />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Closing Qty</label>
                                                        <input type="number" step="any" placeholder="0" className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" value={item.closing_qty} onChange={e => handleItemChange(idx, 'closing_qty', e.target.value)} required />
                                                    </div>
                                                    <div className="text-right sm:mt-4">
                                                        <span className="text-[11px] text-slate-500">Value: </span>
                                                        <span className="text-xs font-bold text-indigo-600">{money(rowVal)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {!editingId && (
                                    <button type="button" onClick={addItemRow} className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-2 rounded-xl transition w-full text-center">
                                        + Add Another Product Item
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-50 transition">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/25 hover:opacity-90 transition">Save Entry</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}