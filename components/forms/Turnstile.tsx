"use client";

// Cloudflare Turnstile: a privacy-friendly "are you a person?" check, usually invisible.
// Its script loads only when a form is on screen: the one outside request the site makes, and only here.
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY (local testing) nothing is shown.

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't load")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Turnstile didn't load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export const TURNSTILE_ENABLED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

/** Calls onToken with a fresh token (or null when it expires). Remount it (change `key`) after each send: tokens work once. */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  });

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey || !ref.current) return;
    let id: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !ref.current) return;
        id = api.render(ref.current, {
          sitekey: siteKey,
          language: locale === "bn" ? "en" : locale,
          appearance: "interaction-only",
          callback: (t: string) => callback.current(t),
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        });
      })
      .catch(() => callback.current(null));
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [locale]);

  if (!TURNSTILE_ENABLED) return null;
  return <div ref={ref} className="min-h-0" />;
}
