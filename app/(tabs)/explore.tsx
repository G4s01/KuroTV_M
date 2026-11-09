import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

export default function ExploreScreen() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace('/(tabs)');
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
}
