import React, { useState, useEffect } from 'react';
import { X, Gift, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { GiftBox } from '../../types';
import { UnifiedRewardedAdModal } from './UnifiedRewardedAdModal';
import { isDone, setDone } from '../../services/antiFakeAds';

interface GiftBoxesModalProps {
  onClose: () => void;
}

const defaultGiftBoxes: GiftBox[] = [
  { id: 1, boxNumber: 1, name: 'Bronze Treasure', rewardAsset: 'E4F', rewardAmount: 2.5, color: '#38BDF8', isOpened: false },
  { id: 2, boxNumber: 2, name: 'Silver Cache', rewardAsset: 'USDT', rewardAmount: 1.5, color: '#A855F7', isOpened: false },
  { id: 3, boxNumber: 3, name: 'Gold Vault', rewardAsset: 'E4F', rewardAmount: 5.0, color: '#EAB308', isOpened: false },
  { id: 4, boxNumber: 4, name: 'Ruby Chest', rewardAsset: 'USDT', rewardAmount: 3.0, color: '#EF4444', isOpened: false },
  { id: 5, boxNumber: 5, name: 'Diamond Relic', rewardAsset: 'E4F', rewardAmount: 10.0, color: '#10B981', isOpened: false },
];

export const GiftBoxesModal: React.FC<GiftBoxesModalProps> = ({ onClose }) => {
  const { user, refreshProfile, addToast } = useApp();
  const [boxes, setBoxes] = useState<GiftBox[]>(defaultGiftBoxes);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [boxesRemainingToday, setBoxesRemainingToday] = useState<number>(5);
  const [maxDailyBoxes, setMaxDailyBoxes] = useState<number>(5);
  const [adRequired, setAdRequired] = useState<boolean>(true);
  const [doneBoxMap, setDoneBoxMap] = useState<Record<number, boolean>>({});

  // Selected box waiting for Rewarded Ad completion
  const [adTargetBox, setAdTargetBox] = useState<GiftBox | null>(null);

  const checkDailyDoneBoxes = async () => {
    if (!user) return;
    const map: Record<number, boolean> = {};
    for (let i = 1; i <= 5; i++) {
      const finished = await isDone('gift', i, user.id);
      map[i] = finished;
    }
    setDoneBoxMap(map);
  };

  const fetchBoxes = async () => {
    if (!user) return;
    try {
      const res = await api.getGiftBoxes(user.id);
      if (res && Array.isArray(res.boxes) && res.boxes.length > 0) {
        setBoxes(res.boxes);
      }
      if (typeof res?.boxesRemainingToday === 'number') {
        setBoxesRemainingToday(res.boxesRemainingToday);
      }
      if (typeof res?.maxDailyBoxes === 'number') {
        setMaxDailyBoxes(res.maxDailyBoxes);
      }
      if (typeof res?.adRequired === 'boolean') {
        setAdRequired(res.adRequired);
      }
    } catch {
      // Keep default boxes
    }
    await checkDailyDoneBoxes();
  };

  useEffect(() => {
    fetchBoxes();
  }, [user]);

  const handleOpenGiftBox = (boxNum: number) => {
    if (!user || openingId) return;

    if (doneBoxMap[boxNum]) {
      addToast('Already Claimed', `Gift Box #${boxNum} was already claimed today. Resets at UTC 00:00.`, 'info');
      return;
    }

    const targetBox = boxes.find((b) => (b.boxNumber || b.id) === boxNum) || boxes[boxNum - 1] || defaultGiftBoxes[boxNum - 1] || {
      id: boxNum,
      boxNumber: boxNum,
      name: `Mystery Box #${boxNum}`,
      rewardAsset: boxNum % 2 === 0 ? 'USDT' : 'E4F',
      rewardAmount: boxNum === 1 ? 2.5 : boxNum === 2 ? 1.5 : boxNum === 3 ? 5.0 : boxNum === 4 ? 3.0 : 10.0,
      color: '#38BDF8',
      isOpened: false,
    };

    setAdTargetBox(targetBox);
  };

  const handleBoxClick = (box: GiftBox) => {
    handleOpenGiftBox(box.boxNumber || box.id);
  };

  const handleAdCompleted = (adSessionId: string, claimToken: string) => {
    if (!adTargetBox) return;
    const boxId = adTargetBox.boxNumber || adTargetBox.id;
    setAdTargetBox(null);
    executeOpenBox(boxId, adSessionId, claimToken);
  };

  const executeOpenBox = async (boxId: number, adSessionId?: string, claimToken?: string) => {
    if (!user) return;
    setOpeningId(boxId);
    try {
      const res = await api.openGiftBox(user.id, boxId, adSessionId, claimToken);
      if (res.success) {
        addToast(
          'Box Unlocked!',
          `You received +${res.rewardAmount} ${res.rewardAsset}! Credited to your wallet.`,
          'success'
        );
        setDoneBoxMap(prev => ({ ...prev, [boxId]: true }));
        await setDone('gift', boxId, user.id);
        await fetchBoxes();
        await refreshProfile();
      } else {
        addToast('Box Locked', (res as any).error || 'Could not open box.', 'error');
      }
    } catch (err: any) {
      addToast('Box Locked', err.message || 'Could not open box.', 'error');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      {/* Dedicated In-App Rewarded Ad Gate Modal (Box 1-5, 30s In-App, 0% External Redirect) */}
      {adTargetBox && user && (
        <UnifiedRewardedAdModal
          userId={user.id}
          actionType="GIFT_BOX"
          targetId={adTargetBox.boxNumber || adTargetBox.id}
          title={`Unlock Mystery Gift Box #${adTargetBox.boxNumber || adTargetBox.id}`}
          description="Complete 30s ad to unlock reward"
          rewardHint={`+${adTargetBox.rewardAmount} ${adTargetBox.rewardAsset}`}
          durationSeconds={30}
          onComplete={handleAdCompleted}
          onCancel={() => setAdTargetBox(null)}
        />
      )}

      <div className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto my-auto bg-[#0C1326] border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl no-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-black text-white mb-1">5 Exclusive Mystery Boxes</h3>
        <p className="text-xs text-slate-400 mb-2">Each box requires its own completed rewarded ad</p>

        {/* Counter Badge */}
        <div className="mb-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold">
          <span className="text-slate-400">Available Today:</span>
          <span className={boxesRemainingToday > 0 ? 'text-amber-400 font-bold' : 'text-slate-400 font-semibold'}>
            {boxesRemainingToday} / {maxDailyBoxes}
          </span>
        </div>

        {/* 5 Gift Boxes Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {boxes.map((box) => (
            <div
              key={box.id}
              className={`p-3.5 rounded-2xl border transition-all text-center relative ${
                box.isOpened
                  ? 'bg-slate-900/40 border-slate-800 opacity-60'
                  : 'bg-slate-900/90 border-amber-500/40 hover:border-amber-400 shadow-lg'
              }`}
            >
              <div
                className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2 shadow-inner"
                style={{ backgroundColor: `${box.color}20`, border: `1px solid ${box.color}50` }}
              >
                <Gift className="w-6 h-6" style={{ color: box.color }} />
              </div>

              <div className="text-xs font-bold text-white mb-0.5">Box {box.boxNumber}</div>
              <div className="text-[10px] text-slate-400 mb-2">{box.name}</div>

              {doneBoxMap[box.boxNumber] || box.isOpened ? (
                <button
                  data-gift={box.boxNumber}
                  disabled
                  className="w-full py-1.5 px-1 rounded-xl text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 opacity-50 cursor-not-allowed"
                >
                  Claimed Today - Reset UTC 00:00
                </button>
              ) : (
                <button
                  data-gift={box.boxNumber}
                  onClick={() => handleOpenGiftBox(box.boxNumber)}
                  disabled={openingId === box.boxNumber || boxesRemainingToday <= 0}
                  className="w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold shadow transition-transform active:scale-95 cursor-pointer"
                >
                  {openingId === box.boxNumber ? 'Opening...' : 'Watch Video Ad (30s)'}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Server-verified one-time ad tokens • Instant wallet crediting</span>
        </div>
      </div>
    </div>
  );
};
