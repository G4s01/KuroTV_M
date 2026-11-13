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
}

export const SyncProfileModal: React.FC<SyncProfileModalProps> = React.memo(({
  visible,
  activeProfileId,
  theme,
  onClose,
  onProfileSelected,
}) => {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadProfiles();
    }
  }, [visible]);

  const loadProfiles = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await SyncManager.listProfiles();
      setProfiles(list);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossibile recuperare i profili');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = async (profile: ProfileItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await SyncManager.switchProfile(profile.id, profile.name);
    onProfileSelected(profile);
    onClose();
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
                SELEZIONA PROFILO
              </Text>
            </View>
            <Pressable
              style={styles.syncModalCloseBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="CHIUDI"
            >
              <Ionicons name="close-outline" size={22} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
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
                      accessibilityRole="button"
                    >
                      <View style={styles.syncProfileItemLeft}>
                        <View style={[styles.syncProfileDot, { backgroundColor: color }]} />
                        <Text style={[styles.syncProfileItemText, { color: theme.colors.text }]}>
                          {p.name}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
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
