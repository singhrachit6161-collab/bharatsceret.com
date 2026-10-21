export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="container-page flex justify-center py-12">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold text-walnut">{title}</h1>
        {subtitle && <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>}
        {children}
        {footer && <div className="mt-6 border-t border-line pt-4 text-center text-sm">{footer}</div>}
      </div>
    </div>
  );
}
