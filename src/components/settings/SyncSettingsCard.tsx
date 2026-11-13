import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { settingsStyles as styles } from './settings.styles';
import { SyncManager, KUROSYNC_GITHUB_REPO_URL, type SyncStatus } from '@/services/sync';
import { ConfirmModal } from '@/components/ConfirmModal';
import { SyncConnectModal } from './SyncConnectModal';
import { AuthorizeTvModal } from './AuthorizeTvModal';
import { SyncProfileModal } from './SyncProfileModal';
import { getContrastTextColor } from '@/theme';

interface SyncSettingsCardProps {
  theme: any;
}

function formatSyncTime(timestamp: number | null): string {
  if (!timestamp) return 'MAI';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (isToday) {
    return `OGGI ALLE ${timeStr}`;
  }
  const dateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  return `${dateStr} ALLE ${timeStr}`;
}

export const SyncSettingsCard: React.FC<SyncSettingsCardProps> = React.memo(({ theme }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => SyncManager.getStatus());
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectModalInitialTab, setConnectModalInitialTab] = useState<'qr' | 'manual'>('qr');
  const [isAuthorizeTvModalOpen, setIsAuthorizeTvModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const primaryContrast = getContrastTextColor(theme.colors.primary);

  useEffect(() => {
    const unsub = SyncManager.addSyncListener((status) => {
      setSyncStatus(status);
    });
    return unsub;
  }, []);

  const handleSyncNow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSyncFeedback(null);
    const res = await SyncManager.performFullSync();
    if (res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSyncFeedback(
        `SINCRONIZZAZIONE COMPLETATA (+${res.upserts} AGGIORNATI, -${res.deletions} RIMOSSI)`
      );
      setTimeout(() => setSyncFeedback(null), 3500);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setSyncFeedback(res.error || 'ERRORE DI SINCRONIZZAZIONE');
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleDisconnectConfirm = async () => {
    setIsDisconnectConfirmOpen(false);
    await SyncManager.disconnect();
    setSyncFeedback(null);
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      {/* Header */}
      <View style={styles.syncHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons
            name={syncStatus.isConnected ? 'cloud-done-outline' : 'cloud-offline-outline'}
            size={18}
            color={syncStatus.isConnected ? theme.colors.success || '#10B981' : theme.colors.textMuted}
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 0 }]}>
            KUROSYNC
          </Text>
        </View>

        {/* Status Pill */}
        <View
          style={[
            styles.syncStatusPill,
            {
              backgroundColor: syncStatus.isConnected
                ? `${theme.colors.success || '#10B981'}18`
                : `${theme.colors.textMuted}18`,
              borderColor: syncStatus.isConnected
                ? theme.colors.success || '#10B981'
                : theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.syncStatusDot,
              {
                backgroundColor: syncStatus.isConnected
                  ? theme.colors.success || '#10B981'
                  : theme.colors.textMuted,
              },
            ]}
          />
          <Text
            style={[
              styles.syncStatusPillText,
              {
                color: syncStatus.isConnected
                  ? theme.colors.success || '#10B981'
                  : theme.colors.textMuted,
              },
            ]}
          >
            {syncStatus.isConnected ? 'CONNESSO' : 'NON ATTIVO'}
          </Text>
        </View>
      </View>

      {/* Body: Connected vs Disconnected */}
      {syncStatus.isConnected ? (
        <View>
          <View style={[styles.syncRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.syncRowLabel, { color: theme.colors.textMuted }]}>SERVER</Text>
            <Text
              style={[styles.syncRowValue, { color: theme.colors.text }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {syncStatus.serverUrl.replace(/^https?:\/\//, '')}
            </Text>
          </View>

          {/* Interactive Profile Row with Switch Action */}
          <Pressable
            style={[styles.syncRow, { borderBottomColor: theme.colors.border, minHeight: 48 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setIsProfileModalOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`CAMBIA PROFILO. ATTUALE: ${syncStatus.profileName}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.syncRowLabel, { color: theme.colors.textMuted }]}>PROFILO</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.syncRowValue, { color: theme.colors.primary }]}>
                {syncStatus.profileName}
              </Text>
              <View
                style={{
                  backgroundColor: `${theme.colors.primary}20`,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: `${theme.colors.primary}40`,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Ionicons name="swap-horizontal" size={12} color={theme.colors.primary} />
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: 'monospace',
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 0.5,
                  }}
                >
                  CAMBIA
                </Text>
              </View>
            </View>
          </Pressable>

          <View style={[styles.syncRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.syncRowLabel, { color: theme.colors.textMuted }]}>
              ULTIMO SYNC
            </Text>
            <Text style={[styles.syncRowValue, { color: theme.colors.text }]}>
              {formatSyncTime(syncStatus.lastSyncTime)}
            </Text>
          </View>

          {/* Feedback or error notice */}
          {syncFeedback ? (
            <View
              style={[
                styles.syncNoticeBox,
                {
                  backgroundColor: `${theme.colors.primary}18`,
                  borderColor: theme.colors.primary,
                },
              ]}
            >
              <Ionicons name="information-circle" size={15} color={theme.colors.primary} />
              <Text style={[styles.syncNoticeText, { color: theme.colors.primary }]}>
                {syncFeedback}
              </Text>
            </View>
          ) : syncStatus.lastError ? (
            <View
              style={[
                styles.syncNoticeBox,
                {
                  backgroundColor: `${theme.colors.error || '#EF4444'}18`,
                  borderColor: theme.colors.error || '#EF4444',
                },
              ]}
            >
              <Ionicons name="alert-circle" size={15} color={theme.colors.error || '#EF4444'} />
              <Text style={[styles.syncNoticeText, { color: theme.colors.error || '#EF4444' }]}>
                {syncStatus.lastError}
              </Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.syncActionsRow}>
            {/* Sync Now */}
            <Pressable
              style={[
                styles.syncBtn,
                {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                  flex: 1,
                  minWidth: 140,
                },
              ]}
              onPress={handleSyncNow}
              disabled={syncStatus.isSyncing}
              accessibilityRole="button"
              accessibilityLabel="SINCRONIZZA ORA"
            >
              {syncStatus.isSyncing ? (
                <ActivityIndicator size="small" color={primaryContrast} />
              ) : (
                <>
                  <Ionicons name="sync" size={16} color={primaryContrast} />
                  <Text style={[styles.syncBtnText, { color: primaryContrast }]}>
                    SINCRONIZZA ORA
                  </Text>
                </>
              )}
            </Pressable>

            {/* Authorize Android TV */}
            <Pressable
              style={[
                styles.syncBtn,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  flex: 1,
                  minWidth: 140,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setIsAuthorizeTvModalOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="AUTORIZZA ANDROID TV"
            >
              <Ionicons name="tv-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.syncBtnText, { color: theme.colors.text }]}>
                AUTORIZZA TV
              </Text>
            </Pressable>

            {/* Change Profile */}
            <Pressable
              style={[
                styles.syncBtn,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  minWidth: 120,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setIsProfileModalOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="CAMBIA PROFILO"
            >
              <Ionicons name="people-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.syncBtnText, { color: theme.colors.text }]}>
                PROFILO
              </Text>
            </Pressable>

            {/* Disconnect */}
            <Pressable
              style={[
                styles.syncBtn,
                {
                  backgroundColor: `${theme.colors.error || '#EF4444'}18`,
                  borderColor: theme.colors.error || '#EF4444',
                  minWidth: 110,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setIsDisconnectConfirmOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="DISCONNETTI"
            >
              <Ionicons name="log-out-outline" size={16} color={theme.colors.error || '#EF4444'} />
              <Text style={[styles.syncBtnText, { color: theme.colors.error || '#EF4444' }]}>
                ESCI
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View>
          <Text style={[styles.syncDesc, { color: theme.colors.textMuted }]}>
            SINCRONIZZA CRONOLOGIA, PREFERITI, PROGRESSO E SERIE IN CORSO TRA SMARTPHONE E ANDROID TV TRAMITE IL BACKEND KUROTV_S.
          </Text>

          <View style={styles.syncActionsRow}>
            {/* Connect with QR / Link */}
            <Pressable
              style={[
                styles.syncBtn,
                {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                  flex: 1,
                  minWidth: 150,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setConnectModalInitialTab('qr');
                setIsConnectModalOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="COLLEGA CON QR O LINK"
            >
              <Ionicons name="qr-code-outline" size={16} color={primaryContrast} />
              <Text style={[styles.syncBtnText, { color: primaryContrast }]}>
                COLLEGA CON QR / LINK
              </Text>
            </Pressable>

            {/* Manual Connection */}
            <Pressable
              style={[
                styles.syncBtn,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  flex: 1,
                  minWidth: 140,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setConnectModalInitialTab('manual');
                setIsConnectModalOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="CONNESSIONE MANUALE"
            >
              <Ionicons name="key-outline" size={16} color={theme.colors.text} />
              <Text style={[styles.syncBtnText, { color: theme.colors.text }]}>
                MANUALE
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* GitHub Repository / Self-hosting Link */}
      <Pressable
        style={[
          styles.syncGithubBtn,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          Linking.openURL(KUROSYNC_GITHUB_REPO_URL).catch(() => {});
        }}
        accessibilityRole="link"
        accessibilityLabel="GUIDA & REPO GITHUB KUROTV_S"
      >
        <Ionicons name="logo-github" size={17} color={theme.colors.text} />
        <Text style={[styles.syncGithubBtnText, { color: theme.colors.text }]}>
          REPOSITORY GITHUB & SELF-HOSTING (KUROTV_S)
        </Text>
        <Ionicons name="open-outline" size={14} color={theme.colors.textMuted} />
      </Pressable>

      {/* Disconnect Confirmation Modal */}
      <ConfirmModal
        visible={isDisconnectConfirmOpen}
        title="DISCONNETTI KUROSYNC"
        message="Vuoi davvero disconnettere KuroSync da questo dispositivo? I preferiti e la cronologia rimarranno salvati in locale."
        icon="cloud-offline-outline"
        confirmText="DISCONNETTI"
        confirmColor={theme.colors.error || '#EF4444'}
        onConfirm={handleDisconnectConfirm}
        onCancel={() => setIsDisconnectConfirmOpen(false)}
      />

      {/* Connect Modal */}
      <SyncConnectModal
        visible={isConnectModalOpen}
        initialTab={connectModalInitialTab}
        theme={theme}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={() => {
          setIsConnectModalOpen(false);
        }}
      />

      {/* Authorize TV Modal */}
      <AuthorizeTvModal
        visible={isAuthorizeTvModalOpen}
        activeProfileName={syncStatus.profileName}
        activeProfileId={syncStatus.profileId}
        theme={theme}
        onClose={() => setIsAuthorizeTvModalOpen(false)}
      />

      {/* Profile Switch Modal */}
      <SyncProfileModal
        visible={isProfileModalOpen}
        activeProfileId={syncStatus.profileId}
        theme={theme}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileSelected={(p) => {
          setSyncFeedback(`PROFILO ATTIVO: ${p.name.toUpperCase()}`);
          setTimeout(() => setSyncFeedback(null), 3500);
        }}
      />
    </View>
  );
});
