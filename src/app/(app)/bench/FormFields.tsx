"use client";

import { useId } from "react";

// Shared Bench Sales form fields. Every label is linked to its control
// (htmlFor/useId) so the browser's validation bubble and screen readers name
// the right field, and clicking a label focuses it.
export const inputClass =
  "w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent";
export const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";

export function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && " *"}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className={inputClass}
      />
    </div>
  );
}

export function FieldTextarea({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && " *"}
      </label>
      <textarea id={id} name={name} rows={3} defaultValue={defaultValue ?? ""} required={required} className={inputClass} />
    </div>
  );
}

export function FieldSelect({
  label,
  name,
  defaultValue,
  required,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && " *"}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} required={required} className={inputClass}>
        {options.map((o) => (
          <option key={o.value || "__empty"} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
