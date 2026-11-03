// Line icons drawn for this app (24×24, 1.8px stroke, currentColor). Decorative by default.

import type { FieldGroup } from "@/types";

const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  match: "M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  bookmarkFilled: "M6 3h12v18l-6-4-6 4z",
  more: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  chevronRight: "M9 5l7 7-7 7",
  chevronLeft: "M15 5l-7 7 7 7",
  chevronDown: "M5 9l7 7 7-7",
  arrowRight: "M4 12h16M14 6l6 6-6 6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  pin: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  building: "M4 21V8l8-5 8 5v13M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z",
  coins: "M9 6a6 3 0 1 0 0 .01M3 6v4c0 1.7 2.7 3 6 3s6-1.3 6-3V6M9 13v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3",
  cap: "M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6",
  check: "M5 12.5l4.5 4.5L19 7",
  checkCircle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12l3 3 5-6",
  xCircle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01",
  alert: "M12 3 2 20h20zM12 10v4M12 17h.01",
  share: "M12 3v12M7 8l5-5 5 5M5 13v7h14v-7",
  copy: "M8 8h12v12H8zM4 16V4h12",
  chat: "M4 5h16v11H9l-5 4z",
  filter: "M4 6h16M7 12h10M10 18h4",
  compare: "M4 4h6v16H4zM14 4h6v16h-6z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  download: "M12 3v12M7 10l5 5 5-5M5 21h14",
  upload: "M12 15V3M7 8l5-5 5 5M5 21h14",
  user: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 4-6 8-6s8 2 8 6",
  tools: "M14 6a4 4 0 0 0 5 5l-8 8a2 2 0 0 1-3-3l8-8a4 4 0 0 0-2-2zM5 5l4 4",
  book: "M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z",
  scholarship: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  briefcase: "M3 8h18v12H3zM8 8V5h8v3M3 13h18",
  users: "M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2.4.6 4 2.4 4 5.2",
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1",
  heart: "M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20zM5 12h4l1.5-2 2 4 1.5-2h5",
  leaf: "M5 19c0-9 6-14 15-14 0 9-5 15-14 15zM5 19l8-8",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 14h9",
  ruler: "M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2",
  scale: "M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8",
  wifi: "M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",
  send: "M4 12 20 4l-6 16-3-7z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={name === "bookmarkFilled" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export const GROUP_ICON: Record<FieldGroup, IconName> = {
  computing: "code",
  engineering: "gear",
  business: "briefcase",
  social: "users",
  humanities: "book",
  health: "heart",
  life_sciences: "leaf",
  natural_sciences: "flask",
  design: "ruler",
};
