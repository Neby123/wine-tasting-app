import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Native `<dialog>` modal built per Modern Web Guidance v1.0 (`dialog` +
 * `prevent-page-scroll-under-modal-dialog`). Uses `showModal()` so the browser
 * manages focus containment, top-layer stacking, inert background, and Esc/back dismissal.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const isDanger = tone === 'danger';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const choice = dialog.returnValue;
    dialog.returnValue = '';
    if (choice === 'confirm') {
      onConfirm();
    } else {
      onCancel();
    }
  };

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    if (busy) {
      e.preventDefault();
      return;
    }
    const dialog = dialogRef.current;
    if (dialog) dialog.returnValue = '';
  };

  const handleActionClick = (value: 'cancel' | 'confirm') => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      dialog.close(value);
    } else {
      dialog.returnValue = value;
      handleClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      {...({ closedby: busy ? 'none' : 'closerequest' } as Record<string, string>)}
      onClose={handleClose}
      onCancel={handleCancel}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-slate-700 bg-[#FFFDF9] p-6 text-slate-100 shadow-2xl"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          {isDanger && (
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-700" aria-hidden="true" />
            </div>
          )}
          <div className="space-y-1.5 min-w-0">
            <h2 id={titleId} className="text-lg font-bold font-serif text-slate-100 leading-snug">
              {title}
            </h2>
            <p id={descId} className="text-sm text-slate-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
          <button
            type="button"
            autoFocus={isDanger}
            disabled={busy}
            onClick={() => handleActionClick('cancel')}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-700 bg-white hover:border-[#6E172C] text-slate-200 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus={!isDanger}
            disabled={busy}
            onClick={() => handleActionClick('confirm')}
            className={`min-h-[44px] px-4 py-2 rounded-lg text-white text-sm font-bold transition-colors disabled:opacity-50 ${
              isDanger
                ? 'bg-rose-700 hover:bg-rose-800'
                : 'bg-[#6E172C] hover:bg-[#5A1425]'
            }`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
};
