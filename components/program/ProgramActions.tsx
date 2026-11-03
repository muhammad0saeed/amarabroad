"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/primitives";
import { compareStore, savedStore, toggleIn, useHydrated, useStore } from "@/lib/clientStore";
import { COMPARE_MAX } from "@/lib/filters";

function useSave(slug: string) {
  const saved = useStore(savedStore);
  return { isSaved: saved.includes(slug), toggle: () => savedStore.set((list) => toggleIn(list, slug)) };
}

function useCompare(slug: string) {
  const ids = useStore(compareStore);
  const selected = ids.includes(slug);
  return { selected, full: !selected && ids.length >= COMPARE_MAX, toggle: () => compareStore.set((list) => toggleIn(list, slug, COMPARE_MAX)) };
}

/** Icon buttons on program cards: save and add to compare. */
export function ProgramCardActions({ slug, title }: { slug: string; title: string }) {
  const t = useTranslations("program");
  const hydrated = useHydrated();
  const save = useSave(slug);
  const compare = useCompare(slug);
  const iconButton = "grid size-tap place-items-center rounded-full hover:bg-surface-2 disabled:opacity-40";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={compare.toggle}
        disabled={!hydrated || compare.full}
        aria-pressed={compare.selected}
        aria-label={t(compare.selected ? "removeCompareNamed" : "addCompareNamed", { title })}
        title={compare.full ? t("compareFull", { max: COMPARE_MAX }) : undefined}
        className={`${iconButton} ${compare.selected ? "text-primary-ink" : "text-ink-muted"}`}
      >
        <Icon name="compare" />
      </button>
      <button
        type="button"
        onClick={save.toggle}
        disabled={!hydrated}
        aria-pressed={save.isSaved}
        aria-label={t(save.isSaved ? "unsaveNamed" : "saveNamed", { title })}
        className={`${iconButton} ${save.isSaved ? "text-primary-ink" : "text-ink-muted"}`}
      >
        <Icon name={save.isSaved ? "bookmarkFilled" : "bookmark"} />
      </button>
    </div>
  );
}

/** Full-width buttons on the program page: save, compare, share. */
export function ProgramPageActions({ slug, title }: { slug: string; title: string }) {
  const t = useTranslations("program");
  const hydrated = useHydrated();
  const save = useSave(slug);
  const compare = useCompare(slug);
  const [shared, setShared] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      }
    } catch {
      // Share sheet dismissed.
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <button type="button" onClick={save.toggle} disabled={!hydrated} aria-pressed={save.isSaved} className={buttonClass(save.isSaved ? "soft" : "secondary", "sm", true)}>
        <Icon name={save.isSaved ? "bookmarkFilled" : "bookmark"} className="size-4" />
        {t(save.isSaved ? "saved" : "save")}
      </button>
      <button
        type="button"
        onClick={compare.toggle}
        disabled={!hydrated || compare.full}
        aria-pressed={compare.selected}
        className={buttonClass(compare.selected ? "soft" : "secondary", "sm", true)}
      >
        <Icon name="compare" className="size-4" />
        {t(compare.selected ? "inCompare" : "compare")}
      </button>
      <button type="button" onClick={share} className={buttonClass("secondary", "sm", true)}>
        <Icon name={shared ? "check" : "share"} className="size-4" />
        <span aria-live="polite">{t(shared ? "linkCopied" : "share")}</span>
      </button>
    </div>
  );
}
