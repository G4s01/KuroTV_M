import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from '@/theme';
import { AppStorage } from '@/services/storage';
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

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={isLight ? 'dark' : 'light'} />
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
