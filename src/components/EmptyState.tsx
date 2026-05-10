interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="text-center py-10 px-6 rounded-2xl bg-white border border-dashed border-slate-200">
      {icon ? (
        <div className="mx-auto h-12 w-12 rounded-2xl bg-accent/10 text-accent-600 grid place-items-center mb-3">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? (
        <p className="text-sm text-slate-500 mt-1.5 max-w-xs mx-auto">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
