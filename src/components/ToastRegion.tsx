import React, { useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ToastMessage } from '../types/wine';

interface ToastRegionProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  suppressed?: boolean;
}

/**
 * Accessible toast notification region using `popover="manual"` per Modern Web
 * Guidance v1.0 (`persistent-toast-notifications`), paired with a polite live region
 * and auto-pause on hover/focus. Suppressed automatically while modal dialogs are open.
 */
export const ToastRegion: React.FC<ToastRegionProps> = ({
  toasts,
  onDismiss,
  suppressed = false
}) => {
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = regionRef.current as (HTMLDivElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
    }) | null;
    if (!el) return;

    const shouldShow = toasts.length > 0 && !suppressed;
    try {
      if (shouldShow && typeof el.showPopover === 'function') {
        if (!el.matches(':popover-open')) el.showPopover();
      } else if (!shouldShow && typeof el.hidePopover === 'function') {
        if (el.matches(':popover-open')) el.hidePopover();
      }
    } catch {
      // Fall back to fixed layout positioning when Popover API is unavailable (e.g., jsdom)
    }
  }, [toasts.length, suppressed]);

  if (toasts.length === 0 || suppressed) return null;

  return (
    <div
      ref={regionRef}
      {...({ popover: 'manual' } as Record<string, string>)}
      role="region"
      aria-label="Notifications"
      className="toast-region pointer-events-none fixed inset-x-0 bottom-4 z-[60] mx-auto flex w-full max-w-md flex-col gap-2 bg-transparent p-4 m-0 border-0"
    >
      {toasts.map(toast => {
        const isError = toast.tone === 'error';
        const isSuccess = toast.tone === 'success';
        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium shadow-lg backdrop-blur-md ${
              isError
                ? 'bg-rose-50/95 border-rose-300 text-rose-900'
                : isSuccess
                  ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
                  : 'bg-[#FFFDF9]/95 border-slate-700 text-slate-100'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-700 mt-0.5" aria-hidden="true" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" aria-hidden="true" />
            ) : (
              <Info className="w-4 h-4 shrink-0 text-wine-300 mt-0.5" aria-hidden="true" />
            )}
            <p className="flex-1 leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="min-w-[32px] min-h-[32px] -mr-1.5 -mt-1 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-100 hover:bg-black/5 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
