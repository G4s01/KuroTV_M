import { AppStorage, type ContinueWatchingItem } from './index';
import { AnimeWorldScraper } from '../scraper';
import type { AnimeItem } from '@/types';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * 1. Controllo passivo istantaneo sui dati recenti della Home (a costo di rete zero).
 * Confronta le serie in pari con gli 'ultimi episodi' caricati nella Home.
 */
export async function syncCaughtUpWithHomeList(recentItems: AnimeItem[]): Promise<boolean> {
  if (!recentItems || recentItems.length === 0) return false;

  const continueList = AppStorage.getContinueWatching();
  const caughtUpItems = continueList.filter((item) => item.isCaughtUp);
  if (caughtUpItems.length === 0) return false;

  let anyUpdated = false;

  for (const item of caughtUpItems) {
    // Cerchiamo se l'anime è presente tra le ultime uscite
    const match = recentItems.find(
      (r) =>
        r.id === item.animeId ||
        (r.title && item.title && r.title.toLowerCase().trim() === item.title.toLowerCase().trim())
    );

    if (match && match.badge) {
      // Estraiamo il numero di episodio dal badge (es: "Episodio 13", "Ep. 13", "13")
      const numMatch = match.badge.match(/(\d+)/);
      if (numMatch && numMatch[1]) {
        const epNum = parseInt(numMatch[1], 10);
        if (epNum > item.episodeNumber) {
          try {
            const detail = await AnimeWorldScraper.getAnimeDetail(item.animeId);
            if (detail?.episodes && detail.episodes.length > 0) {
              const newEp =
                detail.episodes.find((e) => e.number === epNum) ||
                detail.episodes.find((e) => e.number > item.episodeNumber);
              if (newEp) {
                const updated = AppStorage.updateContinueWatchingEpisode(
                  item.animeId,
                  { id: newEp.id, number: newEp.number, dataId: newEp.dataId },
                  detail.totalEpisodes
                );
                if (updated) anyUpdated = true;
              }
            }
          } catch (err) {
            console.warn('[continue-watching-sync] Errore sync da Home list:', err);
          }
        }
      }
    }
  }

  return anyUpdated;
}

/**
 * 2. Controllo remoto periodico (Ibrido Smart).
 * Se sono passate almeno 4 ore dall'ultimo check per le serie in pari (o se force === true),
 * interroga AnimeWorld in background per verificare la disponibilità del nuovo episodio o la conclusione della serie.
 */
export async function syncCaughtUpWithRemote(force = false): Promise<boolean> {
  const continueList = AppStorage.getContinueWatching();
  const caughtUpItems = continueList.filter((item) => item.isCaughtUp);
  if (caughtUpItems.length === 0) return false;

  const now = Date.now();
  const dueItems = caughtUpItems.filter(
    (item) => force || !item.lastCheckedAt || now - item.lastCheckedAt >= FOUR_HOURS_MS
  );

  if (dueItems.length === 0) return false;

  let anyUpdated = false;

  const results = await Promise.allSettled(
    dueItems.map(async (item) => {
      try {
        const detail = await AnimeWorldScraper.getAnimeDetail(item.animeId);
        if (!detail) {
          AppStorage.markContinueWatchingChecked(item.animeId);
          return false;
        }

        const episodes = detail.episodes || [];
        // Verifica se è presente un episodio successivo rispetto a quello visto
        const nextEp = episodes.find((e) => e.number > item.episodeNumber);

        if (nextEp) {
          // Nuovo episodio rilasciato! Promuoviamo in cima al carosello a 0.00
          AppStorage.updateContinueWatchingEpisode(
            item.animeId,
            { id: nextEp.id, number: nextEp.number, dataId: nextEp.dataId },
            detail.totalEpisodes
          );
          return true;
        }

        // Se non c'è un nuovo episodio, verifichiamo se la serie si è conclusa definitivamente
        const statusStr = (detail.status || detail.state || '').toLowerCase();
        const totalStr = String(detail.totalEpisodes || '').trim();
        const isStillOngoing =
          totalStr.includes('?') || statusStr.includes('in corso') || statusStr.includes('ongoing');

        if (!isStillOngoing && totalStr && !totalStr.includes('?')) {
          const totalNum = parseInt(totalStr, 10);
          if (!isNaN(totalNum) && item.episodeNumber >= totalNum) {
            // Serie conclusa definitivamente e l'utente ha visto l'ultimo episodio: rimuoviamo da continua a guardare
            AppStorage.removeContinueWatching(item.animeId);
            return true;
          }
        }

        // Se totalEpisodes è stato aggiornato, lo sincronizziamo
        if (detail.totalEpisodes && detail.totalEpisodes !== item.totalEpisodes) {
          AppStorage.updateContinueWatchingEpisode(
            item.animeId,
            { id: item.episodeId, number: item.episodeNumber, dataId: item.dataId },
            detail.totalEpisodes
          );
          return true;
        } else {
          AppStorage.markContinueWatchingChecked(item.animeId);
        }

        return false;
      } catch (err) {
        console.warn(`[continue-watching-sync] Errore check per ${item.title}:`, err);
        return false;
      }
    })
  );

  for (const res of results) {
    if (res.status === 'fulfilled' && res.value === true) {
      anyUpdated = true;
    }
  }

  return anyUpdated;
}
