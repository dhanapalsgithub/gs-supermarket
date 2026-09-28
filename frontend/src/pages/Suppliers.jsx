import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', company: '', address: '' });
  const [editingSupplier, setEditingSupplier] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/suppliers');
      setSuppliers(res.data || []);
    } catch (err) {
      console.error("Error fetching suppliers", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(sup => {
      const company = (sup.company || '').toLowerCase();
      const name = (sup.name || '').toLowerCase();
      const phone = (sup.phone || '').toLowerCase();
      const email = (sup.email || '').toLowerCase();
      const term = searchTerm.toLowerCase();

      return company.includes(term) || name.includes(term) || phone.includes(term) || email.includes(term);
    });
  }, [suppliers, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage) || 1;
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(start, start + itemsPerPage);
  }, [filteredSuppliers, currentPage]);

  // Add Supplier Handler
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/suppliers', formData);
      setIsAddModalOpen(false);
      fetchSuppliers();
      setFormData({ name: '', phone: '', email: '', company: '', address: '' });
      alert("Supplier added successfully!");
    } catch (err) {
      console.error("Error adding supplier", err);
      alert("Failed to add supplier.");
    }
  };

  // Edit Click Handler
  const handleEditClick = (sup) => {
    setEditingSupplier({ ...sup, uniqueId: sup.id || sup._id || sup.phone });
    setIsEditModalOpen(true);
  };

  // Update Supplier Handler
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    const supplierId = editingSupplier.uniqueId || editingSupplier.phone;
    try {
      await api.put(`/suppliers/${supplierId}`, {
        name: editingSupplier.name,
        phone: editingSupplier.phone,
        email: editingSupplier.email,
        company: editingSupplier.company,
        address: editingSupplier.address
      });
      setIsEditModalOpen(false);
      fetchSuppliers();
      alert("Supplier updated successfully!");
    } catch (err) {
      console.error("Error updating supplier", err);
      alert("Failed to update supplier.");
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Supplier Management</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)} 
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 text-sm font-semibold flex items-center gap-2"
        >
          + Add Supplier
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <input 
          type="text" 
          placeholder="Search by company, contact person, phone, or email..." 
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          className="w-full md:w-1/3 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
        />
      </div>

      {/* Supplier Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">Company Name</th>
              <th className="p-3">Contact Person</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Email</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center p-6 text-gray-500">Loading suppliers...</td></tr>
            ) : paginatedSuppliers.length > 0 ? (
              paginatedSuppliers.map((sup, idx) => (
                <tr key={sup.id || sup.phone || idx} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-semibold">{sup.company || 'N/A'}</td>
                  <td className="p-3">{sup.name || 'N/A'}</td>
                  <td className="p-3">{sup.phone || 'N/A'}</td>
                  <td className="p-3">{sup.email || 'N/A'}</td>
                  <td className="p-3">
                    <button 
                      onClick={() => handleEditClick(sup)} 
                      className="text-blue-600 hover:underline text-sm font-semibold"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center p-6 text-gray-500">No suppliers found matching your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!loading && filteredSuppliers.length > itemsPerPage && (
        <div className="flex justify-between items-center mt-4 bg-white p-4 rounded-lg shadow">
          <span className="text-sm text-gray-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredSuppliers.length)} of {filteredSuppliers.length} entries
          </span>
          <div className="flex gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className={`px-3 py-1 rounded border ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-purple-600 hover:bg-purple-50'}`}
            >
              Previous
            </button>
            <span className="px-3 py-1 font-semibold text-sm flex items-center">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className={`px-3 py-1 rounded border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-purple-600 hover:bg-purple-50'}`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddSubmit} className="bg-white p-6 rounded-lg w-full max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4">Add New Supplier</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} required />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person Name</label>
              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {isEditModalOpen && editingSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateSubmit} className="bg-white p-6 rounded-lg w-full max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4">Edit Supplier</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500" value={editingSupplier.company || ''} onChange={e => setEditingSupplier({...editingSupplier, company: e.target.value})} required />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person Name</label>
              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500" value={editingSupplier.name || ''} onChange={e => setEditingSupplier({...editingSupplier, name: e.target.value})} required />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500" value={editingSupplier.phone || ''} onChange={e => setEditingSupplier({...editingSupplier, phone: e.target.value})} required />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500" value={editingSupplier.email || ''} onChange={e => setEditingSupplier({...editingSupplier, email: e.target.value})} />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold">Update</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}