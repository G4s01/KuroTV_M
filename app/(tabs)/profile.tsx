import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Profile tab placeholder route.
 * Handled via tabPress listener & custom tabBarButton in (tabs)/_layout.tsx to open SyncProfileModal / SyncConnectModal.
 * If navigated directly, gracefully redirects to the home tab.
 */
export default function ProfileScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)');
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
}
