import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { BottomSheet } from '@expo/ui';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, oledTheme } from '@/theme';

export interface PlayerInfoSheetProps {
  isVisible: boolean;
  onClose: () => void;
  animeTitle: string;
  episodeNumber: number;
  episodeTitle?: string;
  episodeDescription?: string;
  animeImage?: string;
  description?: string;
  genres?: string[];
  status?: string;
  releaseYear?: number;
}

export const PlayerInfoSheet: React.FC<PlayerInfoSheetProps> = React.memo(({
  isVisible,
  onClose,
  animeTitle,
  episodeNumber,
  episodeTitle,
  episodeDescription,
  animeImage,
  description,
  genres = [],
  status,
  releaseYear,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const activeDescription = episodeDescription || description;

  const safeHorizontalInset = Math.max(insets.left, insets.right);
  const horizontalPadding = Math.max(16, safeHorizontalInset);

  return (
    <BottomSheet
      isPresented={isVisible}
      onDismiss={onClose}
      showDragIndicator={true}
      containerColor={theme.colors.card}
      contentPadding={0}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.card,
            paddingLeft: horizontalPadding,
            paddingRight: horizontalPadding,
            paddingBottom: Math.max(24, insets.bottom + 12),
          },
        ]}
      >
        <ScrollView
          style={{ maxHeight: isLandscape ? 280 : 520 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            {animeImage ? (
              <Image
                source={{ uri: animeImage }}
                style={[styles.poster, { borderColor: theme.colors.border }]}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.posterPlaceholder,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <Ionicons name="film-outline" size={32} color={theme.colors.textMuted} />
              </View>
            )}

            <View style={styles.mainInfo}>
              <Text style={[styles.animeTitle, { color: theme.colors.text }]} numberOfLines={2}>
                {animeTitle.toUpperCase()}
              </Text>

              <View
                style={[
                  styles.episodeBadge,
                  { backgroundColor: `${theme.colors.primary}25`, borderColor: theme.colors.primary },
                ]}
              >
                <Ionicons name="play-circle" size={14} color={theme.colors.primary} />
                <Text style={[styles.episodeBadgeText, { color: theme.colors.primary }]}>
                  EPISODIO {episodeNumber}
                  {episodeTitle ? `: ${episodeTitle.toUpperCase()}` : ''}
                </Text>
              </View>

              {(releaseYear || status) && (
                <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                  {[releaseYear, status].filter(Boolean).join(' • ').toUpperCase()}
                </Text>
              )}

              {genres.length > 0 && (
                <View style={styles.genresRow}>
                  {genres.slice(0, 4).map((g) => (
                    <View
                      key={g}
                      style={[
                        styles.genreChip,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                      ]}
                    >
                      <Text style={[styles.genreText, { color: theme.colors.textSecondary }]}>
                        {g.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.synopsisSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
              {episodeDescription ? 'TRAMA EPISODIO' : 'TRAMA'}
            </Text>
            <View
              style={[
                styles.synopsisBox,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.synopsisText, { color: theme.colors.text }]}>
                {activeDescription
                  ? activeDescription.toUpperCase()
                  : 'NESSUNA DESCRIZIONE DISPONIBILE PER QUESTO TITOLO.'}
              </Text>
            </View>
          </View>

          <Pressable
            style={[
              styles.closeBtn,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="CHIUDI SCHEDA INFORMAZIONI"
          >
            <Text style={[styles.closeBtnText, { color: theme.colors.text }]}>CHIUDI</Text>
          </Pressable>
        </ScrollView>
      </View>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    gap: 14,
  },
  poster: {
    width: 84,
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
  },
  posterPlaceholder: {
    width: 84,
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInfo: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  animeTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: oledTheme.typography.title.fontFamily,
  },
  episodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  episodeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  genreChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  genreText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
  },
  synopsisSection: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: oledTheme.typography.caption.fontFamily,
    letterSpacing: 0.5,
  },
  synopsisBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  synopsisText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: oledTheme.typography.body.fontFamily,
  },
  closeBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: oledTheme.typography.title.fontFamily,
  },
});
