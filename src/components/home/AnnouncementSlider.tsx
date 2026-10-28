import React, { useState, useEffect } from 'react';
import { ChevronRight, Megaphone, X } from 'lucide-react';
import { Announcement } from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

export const AnnouncementSlider: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const { setActiveTab, openModal } = useApp();

  useEffect(() => {
    api
      .getAnnouncements()
      .then(res => {
        if (res.announcements && res.announcements.length > 0) {
          setAnnouncements(res.announcements);
        }
      })
      .catch(() => {});
  }, []);

  // 5-second auto-rotation (Section 13)
  useEffect(() => {
    if (announcements.length <= 1 || detailOpen) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [announcements.length, detailOpen]);

  if (announcements.length === 0) return null;

  const current = announcements[currentIndex];

  const url = (current.ctaUrl || '').trim();
  const isInternal = url.startsWith('#');
  const isExternal = /^https?:\/\//i.test(url);
  const internalLabel: Record<string, string> = {
    '#mining': 'Open Mining',
    '#wallet': 'Open Wallet',
    '#referral': 'Open Referral',
    '#rewards': 'Open Rewards',
    '#tasks': 'Open Tasks',
    '#support': 'Open Support',
  };

  // Tapping the button first shows the full announcement (never jumps to another page by itself).
  const handleCta = () => setDetailOpen(true);

  const goToTarget = () => {
    setDetailOpen(false);
    if (url === '#mining') setActiveTab('mining');
    else if (url === '#wallet') setActiveTab('wallet');
    else if (url === '#referral') openModal('REFERRAL');
    else if (url === '#rewards') openModal('REWARDS');
    else if (url === '#tasks') openModal('TASKS');
    else if (url === '#support') openModal('SUPPORT');
    else if (isExternal) {
      const tg = (window as any).Telegram?.WebApp;
      try {
        if (/^https?:\/\/t\.me\//i.test(url) && tg?.openTelegramLink) tg.openTelegramLink(url);
        else if (tg?.openLink) tg.openLink(url);
        else window.open(url, '_blank', 'noopener');
      } catch {
        window.open(url, '_blank', 'noopener');
      }
    }
  };

  const showAction = (isInternal && !!internalLabel[url]) || isExternal;
  const actionLabel = isInternal ? internalLabel[url] : 'Open Link';

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-r from-[#0C152B] via-[#0F1B38] to-[#0A1024] border border-slate-800/80 p-4 shadow-lg">
      {/* Background Subtle Accent Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400">
              <Megaphone className="w-3 h-3" />
            </span>
            <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase">
              Official Announcement
            </span>
          </div>

          <h3 className="text-sm font-bold text-white mb-1 line-clamp-1">
            {current.title}
          </h3>
          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-3">
            {current.description}
          </p>

          <button
            onClick={handleCta}
            className="inline-flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 group"
          >
            <span>{current.ctaText || 'Learn More'}</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Banner Thumbnail */}
        {current.imageUrl && (
          <div className="w-24 h-20 rounded-xl overflow-hidden bg-slate-900/90 flex-shrink-0 border border-slate-700/60 shadow-inner">
            <img
              src={current.imageUrl}
              alt={current.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>

      {/* Full announcement details */}
      {detailOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto bg-[#0C1326] border border-amber-500/30 rounded-3xl p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setDetailOpen(false)}
              title="Close"
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 mb-2 pr-8">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400">
                <Megaphone className="w-3 h-3" />
              </span>
              <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase">Official Announcement</span>
            </div>
            {current.imageUrl && (
              <img
                src={current.imageUrl}
                alt={current.title}
                className="w-full rounded-2xl border border-slate-700/60 mb-3 object-cover"
                referrerPolicy="no-referrer"
              />
            )}
            <h3 className="text-base font-black text-white mb-2 leading-snug">{current.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line break-words">{current.description}</p>
            <div className="mt-4 flex gap-2">
              {showAction && (
                <button
                  onClick={goToTarget}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs cursor-pointer active:scale-95"
                >
                  {actionLabel}
                </button>
              )}
              <button
                onClick={() => setDetailOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs cursor-pointer active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dots navigation */}
      {announcements.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {announcements.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-slate-700 hover:bg-slate-600'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
