'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Check, X } from 'lucide-react';
import { api } from '../../../lib/api-client';

interface Market {
  id: string;
  title: string;
  category: string;
  status: string;
  totalVolume: number;
  outcomes: { id: string; name: string; currentPrice?: number }[];
  expiresAt: string;
  createdAt: string;
}

interface CreateForm {
  title: string;
  description: string;
  category: string;
  expiresAt: string;
}

const categories = ['All', 'POLITICS', 'SPORTS', 'CRYPTO', 'ENTERTAINMENT', 'SCIENCE'];

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ title: '', description: '', category: 'CRYPTO', expiresAt: '' });
  const [creating, setCreating] = useState(false);
  const [resolveModal, setResolveModal] = useState<Market | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (categoryFilter !== 'All') params.category = categoryFilter;
      const res = await api.getMarkets(params);
      if (res.success && res.data) setMarkets(res.data);
    } catch (err) {
      console.error('Failed to fetch markets:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title || !createForm.expiresAt) return;
    setCreating(true);
    const res = await api.createMarket({
      ...createForm,
      outcomes: [{ name: 'Yes' }, { name: 'No' }],
    });
    setCreating(false);
    if (res.success) {
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', category: 'CRYPTO', expiresAt: '' });
      fetchMarkets();
    } else {
      alert(res.error || 'Failed to create market');
    }
  };

  const handleResolve = async (outcomeId: string) => {
    if (!resolveModal) return;
    const res = await api.resolveMarket(resolveModal.id, outcomeId);
    if (res.success) {
      setResolveModal(null);
      fetchMarkets();
    } else {
      alert(res.error || 'Failed to resolve market');
    }
  };

  const handleCancel = async (market: Market) => {
    if (!window.confirm(`Cancel market "${market.title}"?`)) return;
    const res = await api.cancelMarket(market.id);
    if (res.success) fetchMarkets();
    else alert(res.error || 'Failed to cancel market');
  };


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
        {markets.filter(m => {
          const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesCategory = categoryFilter === 'All' || m.category === categoryFilter;
          return matchesSearch && matchesCategory;
        }).map((market) => (
          <div key={market.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{market.title}</h3>
                <p className="text-sm text-gray-500 mt-1">Category: {market.category}</p>
              </div>
              {getStatusBadge(market.status)}
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">Outcomes:</p>
              <div className="flex gap-4">
                {market.outcomes.map((outcome) => {
                  const price = outcome.currentPrice ?? 0;
                  return (
                    <div key={outcome.id} className="flex-1 bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">{outcome.name}</span>
                        <span className="text-sm text-gray-600">{(price * 100).toFixed(0)}%</span>
                      </div>
                      <div className="mt-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${price * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Volume: <span className="font-semibold text-gray-900">{market.totalVolume.toLocaleString()} credits</span>
              </span>
              <span className="text-sm text-gray-500">
                Expires: {market.expiresAt ? new Date(market.expiresAt).toLocaleDateString() : '—'}
              </span>
            </div>

            {market.status === 'ACTIVE' && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setResolveModal(market)}
                  className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800"
                >
                  <Check size={16} />
                  Resolve
                </button>
                <button
                  onClick={() => handleCancel(market)}
                  className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                >
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
            <form onSubmit={handleCreateMarket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Will Bitcoin exceed $100k?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {categories.slice(1).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Describe the market resolution criteria..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
                <input
                  type="date"
                  required
                  value={createForm.expiresAt}
                  onChange={(e) => setCreateForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-sm text-gray-500">Outcomes: Yes / No (default binary market)</p>
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
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Market'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Resolve Market</h2>
            <p className="text-sm text-gray-600 mb-4">{resolveModal.title}</p>
            <p className="text-sm font-medium text-gray-700 mb-3">Select winning outcome:</p>
            <div className="space-y-2">
              {resolveModal.outcomes.map((outcome) => (
                <button
                  key={outcome.id}
                  onClick={() => handleResolve(outcome.id)}
                  className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-400 text-sm font-medium"
                >
                  {outcome.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setResolveModal(null)}
              className="mt-4 w-full text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
