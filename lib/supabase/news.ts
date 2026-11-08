import "server-only";

// News links from the news robot (robot/news.ts, supabase/15_news.sql).

import { DATA_SOURCE } from "../source";
import { serviceClient } from "./clients";

export interface NewsLink {
  id: number;
  url: string;
  title: string;
  source: string;
  official: boolean;
  published_on: string;
  countries: string[];
  topics: string[];
  kind: "news" | "deadline" | "evergreen" | "open";
  deadline: string | null;
}

/** Newest first; expired links are already removed by the robot, and skipped here in case it hasn't run yet. */
export async function listNews(limit = 300): Promise<NewsLink[]> {
  if (DATA_SOURCE !== "supabase") return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await serviceClient()
    .from("news_links")
    .select("id, url, title, source, official, published_on, countries, topics, kind, deadline")
    .or(`expires_on.is.null,expires_on.gte.${today}`)
    .order("published_on", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as NewsLink[];
}
