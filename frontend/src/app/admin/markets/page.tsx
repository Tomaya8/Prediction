'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, Check, X, Edit, Trash2 } from 'lucide-react';

interface Market {
  id: string;
  title: string;
  category: string;
  status: 'open' | 'resolved' | 'cancelled';
  totalVolume: number;
  outcomes: { id: string; name: string; price: number }[];
  expiresAt: string;
  createdAt: string;
}

const categories = ['All', 'Politics', 'Sports', 'Crypto', 'Entertainment', 'Science'];

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // Simulated data - replace with actual Firebase queries
    const fetchMarkets = async () => {
      setMarkets([
        { id: '1', title: 'Will Bitcoin exceed $100k by Dec 2024?', category: 'Crypto', status: 'open', totalVolume: 25000, outcomes: [{ id: 'yes', name: 'Yes', price: 0.65 }, { id: 'no', name: 'No', price: 0.35 }], expiresAt: '2024-12-31', createdAt: '2024-01-15' },
        { id: '2', title: 'Will Trump win the 2024 Presidential Election?', category: 'Politics', status: 'open', totalVolume: 52000, outcomes: [{ id: 'yes', name: 'Yes', price: 0.52 }, { id: 'no', name: 'No', price: 0.48 }], expiresAt: '2024-11-05', createdAt: '2024-01-20' },
        { id: '3', title: 'Will ETH hit $5k in 2024?', category: 'Crypto', status: 'open', totalVolume: 18000, outcomes: [{ id: 'yes', name: 'Yes', price: 0.42 }, { id: 'no', name: 'No', price: 0.58 }], expiresAt: '2024-12-31', createdAt: '2024-02-01' },
        { id: '4', title: 'Will Taylor Swift announce retirement?', category: 'Entertainment', status: 'resolved', totalVolume: 8500, outcomes: [{ id: 'yes', name: 'Yes', price: 0.15 }, { id: 'no', name: 'No', price: 0.85 }], expiresAt: '2024-12-31', createdAt: '2024-01-10' },
        { id: '5', title: 'Will SpaceX land on Mars by 2025?', category: 'Science', status: 'open', totalVolume: 12000, outcomes: [{ id: 'yes', name: 'Yes', price: 0.25 }, { id: 'no', name: 'No', price: 0.75 }], expiresAt: '2025-12-31', createdAt: '2024-02-10' },
      ]);
      setLoading(false);
    };
    fetchMarkets();
  }, []);

  const filteredMarkets = markets.filter(market => {
    const matchesSearch = market.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || market.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-green-100 text-green-800',
      resolved: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status as keyof typeof styles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return <div className="text-gray-500">Loading markets...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Markets</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Plus size={20} />
          Create Market
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search markets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Markets Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredMarkets.map((market) => (
          <div key={market.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{market.title}</h3>
                <p className="text-sm text-gray-500 mt-1">Category: {market.category}</p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(market.status)}
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">Outcomes:</p>
              <div className="flex gap-4">
                {market.outcomes.map((outcome) => (
                  <div key={outcome.id} className="flex-1 bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900">{outcome.name}</span>
                      <span className="text-sm text-gray-600">{(outcome.price * 100).toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full" 
                        style={{ width: `${outcome.price * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Volume: <span className="font-semibold text-gray-900">${market.totalVolume.toLocaleString()}</span>
              </span>
              <span className="text-sm text-gray-500">
                Expires: {market.expiresAt}
              </span>
            </div>

            {/* Actions for open markets */}
            {market.status === 'open' && (
              <div className="flex gap-2 mt-4">
                <button className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                  <Edit size={16} />
                  Edit
                </button>
                <button className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800">
                  <Check size={16} />
                  Resolve
                </button>
                <button className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800">
                  <X size={16} />
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Market Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Market</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Will Bitcoin exceed $100k?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {categories.slice(1).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Describe the market resolution criteria..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Market
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
