interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Larger illustration + typography for primary onboarding moments. */
  prominent?: boolean;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
  prominent,
}: EmptyStateProps) {
  return (
    <div
      className={`text-center rounded-2xl bg-white border border-dashed border-slate-200 ${
        prominent ? 'py-12 sm:py-14 px-6 sm:px-10' : 'py-10 px-6'
      }`}
    >
      {icon ? (
        <div
          className={
            prominent
              ? 'mx-auto mb-6 max-w-[220px] w-full aspect-[5/4] rounded-3xl bg-accent/5 text-accent flex items-center justify-center p-6 sm:p-8'
              : 'mx-auto h-12 w-12 rounded-2xl bg-accent/10 text-accent-600 grid place-items-center mb-3'
          }
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <h3 className={`font-semibold text-slate-900 ${prominent ? 'text-lg sm:text-xl' : 'text-base'}`}>
        {title}
      </h3>
      {description ? (
        <p
          className={`text-slate-500 mt-2 mx-auto ${
            prominent ? 'text-sm sm:text-base max-w-md' : 'text-sm mt-1.5 max-w-xs'
          }`}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className={prominent ? 'mt-6' : 'mt-4'}>{action}</div> : null}
    </div>
  );
}
