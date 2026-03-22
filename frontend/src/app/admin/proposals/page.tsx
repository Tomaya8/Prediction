'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, X, ArrowUp, RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api-client';

interface Proposal {
  id: string;
  title: string;
  description?: string;
  category: string;
  outcomes: string[];
  suggestedExpiry: string;
  resolutionCriteria?: string;
  sourceUrl?: string;
  upvotes: number;
  status: string;
  adminNotes?: string;
  createdBy: { id: string; displayName: string };
  createdAt: string;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    const res = await api.getProposals(statusFilter);
    if (res.success && res.data) setProposals(res.data);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const handleApprove = async (id: string) => {
    if (!window.confirm('Approve this proposal? A live market will be created and the proposer will earn 50 credits.')) return;
    setActionLoading(id);
    const res = await api.approveProposal(id);
    if (res.success) fetchProposals();
    else alert(res.error || 'Failed to approve');
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    const notes = rejectNotes[id] || '';
    if (!window.confirm(`Reject this proposal?${notes ? `\n\nReason: ${notes}` : ''}`)) return;
    setActionLoading(id);
    const res = await api.rejectProposal(id, notes);
    if (res.success) fetchProposals();
    else alert(res.error || 'Failed to reject');
    setActionLoading(null);
  };

  if (loading) {
    return <div className="text-gray-500">Loading proposals...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Market Proposals</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setSyncing(true);
              setSyncResult(null);
              const res = await api.syncMarkets();
              setSyncing(false);
              if (res.success && res.data) {
                setSyncResult(`Synced: ${res.data.polymarket} from Polymarket, ${res.data.manifold} from Manifold (${res.data.skipped} skipped)`);
                fetchProposals();
              } else {
                setSyncResult('Sync failed: ' + (res.error || 'Unknown error'));
              }
            }}
            disabled={syncing}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync from Polymarket'}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${syncResult.startsWith('Sync failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {syncResult}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div />
        <div className="flex gap-2">
          {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No {statusFilter.toLowerCase()} proposals</p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map(proposal => (
            <div key={proposal.id} className="bg-white rounded-lg shadow p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                      {proposal.category}
                    </span>
                    <div className="flex items-center gap-1 text-gray-500">
                      <ArrowUp size={14} />
                      <span className="text-sm font-semibold">{proposal.upvotes} votes</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      by {proposal.createdBy.displayName || 'Anonymous'}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{proposal.title}</h3>
                </div>
              </div>

              {/* Details */}
              {proposal.description && (
                <p className="text-sm text-gray-600 mb-3">{proposal.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                <span>Outcomes: <strong>{proposal.outcomes.join(', ')}</strong></span>
                <span>Expires: <strong>{new Date(proposal.suggestedExpiry).toLocaleDateString()}</strong></span>
                {proposal.resolutionCriteria && (
                  <span>Resolution: <strong>{proposal.resolutionCriteria}</strong></span>
                )}
              </div>

              <p className="text-xs text-gray-400 mb-4">
                Submitted {new Date(proposal.createdAt).toLocaleDateString()}
              </p>

              {/* Admin Notes for rejected */}
              {proposal.status === 'REJECTED' && proposal.adminNotes && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700"><strong>Rejection reason:</strong> {proposal.adminNotes}</p>
                </div>
              )}

              {proposal.status === 'APPROVED' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-700">Market created. Proposer earned 50 credits.</p>
                </div>
              )}

              {/* Actions (only for pending) */}
              {proposal.status === 'PENDING' && (
                <div className="flex items-end gap-4 pt-4 border-t border-gray-100">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Rejection reason (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Duplicate, too vague, not verifiable..."
                      value={rejectNotes[proposal.id] || ''}
                      onChange={e => setRejectNotes(prev => ({ ...prev, [proposal.id]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    onClick={() => handleReject(proposal.id)}
                    disabled={actionLoading === proposal.id}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm font-medium"
                  >
                    <X size={16} />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(proposal.id)}
                    disabled={actionLoading === proposal.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <Check size={16} />
                    Approve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
