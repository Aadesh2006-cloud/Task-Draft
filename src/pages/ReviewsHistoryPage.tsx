import React, { useEffect, useState } from 'react';
import { Flag, Star } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link } from '../lib/router';

interface ReviewEntry {
  id: number;
  projectId: number;
  projectTitle: string;
  reviewerName?: string;
  revieweeName?: string;
  reviewerRole: string;
  ratingOverall: number;
  ratingCommunication: number;
  ratingQuality: number;
  ratingReliability: number;
  ratingProfessionalism: number;
  comment: string;
  createdAt: string;
}

export function ReviewsHistoryPage() {
  const { account } = useAuth();
  const [received, setReceived] = useState<ReviewEntry[]>([]);
  const [given, setGiven] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }
    apiRequest<{ received: ReviewEntry[]; given: ReviewEntry[] }>('/api/reviews')
      .then((d) => {
        setReceived(d.received);
        setGiven(d.given);
      })
      .finally(() => setLoading(false));
  }, [account]);

  const flagReview = async (reviewId: number) => {
    await apiRequest('/api/reports', {
      method: 'POST',
      body: {
        targetType: 'review',
        targetId: reviewId,
        reason: 'Abusive or fraudulent review flagged by user',
        details: 'Requested moderation audit on published platform review.',
      },
    });
    setNotice('Review flagged for admin moderation.');
  };

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#101828]">Sign in to view your reviews</h1>
        <Link to="/auth" className="mt-5 inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#101828]">Verified Reviews &amp; Reputation</h1>
        <p className="mt-1 text-sm text-[#475467]">
          Reviews are unlocked only after a project workspace is marked completed, and duplicate submissions are blocked.
        </p>
      </div>

      {notice && (
        <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-sm text-[#15803D]">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="h-44 bg-white border border-[#E4E7EC] rounded-xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#101828]">Reviews You Received ({received.length})</h2>
            {received.length === 0 ? (
              <p className="text-sm text-[#667085]">No reviews received yet.</p>
            ) : (
              received.map((r) => (
                <article key={r.id} className="pb-4 border-b border-[#F2F4F7] last:border-b-0 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#101828]">{r.reviewerName} · {r.projectTitle}</span>
                    <span className="font-mono font-semibold text-[#1E40AF] inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-current" /> {r.ratingOverall}/5
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#667085]">
                    Comm {r.ratingCommunication} · Quality {r.ratingQuality} · Reliability {r.ratingReliability} · Professionalism {r.ratingProfessionalism}
                  </p>
                  <p className="text-sm text-[#344054]">{r.comment}</p>
                  <button
                    type="button"
                    onClick={() => flagReview(r.id)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#667085] hover:text-[#B91C1C]"
                  >
                    <Flag className="w-3 h-3" /> Report review
                  </button>
                </article>
              ))
            )}
          </section>

          <section className="bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#101828]">Reviews You Wrote ({given.length})</h2>
            {given.length === 0 ? (
              <p className="text-sm text-[#667085]">You haven&apos;t published any reviews yet.</p>
            ) : (
              given.map((r) => (
                <article key={r.id} className="pb-4 border-b border-[#F2F4F7] last:border-b-0 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#101828]">For {r.revieweeName} · {r.projectTitle}</span>
                    <span className="font-mono font-semibold text-[#1E40AF] inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-current" /> {r.ratingOverall}/5
                    </span>
                  </div>
                  <p className="text-sm text-[#344054]">{r.comment}</p>
                </article>
              ))
            )}
          </section>
        </div>
      )}
    </div>
  );
}
