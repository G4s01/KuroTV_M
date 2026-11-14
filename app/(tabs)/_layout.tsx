import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, getContrastTextColor } from '@/theme';
import { AppStorage } from '@/services/storage';
import { SyncManager, type SyncStatus } from '@/services/sync';
import { SyncConnectModal, SyncProfileModal } from '@/components/settings';
import { usePendingUpdate } from '@/services/updater';
import { useResponsiveLayout } from '@/hooks';
import { TabletNavigationRail } from '@/components';

function BottomTabIcon({
  name,
  focusedName,
  focused,
  color,
  badge,
}: {
  name: any;
  focusedName: any;
  focused: boolean;
  color: string;
  badge?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();

  if (isTablet) {
    return (
      <View style={styles.tabletTabIconWrapper}>
        <Ionicons
          name={focused ? focusedName : name}
          size={24}
          color={focused ? theme.colors.primary : color}
        />
        {badge}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bottomTabItem,
        focused && [
          styles.bottomTabItemActive,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ],
      ]}
    >
      <Ionicons
        name={focused ? focusedName : name}
        size={22}
        color={focused ? theme.colors.primary : color}
      />
      {badge}
    </View>
  );
}

function SettingsTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();
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

  if (isTablet) {
    return (
      <View style={styles.tabletTabIconWrapper}>
        <Ionicons
          name={focused ? 'settings' : 'settings-outline'}
          size={24}
          color={focused ? theme.colors.primary : color}
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

  return (
    <View
      style={[
        styles.bottomTabItem,
        focused && [
          styles.bottomTabItemActive,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ],
      ]}
    >
      <Ionicons
        name={focused ? 'settings' : 'settings-outline'}
        size={22}
        color={focused ? theme.colors.primary : color}
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

function ProfileTabIcon({
  focused,
  color,
  syncStatus,
}: {
  focused: boolean;
  color: string;
  syncStatus: SyncStatus;
}) {
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();

  const activeProfileName = syncStatus.profileName?.trim();
  const profileInitial = activeProfileName
    ? activeProfileName.charAt(0).toUpperCase()
    : null;
  const isConnected = syncStatus.isConnected;
  const hasProfile = Boolean(isConnected && (profileInitial || syncStatus.profileId));

  if (isTablet) {
    if (isConnected && profileInitial) {
      return (
        <View style={styles.tabletTabIconWrapper}>
          <View
            style={[
              styles.profileAvatarCircle,
              {
                borderColor: focused ? theme.colors.primary : theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text
              style={[
                styles.profileAvatarInitial,
                { color: theme.colors.primary },
              ]}
              numberOfLines={1}
            >
              {profileInitial}
            </Text>
            <View
              style={[
                styles.profileStatusDot,
                {
                  backgroundColor: theme.colors.success || '#22C55E',
                  borderColor: theme.colors.background,
                },
              ]}
            />
          </View>
        </View>
      );
    }
    if (isConnected) {
      return (
        <View style={styles.tabletTabIconWrapper}>
          <Ionicons
            name={focused ? 'person-circle' : 'person-circle-outline'}
            size={24}
            color={focused ? theme.colors.primary : color}
          />
        </View>
      );
    }
    return (
      <View style={styles.tabletTabIconWrapper}>
        <Ionicons
          name={focused ? 'log-in' : 'log-in-outline'}
          size={24}
          color={focused ? theme.colors.primary : color}
        />
      </View>
    );
  }

  // Smartphone bottom tab bar item
  return (
    <View
      style={[
        styles.bottomTabItem,
        focused && [
          styles.bottomTabItemActive,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ],
      ]}
    >
      {isConnected ? (
        <View style={styles.profileAvatarWrapper}>
          {profileInitial ? (
            <View
              style={[
                styles.profileAvatarCircle,
                {
                  borderColor: focused ? theme.colors.primary : theme.colors.border,
                  backgroundColor: theme.colors.card || theme.colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.profileAvatarInitial,
                  { color: theme.colors.primary },
                ]}
                numberOfLines={1}
              >
                {profileInitial}
              </Text>
            </View>
          ) : (
            <Ionicons
              name={focused ? 'person-circle' : 'person-circle-outline'}
              size={22}
              color={focused ? theme.colors.primary : color}
            />
          )}
          <View
            style={[
              styles.profileStatusDot,
              {
                backgroundColor: theme.colors.success || '#22C55E',
                borderColor: theme.colors.background,
              },
            ]}
          />
        </View>
      ) : (
        <Ionicons
          name={focused ? 'log-in' : 'log-in-outline'}
          size={22}
          color={focused ? theme.colors.primary : color}
        />
      )}
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsiveLayout();

  const [isHistoryEnabled, setIsHistoryEnabled] = React.useState<boolean>(() => {
    return AppStorage.isHistoryEnabled();
  });

  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>(() => SyncManager.getStatus());
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = React.useState(false);

  React.useEffect(() => {
    const unsubSync = SyncManager.addSyncListener((status) => {
      setSyncStatus(status);
    });
    return unsubSync;
  }, []);

  const handleProfilePress = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (SyncManager.isConnected()) {
      setIsProfileModalOpen(true);
    } else {
      setIsConnectModalOpen(true);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = AppStorage.addSettingsListener(() => {
      setIsHistoryEnabled(AppStorage.isHistoryEnabled());
    });
    return unsubscribe;
  }, []);

  // Shift the app router higher up to guarantee generous clearance above fixed Android system navigation buttons
  const androidBottomInset = Math.max(16, insets.bottom + 8);
  const iosBottomInset = Math.max(20, insets.bottom);

  return (
    <>
      <Tabs
        backBehavior="initialRoute"
        tabBar={
          isTablet
            ? (props) => (
                <TabletNavigationRail
                  {...props}
                  syncStatus={syncStatus}
                  onProfilePress={handleProfilePress}
                  theme={theme}
                />
              )
            : undefined
        }
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarPosition: isTablet ? 'left' : 'bottom',
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarStyle: isTablet
            ? {
                backgroundColor: theme.colors.background,
                borderRightColor: theme.colors.border,
                borderRightWidth: 1,
                borderTopWidth: 0,
                width: 76,
                minWidth: 76,
                maxWidth: 76,
                height: '100%',
              }
            : {
                backgroundColor: theme.colors.background,
                borderTopColor: theme.colors.border,
                borderTopWidth: 1,
                height: Platform.OS === 'android' ? 62 + androidBottomInset : 64 + iosBottomInset,
                paddingBottom: Platform.OS === 'android' ? androidBottomInset : iosBottomInset,
                paddingTop: 6,
              },
          tabBarItemStyle: isTablet
            ? {
                width: 76,
                minWidth: 76,
                maxWidth: 76,
                height: 56,
                minHeight: 44,
                justifyContent: 'center',
                alignItems: 'center',
                marginVertical: 4,
              }
            : {
                height: 50,
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
              <BottomTabIcon
                name="home-outline"
                focusedName="home"
                focused={focused}
                color={color as string}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            // Tab item hidden from bar (formerly had href: null; now uses tabBarItemStyle and tabBarButton to prevent v58 redirect)
            title: 'PALINSESTO',
            tabBarItemStyle: { display: 'none' },
            tabBarButton: () => null,
            tabBarShowLabel: false,
            tabBarLabel: () => null,
            tabBarIcon: ({ color, focused }) => (
              <BottomTabIcon
                name="calendar-outline"
                focusedName="calendar"
                focused={focused}
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
              <BottomTabIcon
                name="heart-outline"
                focusedName="heart"
                focused={focused}
                color={color as string}
              />
            ),
          }}
        />
        <Tabs.Protected guard={isHistoryEnabled}>
          <Tabs.Screen
            name="history"
            options={{
              title: 'CRONOLOGIA',
              tabBarShowLabel: false,
              tabBarLabel: () => null,
              tabBarIcon: ({ color, focused }) => (
                <BottomTabIcon
                  name="time-outline"
                  focusedName="time"
                  focused={focused}
                  color={color as string}
                />
              ),
            }}
          />
        </Tabs.Protected>
        <Tabs.Screen
          name="profile"
          options={{
            title: 'PROFILO',
            tabBarShowLabel: false,
            tabBarLabel: () => null,
            tabBarIcon: ({ color, focused }) => (
              <ProfileTabIcon
                focused={focused}
                color={color as string}
                syncStatus={syncStatus}
              />
            ),
            tabBarButton: ({ ref: _ref, ...props }) => (
              <Pressable
                {...props}
                style={({ pressed }) => [
                  props.style as any,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={(e) => {
                  e.preventDefault?.();
                  handleProfilePress();
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  syncStatus.isConnected && (syncStatus.profileName?.trim() || syncStatus.profileId)
                    ? `PROFILO: ${syncStatus.profileName?.trim() || 'PRINCIPALE'}`
                    : 'ACCEDI / COLLEGA KUROSYNC'
                }
              >
                {props.children}
              </Pressable>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              handleProfilePress();
            },
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

      {/* Quick Profile Modals */}
      <SyncConnectModal
        visible={isConnectModalOpen}
        initialTab="qr"
        theme={theme}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={() => {
          setIsConnectModalOpen(false);
        }}
      />

      <SyncProfileModal
        visible={isProfileModalOpen}
        activeProfileId={syncStatus.profileId}
        theme={theme}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileSelected={() => {
          setIsProfileModalOpen(false);
        }}
        onProposeLogin={() => {
          setIsConnectModalOpen(true);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bottomTabItem: {
    width: 50,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bottomTabItemActive: {
    borderWidth: 1,
  },
  tabletTabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileAvatarWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarInitial: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  arrowBadge: {
    position: 'absolute',
    top: 4,
    right: 10,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
