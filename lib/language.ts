// Name of a teaching language ("fr" → "French" / "ফরাসি"). Our own wording first; any other language
// the robot finds gets its name from the browser's built-in list, so a new language never shows an error.

type Labels = { has: (key: string) => boolean; (key: string): string };

export function languageName(labels: Labels, code: string, locale: string): string {
  if (labels.has(`lang.${code}`)) return labels(`lang.${code}`);
  try {
    return new Intl.DisplayNames([locale === "bn" ? "bn" : "en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
