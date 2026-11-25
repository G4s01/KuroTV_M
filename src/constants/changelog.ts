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
  versionCode: 64,
  releaseDate: "2026-11-25",
  title: "RELEASE UFFICIALE KUROTV MOBILE",
  highlights: [
  "Aggiornamento e miglioramenti prestazionali per Kuro Mobile.",
  "Compilazione ottimizzata per smartphone Android (sola architettura arm64-v8a)",
  "UI OLED touch nativa ad alte prestazioni a 60/120 FPS",
  "Video Player avanzato con controlli touch e supporto Picture-in-Picture"
],
  releaseNotes: "## [1.0.0] - 2026-11-25\n\n- Aggiornamento e miglioramenti prestazionali per Kuro Mobile.\n\n### Dettagli Tecnici\n- Compilazione ottimizzata per smartphone Android (sola architettura arm64-v8a)\n- UI OLED touch nativa ad alte prestazioni a 60/120 FPS\n- Video Player avanzato con controlli touch e supporto Picture-in-Picture",
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
