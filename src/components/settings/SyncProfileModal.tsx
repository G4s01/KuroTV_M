import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { settingsStyles as styles } from './settings.styles';
import { SyncManager, type ProfileItem } from '@/services/sync';

interface SyncProfileModalProps {
  visible: boolean;
  activeProfileId: string;
  theme: any;
  onClose: () => void;
  onProfileSelected: (profile: ProfileItem) => void;
  onProposeLogin?: () => void;
}

export const SyncProfileModal: React.FC<SyncProfileModalProps> = React.memo(({
  visible,
  activeProfileId,
  theme,
  onClose,
  onProfileSelected,
  onProposeLogin,
}) => {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [switchingProfileId, setSwitchingProfileId] = useState<string | null>(null);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadProfiles();
    }
  }, [visible]);

  const loadProfiles = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setRetryFeedback(null);
    try {
      const res = await SyncManager.listProfilesWithRetries(2, (attempt, max) => {
        setRetryFeedback(`Connessione a KuroSync... (tentativo ${attempt} di ${max})`);
      });
      if (res.ok) {
        setProfiles(res.profiles);
      } else {
        setErrorMsg(res.error || 'Impossibile recuperare i profili');
        if (res.wasLoggedOut) {
          onClose();
          onProposeLogin?.();
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossibile recuperare i profili');
    } finally {
      setIsLoading(false);
      setRetryFeedback(null);
    }
  };

  const handleSelect = async (profile: ProfileItem) => {
    if (switchingProfileId) return;
    if (profile.id === activeProfileId) {
      onClose();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSwitchingProfileId(profile.id);
    setErrorMsg(null);
    setRetryFeedback(null);

    try {
      const res = await SyncManager.switchProfileWithRetries(profile.id, profile.name, 2, (attempt, max) => {
        setRetryFeedback(`Passaggio al profilo... (tentativo ${attempt} di ${max})`);
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onProfileSelected(profile);
        onClose();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setErrorMsg(res.error || 'Passaggio al profilo fallito');
        if (res.wasLoggedOut) {
          onClose();
          onProposeLogin?.();
        }
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMsg(err?.message || 'Errore durante il cambio profilo');
    } finally {
      setSwitchingProfileId(null);
      setRetryFeedback(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.syncModalOverlay}
        onPress={onClose}
        accessibilityRole="none"
      >
        <Pressable
          style={[
            styles.syncModalCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.syncModalHeader}>
            <View style={styles.syncModalTitleRow}>
              <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.syncModalTitle, { color: theme.colors.text }]}>
                CAMBIA PROFILO
              </Text>
            </View>
            <Pressable
              style={styles.syncModalCloseBtn}
              onPress={onClose}
              disabled={Boolean(switchingProfileId)}
              accessibilityRole="button"
              accessibilityLabel="CHIUDI"
            >
              <Ionicons name="close-outline" size={22} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {isLoading || switchingProfileId ? (
            <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              {retryFeedback && (
                <Text
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: '700',
                    color: theme.colors.textMuted,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}
                >
                  {retryFeedback}
                </Text>
              )}
            </View>
          ) : errorMsg ? (
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
                {errorMsg}
              </Text>
            </View>
          ) : profiles.length === 0 ? (
            <Text style={[styles.syncDesc, { color: theme.colors.textMuted }]}>
              NESSUN PROFILO DISPONIBILE
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {profiles.map((p) => {
                  const isSelected = p.id === activeProfileId;
                  const isSwitchingThis = switchingProfileId === p.id;
                  const color = p.avatarColor || p.avatar_color || theme.colors.primary;

                  return (
                    <Pressable
                      key={p.id}
                      style={[
                        styles.syncProfileItem,
                        {
                          backgroundColor: isSelected
                            ? `${theme.colors.primary}18`
                            : theme.colors.card,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                      onPress={() => handleSelect(p)}
                      disabled={Boolean(switchingProfileId)}
                      accessibilityRole="button"
                      accessibilityLabel={`PROFILO ${p.name}`}
                    >
                      <View style={styles.syncProfileItemLeft}>
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            backgroundColor: color,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="person" size={18} color="#FFFFFF" />
                        </View>
                        <View>
                          <Text style={[styles.syncProfileItemText, { color: theme.colors.text }]}>
                            {p.name}
                          </Text>
                          {isSelected ? (
                            <Text
                              style={{
                                color: theme.colors.primary,
                                fontFamily: 'monospace',
                                fontSize: 9,
                                fontWeight: '800',
                              }}
                            >
                              ATTIVO SU QUESTO DISPOSITIVO
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {isSwitchingThis ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});
