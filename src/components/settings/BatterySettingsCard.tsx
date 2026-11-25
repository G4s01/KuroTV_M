import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, getContrastTextColor } from '@/theme';
import { BatteryStore, useBatteryOptimization } from '@/services/battery';

export const BatterySettingsCard: React.FC = React.memo(() => {
  const { theme } = useTheme();
  const batteryState = useBatteryOptimization();

  if (Platform.OS !== 'android' || !batteryState.status.isSupported) {
    return null;
  }

  const isUnrestricted = batteryState.status.isUnrestricted;
  const isNotApplied = !isUnrestricted && batteryState.verificationState === 'not_applied';
  const successColor = theme.colors.success || '#22C55E';
  const warningColor = theme.colors.warning || '#F59E0B';
  const statusColor = isUnrestricted ? successColor : warningColor;
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const handleConfigure = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isUnrestricted || isNotApplied) {
      BatteryStore.openSystemSettings();
    } else {
      BatteryStore.startUnrestrictedRequest();
    }
  };

  const handleOpenAppSettings = () => {
    Haptics.selectionAsync().catch(() => {});
    BatteryStore.openSystemSettings();
  };

  const handleToggleSilenced = () => {
    Haptics.selectionAsync().catch(() => {});
    BatteryStore.silencePrompt(!batteryState.isSilenced);
  };

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
      {/* Header Row */}
      <View style={cardStyles.headerRow}>
        <View style={cardStyles.headerLeft}>
          <Ionicons
            name={isUnrestricted ? 'battery-charging' : 'battery-half-outline'}
            size={18}
            color={statusColor}
          />
          <Text style={[cardStyles.cardTitle, { color: theme.colors.text }]}>
            RISPARMIO ENERGETICO
          </Text>
        </View>

        <View
          style={[
            cardStyles.statusPill,
            {
              backgroundColor: `${statusColor}18`,
              borderColor: statusColor,
            },
          ]}
        >
          <View style={[cardStyles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[cardStyles.statusPillText, { color: statusColor }]}>
            {isUnrestricted ? 'NESSUNA RESTRIZIONE' : 'CON RESTRIZIONI'}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={[cardStyles.description, { color: theme.colors.textSecondary }]}>
        {isUnrestricted
          ? 'IMPOSTAZIONE VERIFICATA: DOWNLOAD, PLAYER IN BACKGROUND E SINCRONIZZAZIONE NON SUBIRANNO LIMITAZIONI DAL SISTEMA.'
          : "IMPOSTA IL RISPARMIO ENERGETICO DI SISTEMA SU 'NESSUNA RESTRIZIONE' PER EVITARE INTERRUZIONI IN BACKGROUND."}
      </Text>

      {/* Warning Notice if not applied after returning */}
      {isNotApplied ? (
        <View
          style={[
            cardStyles.noticeBox,
            {
              backgroundColor: `${warningColor}18`,
              borderColor: warningColor,
            },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={16} color={warningColor} />
          <Text style={[cardStyles.noticeText, { color: warningColor }]}>
            RESTRIZIONE ANCORA ATTIVA: APRI LE IMPOSTAZIONI DELL&apos;APP, TOCCA BATTERIA / RISPARMIO ENERGETICO E SELEZIONA &apos;NESSUNA RESTRIZIONE&apos;.
          </Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={cardStyles.actionsRow}>
        <Pressable
          style={[
            cardStyles.primaryBtn,
            {
              backgroundColor: isUnrestricted ? theme.colors.card : theme.colors.primary,
              borderColor: isUnrestricted ? theme.colors.border : theme.colors.primary,
              flex: 1,
            },
          ]}
          onPress={handleConfigure}
          accessibilityRole="button"
          accessibilityLabel={
            isUnrestricted
              ? 'APRI IMPOSTAZIONI BATTERIA'
              : 'IMPOSTA NESSUNA RESTRIZIONE'
          }
        >
          <Ionicons
            name="settings-outline"
            size={16}
            color={isUnrestricted ? theme.colors.text : primaryContrast}
          />
          <Text
            style={[
              cardStyles.primaryBtnText,
              { color: isUnrestricted ? theme.colors.text : primaryContrast },
            ]}
            numberOfLines={1}
          >
            {isUnrestricted
              ? 'IMPOSTAZIONI BATTERIA'
              : isNotApplied
                ? 'APRI IMPOSTAZIONI APP'
                : 'IMPOSTA NESSUNA RESTRIZIONE'}
          </Text>
        </Pressable>

        {!isUnrestricted && !isNotApplied ? (
          <Pressable
            style={[
              cardStyles.iconBtn,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={handleOpenAppSettings}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="APRI IMPOSTAZIONI APP"
          >
            <Ionicons name="open-outline" size={18} color={theme.colors.text} />
          </Pressable>
        ) : null}
      </View>

      {/* Startup Prompt Silence Toggle */}
      <Pressable
        style={[
          cardStyles.toggleRow,
          {
            backgroundColor: theme.colors.card,
            borderColor: !batteryState.isSilenced ? theme.colors.primary : theme.colors.border,
          },
        ]}
        onPress={handleToggleSilenced}
        accessibilityRole="switch"
        accessibilityLabel="AVVISO ALL'AVVIO"
        accessibilityState={{ checked: !batteryState.isSilenced }}
      >
        <View style={cardStyles.toggleLeft}>
          <Ionicons
            name={batteryState.isSilenced ? 'notifications-off-outline' : 'notifications-outline'}
            size={18}
            color={batteryState.isSilenced ? theme.colors.textMuted : theme.colors.primary}
          />
          <View style={cardStyles.toggleTextBox}>
            <Text style={[cardStyles.toggleTitle, { color: theme.colors.text }]}>
              AVVISO ALL&apos;AVVIO
            </Text>
            <Text style={[cardStyles.toggleSubtitle, { color: theme.colors.textMuted }]}>
              {batteryState.isSilenced
                ? 'SILENZIATO SU QUESTO DISPOSITIVO'
                : 'MOSTRA SE IL RISPARMIO È ATTIVO'}
            </Text>
          </View>
        </View>

        <View
          style={[
            cardStyles.switchPill,
            {
              backgroundColor: !batteryState.isSilenced
                ? theme.colors.primary
                : theme.colors.surface,
              borderColor: !batteryState.isSilenced
                ? theme.colors.primary
                : theme.colors.border,
            },
          ]}
        >
          <Text
            style={[
              cardStyles.switchText,
              {
                color: !batteryState.isSilenced
                  ? primaryContrast
                  : theme.colors.textMuted,
              },
            ]}
          >
            {batteryState.isSilenced ? 'OFF' : 'ON'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  description: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  primaryBtnText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  toggleTextBox: {
    flex: 1,
    minWidth: 0,
  },
  toggleTitle: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  toggleSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    marginTop: 2,
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
});
