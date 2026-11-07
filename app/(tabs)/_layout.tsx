import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';

export default function TabLayout() {
  const { theme } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: '#737373',
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#1A1A1A',
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 64 : 84,
          paddingBottom: Platform.OS === 'android' ? 10 : 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          minHeight: 44,
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
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Esplora',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'compass' : 'compass-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Preferiti',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Cronologia',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Impostazioni',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={22}
              color={color as string}
            />
          ),
        }}
      />
    </Tabs>
  );
}
