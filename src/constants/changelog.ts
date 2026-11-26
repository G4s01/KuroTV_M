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
  versionCode: 70,
  releaseDate: "2026-11-26",
  title: "RELEASE UFFICIALE KUROTV MOBILE",
  highlights: [
  "Ripresa della visione dal Play Button nella Scheda Dettagli;",
  "Fix escursione gesture volume e luminosità del player nonché azione ora nativa;",
  "Fix finto buffering in seguito a ibernazione player video, continue pause o perdita sorgente;",
  "Fix deep-Links;",
  "Fix player nelle notifiche: ora riporta al player di Kuro e la timeline è in tempo reale;",
  "Pop-Up e rimando per i permessi sul risparmio energetico dell'app, 'Nessuna Restrizione'.",
  "MAL SYNC & VISUALIZE"
],
  releaseNotes: "## [1.0.0] - 2026-11-26\n\n- Ripresa della visione dal Play Button nella Scheda Dettagli;\n- Fix escursione gesture volume e luminosità del player nonché azione ora nativa;\n- Fix finto buffering in seguito a ibernazione player video, continue pause o perdita sorgente;\n- Fix deep-Links;\n- Fix player nelle notifiche: ora riporta al player di Kuro e la timeline è in tempo reale;\n- Pop-Up e rimando per i permessi sul risparmio energetico dell'app, 'Nessuna Restrizione'.\n- MAL SYNC & VISUALIZE",
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
