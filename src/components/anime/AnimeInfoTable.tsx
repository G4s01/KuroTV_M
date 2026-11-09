import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { oledTheme, getContrastTextColor, type Theme } from '@/theme';
import type { AnimeDetail } from '@/types';

export interface AnimeInfoTableProps {
  anime: AnimeDetail;
  theme: Theme;
}

export const AnimeInfoTable = React.memo<AnimeInfoTableProps>(
  function AnimeInfoTable({ anime, theme }) {
    const primaryContrast = getContrastTextColor(theme.colors.primary);

    // Metadata field values
    const audioText = anime.audio ? anime.audio.toUpperCase() : 'GIAPPONESE';
    const releaseText = anime.releaseDate
      ? anime.releaseDate.toUpperCase()
      : anime.releaseYear
        ? String(anime.releaseYear)
        : 'N/D';
    const studioText =
      anime.studio ||
      (anime.studios && anime.studios.length > 0 ? anime.studios.join(', ') : 'N/D');
    const genreText =
      anime.genres && anime.genres.length > 0 ? anime.genres.join(', ') : 'N/D';
    const ratingText = anime.rating
      ? anime.rating.toUpperCase()
      : anime.score
        ? `${anime.score} / 10`
        : 'N/D';
    const durationText = anime.duration ? anime.duration.toUpperCase() : '24 MIN';
    const episodesText = anime.totalEpisodes
      ? String(anime.totalEpisodes)
      : anime.episodes && anime.episodes.length > 0
        ? String(anime.episodes.length)
        : 'N/D';
    const statusText = anime.status
      ? anime.status.toUpperCase()
      : anime.state
        ? anime.state.toUpperCase()
        : 'IN CORSO';

    // Actions
    const handleOpenTrailer = () => {
      Haptics.selectionAsync().catch(() => {});
      const url =
        anime.trailer ||
        anime.trailerUrl ||
        `https://www.youtube.com/results?search_query=${encodeURIComponent(`${anime.title} trailer official`)}`;
      Linking.openURL(url).catch(() => {});
    };

    const handleOpenMal = () => {
      Haptics.selectionAsync().catch(() => {});
      const url =
        anime.myanimelistLink ||
        (anime.malId
          ? `https://myanimelist.net/anime/${anime.malId}`
          : `https://myanimelist.net/anime.php?q=${encodeURIComponent(anime.title)}`);
      Linking.openURL(url).catch(() => {});
    };

    const handleOpenAnilist = () => {
      Haptics.selectionAsync().catch(() => {});
      const url =
        anime.anilistLink ||
        (anime.anilistId
          ? `https://anilist.co/anime/${anime.anilistId}`
          : `https://anilist.co/search/anime?search=${encodeURIComponent(anime.title)}`);
      Linking.openURL(url).catch(() => {});
    };

    return (
      <View style={styles.container}>
        <View style={styles.sectionHeadingRow}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
          <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
            DETTAGLI & SCHEDA TECNICA
          </Text>
        </View>

        {/* Tabella Ordinata */}
        <View
          style={[
            styles.tableCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {/* Riga 1: Audio & Stato */}
          <View style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.tableCell}>
              <View style={styles.cellHeader}>
                <Ionicons name="volume-medium-outline" size={13} color={theme.colors.primary} />
                <Text style={[styles.cellLabel, { color: theme.colors.textMuted }]}>AUDIO</Text>
              </View>
              <Text style={[styles.cellValue, { color: theme.colors.text }]} numberOfLines={1}>
                {audioText}
              </Text>
            </View>

            <View style={[styles.cellDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.tableCell}>
              <View style={styles.cellHeader}>
                <Ionicons name="pulse-outline" size={13} color={theme.colors.primary} />
                <Text style={[styles.cellLabel, { color: theme.colors.textMuted }]}>STATO</Text>
              </View>
              <Text style={[styles.cellValue, { color: theme.colors.text }]} numberOfLines={1}>
                {statusText}
              </Text>
            </View>
          </View>

          {/* Riga 2: Data di Uscita & Durata */}
          <View style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.tableCell}>
              <View style={styles.cellHeader}>
                <Ionicons name="calendar-outline" size={13} color={theme.colors.primary} />
                <Text style={[styles.cellLabel, { color: theme.colors.textMuted }]}>USCITA</Text>
              </View>
              <Text style={[styles.cellValue, { color: theme.colors.text }]} numberOfLines={1}>
                {releaseText}
              </Text>
            </View>

            <View style={[styles.cellDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.tableCell}>
              <View style={styles.cellHeader}>
                <Ionicons name="time-outline" size={13} color={theme.colors.primary} />
                <Text style={[styles.cellLabel, { color: theme.colors.textMuted }]}>DURATA</Text>
              </View>
              <Text style={[styles.cellValue, { color: theme.colors.text }]} numberOfLines={1}>
                {durationText}
              </Text>
            </View>
          </View>

          {/* Riga 3: Studio & Episodi */}
          <View style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.tableCell}>
              <View style={styles.cellHeader}>
                <Ionicons name="business-outline" size={13} color={theme.colors.primary} />
                <Text style={[styles.cellLabel, { color: theme.colors.textMuted }]}>STUDIO</Text>
              </View>
              <Text style={[styles.cellValue, { color: theme.colors.text }]} numberOfLines={1}>
                {studioText}
              </Text>
            </View>

            <View style={[styles.cellDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.tableCell}>
              <View style={styles.cellHeader}>
                <Ionicons name="film-outline" size={13} color={theme.colors.primary} />
                <Text style={[styles.cellLabel, { color: theme.colors.textMuted }]}>EPISODI</Text>
              </View>
              <Text style={[styles.cellValue, { color: theme.colors.text }]} numberOfLines={1}>
                {episodesText}
              </Text>
            </View>
          </View>

          {/* Riga 4: Voto & Genere */}
          <View style={styles.tableRow}>
            <View style={styles.tableCell}>
              <View style={styles.cellHeader}>
                <Ionicons name="star" size={13} color="#FBBF24" />
                <Text style={[styles.cellLabel, { color: theme.colors.textMuted }]}>VOTO</Text>
              </View>
              <Text style={[styles.cellValue, { color: theme.colors.text }]} numberOfLines={1}>
                {ratingText}
              </Text>
            </View>

            <View style={[styles.cellDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.tableCell}>
              <View style={styles.cellHeader}>
                <Ionicons name="pricetags-outline" size={13} color={theme.colors.primary} />
                <Text style={[styles.cellLabel, { color: theme.colors.textMuted }]}>GENERE</Text>
              </View>
              {anime.genres && anime.genres.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled={true}
                  style={styles.genreScroll}
                  contentContainerStyle={styles.genreScrollContent}
                >
                  <Text style={[styles.cellValue, { color: theme.colors.text, marginTop: 0 }]}>
                    {genreText}
                  </Text>
                </ScrollView>
              ) : (
                <Text style={[styles.cellValue, { color: theme.colors.text }]} numberOfLines={1}>
                  {genreText}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Link Esterni: Trailer, MyAnimeList, AniList */}
        <View style={styles.linksRow}>
          <Pressable
            style={[styles.linkBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={handleOpenTrailer}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="GUARDA IL TRAILER SU YOUTUBE"
          >
            <Ionicons name="logo-youtube" size={16} color="#FF0000" />
            <Text style={[styles.linkBtnText, { color: theme.colors.text }]}>TRAILER</Text>
          </Pressable>

          <Pressable
            style={[styles.linkBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={handleOpenMal}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="APRI SCHEDA SU MYANIMELIST"
          >
            <Ionicons name="open-outline" size={15} color="#2E51A2" />
            <Text style={[styles.linkBtnText, { color: theme.colors.text }]}>MYANIMELIST</Text>
          </Pressable>

          <Pressable
            style={[styles.linkBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={handleOpenAnilist}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="APRI SCHEDA SU ANILIST"
          >
            <Ionicons name="open-outline" size={15} color="#02A9FF" />
            <Text style={[styles.linkBtnText, { color: theme.colors.text }]}>ANILIST</Text>
          </Pressable>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableCard: {
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 2,
  },
  cellDivider: {
    width: 1,
  },
  cellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cellLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cellValue: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: oledTheme.typography.body.fontFamily,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  genreScroll: {
    marginTop: 2,
  },
  genreScrollContent: {
    alignItems: 'center',
    paddingRight: 6,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 8,
  },
  linkBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: oledTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  linkBtnText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
});
