import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  BackHandler,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import { AppStorage, type HistoryRetentionDays } from '@/services/storage';
import { HistorySlider, SEARCH_RETENTION_STEPS } from '@/components/HistorySlider';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  SettingsHeader,
  settingsStyles as styles,
} from '@/components/settings';

export default function HistorySettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();

  useFocusEffect(
    useCallback(() => {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        Haptics.selectionAsync().catch(() => {});
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/settings' as any);
        }
        return true;
      });
      return () => backSub.remove();
    }, [router])
  );

  // Watch history settings state
  const [historyRetention, setHistoryRetention] = useState<HistoryRetentionDays>(() => {
    return AppStorage.getHistoryRetentionDays();
  });
  const [isClearHistoryConfirmOpen, setIsClearHistoryConfirmOpen] = useState(false);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);

  // Search History settings state
  const [searchHistoryRetention, setSearchHistoryRetention] = useState<HistoryRetentionDays>(() => {
    return AppStorage.getSearchHistoryRetentionDays();
  });
  const [isClearSearchHistoryConfirmOpen, setIsClearSearchHistoryConfirmOpen] = useState(false);
  const [searchHistoryNotice, setSearchHistoryNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setHistoryRetention(AppStorage.getHistoryRetentionDays());
      setSearchHistoryRetention(AppStorage.getSearchHistoryRetentionDays());
    }, [])
  );

  const showHistoryNotice = (msg: string) => {
    setHistoryNotice(msg);
    setTimeout(() => {
      setHistoryNotice(null);
    }, 4000);
  };

  const handleChangeHistoryRetention = (days: HistoryRetentionDays) => {
    setHistoryRetention(days);
    AppStorage.setHistoryRetentionDays(days);
    if (days === -1) {
      showHistoryNotice('CRONOLOGIA DISATTIVATA (NASCOSTA DAI TAB)');
    } else if (days === 0) {
      showHistoryNotice('CRONOLOGIA SENZA SCADENZA (ATTIVA)');
    } else {
      showHistoryNotice(`CONSERVAZIONE IMPOSTATA A ${days} GIORNI`);
    }
  };

  const handleConfirmClearHistory = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AppStorage.clearWatchHistory();
    setIsClearHistoryConfirmOpen(false);
    showHistoryNotice('CRONOLOGIA COMPLETAMENTE CANCELLATA');
  };

  const showSearchHistoryNotice = (msg: string) => {
    setSearchHistoryNotice(msg);
    setTimeout(() => {
      setSearchHistoryNotice(null);
    }, 4000);
  };

  const handleChangeSearchHistoryRetention = (days: HistoryRetentionDays) => {
    setSearchHistoryRetention(days);
    AppStorage.setSearchHistoryRetentionDays(days);
    if (days === -1) {
      showSearchHistoryNotice('CRONOLOGIA DI RICERCA DISATTIVATA');
    } else if (days === 0) {
      showSearchHistoryNotice('CRONOLOGIA DI RICERCA SENZA SCADENZA (ATTIVA)');
    } else {
      showSearchHistoryNotice(`CONSERVAZIONE RICERCHE IMPOSTATA A ${days} GIORNI`);
    }
  };

  const handleConfirmClearSearchHistory = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AppStorage.clearSearchHistory();
    setIsClearSearchHistoryConfirmOpen(false);
    showSearchHistoryNotice('CRONOLOGIA RICERCHE CANCELLATA CON SUCCESSO');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <SettingsHeader
        title="CRONOLOGIA & PRIVACY"
        subtitle="TEMPI DI CONSERVAZIONE E PULIZIA CRONOLOGIA VISIONI E RICERCHE"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* CRONOLOGIA (Slider durata conservazione & cancellazione comoda) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>CRONOLOGIA VISIONI</Text>

          <HistorySlider
            value={historyRetention}
            onChange={handleChangeHistoryRetention}
            theme={theme}
          />

          <Pressable
            style={[
              styles.clearHistoryBtn,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setIsClearHistoryConfirmOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="CANCELLA CRONOLOGIA"
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.error || '#EF4444'} />
            <Text style={[styles.clearHistoryBtnText, { color: theme.colors.error || '#EF4444' }]}>
              CANCELLA TUTTA LA CRONOLOGIA
            </Text>
          </Pressable>

          {historyNotice ? (
            <View
              style={[
                styles.sourceNoticeBox,
                {
                  backgroundColor: `${theme.colors.primary}18`,
                  borderColor: theme.colors.primary,
                  marginTop: 10,
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
              <Text style={[styles.sourceNoticeText, { color: theme.colors.primary }]}>
                {historyNotice}
              </Text>
            </View>
          ) : null}
        </View>

        {/* CRONOLOGIA DI RICERCA (Google Style search history retention & clear) */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>CRONOLOGIA DI RICERCA</Text>

          <HistorySlider
            value={searchHistoryRetention}
            onChange={handleChangeSearchHistoryRetention}
            theme={theme}
            steps={SEARCH_RETENTION_STEPS}
          />

          <Pressable
            style={[
              styles.clearHistoryBtn,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setIsClearSearchHistoryConfirmOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="CANCELLA CRONOLOGIA RICERCHE"
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.error || '#EF4444'} />
            <Text style={[styles.clearHistoryBtnText, { color: theme.colors.error || '#EF4444' }]}>
              CANCELLA TUTTA LA CRONOLOGIA RICERCHE
            </Text>
          </Pressable>

          {searchHistoryNotice ? (
            <View
              style={[
                styles.sourceNoticeBox,
                {
                  backgroundColor: `${theme.colors.primary}18`,
                  borderColor: theme.colors.primary,
                  marginTop: 10,
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
              <Text style={[styles.sourceNoticeText, { color: theme.colors.primary }]}>
                {searchHistoryNotice}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Modal di Conferma Svuota Cronologia Integrato nella UI */}
      <ConfirmModal
        visible={isClearHistoryConfirmOpen}
        title="SVUOTA CRONOLOGIA"
        message="VUOI DAVVERO CANCELLARE TUTTA LA CRONOLOGIA DI VISIONE? L'OPERAZIONE NON È REVERSIBILE."
        icon="trash-outline"
        confirmText="CANCELLA TUTTO"
        onConfirm={handleConfirmClearHistory}
        onCancel={() => setIsClearHistoryConfirmOpen(false)}
      />

      {/* Modal di Conferma Svuota Cronologia Ricerche */}
      <ConfirmModal
        visible={isClearSearchHistoryConfirmOpen}
        title="SVUOTA CRONOLOGIA RICERCHE"
        message="VUOI DAVVERO CANCELLARE TUTTE LE RICERCHE RECENTI? L'OPERAZIONE NON È REVERSIBILE."
        icon="trash-outline"
        confirmText="CANCELLA TUTTO"
        onConfirm={handleConfirmClearSearchHistory}
        onCancel={() => setIsClearSearchHistoryConfirmOpen(false)}
      />
    </View>
  );
}
