import React, { useState } from 'react';
import { X, Headphones, Send, MessageSquare, HelpCircle, Mail, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SupportModalProps {
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ onClose }) => {
  const { language } = useApp();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is E4F and when is the planned listing?',
      a: 'E4F is the native coin of the E4F project. The planned target listing date is 28 February 2028. It is a target only, not a confirmation from any exchange, and no exchange has approved a listing yet. After the mining program ends, E4F balances earned in the app are planned to be issued 1:1 as native E4F on the TON blockchain. Before a listing, E4F has no market price.',
    },
    {
      q: 'How does the 8-Hour Mining work?',
      a: 'Each mining session lasts exactly 8 hours. The mining rate is shown on the Mining screen and can change, and referrals can boost it. Automatic restart is strictly disabled; you must manually start each session and claim the reward.',
    },
    {
      q: 'Are Spot trades executed immediately?',
      a: 'Yes, spot trading for listed pairs (BTC, ETH, SOL, BNB with USDT) executes on our high-performance in-memory order engine with live order books.',
    },
    {
      q: 'How do I withdraw USDT?',
      a: 'Withdrawals are not available before E4F is listed. After a listing, withdrawals are planned to be enabled under published rules, including a minimum amount and review.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-[#0C1326] border border-slate-700 rounded-3xl p-6 text-slate-200 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-black text-white mb-1 flex items-center gap-1.5">
          <Headphones className="w-5 h-5 text-teal-400" />
          <span>Support & Help Center</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">Official customer assistance and community channels</p>

        {/* Channels */}
        <div className="space-y-2 mb-4">
          <a
            href="https://t.me/e4f_help_dex_bot"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-teal-500/40 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-teal-300">
                  Telegram 24/7 Support Bot
                </div>
                <div className="text-[10px] text-slate-400">Instant ticket resolution</div>
              </div>
            </div>
            <span className="text-xs text-sky-400 font-bold">@e4f_help_dex_bot</span>
          </a>

          <a
            href="https://t.me/E4F_Global_Community"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-teal-500/40 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-teal-300">
                  Global Discussion Community
                </div>
                <div className="text-[10px] text-slate-400">Chat with traders worldwide</div>
              </div>
            </div>
            <span className="text-xs text-amber-400 font-bold">Join Group</span>
          </a>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Compliance & Inquiries</div>
                <div className="text-[10px] text-slate-400">Official security inbox</div>
              </div>
            </div>
            <span className="text-xs font-mono text-teal-300">e4fofficial.support@gmail.com</span>
          </div>
        </div>

        {/* FAQs */}
        <div className="border-t border-slate-800 pt-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            <span>Frequently Asked Questions</span>
          </h4>

          <div className="space-y-1.5">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between text-left font-bold text-slate-200"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      activeFaq === idx ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {activeFaq === idx && (
                  <p className="mt-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
