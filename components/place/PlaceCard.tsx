import { Icon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import type { Photo } from "@/types";

/**
 * A photo card for a country or city. In lite mode the photo is dropped (no download at all,
 * since the <img> is never rendered visible and lazy images outside the viewport aren't fetched).
 */
export function PlaceCard({
  href,
  title,
  subtitle,
  photo,
  stats,
  size = "md",
}: {
  href: string;
  title: string;
  subtitle?: string;
  photo?: Photo;
  stats: string[];
  size?: "md" | "lg";
}) {
  return (
    <article className="group/place relative overflow-hidden rounded-card bg-surface shadow-card">
      <div className={`relative bg-surface-2 lite:hidden ${size === "lg" ? "aspect-[4/3] sm:aspect-[3/2]" : "aspect-[16/10]"}`}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- already sized WebP; next/image would re-encode it.
          <img src={photo.src} alt="" loading="lazy" decoding="async" width={960} height={640} className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover/place:scale-[1.03]" />
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 className={`font-bold tracking-tight ${size === "lg" ? "text-title" : "text-heading"}`}>
            <Link href={href} className="after:absolute after:inset-0 after:z-10">
              {title}
            </Link>
          </h3>
          {subtitle && <p className="mt-0.5 line-clamp-1 text-meta text-white/80">{subtitle}</p>}
        </div>
      </div>
      {/* Lite mode: text only. */}
      <div className="hidden p-4 lite:block">
        <h3 className="text-heading font-bold">
          <Link href={href} className="after:absolute after:inset-0 after:z-10">
            {title}
          </Link>
        </h3>
        {subtitle && <p className="mt-0.5 text-meta text-ink-muted">{subtitle}</p>}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-meta">
        <p className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5">
          {stats.map((s, i) => (
            <span key={i} className={i === 0 ? "font-semibold" : "text-ink-muted"}>
              {s}
            </span>
          ))}
        </p>
        <Icon name="arrowRight" className="size-4 shrink-0 text-ink-muted transition-transform group-hover/place:translate-x-0.5" />
      </div>
    </article>
  );
}
