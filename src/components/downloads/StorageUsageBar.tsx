import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme';
import { downloadsStyles as styles } from './downloads.styles';
import type { StorageUsageInfo } from '@/services/downloads';

export interface StorageUsageBarProps {
  storage: StorageUsageInfo;
}

export const StorageUsageBar = React.memo<StorageUsageBarProps>(
  function StorageUsageBar({ storage }) {
    const { theme } = useTheme();

    const usedBytes = storage.appDownloadsBytes;
    const freeBytes = storage.freeDiskBytes ?? 0;
    const totalEst = usedBytes + freeBytes;
    const usedPct =
      totalEst > 0
        ? Math.min(100, Math.max(1, Math.round((usedBytes / totalEst) * 100)))
        : 0;

    return (
      <View
        style={[
          styles.storageContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.storageHeader}>
          <Text style={[styles.storageLabel, { color: theme.colors.text }]} numberOfLines={1}>
            MEMORIA
          </Text>
          <Text
            style={[styles.storageValues, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            KURO: <Text style={{ color: theme.colors.primary }}>{storage.appDownloadsFormatted}</Text>
            {storage.freeDiskFormatted && ` • LIBERO: ${storage.freeDiskFormatted}`}
          </Text>
        </View>

        <View style={styles.storageTrack}>
          <View
            style={[
              styles.storageFill,
              {
                width: `${usedPct}%`,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>
      </View>
    );
  }
);
