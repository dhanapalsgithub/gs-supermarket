import React, { useEffect, useState, useMemo } from 'react';
import { api, money } from '../lib/api';

export default function Customers() {
  const [activeTab, setActiveTab] = useState('online');
  const [onlineCustomers, setOnlineCustomers] = useState([]);
  const [walkingCustomers, setWalkingCustomers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    fetchCustomersAndOrders();
  }, []);

  const fetchCustomersAndOrders = async () => {
    try {
      setLoading(true);
      const [custRes, ordRes] = await Promise.all([
        api.get('/customers'),
        api.get('/orders').catch(() => ({ data: [] }))
      ]);

      const rawCust = custRes.data || {};
      let online = [];
      let walking = [];
      let fullList = [];

      if (Array.isArray(rawCust)) {
        fullList = rawCust;
        online = rawCust.filter((c) => c.type === 'online' || c.channel === 'ONLINE');
        walking = rawCust.filter((c) => c.type === 'walking' || c.channel === 'WALK-IN' || c.type === 'pos');
      } else {
        online = rawCust.online || [];
        walking = rawCust.walking || [];
        fullList = [...online, ...walking, ...(rawCust.credit || [])];
      }

      setOnlineCustomers(online);
      setWalkingCustomers(walking);
      setAllCustomers(fullList);
      setOrders(Array.isArray(ordRes.data) ? ordRes.data : []);
    } catch (err) {
      console.error('Error fetching data', err);
    } finally {
      setLoading(false);
    }
  };

  /* Process Credit Customers & Outstanding Balances */
  const creditSummary = useMemo(() => {
    const custMap = {};
    const now = new Date();

    // 1. Process credit orders
    orders.forEach((ord) => {
      const pm = (ord.payment_method || '').toUpperCase();
      const isCredit = pm.includes('CREDIT') || pm.includes('NON PAY') || pm.includes('NON-PAY');
      
      const totalAmt = Number(ord.total || 0);
      const paidAmt = Number(ord.amount_paid || 0);
      const balance = Math.max(0, totalAmt - paidAmt);

      if (!isCredit && balance <= 0) return;

      const phone = (ord.customer_phone || ord.phone || 'Unknown').trim();
      const name = ord.customer_name || 'Credit Customer';
      const orderDate = ord.created_at ? new Date(ord.created_at) : new Date();
      const diffDays = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));

      if (balance > 0) {
        if (!custMap[phone]) {
          custMap[phone] = {
            id: ord.customer_id || phone,
            name,
            phone,
            totalCredit: 0,
            overdueBalance: 0,
            oldestOrderDays: 0,
            created_at: ord.created_at
          };
        }

        custMap[phone].totalCredit += balance;

        if (diffDays >= 30) {
          custMap[phone].overdueBalance += balance;
        }
        if (diffDays > custMap[phone].oldestOrderDays) {
          custMap[phone].oldestOrderDays = diffDays;
        }
      }
    });

    // 2. Include database customer records with direct credit balance or credit type
    allCustomers.forEach((cust) => {
      const phone = (cust.phone || cust.mobile || 'Unknown').trim();
      const directBalance = Number(cust.credit_balance || cust.outstanding_balance || 0);
      const isCreditType = cust.type === 'credit' || directBalance > 0;

      if (isCreditType) {
        if (!custMap[phone]) {
          custMap[phone] = {
            id: cust.id || cust._id || phone,
            name: cust.name || 'Credit Customer',
            phone,
            totalCredit: directBalance,
            overdueBalance: 0,
            oldestOrderDays: 0,
            created_at: cust.created_at
          };
        } else if (directBalance > custMap[phone].totalCredit) {
          custMap[phone].totalCredit = directBalance;
        }
      }
    });

    const list = Object.values(custMap).filter((c) => c.totalCredit > 0);
    const overallCredit = list.reduce((sum, c) => sum + c.totalCredit, 0);
    const overallOverdue = list.reduce((sum, c) => sum + c.overdueBalance, 0);

    return { list, overallCredit, overallOverdue };
  }, [orders, allCustomers]);

  const filteredCustomers = useMemo(() => {
    const list =
      activeTab === 'online'
        ? onlineCustomers
        : activeTab === 'walking'
        ? walkingCustomers
        : creditSummary.list;

    return list.filter((cust) => {
      const name = (cust.name || '').toLowerCase();
      const phone = (cust.phone || cust.mobile || '').toLowerCase();
      const email = (cust.email || '').toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch = name.includes(term) || phone.includes(term) || email.includes(term);

      let matchesDate = true;
      if (cust.created_at) {
        const custDate = cust.created_at.split('T')[0];
        if (startDate && custDate < startDate) matchesDate = false;
        if (endDate && custDate > endDate) matchesDate = false;
      }

      return matchesSearch && matchesDate;
    });
  }, [activeTab, onlineCustomers, walkingCustomers, creditSummary, searchTerm, startDate, endDate]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchTerm('');
  };

  const handleEditClick = (cust) => {
    setEditingCustomer({ ...cust, uniqueId: cust.id || cust._id || cust.phone });
    setIsEditModalOpen(true);
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    const customerId = editingCustomer.uniqueId || editingCustomer.phone;
    try {
      await api.put(`/customers/${customerId}`, {
        name: editingCustomer.name,
        phone: editingCustomer.phone || editingCustomer.mobile,
        email: editingCustomer.email,
        address: editingCustomer.address
      });
      setIsEditModalOpen(false);
      fetchCustomersAndOrders();
      alert('Customer updated successfully!');
    } catch (err) {
      console.error('Error updating customer', err);
      alert('Failed to update customer.');
    }
  };

  const exportCSV = () => {
    const list = filteredCustomers;
    if (list.length === 0) {
      alert('No data available to export!');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    if (activeTab === 'credit') {
      csvContent += 'Name,Mobile Number,Total Credit Balance,Overdue (>30 Days),Oldest Bill (Days)\n';
      list.forEach((cust) => {
        const row = [
          `"${cust.name || 'N/A'}"`,
          `"${cust.phone || 'N/A'}"`,
          `"${cust.totalCredit.toFixed(2)}"`,
          `"${cust.overdueBalance.toFixed(2)}"`,
          `"${cust.oldestOrderDays}"`
        ].join(',');
        csvContent += row + '\n';
      });
    } else {
      csvContent += 'Name,Mobile Number,' + (activeTab === 'online' ? 'Email' : 'Address/Type') + ',Created At\n';
      list.forEach((cust) => {
        const row = [
          `"${cust.name || 'N/A'}"`,
          `"${cust.phone || cust.mobile || 'N/A'}"`,
          `"${activeTab === 'online' ? cust.email || 'N/A' : cust.address || 'Walking Customer'}"`,
          `"${cust.created_at ? cust.created_at.split('T')[0] : 'N/A'}"`
        ].join(',');
        csvContent += row + '\n';
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeTab}_customers_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Customer Management</h1>
        <button
          onClick={exportCSV}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 text-sm font-semibold flex items-center gap-2"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Credit Summary Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">Total Credit Balance</div>
            <div className="text-2xl font-extrabold text-amber-900 mt-1">{money(creditSummary.overallCredit)}</div>
          </div>
          <div className="text-xs font-medium text-amber-600 bg-amber-100 px-3 py-1.5 rounded-full">
            {creditSummary.list.length} Customers
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <div className="text-xs font-bold text-rose-700 uppercase tracking-wider">Total Overdue (&gt;30 Days)</div>
            <div className="text-2xl font-extrabold text-rose-900 mt-1">{money(creditSummary.overallOverdue)}</div>
          </div>
          <div className="text-xs font-medium text-rose-600 bg-rose-100 px-3 py-1.5 rounded-full">
            Action Needed
          </div>
        </div>
      </div>

      <div className="flex gap-6 mb-6 border-b pb-2">
        <button
          className={`pb-2 font-semibold ${
            activeTab === 'online' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500'
          }`}
          onClick={() => handleTabChange('online')}
        >
          Online Customers ({onlineCustomers.length})
        </button>
        <button
          className={`pb-2 font-semibold ${
            activeTab === 'walking' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500'
          }`}
          onClick={() => handleTabChange('walking')}
        >
          Walking Customers ({walkingCustomers.length})
        </button>
        <button
          className={`pb-2 font-semibold ${
            activeTab === 'credit' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500'
          }`}
          onClick={() => handleTabChange('credit')}
        >
          Credit Customers ({creditSummary.list.length})
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-1/3">
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-medium text-gray-600">Filter By Date:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 border rounded-lg text-sm"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 border rounded-lg text-sm"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-red-500 text-xs underline px-2 py-1"
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">Name</th>
              <th className="p-3">Mobile Number</th>
              {activeTab === 'credit' ? (
                <>
                  <th className="p-3">Total Credit Balance</th>
                  <th className="p-3">Overdue Status (&gt;30 Days)</th>
                  <th className="p-3">Actions</th>
                </>
              ) : (
                <>
                  <th className="p-3">{activeTab === 'online' ? 'Email' : 'Address / Type'}</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Actions</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center p-6 text-gray-500">
                  Loading customers...
                </td>
              </tr>
            ) : paginatedCustomers.length > 0 ? (
              paginatedCustomers.map((cust, index) => (
                <tr key={cust.id || cust.phone || index} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{cust.name || 'N/A'}</td>
                  <td className="p-3">{cust.phone || cust.mobile || 'N/A'}</td>
                  {activeTab === 'credit' ? (
                    <>
                      <td className="p-3 font-bold text-amber-700">{money(cust.totalCredit)}</td>
                      <td className="p-3">
                        {cust.overdueBalance > 0 ? (
                          <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs font-bold inline-flex items-center gap-1">
                            ⚠️ Overdue: {money(cust.overdueBalance)} ({cust.oldestOrderDays} days)
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">
                            Current (&lt; 30 days)
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleEditClick(cust)}
                          className="text-blue-600 hover:underline text-sm font-semibold"
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3">
                        {activeTab === 'online' ? cust.email || 'N/A' : cust.address || 'Walking Customer'}
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {cust.created_at ? cust.created_at.split('T')[0] : 'N/A'}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleEditClick(cust)}
                          className="text-blue-600 hover:underline text-sm font-semibold"
                        >
                          Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center p-6 text-gray-500">
                  No customers found matching your search/filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredCustomers.length > itemsPerPage && (
        <div className="flex justify-between items-center mt-4 bg-white p-4 rounded-lg shadow">
          <span className="text-sm text-gray-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} entries
          </span>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className={`px-3 py-1 rounded border ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-purple-600 hover:bg-purple-50'
              }`}
            >
              Previous
            </button>
            <span className="px-3 py-1 font-semibold text-sm flex items-center">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className={`px-3 py-1 rounded border ${
                currentPage === totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-purple-600 hover:bg-purple-50'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4">Edit Customer</h2>
            <form onSubmit={handleUpdateSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingCustomer.name || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={editingCustomer.phone || editingCustomer.mobile || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {activeTab === 'online' ? 'Email' : 'Address'}
                </label>
                <input
                  type="text"
                  value={activeTab === 'online' ? editingCustomer.email || '' : editingCustomer.address || ''}
                  onChange={(e) =>
                    setEditingCustomer({
                      ...editingCustomer,
                      [activeTab === 'online' ? 'email' : 'address']: e.target.value
                    })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}