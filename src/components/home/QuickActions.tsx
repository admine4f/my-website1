import React from 'react';
import { Pickaxe, BarChart3, ArrowLeftRight, Wallet, CheckSquare, Gift, Users, Headphones, Disc, Package, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const QuickActions: React.FC = () => {
  const { setActiveTab, openModal } = useApp();

  const actions = [
    {
      id: 'mining',
      name: 'Mining',
      icon: Pickaxe,
      color: 'from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/30',
      badge: '8H',
      onClick: () => setActiveTab('mining'),
    },
    {
      id: 'gift_boxes',
      name: 'Gift Box',
      icon: Package,
      color: 'from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/30',
      badge: '5 Boxes',
      onClick: () => openModal('GIFT_BOXES'),
    },
    {
      id: 'spin',
      name: 'Spin',
      icon: Disc,
      color: 'from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/30',
      badge: 'Win',
      onClick: () => openModal('SPIN'),
    },
    {
      id: 'rewards',
      name: 'Daily check in',
      icon: Calendar,
      color: 'from-pink-500/20 to-pink-600/10 text-pink-400 border-pink-500/30',
      badge: 'Daily',
      onClick: () => openModal('REWARDS'),
    },
    {
      id: 'tasks',
      name: 'Tasks',
      icon: CheckSquare,
      color: 'from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/30',
      badge: 'Earn',
      onClick: () => openModal('TASKS'),
    },
    {
      id: 'market',
      name: 'Market',
      icon: BarChart3,
      color: 'from-sky-500/20 to-sky-600/10 text-sky-400 border-sky-500/30',
      onClick: () => setActiveTab('market'),
    },
    {
      id: 'trade',
      name: 'Trade',
      icon: ArrowLeftRight,
      color: 'from-emerald-500/20 to-emerald-600/10 text-emerald-400 border-emerald-500/30',
      onClick: () => setActiveTab('trade'),
    },
    {
      id: 'wallet',
      name: 'Wallet',
      icon: Wallet,
      color: 'from-indigo-500/20 to-indigo-600/10 text-indigo-400 border-indigo-500/30',
      onClick: () => setActiveTab('wallet'),
    },
    {
      id: 'referral',
      name: 'Referral',
      icon: Users,
      color: 'from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/30',
      badge: '5 USDT',
      onClick: () => openModal('REFERRAL'),
    },
    {
      id: 'support',
      name: 'Support',
      icon: Headphones,
      color: 'from-teal-500/20 to-teal-600/10 text-teal-400 border-teal-500/30',
      onClick: () => openModal('SUPPORT'),
    },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Quick Actions
        </h3>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {actions.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              className="relative flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 active:scale-95 transition-all group cursor-pointer"
            >
              {action.badge && (
                <span className="absolute -top-1.5 -right-0.5 px-1 py-0.2 rounded-full bg-amber-500 text-[8px] font-black text-slate-950 shadow-sm leading-tight">
                  {action.badge}
                </span>
              )}
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${action.color} border flex items-center justify-center mb-1 group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-medium text-slate-300 text-center tracking-tight truncate w-full">
                {action.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
