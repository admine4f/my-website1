import React, { useRef } from 'react';
import { Bell, Headphones, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopBar: React.FC = () => {
  const { openModal, notifications } = useApp();
  const unreadCount = notifications.filter(n => !n.read).length;

  // Secret Admin Access via 5 taps on Logo within 3 seconds
  const tapCountRef = useRef<number>(0);
  const tapTimerRef = useRef<any>(null);

  const handleLogoTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      openModal('ADMIN');
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 3000);
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-[#070B14]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Logo & Brand */}
        <div
          onClick={handleLogoTap}
          className="flex items-center gap-2.5 cursor-pointer select-none"
          title="E4F Web3 Exchange"
        >
          <div className="relative w-8 h-8 rounded-full overflow-hidden p-0.5 bg-gradient-to-tr from-amber-500 via-amber-300 to-sky-400 shadow-[0_0_12px_rgba(245,158,11,0.35)]">
            <img
              src="/e4f_coin.jpg"
              alt="E4F Web3 Exchange"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-amber-300 via-amber-100 to-sky-300 bg-clip-text text-transparent">
                E4F
              </span>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Web3 Exchange
              </span>
            </div>
          </div>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1.5">
          {/* Support */}
          <button
            onClick={() => openModal('SUPPORT')}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
            title="Support"
          >
            <Headphones className="w-4 h-4 text-slate-300" />
          </button>

          {/* Notifications */}
          <button
            onClick={() => openModal('NOTIFICATIONS')}
            className="relative p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-[#070B14]" />
            )}
          </button>

          {/* Profile Button with Man Icon */}
          <button
            onClick={() => openModal('PROFILE')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-800 transition-all cursor-pointer"
            title="Profile"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-sky-400 flex items-center justify-center text-slate-950">
              <User className="w-3.5 h-3.5 text-slate-950" />
            </div>
            <span className="text-xs font-semibold text-slate-200">
              Profile
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
