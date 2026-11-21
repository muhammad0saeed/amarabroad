import { createElement, type ComponentProps } from "react";
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware replacements for next/link and next/navigation.
const nav = createNavigation(routing);
export const { redirect, usePathname, useRouter, getPathname } = nav;

/**
 * Links don't load their page in the background unless asked (prefetch). A search result or list shows many
 * program links, and each background load rebuilt that page on Vercel, using up the free plan's 200,000
 * monthly page rebuilds (22 Nov 2026). Pages still open quickly: they are kept for a day after the first visit.
 */
export function Link(props: ComponentProps<typeof nav.Link>) {
  return createElement(nav.Link, { prefetch: false, ...props });
}
