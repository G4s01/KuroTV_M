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
import { UpdateModal } from '@/components';

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
        applyNavBarVisibility(AppStorage.getNavBarMode());
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

    return () => {
      clearTimeout(timer);
      clearTimeout(updateTimer);
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
