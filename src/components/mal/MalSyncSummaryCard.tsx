import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { getContrastTextColor, useTheme } from '@/theme';
import {
  MalAuthService,
  MalSyncService,
  addMalDataListener,
  getMalSettings,
  type MalAuthStatus,
} from '@/services/mal';
import { settingsStyles as styles } from '@/components/settings/settings.styles';
import malSvg from '../../../assets/icons/myanimelist.svg';

export const MalSyncSummaryCard: React.FC = React.memo(function MalSyncSummaryCard() {
  const { theme } = useTheme();
  const router = useRouter();
  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const [authStatus, setAuthStatus] = React.useState<MalAuthStatus>(() =>
    MalAuthService.getStatus()
  );
  const [malSettings, setMalSettings] = React.useState(() => getMalSettings());
  const [pendingCount, setPendingCount] = React.useState(() =>
    MalSyncService.getPendingUpdatesCount()
  );

  React.useEffect(() => {
    const refresh = () => {
      setAuthStatus(MalAuthService.getStatus());
      setMalSettings(getMalSettings());
      setPendingCount(MalSyncService.getPendingUpdatesCount());
    };
    refresh();
    const unsub = addMalDataListener(refresh);
    return unsub;
  }, []);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.syncHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image
            source={malSvg}
            style={{ width: 20, height: 20, borderRadius: 10 }}
            contentFit="contain"
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>
            MYANIMELIST
          </Text>
        </View>

        <View
          style={[
            styles.syncStatusPill,
            {
              backgroundColor: authStatus.isConnected
                ? `${theme.colors.success || '#10B981'}18`
                : `${theme.colors.textMuted}18`,
              borderColor: authStatus.isConnected
                ? theme.colors.success || '#10B981'
                : theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.syncStatusDot,
              {
                backgroundColor: authStatus.isConnected
                  ? theme.colors.success || '#10B981'
                  : theme.colors.textMuted,
              },
            ]}
          />
          <Text
            style={[
              styles.syncStatusPillText,
              {
                color: authStatus.isConnected
                  ? theme.colors.success || '#10B981'
                  : theme.colors.textMuted,
              },
            ]}
          >
            {authStatus.isConnected ? 'CONNESSO' : 'NON ATTIVO'}
          </Text>
        </View>
      </View>

      {authStatus.isConnected ? (
        <View>
          <View style={[styles.syncRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.syncRowLabel, { color: theme.colors.textMuted }]}>ACCOUNT</Text>
            <Text style={[styles.syncRowValue, { color: theme.colors.primary }]} numberOfLines={1}>
              @{authStatus.username || 'UTENTE'}
            </Text>
          </View>
          <View style={[styles.syncRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.syncRowLabel, { color: theme.colors.textMuted }]}>
              AUTO-SYNC PLAYER
            </Text>
            <Text style={[styles.syncRowValue, { color: theme.colors.text }]}>
              {malSettings.autoSyncOnComplete ? 'ON' : 'OFF'}
            </Text>
          </View>
          <View style={[styles.syncRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.syncRowLabel, { color: theme.colors.textMuted }]}>
              AUDIO ANIMEWORLD
            </Text>
            <Text style={[styles.syncRowValue, { color: theme.colors.text }]}>
              {malSettings.audioPreference.toUpperCase()}
            </Text>
          </View>
          {pendingCount > 0 && (
            <View style={[styles.syncRow, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.syncRowLabel, { color: theme.colors.textMuted }]}>
                CODA OFFLINE
              </Text>
              <Text style={[styles.syncRowValue, { color: theme.colors.warning || '#F59E0B' }]}>
                {pendingCount} IN ATTESA
              </Text>
            </View>
          )}
        </View>
      ) : (
        <Text style={[styles.syncDesc, { color: theme.colors.textMuted }]}>
          CONSULTA LE TUE LISTE MYANIMELIST E INVIA I PROGRESSI DALL&apos;APP (SOLO LOCALE, SEPARATO DA KUROSYNC).
        </Text>
      )}

      <View style={[styles.syncActionsRow, { marginTop: 12 }]}>
        <Pressable
          style={[
            styles.syncBtn,
            {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
              flex: 1,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push('/mal' as any);
          }}
          accessibilityRole="button"
          accessibilityLabel="APRI LISTE MYANIMELIST"
        >
          <Ionicons name="list-outline" size={16} color={primaryContrast} />
          <Text style={[styles.syncBtnText, { color: primaryContrast }]}>
            {authStatus.isConnected ? 'APRI LISTE MAL' : 'COLLEGA MYANIMELIST'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
