import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link, useRouter } from '../lib/router';
import { formatCurrency } from '../utils/domain';

interface ContractPayload {
  contract: {
    id: number;
    projectId: number;
    buyerId: number;
    sellerId: number;
    agreedScope: string;
    agreedDeliverables: string[];
    agreedPrice: number;
    pricingType: string;
    currency: string;
    deadline: string;
    revisionPolicy: string;
    responsibilities: string;
    buyerAcceptedAt: string | null;
    sellerAcceptedAt: string | null;
    status: string;
  };
  projectTitle: string;
  milestonePlan: Array<{ title: string; deliverables: string; amount: number }>;
  buyer: { id: number; name: string; email: string } | null;
  seller: { id: number; name: string; email: string } | null;
  workspaceId: number | null;
}

export function ContractAgreementPage({ contractId }: { contractId: number }) {
  const { account } = useAuth();
  const { navigate } = useRouter();
  const [data, setData] = useState<ContractPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreedCheck, setAgreedCheck] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<ContractPayload>(`/api/contracts/${contractId}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load project agreement.');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-12 text-sm text-[#475467]">Loading agreement...</div>;
  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#101828]">Agreement unavailable</h1>
        <p className="mt-2 text-sm text-[#B91C1C]">{error}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-[#1E40AF] underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const { contract, projectTitle, milestonePlan, buyer, seller, workspaceId } = data;
  const isBuyer = account?.user.id === contract.buyerId;
  const isSeller = account?.user.id === contract.sellerId;
  const alreadyAccepted = (isBuyer && Boolean(contract.buyerAcceptedAt)) || (isSeller && Boolean(contract.sellerAcceptedAt));

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await apiRequest<{ workspace: { id: number } | null }>(`/api/contracts/${contractId}/accept`, {
        method: 'POST',
      });
      if (res.workspace) {
        navigate(`/workspace/${res.workspace.id}`);
      } else {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acceptance failed.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div>
        <p className="text-xs font-medium text-[#1E40AF]">Hiring &amp; Project Agreement</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#101828]">{projectTitle}</h1>
        <p className="mt-1 text-sm text-[#475467]">
          Both client and freelancer must accept these terms before the contract becomes active and the private workspace opens.
        </p>
      </div>

      <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-[#E4E7EC] text-sm">
          <div>
            <p className="text-xs text-[#667085]">Agreed Price</p>
            <p className="font-mono tabular-nums text-xl font-bold text-[#101828] mt-1">
              {formatCurrency(contract.agreedPrice, contract.currency)}
            </p>
            <p className="text-xs text-[#667085] capitalize">{contract.pricingType} agreement</p>
          </div>
          <div>
            <p className="text-xs text-[#667085]">Target Deadline</p>
            <p className="font-mono text-base font-semibold text-[#101828] mt-1">{contract.deadline || 'Per milestones'}</p>
          </div>
          <div>
            <p className="text-xs text-[#667085]">Agreement Status</p>
            <p className="text-base font-semibold text-[#101828] mt-1 capitalize">{contract.status.replace('_', ' ')}</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-[#344054]">
          <div>
            <h2 className="font-semibold text-[#101828]">Agreed Scope</h2>
            <p className="mt-1 leading-relaxed whitespace-pre-line">{contract.agreedScope}</p>
          </div>

          {contract.agreedDeliverables.length > 0 && (
            <div>
              <h2 className="font-semibold text-[#101828]">Deliverables</h2>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                {contract.agreedDeliverables.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {milestonePlan.length > 0 && (
            <div>
              <h2 className="font-semibold text-[#101828]">Scheduled Milestones</h2>
              <div className="mt-2 divide-y divide-[#F2F4F7] border border-[#E4E7EC] rounded-lg">
                {milestonePlan.map((m, i) => (
                  <div key={i} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-[#101828]">{m.title}</p>
                      <p className="text-[#475467]">{m.deliverables}</p>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-[#101828]">
                      {formatCurrency(m.amount, contract.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E4E7EC]">
            <div>
              <h2 className="font-semibold text-[#101828]">Revision Policy</h2>
              <p className="mt-1 text-xs text-[#475467]">{contract.revisionPolicy}</p>
            </div>
            <div>
              <h2 className="font-semibold text-[#101828]">Responsibilities</h2>
              <p className="mt-1 text-xs text-[#475467]">{contract.responsibilities}</p>
            </div>
          </div>
        </div>

        {/* Dual-Party Acceptance Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 border-t border-[#E4E7EC]">
          <div className="p-4 rounded-lg bg-[#F8F9FB] border border-[#E4E7EC] text-xs">
            <p className="text-[#667085]">Client / Buyer</p>
            <p className="font-semibold text-[#101828] text-sm mt-0.5">{buyer?.name}</p>
            <p className={`mt-2 flex items-center gap-1.5 font-medium ${contract.buyerAcceptedAt ? 'text-[#15803D]' : 'text-[#B45309]'}`}>
              <CheckCircle2 className="w-4 h-4" />
              {contract.buyerAcceptedAt
                ? `Accepted on ${new Date(contract.buyerAcceptedAt).toLocaleDateString()}`
                : 'Awaiting buyer acceptance'}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[#F8F9FB] border border-[#E4E7EC] text-xs">
            <p className="text-[#667085]">Freelancer / Seller</p>
            <p className="font-semibold text-[#101828] text-sm mt-0.5">{seller?.name}</p>
            <p className={`mt-2 flex items-center gap-1.5 font-medium ${contract.sellerAcceptedAt ? 'text-[#15803D]' : 'text-[#B45309]'}`}>
              <CheckCircle2 className="w-4 h-4" />
              {contract.sellerAcceptedAt
                ? `Accepted on ${new Date(contract.sellerAcceptedAt).toLocaleDateString()}`
                : 'Awaiting freelancer acceptance'}
            </p>
          </div>
        </div>

        {workspaceId ? (
          <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm font-medium text-[#15803D] flex items-center gap-2">
              <Lock className="w-4 h-4" /> Both parties accepted. Your private project workspace is ready.
            </p>
            <Link
              to={`/workspace/${workspaceId}`}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg whitespace-nowrap"
            >
              Enter Private Workspace
            </Link>
          </div>
        ) : (isBuyer || isSeller) && !alreadyAccepted ? (
          <div className="pt-4 border-t border-[#E4E7EC] space-y-4">
            <label className="flex items-start gap-2.5 text-sm text-[#101828]">
              <input
                type="checkbox"
                checked={agreedCheck}
                onChange={(e) => setAgreedCheck(e.target.checked)}
                className="mt-1"
              />
              <span>
                I accept the agreed scope, deliverables, price, revision policy, and responsibilities outlined above and confirm activation of the private workspace.
              </span>
            </label>
            <button
              type="button"
              disabled={!agreedCheck || accepting}
              onClick={handleAccept}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] disabled:opacity-50 rounded-lg"
            >
              {accepting ? 'Activating Workspace...' : 'Accept Terms & Activate Project'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-[#475467]">
            You have accepted these terms. Waiting for the other party to confirm before the private workspace activates.
          </p>
        )}
      </div>
    </div>
  );
}
