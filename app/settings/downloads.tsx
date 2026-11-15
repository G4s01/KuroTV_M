import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, BackHandler } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import { DownloadService, type DownloadSettings, type StorageUsageInfo } from '@/services/downloads';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  SettingsHeader,
  DownloadSettingsCard,
  settingsStyles as styles,
} from '@/components/settings';

export default function DownloadsSettingsScreen() {
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

  const [downloadSettings, setDownloadSettings] = useState<DownloadSettings>(() => {
    return DownloadService.getSettings();
  });
  const [storageInfo, setStorageInfo] = useState<StorageUsageInfo>({
    appDownloadsBytes: 0,
    appDownloadsFormatted: '0 B',
  });
  const [isClearAllDownloadsConfirmOpen, setIsClearAllDownloadsConfirmOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setDownloadSettings(DownloadService.getSettings());
      DownloadService.getStorageUsage().then(setStorageInfo).catch(() => {});
    }, [])
  );

  useEffect(() => {
    DownloadService.getStorageUsage().then(setStorageInfo).catch(() => {});
    const unsubSettings = DownloadService.addSettingsListener((s) => {
      setDownloadSettings(s);
    });
    const unsubList = DownloadService.addListListener(() => {
      DownloadService.getStorageUsage().then(setStorageInfo).catch(() => {});
    });
    return () => {
      unsubSettings();
      unsubList();
    };
  }, []);

  const handleChangeDownloadDirectory = async () => {
    await DownloadService.requestCustomDirectoryPermissions();
  };

  const handleResetDownloadDirectory = () => {
    DownloadService.setCustomDirectoryUri(null);
  };

  const handleToggleWifiOnly = (enabled: boolean) => {
    DownloadService.setWifiOnly(enabled);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <SettingsHeader
        title="DOWNLOAD"
        subtitle="CARTELLA SAF, DOWNLOAD SOLO WI-FI E MEMORIA OCCUPATA"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <DownloadSettingsCard
          settings={downloadSettings}
          storageInfo={storageInfo}
          onChangeDirectory={handleChangeDownloadDirectory}
          onResetDirectory={handleResetDownloadDirectory}
          onToggleWifiOnly={handleToggleWifiOnly}
          onClearAllDownloads={() => setIsClearAllDownloadsConfirmOpen(true)}
          onOpenDownloadsScreen={() => router.push('/downloads' as any)}
        />
      </ScrollView>

      {/* Modal di Conferma Svuota Tutti i Download */}
      <ConfirmModal
        visible={isClearAllDownloadsConfirmOpen}
        title="SVUOTA SCARICATI"
        message="VUOI ELIMINARE TUTTI GLI EPISODI SCARICATI? L'OPERAZIONE NON È REVERSIBILE."
        icon="trash-outline"
        confirmText="SVUOTA"
        onConfirm={() => {
          DownloadService.clearAllDownloads();
          setIsClearAllDownloadsConfirmOpen(false);
        }}
        onCancel={() => setIsClearAllDownloadsConfirmOpen(false)}
      />
    </View>
  );
}
