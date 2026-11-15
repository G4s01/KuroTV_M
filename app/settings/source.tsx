import React, { useState, useCallback } from 'react';
import { View, ScrollView, BackHandler } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { useResponsiveLayout } from '@/hooks';
import { AppStorage } from '@/services/storage';
import { scraperConfig } from '@/services/scraper/config';
import {
  SettingsHeader,
  SourceSettingsCard,
  QUICK_DOMAINS,
  settingsStyles as styles,
} from '@/components/settings';

export default function SourceSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isTablet } = useResponsiveLayout();

  useFocusEffect(
    useCallback(() => {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        Haptics.selectionAsync().catch(() => {});
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/settings' as any);
        }
        return true;
      });
      return () => backSub.remove();
    }, [router])
  );

  const [selectedTld, setSelectedTld] = useState<string>(() => {
    const custom = AppStorage.getCustomDomain();
    if (custom) {
      try {
        const parsed = new URL(custom);
        const hostParts = parsed.hostname.split('.');
        const candidate = hostParts[hostParts.length - 1]?.toLowerCase();
        if (candidate && Array.isArray(QUICK_DOMAINS) && QUICK_DOMAINS.includes(candidate as any)) {
          return candidate;
        }
        return '';
      } catch {
        return '';
      }
    }
    return AppStorage.getTld();
  });

  const [customUrl, setCustomUrl] = useState<string>(() => {
    const customDomain = AppStorage.getCustomDomain();
    if (customDomain) {
      return customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;
    }
    return scraperConfig.getBaseUrl();
  });

  const [sourceNotice, setSourceNotice] = useState<string | null>(null);

  const showSourceNotice = (msg: string) => {
    setSourceNotice(msg);
    setTimeout(() => {
      setSourceNotice(null);
    }, 4000);
  };

  const handleSelectQuickDomain = (tld: string) => {
    Haptics.selectionAsync().catch(() => {});
    const clean = tld.replace(/^\.+/, '').trim().toLowerCase();
    setSelectedTld(clean);
    const newBase = `https://www.animeworld.${clean}`;
    setCustomUrl(newBase);
    AppStorage.setTld(clean);
    showSourceNotice(`SORGENTE AGGIORNATA: .${clean.toUpperCase()}`);
  };

  const handleApplyCustomUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (typeof trimmed === 'string' && !trimmed.includes('.') && !trimmed.includes('/')) {
      const cleanTld = trimmed.toLowerCase();
      setSelectedTld(cleanTld);
      AppStorage.setTld(cleanTld);
      setCustomUrl(`https://www.animeworld.${cleanTld}`);
      showSourceNotice(`SORGENTE AGGIORNATA: .${cleanTld.toUpperCase()}`);
      return;
    }

    const fullUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

    try {
      const parsed = new URL(fullUrl);
      const hostParts = parsed.hostname.split('.');
      const tldCandidate = hostParts[hostParts.length - 1]?.toLowerCase();
      if (tldCandidate && Array.isArray(QUICK_DOMAINS) && QUICK_DOMAINS.includes(tldCandidate as any)) {
        setSelectedTld(tldCandidate);
      } else {
        setSelectedTld('');
      }
    } catch {
      setSelectedTld('');
    }

    AppStorage.setCustomDomain(fullUrl);
    setCustomUrl(fullUrl);
    showSourceNotice(`URL SORGENTE IMPOSTATO: ${fullUrl.toUpperCase()}`);
  };

  // Synchronize dynamic state on focus
  useFocusEffect(
    useCallback(() => {
      const custom = AppStorage.getCustomDomain();
      if (custom) {
        try {
          const parsed = new URL(custom);
          const hostParts = parsed.hostname.split('.');
          const candidate = hostParts[hostParts.length - 1]?.toLowerCase();
          if (candidate && Array.isArray(QUICK_DOMAINS) && QUICK_DOMAINS.includes(candidate as any)) {
            setSelectedTld(candidate);
          } else {
            setSelectedTld('');
          }
        } catch {
          setSelectedTld('');
        }
        setCustomUrl(custom.startsWith('http') ? custom : `https://${custom}`);
      } else {
        setSelectedTld(AppStorage.getTld());
        setCustomUrl(scraperConfig.getBaseUrl());
      }
    }, [])
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      <SettingsHeader
        title="SORGENTE"
        subtitle="CONFIGURAZIONE DOMINIO ANIMEWORLD E TEST CONNESSIONE"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SourceSettingsCard
          selectedTld={selectedTld}
          customUrl={customUrl}
          onChangeCustomUrl={setCustomUrl}
          onSelectQuickDomain={handleSelectQuickDomain}
          onApplyCustomUrl={handleApplyCustomUrl}
          sourceNotice={sourceNotice}
          theme={theme}
        />
      </ScrollView>
    </View>
  );
}
