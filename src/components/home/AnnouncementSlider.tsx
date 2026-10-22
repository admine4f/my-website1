import React, { useState, useEffect } from 'react';
import { ChevronRight, Megaphone } from 'lucide-react';
import { Announcement } from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

export const AnnouncementSlider: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
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
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [announcements.length]);

  if (announcements.length === 0) return null;

  const current = announcements[currentIndex];

  const handleCta = () => {
    if (current.ctaUrl === '#mining') setActiveTab('mining');
    else if (current.ctaUrl === '#wallet') setActiveTab('wallet');
    else if (current.ctaUrl === '#referral') openModal('REFERRAL');
    else if (current.ctaUrl === '#rewards') openModal('REWARDS');
    else setActiveTab('mining');
  };

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
