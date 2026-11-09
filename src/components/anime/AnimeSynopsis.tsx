import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { oledTheme, type Theme } from '@/theme';

export interface AnimeSynopsisProps {
  synopsis?: string;
  description?: string;
  theme: Theme;
}

export const AnimeSynopsis = React.memo<AnimeSynopsisProps>(
  function AnimeSynopsis({ synopsis, description, theme }) {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const content = synopsis || description;

    if (!content) return null;

    return (
      <View style={styles.synopsisContainer}>
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
          TRAMA
        </Text>
        <Text
          style={[styles.synopsis, { color: theme.colors.textSecondary }]}
          numberOfLines={isExpanded ? undefined : 3}
        >
          {content}
        </Text>
        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          hitSlop={8}
          style={styles.toggleBtn}
          accessibilityLabel={isExpanded ? 'MOSTRA MENO' : 'LEGGI TUTTO'}
        >
          <Text style={[styles.readMore, { color: theme.colors.primary }]}>
            {isExpanded ? 'MOSTRA MENO' : 'LEGGI TUTTO'}
          </Text>
        </Pressable>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  synopsisContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.title.fontFamily,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  synopsis: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: oledTheme.typography.body.fontFamily,
  },
  toggleBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    minHeight: 28,
    justifyContent: 'center',
  },
  readMore: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: oledTheme.typography.caption.fontFamily,
    textTransform: 'uppercase',
  },
});
