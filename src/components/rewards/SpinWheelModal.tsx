import React, { useState, useEffect } from 'react';
import { X, Play, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { UnifiedRewardedAdModal } from './UnifiedRewardedAdModal';

interface SpinWheelModalProps {
  onClose: () => void;
}

export const SpinWheelModal: React.FC<SpinWheelModalProps> = ({ onClose }) => {
  const { user, refreshProfile, addToast } = useApp();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<any>(null);
  const [spinStatus, setSpinStatus] = useState<{
    spinsUsed: number;
    maxSpins: number;
    spinsRemainingToday: number;
    adRequired: boolean;
    prizes?: any[];
  } | null>(null);

  const [showAdModal, setShowAdModal] = useState<boolean>(false);
  const [isAllDoneToday, setIsAllDoneToday] = useState<boolean>(false);

  const defaultPrizes = [
    { id: 0, label: '0.25 E4F', asset: 'E4F', amount: 0.25, color: '#3B82F6' },
    { id: 1, label: '0.50 USDT', asset: 'USDT', amount: 0.50, color: '#10B981' },
    { id: 2, label: '1.00 E4F', asset: 'E4F', amount: 1.00, color: '#EAB308' },
    { id: 3, label: '0.10 USDT', asset: 'USDT', amount: 0.10, color: '#6366F1' },
    { id: 4, label: '2.50 E4F', asset: 'E4F', amount: 2.50, color: '#EC4899' },
    { id: 5, label: '1.00 USDT', asset: 'USDT', amount: 1.00, color: '#14B8A6' },
    { id: 6, label: '5.00 E4F', asset: 'E4F', amount: 5.00, color: '#F97316' },
    { id: 7, label: '2.00 USDT', asset: 'USDT', amount: 2.00, color: '#8B5CF6' },
  ];

  const prizes = spinStatus?.prizes && spinStatus.prizes.length > 0
    ? spinStatus.prizes
    : defaultPrizes;

  // Track exact spin slot 1..5 for dedicated ad network mapping
  const spinsUsedCount = spinStatus?.spinsUsed ?? (spinStatus ? Math.max(0, (spinStatus.maxSpins || 5) - spinStatus.spinsRemainingToday) : 0);
  const currentSpinNumber = Math.min(5, Math.max(1, spinsUsedCount + 1));

  useEffect(() => {
    if (user?.id) {
      api.getSpinStatus(user.id).then(status => {
        setSpinStatus(status);
        if (status && status.spinsRemainingToday <= 0) {
          setIsAllDoneToday(true);
        }
      }).catch(() => {});
    }
  }, [user]);

  const handleInitiateSpin = async () => {
    if (!user || spinning) return;
    const remaining = spinStatus?.spinsRemainingToday ?? 5;
    if (remaining <= 0) {
      addToast('Daily Limit Reached', 'You have used all 5 spins for today. Resets tomorrow at 00:00 UTC.', 'info');
      return;
    }

    if (spinStatus?.adRequired !== false) {
      setShowAdModal(true);
    } else {
      executeSpin();
    }
  };

  const handleAdCompleted = (adSessionId: string, claimToken: string) => {
    setShowAdModal(false);
    executeSpin(adSessionId, claimToken);
  };

  const executeSpin = async (adSessionId?: string, claimToken?: string) => {
    if (!user || spinning) return;
    setSpinning(true);
    setWonPrize(null);

    try {
      // Backend validates ad session and determines outcome authoritatively
      const res = await api.spinWheel(user.id, adSessionId, claimToken);
      const segmentAngle = 360 / prizes.length;
      // Target rotation angle: 5 full spins (1800 deg) + offset to winning segment
      const targetDeg = 1800 + (360 - (res.prizeIndex * segmentAngle + segmentAngle / 2));

      setRotation(prev => prev + targetDeg);

      setTimeout(() => {
        setSpinning(false);
        setWonPrize(res.prize);
        addToast('Spin Reward!', `Won ${res.prize.label}! Credited to your wallet.`, 'success');
        api.getSpinStatus(user.id).then(setSpinStatus).catch(() => {});
        refreshProfile();
      }, 3500);
    } catch (err: any) {
      setSpinning(false);
      addToast('Spin Failed', err.message || 'Error occurred during spin.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      {/* Dedicated In-App Rewarded Ad Gate Modal (Spin 1-5, 30s In-App, 0% External Redirect) */}
      {showAdModal && user && (
        <UnifiedRewardedAdModal
          userId={user.id}
          actionType="SPIN"
          targetId={currentSpinNumber}
          title={`Lucky Spin #${currentSpinNumber}`}
          description={`Complete 30s ad to unlock Lucky Spin #${currentSpinNumber}`}
          rewardHint="1 Free Lucky Wheel Spin (E4F / USDT)"
          durationSeconds={30}
          onComplete={handleAdCompleted}
          onCancel={() => setShowAdModal(false)}
        />
      )}

      <div className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto my-auto bg-[#0C1326] border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl no-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-black text-white mb-1">Spin & Win Lucky Wheel</h3>
        <p className="text-xs text-slate-400 mb-4">5 Daily rewarded spins for E4F & USDT rewards</p>

        {/* Wheel Container */}
        <div className="relative w-56 h-56 mx-auto my-3 flex items-center justify-center">
          {/* Top Indicator Arrow */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-amber-400 filter drop-shadow" />

          {/* Rotating Wheel SVG */}
          <div
            className="w-full h-full rounded-full transition-transform duration-[3500ms] ease-out relative shadow-2xl p-1 bg-gradient-to-tr from-amber-500 via-sky-400 to-amber-600"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-slate-950 relative">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {prizes.map((p, idx) => {
                  const angle = (360 / prizes.length);
                  const startAngle = idx * angle;
                  const endAngle = startAngle + angle;
                  const rad1 = ((startAngle - 90) * Math.PI) / 180;
                  const rad2 = ((endAngle - 90) * Math.PI) / 180;

                  const x1 = 50 + 50 * Math.cos(rad1);
                  const y1 = 50 + 50 * Math.sin(rad1);
                  const x2 = 50 + 50 * Math.cos(rad2);
                  const y2 = 50 + 50 * Math.sin(rad2);

                  const path = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;

                  return (
                    <path
                      key={p.id ?? idx}
                      d={path}
                      fill={idx % 2 === 0 ? '#1E293B' : '#0F172A'}
                      stroke="#334155"
                      strokeWidth="0.5"
                    />
                  );
                })}
              </svg>

              {/* Labels on Wheel */}
              {prizes.map((p, idx) => {
                const angle = idx * (360 / prizes.length) + (360 / prizes.length) / 2;
                return (
                  <div
                    key={p.id ?? idx}
                    className="absolute inset-0 flex items-start justify-center pt-3 text-[9px] font-black pointer-events-none"
                    style={{
                      transform: `rotate(${angle}deg)`,
                      transformOrigin: '50% 50%',
                      color: p.color || '#F59E0B',
                    }}
                  >
                    {p.label}
                  </div>
                );
              })}

              {/* Center E4F Coin Hub */}
              <div className="absolute inset-0 m-auto w-12 h-12 rounded-full p-0.5 bg-amber-400 shadow-lg flex items-center justify-center">
                <img
                  src="/e4f_coin.jpg"
                  alt="E4F"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Won Prize Display */}
        {wonPrize && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold my-2 flex items-center justify-center gap-1.5 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>Congratulations! Won {wonPrize.label}</span>
          </div>
        )}

        {/* Spin Limit Status */}
        {spinStatus && (
          <div className="text-[11px] font-semibold text-slate-400 mb-2">
            Spins Today:{' '}
            <span className={spinStatus.spinsRemainingToday > 0 ? 'text-amber-400 font-bold' : 'text-slate-400 font-semibold'}>
              {spinStatus.spinsRemainingToday} / {spinStatus.maxSpins} remaining
            </span>
          </div>
        )}

        {isAllDoneToday || (spinStatus !== null && spinStatus.spinsRemainingToday <= 0) ? (
          <button
            disabled
            className="w-full py-3 rounded-2xl text-amber-400 font-black text-sm bg-amber-500/10 border border-amber-500/30 opacity-50 cursor-not-allowed"
          >
            Claimed Today - Reset UTC 00:00
          </button>
        ) : (
          <button
            onClick={handleInitiateSpin}
            disabled={spinning}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-transform cursor-pointer"
          >
            {spinning ? 'Spinning Wheel...' : `WATCH AD & SPIN #${currentSpinNumber} (30s)`}
          </button>
        )}

        <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3 text-amber-400" />
          <span>Each spin requires 1 completed rewarded ad session</span>
        </div>
      </div>
    </div>
  );
};
