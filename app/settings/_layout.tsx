import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function SettingsLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="appearance" options={{ headerShown: false }} />
      <Stack.Screen name="playback" options={{ headerShown: false }} />
      <Stack.Screen name="sync" options={{ headerShown: false }} />
      <Stack.Screen name="downloads" options={{ headerShown: false }} />
      <Stack.Screen name="source" options={{ headerShown: false }} />
      <Stack.Screen name="history" options={{ headerShown: false }} />
      <Stack.Screen name="about" options={{ headerShown: false }} />
    </Stack>
  );
}
