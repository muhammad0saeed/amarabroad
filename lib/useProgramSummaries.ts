"use client";

// Loads the summaries of a few programs (saved, compared) from the server, instead of every program.

import { useEffect, useState } from "react";
import { programsBySlug } from "@/app/actions/programs";
import type { ProgramSummary } from "./summary";

const NONE: ProgramSummary[] = [];

/** `programs` is null while loading. Programs that no longer exist are simply missing. */
export function useProgramSummaries(slugs: string[], enabled = true): ProgramSummary[] | null {
  const key = [...new Set(slugs)].sort().join(",");
  const [state, setState] = useState<{ key: string; programs: ProgramSummary[] } | null>(null);
  useEffect(() => {
    if (!enabled || !key) return;
    let live = true;
    programsBySlug(key.split(","))
      .then((programs) => live && setState({ key, programs }))
      .catch(() => live && setState({ key, programs: NONE }));
    return () => {
      live = false;
    };
  }, [key, enabled]);
  if (!key) return NONE;
  return state && state.key === key ? state.programs : null;
}
