import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Check, MessageSquare } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { Link } from '../lib/router';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  linkPath: string;
  isRead: boolean;
  createdAt: string;
}

interface DirectMessageItem {
  id: number;
  body: string;
  senderId: number;
  recipientId: number;
  createdAt: string;
  sender: { id: number; name: string } | null;
  recipient: { id: number; name: string } | null;
}

export function InboxNotificationsPage() {
  const { account, refreshAccount } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!account) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [n, m] = await Promise.all([
        apiRequest<NotificationItem[]>('/api/notifications'),
        apiRequest<DirectMessageItem[]>('/api/messages'),
      ]);
      setNotifications(n);
      setMessages(m);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    await apiRequest('/api/notifications/read', { method: 'PATCH', body: {} });
    await refreshAccount();
    await load();
  };

  if (!account) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#101828]">Sign in to view notifications &amp; messages</h1>
        <Link to="/auth" className="mt-5 inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] rounded-lg">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#101828]">Notifications &amp; Direct Messages</h1>
          <p className="mt-1 text-sm text-[#475467]">Stay ahead of proposal updates, milestone reviews, and pre-hire inquiries.</p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#101828] bg-white border border-[#D0D5DD] hover:bg-[#F8F9FB] rounded-lg"
        >
          <Check className="w-3.5 h-3.5" /> Mark All Read
        </button>
      </div>

      {loading ? (
        <div className="h-48 bg-white border border-[#E4E7EC] rounded-xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#101828] flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#1E40AF]" /> Activity Notifications
            </h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-[#667085]">You&apos;re all caught up.</p>
            ) : (
              <div className="divide-y divide-[#F2F4F7]">
                {notifications.map((n) => (
                  <div key={n.id} className={`py-3.5 flex items-start justify-between gap-4 ${n.isRead ? 'opacity-75' : ''}`}>
                    <div>
                      <p className="text-sm font-semibold text-[#101828]">{n.title}</p>
                      <p className="text-xs text-[#475467] mt-0.5">{n.body}</p>
                      <p className="text-[11px] text-[#667085] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    <Link to={n.linkPath} className="text-xs font-semibold text-[#1E40AF] hover:underline whitespace-nowrap">
                      Open →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-5 bg-white border border-[#E4E7EC] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#101828] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#1E40AF]" /> Direct Pre-Hire Messages
            </h2>
            {messages.length === 0 ? (
              <p className="text-sm text-[#667085]">No direct pre-hire messages yet. Active project chats live inside each private workspace.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className="p-3.5 rounded-lg bg-[#F8F9FB] border border-[#E4E7EC] text-xs space-y-1">
                    <p className="font-semibold text-[#101828]">
                      {m.sender?.name} → {m.recipient?.name}
                    </p>
                    <p className="text-[#344054]">{m.body}</p>
                    <p className="text-[11px] text-[#667085]">{new Date(m.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
