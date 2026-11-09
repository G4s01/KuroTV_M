import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { AppStorage } from '@/services/storage';

export default function TabLayout() {
  const { theme } = useTheme();
  const isLight = theme.name === 'light';

  const [isHistoryEnabled, setIsHistoryEnabled] = React.useState<boolean>(() => {
    return AppStorage.isHistoryEnabled();
  });

  React.useEffect(() => {
    const unsubscribe = AppStorage.addSettingsListener(() => {
      setIsHistoryEnabled(AppStorage.isHistoryEnabled());
    });
    return unsubscribe;
  }, []);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 56 : 78,
          paddingBottom: Platform.OS === 'android' ? 0 : 20,
          paddingTop: 0,
        },
        tabBarItemStyle: {
          minHeight: 44,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync().catch(() => {});
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarShowLabel: false,
          tabBarLabel: () => null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'ESPLORA',
          tabBarShowLabel: false,
          tabBarLabel: () => null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'compass' : 'compass-outline'}
              size={24}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'PREFERITI',
          tabBarShowLabel: false,
          tabBarLabel: () => null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              size={24}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: isHistoryEnabled ? '/(tabs)/history' : null,
          title: 'CRONOLOGIA',
          tabBarShowLabel: false,
          tabBarLabel: () => null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              size={24}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'IMPOSTAZIONI',
          tabBarShowLabel: false,
          tabBarLabel: () => null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={24}
              color={color as string}
            />
          ),
        }}
      />
    </Tabs>
  );
}
