import { useUI } from '../store/ui';

const KIND_STYLE: Record<string, string> = {
  success: 'bg-accent-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-900 text-white',
};

export default function ToastViewport() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none"
      style={{ bottom: 'calc(72px + var(--safe-bottom))' }}
    >
      {toasts.map((t) => (
        <button
          type="button"
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
            KIND_STYLE[t.kind] ?? KIND_STYLE.info
          }`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
