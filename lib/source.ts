// Which data the site runs on. Set NEXT_PUBLIC_DATA_SOURCE=supabase for real data (Vercel, and .env.local once the
// database is filled); anything else uses the Stage 1 sample data. Safe to import anywhere (no data attached).
export const DATA_SOURCE: "supabase" | "json" = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" ? "supabase" : "json";
export const IS_SAMPLE_DATA = DATA_SOURCE === "json";
