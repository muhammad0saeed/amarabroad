"use client";

import { startTransition, useActionState } from "react";
import { TABLES, getPath, type Column, type Field, type Option, type TableKey } from "@/lib/admin/content";
import type { SaveState } from "./actions";

const input = "block min-h-10 w-full rounded-tile border border-border bg-surface px-3 py-2 text-body focus:border-accent focus:outline-none";
const BLANK_ROWS = 2;

export function EditForm({
  table,
  action,
  row,
  options,
  locked,
  saved,
}: {
  table: TableKey;
  action: (state: SaveState, form: FormData) => Promise<SaveState>;
  row: Record<string, unknown> | null;
  options: Record<string, Option[]>;
  locked: string[];
  saved?: boolean;
}) {
  const spec = TABLES[table];
  const [state, formAction, pending] = useActionState(action, saved ? { status: "saved", message: "Created." } : { status: "idle" });
  const errors = state.status === "error" ? (state.errors ?? {}) : {};

  return (
    <form
      className="space-y-8"
      noValidate
      // Submitting by hand (not action=) so React doesn't clear the boxes when a save is refused.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {!row && (
        <section>
          <label className="block text-meta font-semibold" htmlFor="new_id">
            {spec.id === "currency" ? "Currency code" : "ID (in the address)"}
          </label>
          <p className="text-meta text-ink-muted">{spec.id === "currency" ? "Three letters, e.g. CHF." : "Leave empty to make one from the name. It can't be changed later."}</p>
          <input id="new_id" name="new_id" className={`${input} mt-1 max-w-sm`} />
          {errors.new_id && <p className="mt-1 text-meta font-semibold text-danger">{errors.new_id}</p>}
        </section>
      )}

      {spec.sections.map((section) => (
        <fieldset key={section.title} className="border-t border-border pt-4">
          <legend className="pr-3 text-heading font-bold">{section.title}</legend>
          <div className="mt-3 grid gap-x-6 gap-y-5 md:grid-cols-2">
            {section.fields.map((f) => (
              <div key={f.name} className={wide(f) ? "md:col-span-2" : undefined}>
                <FieldInput field={f} value={row?.[f.name]} options={options[f.name]} error={errors[f.name]} locked={locked.includes(f.name)} />
              </div>
            ))}
          </div>
          {section.title === "Checking" && spec.verified && (
            <label className="mt-5 flex items-center gap-2 font-semibold">
              <input type="checkbox" name="checked_today" className="size-4 accent-[var(--color-primary)]" />
              Checked against the official page today
            </label>
          )}
        </fieldset>
      ))}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-canvas px-4 py-3">
        <button disabled={pending} className="inline-flex min-h-tap items-center rounded-full bg-primary px-6 font-semibold text-on-primary hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50">
          {pending ? "Saving…" : row ? "Save changes" : `Add ${spec.one}`}
        </button>
        <p role="status" aria-live="polite" className={`text-meta font-semibold ${state.status === "error" ? "text-danger" : "text-success"}`}>
          {state.status !== "idle" && state.message}
        </p>
      </div>
    </form>
  );
}

function wide(f: Field) {
  return f.kind === "textarea" || f.kind === "rows" || f.kind === "group" || f.kind === "multi" || f.kind === "lines" || f.kind === "json";
}

function FieldInput({ field: f, value, options, error, locked }: { field: Field; value: unknown; options?: Option[]; error?: string; locked: boolean }) {
  const name = `f.${f.name}`;
  const id = `field-${f.name}`;
  const label = (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-semibold">
        {f.label}
        {f.required && <span className="text-danger"> *</span>}
      </span>
      {locked && (
        <span className="text-meta text-warning" title="You set this by hand. The robot won't overwrite it; if the page says something else, it asks you in Robot changes.">
          set by hand
        </span>
      )}
    </span>
  );
  const after = (
    <>
      {f.hint && <span className="mt-1 block text-meta text-ink-muted">{f.hint}</span>}
      {locked && (
        <label className="mt-1 flex items-center gap-2 text-meta text-ink-muted">
          <input type="checkbox" name="unlock" value={f.name} className="accent-[var(--color-primary)]" /> Let the robot update this again
        </label>
      )}
      {error && <span className="mt-1 block text-meta font-semibold text-danger">{error}</span>}
    </>
  );
  const str = value === null || value === undefined ? "" : String(value);

  switch (f.kind) {
    case "bool":
      return (
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name={name} defaultChecked={value === true} className="size-4 accent-[var(--color-primary)]" />
            {label}
          </label>
          {after}
        </div>
      );
    case "tri":
      return (
        <fieldset>
          <legend>{label}</legend>
          <div className="mt-1 flex flex-wrap gap-4">
            {[["yes", "Yes", true], ["no", "No", false], ["", "Not stated", null]].map(([v, l, b]) => (
              <label key={String(v)} className="flex items-center gap-1.5">
                <input type="radio" name={name} value={String(v)} defaultChecked={value === b || (b === null && value === undefined)} className="accent-[var(--color-primary)]" /> {String(l)}
              </label>
            ))}
          </div>
          {after}
        </fieldset>
      );
    case "select":
    case "ref":
      return (
        <label className="block" htmlFor={id}>
          {label}
          <select id={id} name={name} defaultValue={str} className={`${input} mt-1`}>
            <option value="">{f.required ? "Choose…" : "Not stated"}</option>
            {(f.kind === "select" ? f.options : (options ?? [])).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {after}
        </label>
      );
    case "multi": {
      const chosen = new Set(Array.isArray(value) ? value.map(String) : []);
      const opts = f.options ?? options ?? [];
      return (
        <fieldset>
          <legend>{label}</legend>
          <div className={`mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 ${opts.length > 18 ? "max-h-56 overflow-y-auto rounded-tile border border-border p-2" : ""}`}>
            {opts.map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-meta">
                <input type="checkbox" name={name} value={v} defaultChecked={chosen.has(v)} className="accent-[var(--color-primary)]" /> {l}
              </label>
            ))}
          </div>
          {after}
        </fieldset>
      );
    }
    case "lines":
      return (
        <label className="block" htmlFor={id}>
          {label}
          <textarea id={id} name={name} rows={4} defaultValue={Array.isArray(value) ? value.join("\n") : ""} className={`${input} mt-1`} />
          {after}
        </label>
      );
    case "textarea":
      return (
        <label className="block" htmlFor={id}>
          {label}
          <textarea id={id} name={name} rows={f.rows ?? 3} defaultValue={str} className={`${input} mt-1`} />
          {after}
        </label>
      );
    case "json":
      return (
        <label className="block" htmlFor={id}>
          {label}
          <textarea id={id} name={name} rows={4} defaultValue={value == null ? "" : JSON.stringify(value, null, 2)} className={`${input} mt-1 font-mono text-meta`} />
          {after}
        </label>
      );
    case "rows": {
      const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const count = rows.length + BLANK_ROWS;
      return (
        <fieldset>
          <legend>{label}</legend>
          <input type="hidden" name={`${name}.count`} value={count} />
          <div className="mt-1 space-y-2">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${f.columns.length}, minmax(0, 1fr))` }}>
                {f.columns.map((c) => (
                  <ColumnInput key={c.name} column={c} name={`${name}.${i}.${c.name}`} value={rows[i]?.[c.name]} showLabel={i === 0} />
                ))}
              </div>
            ))}
          </div>
          {after}
        </fieldset>
      );
    }
    case "group": {
      const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
      return (
        <fieldset>
          <legend>{label}</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {f.columns.map((c) => (
              <div key={c.name} className={c.kind === "textarea" ? "sm:col-span-2 lg:col-span-3" : undefined}>
                <ColumnInput column={c} name={`${name}.${c.name}`} value={getPath(obj, c.name)} showLabel />
              </div>
            ))}
          </div>
          {after}
        </fieldset>
      );
    }
    default:
      return (
        <label className="block" htmlFor={id}>
          {label}
          <input
            id={id}
            name={name}
            type={f.kind === "number" ? "text" : f.kind === "date" ? "date" : f.kind === "url" ? "url" : "text"}
            inputMode={f.kind === "number" ? "decimal" : undefined}
            defaultValue={str}
            maxLength={f.kind === "text" ? f.maxLength : undefined}
            className={`${input} mt-1`}
          />
          {after}
        </label>
      );
  }
}

function ColumnInput({ column: c, name, value, showLabel }: { column: Column; name: string; value: unknown; showLabel: boolean }) {
  const str = value === null || value === undefined ? "" : String(value);
  const control =
    c.kind === "select" ? (
      <select name={name} defaultValue={str} className={input} aria-label={c.label}>
        <option value="" />
        {c.options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    ) : c.kind === "textarea" ? (
      <textarea name={name} defaultValue={str} rows={2} className={input} aria-label={c.label} />
    ) : (
      <input name={name} type={c.kind === "date" ? "date" : "text"} inputMode={c.kind === "number" ? "decimal" : undefined} defaultValue={str} className={input} aria-label={c.label} />
    );
  return (
    <label className="block text-meta">
      {showLabel && <span className="mb-0.5 block text-ink-muted">{c.label}</span>}
      {control}
    </label>
  );
}
