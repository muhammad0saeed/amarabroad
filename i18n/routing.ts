import { defineRouting } from "next-intl/routing";

// Every page exists twice: /en/... and /bn/... (a static export can't run
// next-intl's middleware, so the language always lives in the URL).
export const routing = defineRouting({
  locales: ["en", "bn"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
