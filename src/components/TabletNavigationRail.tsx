import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Theme } from '@/theme';
import type { SyncStatus } from '@/services/sync';
import malSvg from '../../assets/icons/myanimelist.svg';

export interface TabletNavigationRailProps {
  state: any;
  descriptors: any;
  insets: { top: number; bottom: number; left: number; right: number };
  navigateToTab?: (routeKey: string) => void;
  navigation?: any;
  emitter?: any;
  syncStatus: SyncStatus;
  onProfilePress: () => void;
  isMalConnected?: boolean;
  onMalPress?: () => void;
  theme: Theme;
}

export const TabletNavigationRail = React.memo<TabletNavigationRailProps>(
  function TabletNavigationRail({
    state,
    descriptors,
    navigation,
    navigateToTab,
    emitter,
    insets,
    syncStatus,
    onProfilePress,
    isMalConnected = false,
    onMalPress,
    theme,
  }) {
    const handleProfilePress = React.useCallback(() => {
      Haptics.selectionAsync().catch(() => {});
      onProfilePress();
    }, [onProfilePress]);

    const handleMalPress = React.useCallback(() => {
      if (!onMalPress) return;
      Haptics.selectionAsync().catch(() => {});
      onMalPress();
    }, [onMalPress]);

    const activeProfileName = syncStatus.profileName?.trim();
    const profileInitial = activeProfileName
      ? activeProfileName.charAt(0).toUpperCase()
      : null;
    const isConnected = syncStatus.isConnected;
    const hasProfile = Boolean(
      isConnected && (profileInitial || syncStatus.profileId)
    );
    const displayInitial =
      profileInitial ||
      (activeProfileName ? activeProfileName.charAt(0).toUpperCase() : 'P');

    return (
      <View
        style={[
          styles.railContainer,
          {
            backgroundColor: theme.colors.background,
            borderRightColor: theme.colors.border,
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom + 12, 16),
          },
        ]}
      >
        {/* Top Section: Touch-Native Profile Selector aligned with Screen Header */}
        <View
          style={[
            styles.topSection,
            { borderBottomColor: theme.colors.border },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.profileBtn,
              {
                backgroundColor: theme.colors.surface,
                borderColor: hasProfile
                  ? theme.colors.primary
                  : theme.colors.border,
              },
              pressed && styles.pressedBtn,
            ]}
            onPress={handleProfilePress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              hasProfile
                ? `PROFILO: ${activeProfileName || 'PRINCIPALE'}`
                : 'ACCEDI / COLLEGA KUROSYNC'
            }
          >
            {hasProfile ? (
              <View style={styles.profileAvatarBox}>
                <Text
                  style={[
                    styles.profileInitial,
                    { color: theme.colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  {displayInitial}
                </Text>
                {/* Active Online Status Indicator */}
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: theme.colors.success || '#22C55E',
                      borderColor: theme.colors.background,
                    },
                  ]}
                />
              </View>
            ) : (
              <Ionicons
                name="log-in-outline"
                size={22}
                color={theme.colors.textMuted}
              />
            )}
          </Pressable>
        </View>

        {/* Center Section: Navigation Rail Tab Items */}
        <View style={styles.navItemsList}>
          {state.routes.map((route: any) => {
            const descriptor = descriptors[route.key];
            if (!descriptor) return null;
            const { options } = descriptor;

            // Skip hidden routes and duplicate profile
            if (
              options.href === null ||
              route.name === 'profile' ||
              route.name === 'explore'
            ) {
              return null;
            }

            const isFocused = state.routes[state.index]?.key === route.key;

            const onPress = () => {
              Haptics.selectionAsync().catch(() => {});
              let defaultPrevented = false;
              if (emitter) {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                defaultPrevented = Boolean(event?.defaultPrevented);
              } else if (navigation?.emit) {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                defaultPrevented = Boolean(event?.defaultPrevented);
              }

              if (!isFocused && !defaultPrevented) {
                if (navigateToTab) {
                  navigateToTab(route.key);
                } else if (navigation?.navigate) {
                  navigation.navigate(route.name);
                } else if (descriptor.navigation?.navigate) {
                  descriptor.navigation.navigate(route.name);
                }
              }
            };

            const onLongPress = () => {
              if (emitter) {
                emitter.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              } else if (navigation?.emit) {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              }
            };

            const color = isFocused
              ? theme.colors.primary
              : theme.colors.textMuted;
            const icon = options.tabBarIcon?.({
              focused: isFocused,
              color,
              size: 24,
            });

            const tabButton = (
              <Pressable
                key={route.key}
                style={({ pressed }) => [
                  styles.tabItem,
                  isFocused && [
                    styles.tabItemActive,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ],
                  pressed && styles.pressedBtn,
                ]}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="button"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={options.title || route.name}
                hitSlop={6}
              >
                {icon}
              </Pressable>
            );

            if (route.name === 'favorites' && onMalPress) {
              return (
                <React.Fragment key={route.key}>
                  {tabButton}
                  <Pressable
                    style={({ pressed }) => [
                      styles.tabItem,
                      pressed && styles.pressedBtn,
                    ]}
                    onPress={handleMalPress}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isMalConnected
                        ? 'APRI LISTE MYANIMELIST (CONNESSO)'
                        : 'APRI MYANIMELIST'
                    }
                    hitSlop={6}
                  >
                    <View style={styles.malIconWrapper}>
                      <Image
                        source={malSvg}
                        style={styles.malIcon}
                        contentFit="contain"
                      />
                      {isMalConnected && (
                        <View
                          style={[
                            styles.malStatusDot,
                            {
                              backgroundColor: theme.colors.success || '#10B981',
                              borderColor: theme.colors.background,
                            },
                          ]}
                        />
                      )}
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            }

            return tabButton;
          })}
        </View>

        {/* Bottom spacer for symmetrical balance */}
        <View style={styles.bottomSpacer} />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  railContainer: {
    width: 76,
    minWidth: 76,
    maxWidth: 76,
    height: '100%',
    borderRightWidth: 1,
    alignItems: 'center',
    zIndex: 50,
  },
  topSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 60,
    borderBottomWidth: 1,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileAvatarBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileInitial: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    textTransform: 'uppercase',
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  navItemsList: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    gap: 8,
  },
  tabItem: {
    width: 52,
    height: 52,
    minHeight: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabItemActive: {
    borderWidth: 1,
  },
  malIconWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  malIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  malStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
  },
  pressedBtn: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  bottomSpacer: {
    height: 16,
  },
});
