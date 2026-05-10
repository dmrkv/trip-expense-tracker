import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Replace the default close button area with custom footer content. */
  footer?: React.ReactNode;
  /** When true, renders as a bottom sheet on mobile and centered card on sm+. */
  variant?: 'sheet' | 'centered';
  /** Wider max-width on large screens for dense two-column content. */
  wide?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'sheet',
  wide = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = original;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative w-full ${
          variant === 'sheet'
            ? `sm:max-w-md sm:rounded-2xl rounded-t-2xl${wide ? ' lg:max-w-4xl' : ''}`
            : `sm:max-w-md rounded-2xl mx-4${wide ? ' lg:max-w-4xl' : ''}`
        } bg-white shadow-xl max-h-[92vh] flex flex-col`}
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 h-9 w-9 grid place-items-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto flex-1">{children}</div>
        {footer ? (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
