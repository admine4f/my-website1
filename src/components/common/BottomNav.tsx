import React from 'react';
import { Home, Pickaxe, BarChart3, ArrowLeftRight, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ScreenTab } from '../../types';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems: Array<{ id: ScreenTab; label: string; icon: React.ElementType }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'mining', label: 'Mining', icon: Pickaxe },
    { id: 'market', label: 'Market', icon: BarChart3 },
    { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0A0F1D]/95 backdrop-blur-lg border-t border-slate-800/90 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5">
      <div className="max-w-md mx-auto grid grid-cols-5 px-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 relative transition-all duration-200 ${
                isActive ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              {isActive && (
                <div className="absolute -top-1.5 w-8 h-1 rounded-full bg-gradient-to-r from-amber-400 to-sky-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              )}
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-amber-400/10' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-400 scale-105' : 'text-slate-400'}`} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
