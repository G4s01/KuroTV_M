import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getContrastTextColor } from '@/theme';
import type { ContinueWatchingItem } from '@/types';
import { homeStyles as styles } from './home.styles';

export interface ContinueWatchingSectionProps {
  items: ContinueWatchingItem[];
  onItemPress: (item: ContinueWatchingItem) => void;
  onRemoveItem: (item: ContinueWatchingItem) => void;
}

export function ContinueWatchingSection({
  items,
  onItemPress,
  onRemoveItem,
}: ContinueWatchingSectionProps) {
  const { theme } = useTheme();

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>RIPRENDI A GUARDARE</Text>
        <Text
          style={[
            styles.sectionBadge,
            {
              backgroundColor: theme.colors.primary,
              color: getContrastTextColor(theme.colors.primary),
            },
          ]}
        >
          {items.length}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
      >
        {items.map((item) => (
          <Pressable
            key={`${item.animeId}-${item.episodeId}`}
            style={styles.continueCard}
            onPress={() => onItemPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`RIPRENDI ${item.title.toUpperCase()}`}
          >
            <View
              style={[
                styles.continueThumbWrapper,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              {item.thumbnail ? (
                <Image
                  source={{ uri: item.thumbnail }}
                  style={styles.continueThumb}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.continueThumb, styles.continueFallback, { backgroundColor: theme.colors.card }]}>
                  <Ionicons name="film" size={24} color={theme.colors.textMuted} />
                </View>
              )}

              {/* Tasto rimozione in alto a destra */}
              <Pressable
                style={styles.removeContinueBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  onRemoveItem(item);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={`RIMUOVI ${item.title.toUpperCase()} DA RIPRENDI A GUARDARE`}
              >
                <View style={styles.removeContinueIconWrapper}>
                  <Ionicons name="remove" size={14} color="#FFFFFF" />
                </View>
              </Pressable>

              <View style={styles.playOverlay}>
                <Ionicons name="play-circle" size={32} color="#FFFFFF" />
              </View>
              <View style={styles.progressBarWrapper}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, item.percentage || 0)}%`,
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={[styles.continueTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.continueSubtitle, { color: theme.colors.textMuted }]}>
              EPISODIO {item.episodeNumber} ({item.percentage}%)
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
