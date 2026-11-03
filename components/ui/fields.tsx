"use client";

// Labelled form controls with error text, 44px tap targets and visible focus.

import type { ReactNode } from "react";

const control =
  "mt-1 block w-full min-h-tap rounded-tile border border-border bg-surface px-3 text-body text-ink placeholder:text-ink-muted/70 focus:border-primary focus:outline-none aria-[invalid=true]:border-danger";

interface Base {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}

function Wrapper({ id, label, hint, error, children }: Base & { children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-meta font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-meta text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-meta font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = ({ id, hint, error }: Base) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export function TextField(props: Base & { value: string; onChange: (v: string) => void; type?: string; inputMode?: "text" | "decimal" | "numeric" | "email" | "url"; placeholder?: string; step?: string; min?: string; max?: string; autoComplete?: string }) {
  const { id, value, onChange, type = "text", inputMode, placeholder, step, min, max, autoComplete } = props;
  return (
    <Wrapper {...props}>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(props)}
        className={control}
      />
    </Wrapper>
  );
}

export function TextArea(props: Base & { value: string; onChange: (v: string) => void; rows?: number; maxLength?: number }) {
  return (
    <Wrapper {...props}>
      <textarea
        id={props.id}
        value={props.value}
        rows={props.rows ?? 4}
        maxLength={props.maxLength}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(props)}
        className={`${control} py-2`}
      />
    </Wrapper>
  );
}

export function SelectField(props: Base & { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Wrapper {...props}>
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(props)}
        className={control}
      >
        {props.placeholder !== undefined && <option value="">{props.placeholder}</option>}
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function CheckboxField({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-tap cursor-pointer items-start gap-3 py-2">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
      <span>
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-meta text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Pill toggle used for filter and quiz chips. */
export function ChipToggle({ pressed, onClick, children, disabled }: { pressed: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-full border px-4 text-meta font-semibold transition-colors disabled:opacity-50 ${
        pressed ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-ink hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

export function Fieldset({ legend, children, hint }: { legend: string; children: ReactNode; hint?: string }) {
  return (
    <fieldset>
      <legend className="text-meta font-semibold">{legend}</legend>
      {hint && <p className="text-meta text-ink-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
