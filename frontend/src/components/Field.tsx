import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

export function Field({ label, hint, error, required, children }: FieldProps) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-saffron-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="help">{hint}</p>}
      {error && <p className="mt-1 text-xs text-saffron-700">{error}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ''}`} />;
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card p-6 sm:p-8">
      <header className="mb-6">
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        {description && <p className="text-sm text-ink-500 mt-1">{description}</p>}
      </header>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}
