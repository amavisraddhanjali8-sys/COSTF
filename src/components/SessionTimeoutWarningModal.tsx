import React from 'react';
import { Clock, ShieldAlert, RefreshCw, LogOut } from 'lucide-react';

interface SessionTimeoutWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  totalWarningSeconds?: number;
  timeoutMinutes: number;
  onExtend: () => void;
  onSignOut: () => void;
}

export const SessionTimeoutWarningModal: React.FC<SessionTimeoutWarningModalProps> = ({
  isOpen,
  secondsRemaining,
  totalWarningSeconds = 60,
  timeoutMinutes,
  onExtend,
  onSignOut
}) => {
  if (!isOpen) return null;

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const pct = Math.max(0, Math.min(100, (secondsRemaining / totalWarningSeconds) * 100));
  const isUrgent = secondsRemaining <= 15;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 text-center relative overflow-hidden">
        {/* Progress Bar Header */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full transition-all duration-1000 ${
              isUrgent ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Icon & Title */}
        <div className="pt-2 flex flex-col items-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md transition-colors ${
              isUrgent
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-bounce'
                : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            }`}
          >
            {isUrgent ? <ShieldAlert className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
          </div>

          <h2
            id="session-warning-title"
            className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight"
          >
            Session Inactivity Warning
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
            You have been inactive. For system security, your account will automatically sign out in:
          </p>
        </div>

        {/* Countdown Timer Display */}
        <div
          className={`py-4 px-6 rounded-xl border text-center font-mono ${
            isUrgent
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-300'
              : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300'
          }`}
        >
          <div className="text-3xl font-extrabold tracking-widest">{timeFormatted}</div>
          <div className="text-[10px] font-sans text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
            Configured Timeout: {timeoutMinutes} Minutes
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onExtend}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#003049] hover:bg-[#002235] dark:bg-sky-600 dark:hover:bg-sky-500 text-white flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer active:scale-[0.99]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Stay Signed In</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/50 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 hover:border-rose-200 transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
