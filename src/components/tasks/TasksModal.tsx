import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle2,
  ExternalLink,
  Clock,
  Send,
  AlertCircle,
  Image as ImageIcon,
  Upload,
  Check,
  FileText,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { TaskItem } from '../../types';
import { TaskTimerModal } from './TaskTimerModal';

interface TasksModalProps {
  onClose: () => void;
}

export const TasksModal: React.FC<TasksModalProps> = ({ onClose }) => {
  const { user, refreshProfile, addToast } = useApp();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Active timers (taskId -> remainingSeconds)
  const [activeTimers, setActiveTimers] = useState<{ [taskId: string]: number }>({});

  // Active Timer Modal Task
  const [activeTimerTask, setActiveTimerTask] = useState<TaskItem | null>(null);

  // Active Proof Verification Modal state
  const [verifyingTask, setVerifyingTask] = useState<TaskItem | null>(null);
  const [usernameOrLink, setUsernameOrLink] = useState('');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getStoredTaskTimer = (taskId: string) => {
    if (!user) return null;
    try {
      const raw = localStorage.getItem(`task_timer_${user.id}_${taskId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      return null;
    }
    return null;
  };

  useEffect(() => {
    if (user) {
      api
        .getTasks(user.id)
        .then(res => setTasks(res.tasks))
        .catch(() => {});
    }
  }, [user]);

  // Handle Timer Countdown Tick
  useEffect(() => {
    const timerKeys = Object.keys(activeTimers);
    if (timerKeys.length === 0) return;

    const interval = setInterval(() => {
      setActiveTimers(prev => {
        const next = { ...prev };
        let changed = false;
        for (const taskId of Object.keys(next)) {
          if (next[taskId] > 0) {
            next[taskId] -= 1;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimers]);

  // Handle "Go" / "Visit" Button Click
  const handleGoTask = async (task: TaskItem) => {
    // If task has TIMER verification or configured duration or is website/youtube/tiktok, open TaskTimerModal
    const isTimer =
      task.verificationMethod === 'TIMER' ||
      Boolean(task.durationSeconds && task.durationSeconds > 0) ||
      ['WEBSITE', 'YOUTUBE', 'TIKTOK', 'VIDEO'].includes((task.platform || '').toUpperCase());

    if (isTimer) {
      setActiveTimerTask(task);
      return;
    }

    const targetUrl = task.actionUrl || task.url;
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Open Proof Verification Modal
  const handleOpenVerifyModal = (task: TaskItem) => {
    const isTimer =
      task.verificationMethod === 'TIMER' ||
      Boolean(task.durationSeconds && task.durationSeconds > 0) ||
      ['WEBSITE', 'YOUTUBE', 'TIKTOK', 'VIDEO'].includes((task.platform || '').toUpperCase());

    if (isTimer) {
      setActiveTimerTask(task);
      return;
    }

    // If it's AUTO task and no proof required, quick-verify
    if (task.verificationMethod === 'AUTO') {
      handleClaim(task.id);
      return;
    }

    // Otherwise open standard manual proof submission modal
    setVerifyingTask(task);
    setUsernameOrLink('');
    setScreenshotData(null);
    setNotes('');
  };

  // Handle screenshot file input & image compression to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Invalid File', 'Please select an image screenshot (PNG, JPG, JPEG, WEBP)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        // Compress & scale to max 900px
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 900;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setScreenshotData(compressedDataUrl);
        } else {
          setScreenshotData(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Submit Proof to Admin
  const handleConfirmSubmitProof = async () => {
    if (!user || !verifyingTask || isSubmitting) return;

    const trimmedIdentifier = usernameOrLink.trim();
    if (!trimmedIdentifier && !screenshotData) {
      addToast(
        'Proof Required',
        'Please enter your username/profile/post link or upload a screenshot.',
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitTask(user.id, verifyingTask.id, {
        usernameOrLink: trimmedIdentifier,
        screenshot: screenshotData || undefined,
        description: notes.trim() || undefined,
        proof: trimmedIdentifier || 'Screenshot proof submitted',
      });

      if (res.success) {
        addToast(
          'Proof Submitted!',
          'Your task submission is queued for Administrator review and approval.',
          'success'
        );
        setVerifyingTask(null);
        // Refresh tasks list
        const updated = await api.getTasks(user.id);
        setTasks(updated.tasks);
      }
    } catch (err: any) {
      addToast('Submission Failed', err.message || 'Could not submit proof', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Timer Verification Claim
  const handleVerifyTimer = async (taskId: string) => {
    if (!user || claimingId) return;
    setClaimingId(taskId);
    try {
      const storedTimer = getStoredTaskTimer(taskId);
      const acc = storedTimer?.accumulatedSeconds || 30;
      const res = await api.verifyTaskTimer(user.id, taskId, acc);
      if (res.success) {
        addToast(
          'Task Verified!',
          `+${res.rewardAmount || res.reward} ${res.rewardAsset || res.asset} credited to your wallet!`,
          'success'
        );
        setActiveTimers(prev => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        const updated = await api.getTasks(user.id);
        setTasks(updated.tasks);
        await refreshProfile();
      }
    } catch (err: any) {
      addToast('Verification Failed', err.message || 'Timer not completed', 'error');
    } finally {
      setClaimingId(null);
    }
  };

  // Standard Auto-Claim
  const handleClaim = async (taskId: string) => {
    if (!user || claimingId) return;
    setClaimingId(taskId);
    try {
      const res = await api.claimTask(user.id, taskId);
      if (res.success) {
        addToast(
          'Task Completed!',
          `+${res.rewardAmount} ${res.rewardAsset} added to your account!`,
          'success'
        );
        const updated = await api.getTasks(user.id);
        setTasks(updated.tasks);
        await refreshProfile();
      }
    } catch (err: any) {
      addToast('Task Incomplete', err.message || 'Verification failed', 'error');
    } finally {
      setClaimingId(null);
    }
  };

  // User completed tasks with rewards claimed disappear automatically
  // Only tasks that are pending review (SUBMITTED) or not completed yet (AVAILABLE / REJECTED) are shown
  const visibleTasks = tasks.filter(task => {
    const isCompleted = task.isCompleted || task.status === 'APPROVED';
    return !isCompleted;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-[#0C1326] border border-slate-700/80 rounded-3xl p-5 text-slate-200 shadow-2xl max-h-[88vh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-white mb-0.5">Tasks & Bounty Hub</h3>
            <p className="text-xs text-slate-400">
              Complete tasks, verify proof & earn real crypto rewards
            </p>
          </div>
          {visibleTasks.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0 font-mono">
              {visibleTasks.length} Active
            </span>
          )}
        </div>

        {/* Task Cards List */}
        <div className="space-y-3">
          {visibleTasks.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3.5 bg-slate-900/40 rounded-2xl border border-slate-800/80">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white">All Tasks Completed!</h4>
                <p className="text-xs text-slate-400 max-w-[250px] mx-auto leading-relaxed">
                  You have claimed all available task rewards. Only pending or new tasks will appear here.
                </p>
              </div>
            </div>
          ) : (
            visibleTasks.map(task => {
              const isSubmitted = task.status === 'SUBMITTED';
              const isRejected = task.status === 'REJECTED';
              const isTimerTask = task.verificationMethod === 'TIMER' || Boolean(task.durationSeconds && task.durationSeconds > 0);
              const taskSec = task.durationSeconds || 30;
              const isVideoPlatform = ['YOUTUBE', 'TIKTOK', 'VIDEO'].includes((task.platform || '').toUpperCase());
              const actionNoun = isVideoPlatform ? 'Watch' : 'Visit';

              const storedTimer = isTimerTask ? getStoredTaskTimer(task.id) : null;
              const isTimerCompleted = storedTimer?.isCompleted || (storedTimer?.accumulatedSeconds && storedTimer.accumulatedSeconds >= taskSec);
              const isTimerPaused = storedTimer && !isTimerCompleted && (storedTimer.accumulatedSeconds > 0);
              const remainingTimerSec = isTimerPaused ? Math.max(1, taskSec - storedTimer.accumulatedSeconds) : taskSec;

              return (
                <div
                  key={task.id}
                  className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5 transition-all shadow-sm"
                >
                  {/* Header & Category */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-white mb-0.5">
                        <span>{task.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold uppercase tracking-wider">
                          {task.platform || task.category || 'TASK'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        {task.description}
                      </p>
                    </div>

                    <div className="text-[11px] font-extrabold text-amber-400 font-mono shrink-0">
                      +{task.rewardAmount} {task.rewardAsset}
                    </div>
                  </div>

                  {/* Status Badges or Action Controls */}
                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {/* Status Indicator */}
                    {isSubmitted ? (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 px-2.5 py-1 bg-amber-500/10 rounded-xl">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        <span>Under Admin Review</span>
                      </div>
                    ) : isRejected ? (
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded-xl">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Action Required • Re-submit</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        {isTimerTask ? (
                          isTimerCompleted ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ready to Claim</span>
                            </span>
                          ) : isTimerPaused ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Paused ({storedTimer.accumulatedSeconds}s / {taskSec}s)</span>
                            </span>
                          ) : (
                            <span className="text-sky-400 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{taskSec}s Timer</span>
                            </span>
                          )
                        ) : (
                          <span>Proof required</span>
                        )}
                      </div>
                    )}

                    {/* Action Controls */}
                    {!isSubmitted && (
                      <div className="flex items-center gap-2 shrink-0">
                        {isTimerTask ? (
                          isTimerCompleted ? (
                            <button
                              onClick={() => setActiveTimerTask(task)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Claim</span>
                            </button>
                          ) : isTimerPaused ? (
                            <button
                              onClick={() => setActiveTimerTask(task)}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 active:scale-95 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Resume ({remainingTimerSec}s)</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setActiveTimerTask(task)}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 active:scale-95 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <ExternalLink className="w-3 h-3 text-slate-950" />
                              <span>{actionNoun} ({taskSec}s)</span>
                            </button>
                          )
                        ) : (
                          <>
                            <button
                              onClick={() => handleGoTask(task)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all shadow cursor-pointer"
                              title="Open task link"
                            >
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                              <span>Go</span>
                            </button>

                            <button
                              onClick={() => handleOpenVerifyModal(task)}
                              disabled={claimingId === task.id}
                              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 text-xs font-black shadow-md shadow-cyan-500/20 transition-all cursor-pointer flex items-center gap-1"
                              title="Submit proof for admin verification"
                            >
                              {claimingId === task.id ? <span>Checking...</span> : <span>Verify</span>}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal: Submit Proof Verification Dialog */}
        {verifyingTask && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-sm bg-[#0C1326] border border-cyan-500/40 rounded-3xl p-5 text-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                    Task Proof Verification
                  </div>
                  <h4 className="text-sm font-extrabold text-white leading-tight">
                    {verifyingTask.title}
                  </h4>
                  <div className="text-[11px] font-bold text-amber-400 mt-0.5">
                    Reward: +{verifyingTask.rewardAmount} {verifyingTask.rewardAsset}
                  </div>
                </div>
                <button
                  onClick={() => setVerifyingTask(null)}
                  className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Input 1: username / profile link / post link */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Username / Profile Link / Post Link <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={usernameOrLink}
                  onChange={e => setUsernameOrLink(e.target.value)}
                  placeholder="@yourusername or https://t.me/... or post link"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Provide your Telegram/X/YouTube handle or post URL.
                </span>
              </div>

              {/* Form Input 2: Screenshot proof with file upload & preview */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Upload Screenshot Proof
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {screenshotData ? (
                  <div className="relative rounded-2xl overflow-hidden border border-cyan-500/40 bg-slate-950 p-2">
                    <img
                      src={screenshotData}
                      alt="Proof preview"
                      className="w-full max-h-36 object-contain rounded-xl"
                    />
                    <button
                      onClick={() => setScreenshotData(null)}
                      className="absolute top-3 right-3 p-1.5 rounded-full bg-rose-500/80 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="text-[10px] text-cyan-400 font-semibold mt-1 text-center flex items-center justify-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Screenshot ready for submission</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 rounded-2xl border border-dashed border-slate-700 hover:border-cyan-500/60 bg-slate-950/60 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    <Upload className="w-5 h-5 text-cyan-400" />
                    <span className="text-xs font-semibold">Click to upload screenshot</span>
                    <span className="text-[10px] text-slate-500">Supports PNG, JPG, JPEG</span>
                  </button>
                )}
              </div>

              {/* Form Input 3: Optional Box - User activity notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Additional Details <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Describe what you did (or leave empty)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              {/* Submission Controls */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyingTask(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmitProof}
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold shadow-md shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Proof'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Task Timer Modal */}
        {activeTimerTask && user && (
          <TaskTimerModal
            task={activeTimerTask}
            userId={user.id}
            onComplete={async () => {
              setActiveTimerTask(null);
              const updated = await api.getTasks(user.id);
              setTasks(updated.tasks);
              await refreshProfile();
            }}
            onClose={() => {
              setActiveTimerTask(null);
              if (user) {
                api.getTasks(user.id).then(res => setTasks(res.tasks)).catch(() => {});
              }
            }}
          />
        )}
      </div>
    </div>
  );
};
