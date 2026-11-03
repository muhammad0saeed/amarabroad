"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/primitives";

/** A plain Bangla summary parents can read, copy or forward (always in Bangla, built on the server). */
export function ParentSummary({ text, title }: { text: string; title: string }) {
  const t = useTranslations("parent");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title, text });
      else await copy();
    } catch {
      // Share sheet dismissed.
    }
  }

  return (
    <section aria-labelledby="parent-title" className="rounded-card bg-surface p-4 shadow-card sm:p-5">
      <h2 id="parent-title" className="flex items-center gap-2 text-heading font-semibold">
        <Icon name="users" /> {t("title")}
      </h2>
      <p className="mt-1 text-meta text-ink-muted">{t("intro")}</p>
      <pre lang="bn" className="mt-3 rounded-tile bg-surface-2 p-3 font-sans text-meta whitespace-pre-wrap">
        {text}
      </pre>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className={buttonClass("secondary", "sm", true)}>
          <Icon name={copied ? "check" : "copy"} className="size-4" />
          <span aria-live="polite">{t(copied ? "copied" : "copy")}</span>
        </button>
        <button type="button" onClick={share} className={buttonClass("secondary", "sm", true)}>
          <Icon name="share" className="size-4" /> {t("share")}
        </button>
      </div>
    </section>
  );
}
