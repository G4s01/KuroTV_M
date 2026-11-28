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
  versionCode: 80,
  releaseDate: "2026-11-28",
  title: "RELEASE UFFICIALE KUROTV MOBILE",
  highlights: [
  "RELEASE UFFICIALE V1.0.0 (BUILD 80)"
],
  releaseNotes: "## [1.0.0] - 2026-11-28\n\nPLAYER GESTURES\nBATTERY SETTINGS",
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
