import React, { useCallback } from 'react';
import { View, ScrollView, BackHandler } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import {
  SettingsHeader,
  SyncSettingsCard,
  settingsStyles as styles,
} from '@/components/settings';
import { MalSyncSummaryCard } from '@/components/mal';

export default function SyncSettingsScreen() {
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

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <SettingsHeader
        title="SINCRONIA"
        subtitle="SINCRONIZZAZIONE MULTI-DISPOSITIVO & ACCOPPIAMENTO ANDROID TV"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SyncSettingsCard theme={theme} />
        <MalSyncSummaryCard />
      </ScrollView>
    </View>
  );
}
