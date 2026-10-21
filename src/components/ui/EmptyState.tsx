import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 text-saffron">{icon}</div>}
      <h2 className="font-display text-xl font-semibold text-walnut">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm text-muted">{description}</p>}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary mt-6">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
