import React from 'react';
import { Platform, AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from '@/theme';
import { AppStorage, type NavBarMode } from '@/services/storage';
import { UpdaterService, UpdateStore } from '@/services/updater';
import { SyncManager, parseKuroSyncDeepLink } from '@/services/sync';
import * as Linking from 'expo-linking';
import { UpdateModal, ConfirmModal } from '@/components';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function RootNavigation() {
  const { theme } = useTheme();
  const isLight = theme.name === 'light';

  const [navBarMode, setNavBarMode] = React.useState<NavBarMode>(() => AppStorage.getNavBarMode());

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;

    const applyNavBarVisibility = (mode: NavBarMode) => {
      NavigationBar.setVisibilityAsync(mode === 'auto-hide' ? 'hidden' : 'visible').catch(() => {});
    };

    applyNavBarVisibility(navBarMode);

    const subAppState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (Platform.OS === 'android') {
          applyNavBarVisibility(AppStorage.getNavBarMode());
        }
        if (SyncManager.isConnected()) {
          SyncManager.pullDelta().catch(() => {});
        }
      } else if (state === 'background' || state === 'inactive') {
        if (SyncManager.isConnected()) {
          SyncManager.pushPending(true).catch(() => {});
        }
      }
    });

    const unsubSettings = AppStorage.addSettingsListener(() => {
      const latest = AppStorage.getNavBarMode();
      setNavBarMode(latest);
      applyNavBarVisibility(latest);
    });

    return () => {
      subAppState.remove();
      unsubSettings();
    };
  }, [navBarMode]);

  const [syncAlert, setSyncAlert] = React.useState<{
    visible: boolean;
    title: string;
    message: string;
  } | null>(null);

  // KuroSync deep-link handling (e.g. kurosync://connect?url=...&token=...&profile=... or kurosync://pair?code=...)
  React.useEffect(() => {
    const processDeepLink = async (url: string) => {
      if (!url) return;
      const parsed = parseKuroSyncDeepLink(url);
      if (parsed?.token) {
        try {
          const res = await SyncManager.connectFromDeepLink(url);
          if (!res.ok) {
            const isExpired =
              res.isExpiredQr ||
              res.message?.includes('410') ||
              res.message?.toLowerCase().includes('scaduto');
            setSyncAlert({
              visible: true,
              title: isExpired ? 'CODICE QR SCADUTO' : 'CONNESSIONE FALLITA',
              message: isExpired
                ? 'Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.'
                : res.message || 'Connessione fallita',
            });
          }
        } catch (err: any) {
          const isExpired =
            err?.status === 410 ||
            String(err?.message).includes('410') ||
            String(err?.message).toLowerCase().includes('scaduto');
          setSyncAlert({
            visible: true,
            title: isExpired ? 'CODICE QR SCADUTO' : 'ERRORE DI RETE',
            message: isExpired
              ? 'Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.'
              : err?.message || 'Errore di connessione',
          });
        }
      } else if (parsed?.code) {
        if (SyncManager.isConnected()) {
          SyncManager.approveTvPairing(parsed.code).catch(() => {});
        }
      } else if (
        url.startsWith('kurosync://') ||
        url.includes('token=') ||
        url.includes('kurosync')
      ) {
        try {
          const res = await SyncManager.connectFromDeepLink(url);
          if (!res.ok) {
            const isExpired =
              res.isExpiredQr ||
              res.message?.includes('410') ||
              res.message?.toLowerCase().includes('scaduto');
            setSyncAlert({
              visible: true,
              title: isExpired ? 'CODICE QR SCADUTO' : 'CONNESSIONE FALLITA',
              message: isExpired
                ? 'Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.'
                : res.message || 'Connessione fallita',
            });
          }
        } catch (err: any) {
          const isExpired =
            err?.status === 410 ||
            String(err?.message).includes('410') ||
            String(err?.message).toLowerCase().includes('scaduto');
          setSyncAlert({
            visible: true,
            title: isExpired ? 'CODICE QR SCADUTO' : 'ERRORE DI RETE',
            message: isExpired
              ? 'Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.'
              : err?.message || 'Errore di connessione',
          });
        }
      }
    };

    const handleUrl = (event: { url: string }) => {
      if (event?.url) {
        processDeepLink(event.url);
      }
    };

    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) {
          processDeepLink(initialUrl);
        }
      })
      .catch(() => {});

    const subLinking = Linking.addEventListener('url', handleUrl);
    return () => {
      subLinking.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={isLight ? 'dark' : 'light'} />
      {Platform.OS === 'android' && (
        <NavigationBar.NavigationBar
          hidden={navBarMode === 'auto-hide'}
          style={isLight ? 'dark' : 'light'}
        />
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'default',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="downloads/index"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="anime/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="player/[id]"
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
      </Stack>
      <UpdateModal />
      {syncAlert?.visible && (
        <ConfirmModal
          visible={syncAlert.visible}
          title={syncAlert.title}
          message={syncAlert.message}
          icon="alert-circle-outline"
          iconColor={theme.colors.error || '#EF4444'}
          confirmText="HO CAPITO"
          confirmColor={theme.colors.primary}
          singleAction={true}
          onConfirm={() => setSyncAlert(null)}
          onCancel={() => setSyncAlert(null)}
        />
      )}
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  React.useEffect(() => {
    // Non-blocking background storage maintenance on startup
    const timer = setTimeout(() => {
      try {
        AppStorage.pruneOldProgress();
        AppStorage.cleanupExpiredHistory();
      } catch {
        // Safe fallback
      }
    }, 2000);

    // Automatic update check on app launch
    const updateTimer = setTimeout(() => {
      UpdaterService.checkForUpdates()
        .then((result) => {
          if (result.isUpdateAvailable && result.manifest) {
            UpdateStore.setPendingUpdate(result);
          }
        })
        .catch(() => {});
    }, 1200);

    // Initial KuroSync delta pull on app startup
    const syncTimer = setTimeout(() => {
      if (SyncManager.isConnected()) {
        SyncManager.performFullSync().catch(() => {});
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      clearTimeout(updateTimer);
      clearTimeout(syncTimer);
    };
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <RootNavigation />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
