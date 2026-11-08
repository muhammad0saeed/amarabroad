// App icons, from Phosphor (one family, one weight). The SSR build works in Server and Client Components.
// Call sites use <Icon name="…" />, so swapping a glyph happens here only.

import {
  ArrowRight,
  ArrowUpRight,
  BookmarkSimple,
  BookOpen,
  Briefcase,
  Buildings,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChatCircleText,
  Check,
  CheckCircle,
  Clock,
  Code,
  Coins,
  Columns,
  Copy,
  DownloadSimple,
  Flask,
  Gear,
  GlobeHemisphereEast,
  GraduationCap,
  Heartbeat,
  House,
  Info,
  Leaf,
  Lightning,
  List,
  MagnifyingGlass,
  MapPin,
  Medal,
  Minus,
  Palette,
  PaperPlaneTilt,
  Plus,
  Ruler,
  Scales,
  ShareNetwork,
  SlidersHorizontal,
  Sparkle,
  Trash,
  UploadSimple,
  User,
  UsersThree,
  Warning,
  WifiHigh,
  Wrench,
  X,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { FieldGroup } from "@/types";

const ICONS = {
  home: House,
  search: MagnifyingGlass,
  match: Sparkle,
  bookmark: BookmarkSimple,
  bookmarkFilled: BookmarkSimple,
  more: List,
  close: X,
  chevronRight: CaretRight,
  chevronLeft: CaretLeft,
  chevronDown: CaretDown,
  arrowRight: ArrowRight,
  external: ArrowUpRight,
  calendar: CalendarBlank,
  clock: Clock,
  pin: MapPin,
  building: Buildings,
  globe: GlobeHemisphereEast,
  coins: Coins,
  cap: GraduationCap,
  check: Check,
  checkCircle: CheckCircle,
  xCircle: XCircle,
  info: Info,
  alert: Warning,
  share: ShareNetwork,
  copy: Copy,
  chat: ChatCircleText,
  filter: SlidersHorizontal,
  compare: Columns,
  trash: Trash,
  download: DownloadSimple,
  upload: UploadSimple,
  user: User,
  tools: Wrench,
  book: BookOpen,
  scholarship: Medal,
  bolt: Lightning,
  briefcase: Briefcase,
  users: UsersThree,
  code: Code,
  gear: Gear,
  heart: Heartbeat,
  leaf: Leaf,
  flask: Flask,
  ruler: Ruler,
  scale: Scales,
  palette: Palette,
  wifi: WifiHigh,
  send: PaperPlaneTilt,
  plus: Plus,
  minus: Minus,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "size-5", label, weight }: { name: IconName; className?: string; label?: string; weight?: "regular" | "bold" | "fill" }) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      className={className}
      weight={weight ?? (name === "bookmarkFilled" ? "fill" : "regular")}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
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
  law: "scale",
  education: "cap",
  arts: "palette",
};
