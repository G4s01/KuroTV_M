import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, getContrastTextColor } from '@/theme';
import { AppStorage } from '@/services/storage';
import { usePendingUpdate } from '@/services/updater';

function SettingsTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const { theme } = useTheme();
  const { update, isDismissed } = usePendingUpdate();
  const hasPendingUpdate = Boolean(update?.isUpdateAvailable && update?.manifest && isDismissed);

  const bounceAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!hasPendingUpdate) {
      bounceAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -4,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 550,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => {
      loop.stop();
      bounceAnim.setValue(0);
    };
  }, [hasPendingUpdate, bounceAnim]);

  return (
    <View style={styles.tabIconWrapper}>
      <Ionicons
        name={focused ? 'settings' : 'settings-outline'}
        size={24}
        color={color}
      />
      {hasPendingUpdate && (
        <Animated.View
          style={[
            styles.arrowBadge,
            {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.background,
              transform: [{ translateY: bounceAnim }],
            },
          ]}
        >
          <Ionicons
            name="arrow-up"
            size={10}
            color={getContrastTextColor(theme.colors.primary)}
          />
        </Animated.View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [isHistoryEnabled, setIsHistoryEnabled] = React.useState<boolean>(() => {
    return AppStorage.isHistoryEnabled();
  });

  React.useEffect(() => {
    const unsubscribe = AppStorage.addSettingsListener(() => {
      setIsHistoryEnabled(AppStorage.isHistoryEnabled());
    });
    return unsubscribe;
  }, []);

  const androidBottomInset = Math.max(0, insets.bottom);
  const iosBottomInset = Math.max(20, insets.bottom);

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
          height: Platform.OS === 'android' ? 56 + androidBottomInset : 58 + iosBottomInset,
          paddingBottom: Platform.OS === 'android' ? androidBottomInset : iosBottomInset,
          paddingTop: 0,
        },
        tabBarItemStyle: {
          height: 56,
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
          href: null,
          tabBarItemStyle: { display: 'none' },
          tabBarShowLabel: false,
          tabBarLabel: () => null,
          tabBarIcon: () => null,
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
            <SettingsTabIcon color={color as string} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconWrapper: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  arrowBadge: {
    position: 'absolute',
    top: -3,
    right: -7,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
