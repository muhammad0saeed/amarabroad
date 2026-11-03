import localFont from "next/font/local";

// Self-hosted variable fonts (SIL Open Font License, see fonts/LICENSE-*.txt).
// unicode-range lets the browser fetch each file only when its script appears.

export const inter = localFont({
  src: "./fonts/inter-latin-var.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

// Also carries ৳ (U+09F3), so English pages showing taka use it too.
// Not preloaded: unicode-range makes the browser fetch it as soon as Bangla text or ৳ appears,
// without making English pages download 108 KB before anything else. Android ships its own
// Noto Sans Bengali, so the swap is barely visible.
export const notoBengali = localFont({
  src: "./fonts/noto-sans-bengali-var.woff2",
  weight: "100 900",
  variable: "--font-bengali",
  display: "swap",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1",
    },
  ],
});
