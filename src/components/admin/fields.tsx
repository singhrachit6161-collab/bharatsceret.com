export function Field({
  label,
  name,
  defaultValue,
  hint,
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue"> & { label: string; name: string; hint?: string; defaultValue?: string | null }) {
  const id = `f-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} name={name} defaultValue={defaultValue ?? ""} className="input" {...props} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 3,
  hint,
  className = "",
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "defaultValue"> & { label: string; name: string; hint?: string; defaultValue?: string | null }) {
  const id = `f-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} name={name} defaultValue={defaultValue ?? ""} rows={rows} className="input" {...props} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Check({ label, name, defaultChecked, value }: { label: string; name: string; defaultChecked?: boolean; value?: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="h-4 w-4 accent-walnut" /> {label}
    </label>
  );
}
