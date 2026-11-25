import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import {
  MalAuthService,
  MalClient,
  addMalDataListener,
  findEntryInMalListCache,
  type MalAnimeListEntry,
} from '@/services/mal';
import type { AnimeDetail } from '@/types';
import { MalEntrySheet } from './MalEntrySheet';
import { malStyles as styles } from './mal.styles';
import malSvg from '../../../assets/icons/myanimelist.svg';

export interface MalStatusPillProps {
  anime: AnimeDetail;
}

function formatStatusLabel(entry: MalAnimeListEntry | null): string {
  if (!entry) return 'MAL: AGGIUNGI A LISTA';
  const totalStr = entry.numEpisodes > 0 ? `/${entry.numEpisodes}` : '/?';
  if (entry.status === 'plan_to_watch') {
    return 'MAL: DA GUARDARE';
  }
  if (entry.status === 'completed') {
    return entry.score > 0 ? `MAL: COMPLETATO • ★ ${entry.score}` : 'MAL: COMPLETATO';
  }
  if (entry.status === 'watching') {
    return `MAL: IN CORSO • EP. ${entry.watchedEpisodes}${totalStr}`;
  }
  if (entry.status === 'on_hold') {
    return `MAL: IN PAUSA • EP. ${entry.watchedEpisodes}${totalStr}`;
  }
  return `MAL: ABBANDONATO • EP. ${entry.watchedEpisodes}${totalStr}`;
}

export const MalStatusPill: React.FC<MalStatusPillProps> = React.memo(function MalStatusPill({
  anime,
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const malId = anime?.malId;

  const [isConnected, setIsConnected] = React.useState(() => MalAuthService.isConnected());
  const [entry, setEntry] = React.useState<MalAnimeListEntry | null>(() =>
    malId && malId > 0 ? findEntryInMalListCache(malId) : null
  );
  const [isSheetVisible, setIsSheetVisible] = React.useState(false);

  React.useEffect(() => {
    const syncLocalState = () => {
      const connected = MalAuthService.isConnected();
      setIsConnected(connected);
      if (connected && malId && malId > 0) {
        setEntry(findEntryInMalListCache(malId));
      } else {
        setEntry(null);
      }
    };
    syncLocalState();
    const unsub = addMalDataListener(syncLocalState);
    return unsub;
  }, [malId]);

  React.useEffect(() => {
    if (!isConnected || !malId || malId <= 0) return;
    let cancelled = false;
    MalClient.getAnimeUserStatus(malId)
      .then((res) => {
        if (!cancelled) {
          setEntry(res.listEntry);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isConnected, malId]);

  if (typeof malId !== 'number' || !Number.isFinite(malId) || malId <= 0) {
    return null;
  }

  const label = isConnected ? formatStatusLabel(entry) : 'MAL: COLLEGA ACCOUNT';

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.malPillBtn,
          {
            backgroundColor: theme.colors.surface,
            borderColor: entry ? theme.colors.primary : theme.colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          if (!isConnected) {
            router.push('/mal' as any);
          } else {
            setIsSheetVisible(true);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.malPillLeft}>
          <Image source={malSvg} style={styles.headerLogo} contentFit="contain" />
          <Text
            style={[
              styles.malPillText,
              { color: entry ? theme.colors.primary : theme.colors.text },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>

        <Ionicons
          name={isConnected ? 'create-outline' : 'chevron-forward'}
          size={16}
          color={entry ? theme.colors.primary : theme.colors.textMuted}
        />
      </Pressable>

      <MalEntrySheet
        isVisible={isSheetVisible}
        malId={malId}
        animeId={anime.id}
        animeTitle={anime.title}
        totalEpisodesHint={anime.totalEpisodes}
        thumbnail={anime.image || anime.thumbnail}
        initialEntry={entry}
        onClose={() => setIsSheetVisible(false)}
        onUpdated={(next) => setEntry(next)}
      />
    </>
  );
});
