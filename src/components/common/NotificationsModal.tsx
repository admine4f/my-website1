import React, { useEffect } from 'react';
import { X, Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NotificationsModalProps {
  onClose: () => void;
}

const timeAgo = (ts: number): string => {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ onClose }) => {
  const { notifications, markAllNotificationsRead } = useApp();
  const hadUnread = React.useRef(notifications.filter(n => !n.read).map(n => n.id));

  // Opening the list marks everything as read (the dot on the bell goes away)
  useEffect(() => {
    markAllNotificationsRead();
  }, [markAllNotificationsRead]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-[#0C1326] border border-slate-700 rounded-3xl p-6 text-slate-200 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          <span>Notifications</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">Your latest updates</p>

        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-[11px] text-slate-500 text-center py-6">No notifications yet.</div>
          ) : (
            notifications.map(n => (
              <div key={n.id} className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {hadUnread.current.includes(n.id) && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                    <span className="text-xs font-bold text-white truncate">{n.title}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 shrink-0">{timeAgo(n.timestamp)}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug mt-1">{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
