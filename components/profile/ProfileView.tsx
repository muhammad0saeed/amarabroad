"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { ButtonLink, buttonClass, EmptyState } from "@/components/ui/primitives";
import { profileStore, useHydrated, useStore } from "@/lib/clientStore";
import { isProfileComplete, parseProfileFile, profileFileContents } from "@/lib/profile";
import { site } from "@/lib/site";
import { ProfileForm, type ProfileFormOptions } from "./ProfileForm";

export function ProfileView({ options }: { options: ProfileFormOptions }) {
  const t = useTranslations("profile");
  const hydrated = useHydrated();
  const profile = useStore(profileStore);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  function exportFile() {
    if (!profile) return;
    const blob = new Blob([profileFileContents(profile, site.name)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${site.name.toLowerCase()}-profile.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const parsed = file.size < 200_000 ? parseProfileFile(await file.text()) : null;
    if (parsed && isProfileComplete(parsed)) {
      profileStore.set(parsed);
      setFormKey((k) => k + 1);
      setMessage({ tone: "ok", text: t("imported") });
    } else {
      setMessage({ tone: "error", text: t("importFailed") });
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function remove() {
    if (window.confirm(t("deleteConfirm"))) {
      profileStore.clear();
      setFormKey((k) => k + 1);
      setMessage({ tone: "ok", text: t("deleted") });
    }
  }

  if (!hydrated) return <p className="text-ink-muted">{t("loading")}</p>;

  return (
    <div className="space-y-5">
      <p className="flex gap-2 rounded-card bg-primary-soft p-4 text-meta text-primary-ink">
        <Icon name="info" className="size-5 shrink-0" /> {t("privacy")}
      </p>

      {message && (
        <p role="status" className={`rounded-tile p-3 text-meta font-semibold ${message.tone === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportFile} disabled={!profile} className={buttonClass("secondary", "sm")}>
          <Icon name="download" className="size-4" /> {t("export")}
        </button>
        <label className={`${buttonClass("secondary", "sm")} cursor-pointer`}>
          <Icon name="upload" className="size-4" /> {t("import")}
          <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void importFile(e.target.files?.[0])} />
        </label>
        <button type="button" onClick={remove} disabled={!profile} className={`${buttonClass("ghost", "sm")} text-danger`}>
          <Icon name="trash" className="size-4" /> {t("delete")}
        </button>
      </div>

      {isProfileComplete(profile) ? (
        <ProfileForm
          key={formKey}
          options={options}
          initial={profile}
          mode="full"
          submitLabel={t("save")}
          onSave={(p) => {
            profileStore.set(p);
            setMessage({ tone: "ok", text: t("saved") });
            window.scrollTo({ top: 0 });
          }}
        />
      ) : (
        <EmptyState icon="user" title={t("emptyTitle")} body={t("emptyBody")} action={<ButtonLink href="/match">{t("startQuiz")}</ButtonLink>} />
      )}
    </div>
  );
}
