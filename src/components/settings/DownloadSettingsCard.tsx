import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, getContrastTextColor } from '@/theme';
import type { DownloadSettings, StorageUsageInfo } from '@/services/downloads';

export interface DownloadSettingsCardProps {
  settings: DownloadSettings;
  storageInfo: StorageUsageInfo;
  onChangeDirectory: () => void;
  onResetDirectory: () => void;
  onToggleWifiOnly: (enabled: boolean) => void;
  onClearAllDownloads: () => void;
  onOpenDownloadsScreen: () => void;
}

export function DownloadSettingsCard({
  settings,
  storageInfo,
  onChangeDirectory,
  onResetDirectory,
  onToggleWifiOnly,
  onClearAllDownloads,
  onOpenDownloadsScreen,
}: DownloadSettingsCardProps) {
  const { theme } = useTheme();

  const isCustomDir = Boolean(settings.customDirectoryUri);
  const dirDisplay = isCustomDir
    ? decodeURIComponent(settings.customDirectoryUri!).split('/').pop() || 'ESTERNA'
    : 'MEMORIA INTERNA';

  return (
    <View
      style={[
        cardStyles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={cardStyles.headerRow}>
        <View style={cardStyles.headerTitleBox}>
          <Ionicons
            name="cloud-download-outline"
            size={18}
            color={theme.colors.primary}
          />
          <Text style={[cardStyles.cardTitle, { color: theme.colors.text }]}>
            SCARICATI
          </Text>
        </View>

        <Pressable
          style={[cardStyles.openDownloadsBtn, { borderColor: theme.colors.border }]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onOpenDownloadsScreen();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="APRI SCHERMATA SCARICATI"
        >
          <Text style={[cardStyles.openDownloadsText, { color: theme.colors.primary }]}>
            APRI
          </Text>
          <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
        </Pressable>
      </View>

      {/* Cartella di Salvataggio */}
      <View style={cardStyles.subSection}>
        <Text style={[cardStyles.subTitle, { color: theme.colors.textSecondary }]}>
          PERCORSO
        </Text>

        <View
          style={[
            cardStyles.directoryBox,
            {
              backgroundColor: theme.colors.card,
              borderColor: isCustomDir ? theme.colors.primary : theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name={isCustomDir ? 'folder' : 'phone-portrait-outline'}
            size={18}
            color={isCustomDir ? theme.colors.primary : theme.colors.textSecondary}
          />
          <View style={cardStyles.dirDetails}>
            <Text
              style={[cardStyles.dirPathText, { color: theme.colors.text }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {dirDisplay}
            </Text>
            <Text
              style={[
                cardStyles.dirBadgeText,
                { color: isCustomDir ? theme.colors.primary : theme.colors.textMuted },
              ]}
            >
              {isCustomDir ? 'SAF (ESTERNA)' : 'PREDEFINITA'}
            </Text>
          </View>
        </View>

        <View style={cardStyles.buttonRow}>
          <Pressable
            style={[
              cardStyles.actionBtn,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.primary,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChangeDirectory();
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="CAMBIA CARTELLA DOWNLOAD"
          >
            <Ionicons name="folder-open-outline" size={16} color={theme.colors.primary} />
            <Text style={[cardStyles.actionBtnText, { color: theme.colors.primary }]}>
              CAMBIA
            </Text>
          </Pressable>

          {isCustomDir && (
            <Pressable
              style={[
                cardStyles.actionBtn,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onResetDirectory();
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="RIPRISTINA CARTELLA PREDEFINITA"
            >
              <Ionicons name="refresh-outline" size={16} color={theme.colors.textMuted} />
              <Text style={[cardStyles.actionBtnText, { color: theme.colors.textMuted }]}>
                PREDEFINITA
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Rete Wi-Fi Only */}
      <View style={cardStyles.subSection}>
        <Text style={[cardStyles.subTitle, { color: theme.colors.textSecondary }]}>
          RETE
        </Text>

        <Pressable
          style={[
            cardStyles.toggleRow,
            {
              backgroundColor: theme.colors.card,
              borderColor: settings.wifiOnly ? theme.colors.primary : theme.colors.border,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onToggleWifiOnly(!settings.wifiOnly);
          }}
          accessibilityRole="switch"
          accessibilityLabel="SCARICA SOLO TRAMITE WI-FI"
          accessibilityState={{ checked: settings.wifiOnly }}
        >
          <View style={cardStyles.toggleLeft}>
            <Ionicons
              name={settings.wifiOnly ? 'wifi' : 'cellular'}
              size={20}
              color={settings.wifiOnly ? theme.colors.primary : theme.colors.textMuted}
            />
            <View style={cardStyles.toggleTextWrapper}>
              <Text style={[cardStyles.toggleTitle, { color: theme.colors.text }]}>
                SOLO WI-FI
              </Text>
              <Text style={[cardStyles.toggleSubtitle, { color: theme.colors.textSecondary }]}>
                EVITA RETE DATI
              </Text>
            </View>
          </View>

          <View
            style={[
              cardStyles.switchPill,
              {
                backgroundColor: settings.wifiOnly
                  ? theme.colors.primary
                  : theme.colors.surface,
                borderColor: settings.wifiOnly
                  ? theme.colors.primary
                  : theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                cardStyles.switchText,
                {
                  color: settings.wifiOnly
                    ? getContrastTextColor(theme.colors.primary)
                    : theme.colors.textMuted,
                },
              ]}
            >
              {settings.wifiOnly ? 'ON' : 'OFF'}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Spazio & Pulizia */}
      <View style={cardStyles.subSection}>
        <Text style={[cardStyles.subTitle, { color: theme.colors.textSecondary }]}>
          MEMORIA
        </Text>

        <View
          style={[
            cardStyles.storageSummaryRow,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View>
            <Text style={[cardStyles.storageNumberText, { color: theme.colors.primary }]}>
              {storageInfo.appDownloadsFormatted}
            </Text>
            <Text style={[cardStyles.storageLabelText, { color: theme.colors.textSecondary }]}>
              USATO DA KURO
            </Text>
          </View>

          <Pressable
            style={[
              cardStyles.clearAllBtn,
              {
                borderColor: theme.colors.error,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onClearAllDownloads();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="SVUOTA TUTTI I DOWNLOAD"
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
            <Text style={[cardStyles.clearAllText, { color: theme.colors.error }]}>
              SVUOTA
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  openDownloadsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  openDownloadsText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  subSection: {
    marginBottom: 16,
  },
  subTitle: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  directoryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  dirDetails: {
    flex: 1,
    minWidth: 0,
  },
  dirPathText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dirBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 52,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  toggleTextWrapper: {
    flex: 1,
    minWidth: 0,
  },
  toggleTitle: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  switchPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46,
  },
  switchText: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  storageSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  storageNumberText: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  storageLabelText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
});
