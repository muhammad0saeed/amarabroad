import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

/** Text the app shell's client components need on every page (header, bottom nav, More menu, compare tray). */
export const SHELL_NAMESPACES = ["header", "nav", "compare"] as const;

/**
 * Sends the browser only the UI text a page's client components use, instead of every string in the app.
 * Server components read all messages on the server regardless.
 */
export async function ClientMessages({ namespaces, children }: { namespaces: readonly string[]; children: ReactNode }) {
  const all = (await getMessages()) as Record<string, unknown>;
  const messages = Object.fromEntries([...new Set([...SHELL_NAMESPACES, ...namespaces])].map((ns) => [ns, all[ns]]));
  return <NextIntlClientProvider messages={messages as never}>{children}</NextIntlClientProvider>;
}
