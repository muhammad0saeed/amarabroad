// Runs after `next build` (npm "postbuild").
//
// Next.js 16 writes the client router's prefetch files as out/<route>/__next.<segment.path>.txt.
// On Windows the exporter keeps backslashes in the segment path, so those files end up nested
// (out/en/__next.$d$locale/__PAGE__.txt) and the browser's request for
// out/en/__next.$d$locale.__PAGE__.txt gets a 404. This moves nested files to the flat name.
// On macOS/Linux nothing is nested, so it does nothing.

import { readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = join(process.cwd(), "out");
let moved = 0;

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name.startsWith("__next.")) {
      for (const file of filesUnder(path)) {
        const flat = join(dir, `${name}.${relative(path, file).split(sep).join(".")}`);
        renameSync(file, flat);
        moved++;
      }
      rmSync(path, { recursive: true, force: true });
    } else {
      walk(path);
    }
  }
}

walk(OUT);
if (moved) console.log(`fix-export-segments: moved ${moved} prefetch files to their flat names`);
