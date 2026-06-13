"use client";

import { useFormStatus } from "react-dom";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm " +
  "outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 " +
  "disabled:opacity-50";

export function Field({
  label,
  name,
  hint,
  errors,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  errors?: Record<string, string[]>;
  children: React.ReactNode;
}) {
  const fieldErrors = errors?.[name];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !fieldErrors && (
        <p className="text-xs text-muted">{hint}</p>
      )}
      {fieldErrors?.map((message) => (
        <p key={message} className="text-xs text-red-600 dark:text-red-400">
          {message}
        </p>
      ))}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} id={props.id ?? props.name} className={inputClass} />;
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Working…" : children}
    </button>
  );
}
