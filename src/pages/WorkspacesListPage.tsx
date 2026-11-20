import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link } from '../lib/router';
import { StatusText } from '../components/Layout';
import { formatCurrency } from '../utils/domain';

interface WorkspaceListItem {
  id: number;
  projectTitle: string;
  status: string;
  agreedPrice: number;
  currency: string;
  deadline: string;
  updatedAt: string;
}

export function WorkspacesListPage() {
  const { account } = useAuth();
  const [items, setItems] = useState<WorkspaceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }
    apiRequest<WorkspaceListItem[]>('/api/workspaces')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [account]);

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <Lock className="w-8 h-8 text-[#1E40AF] mx-auto mb-3" />
        <h1 className="font-display text-2xl font-bold text-[#101828]">Your Private Project Workspaces</h1>
        <p className="mt-2 text-sm text-[#475467]">Sign in to access project rooms where you are an authorized client or hired freelancer.</p>
        <Link to="/auth" className="mt-5 inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#101828]">Private Project Workspaces</h1>
        <p className="mt-1 text-sm text-[#475467]">
          Only projects where you are the client, hired specialist, or an authorized admin appear here.
        </p>
      </div>

      {loading ? (
        <div className="h-40 bg-white border border-[#E4E7EC] rounded-xl animate-pulse" />
      ) : items.length === 0 ? (
        <div className="bg-white border border-[#E4E7EC] rounded-xl p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-[#101828]">No active workspaces yet</h2>
          <p className="mt-1 text-sm text-[#475467]">
            Workspaces are created automatically once a client and freelancer both accept contract terms.
          </p>
          <Link to="/marketplace" className="mt-4 inline-block px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg">
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((ws) => (
            <div
              key={ws.id}
              className="bg-white border border-[#E4E7EC] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <p className="text-xs text-[#667085] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#1E40AF]" /> Workspace #{ws.id} · <StatusText status={ws.status} /> · Due{' '}
                  <span className="font-mono">{ws.deadline || 'TBD'}</span>
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-[#101828]">{ws.projectTitle}</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono tabular-nums text-base font-semibold text-[#101828]">
                  {formatCurrency(ws.agreedPrice, ws.currency)}
                </span>
                <Link
                  to={`/workspace/${ws.id}`}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg whitespace-nowrap"
                >
                  Open Project Room
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
