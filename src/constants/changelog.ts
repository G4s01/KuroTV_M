/**
 * KuroTV Mobile — Changelog & Release Notes Constants
 * Aggiornato automaticamente da build-release.sh durante il rilascio.
 */

export interface ChangelogEntry {
  version: string;
  versionCode: number;
  releaseDate: string;
  title: string;
  highlights: string[];
  releaseNotes?: string;
}

export const CURRENT_CHANGELOG: ChangelogEntry = {
  version: "1.0.0",
  versionCode: 63,
  releaseDate: "2026-11-25",
  title: "RELEASE UFFICIALE KUROTV MOBILE",
  highlights: [
  "Il pulsante riproduci nella scheda dettagli ora riprende la visione;",
  "I controlli di volume e luminosità nel player hanno ora un'escursione adattiva e controlli nativi."
],
  releaseNotes: "## [1.0.0] - 2026-11\n\n- Il pulsante riproduci nella scheda dettagli ora riprende la visione;\n- I controlli di volume e luminosità nel player hanno ora un'escursione adattiva e controlli nativi.",
};

export function formatChangelog(entry: ChangelogEntry): string {
  if (entry.releaseNotes && entry.releaseNotes.trim().length > 0) {
    const raw = entry.releaseNotes.trim();
    const nonHeaderLines = raw.split("\n").filter((l) => l.trim().length > 0 && !l.trim().startsWith("## ["));
    if (nonHeaderLines.length > 0) {
      return raw.toUpperCase();
    }
  }
  const lines: string[] = [
    `=== ${entry.title} (V${entry.version} BUILD ${entry.versionCode}) ===`,
    `DATA DI RILASCIO: ${entry.releaseDate}`,
    "",
    ...entry.highlights.map((h, i) => `${i + 1}. ${h}`),
  ];
  return lines.join("\n");
}
