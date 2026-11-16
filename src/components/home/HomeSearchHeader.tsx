import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getContrastTextColor } from '@/theme';
import { homeStyles as styles } from './home.styles';

export interface HomeSearchHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onSubmitSearch?: (query: string) => void;
  onClose: () => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
}

export const HomeSearchHeader = React.memo(function HomeSearchHeader({
  searchQuery,
  onSearchChange,
  onSubmitSearch,
  onClose,
  activeFilterCount,
  onOpenFilters,
}: HomeSearchHeaderProps) {
  const { theme } = useTheme();
  const inputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const [localText, setLocalText] = React.useState(searchQuery.length > 0 ? '1' : '');
  const lastNativeTextRef = React.useRef(searchQuery);
  const lastPropagatedQueryRef = React.useRef(searchQuery);
  const isTypingRef = React.useRef(false);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputKey, setInputKey] = React.useState(0);
  const isInitialMount = React.useRef(true);

  // Synchronize with genuine external query mutations (history selection, clear/close)
  // Protected against overwriting or unmounting during active fast typing or spamming
  React.useEffect(() => {
    if (
      searchQuery === lastNativeTextRef.current ||
      searchQuery === lastPropagatedQueryRef.current ||
      isTypingRef.current
    ) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    lastNativeTextRef.current = searchQuery;
    lastPropagatedQueryRef.current = searchQuery;
    setLocalText(searchQuery.length > 0 ? '1' : '');
    setInputKey((k) => k + 1);
  }, [searchQuery]);

  React.useEffect(() => {
    isInitialMount.current = false;
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleChangeText = React.useCallback(
    (text: string) => {
      lastNativeTextRef.current = text;
      isTypingRef.current = true;

      // Only update localText state on empty/non-empty transition to avoid re-rendering
      // on every single keystroke. Re-rendering during fast typing or spamming destroys
      // active IME composing spans (SPAN_COMPOSING) and causes dropped characters on
      // 3rd party keyboards (SwiftKey, Fleksy, Samsung Keyboard, Ekatox).
      setLocalText((prev) => {
        if ((prev.length === 0 && text.length > 0) || (prev.length > 0 && text.length === 0)) {
          return text.length > 0 ? '1' : '';
        }
        return prev;
      });

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Debounce propagating text to parent to prevent full-screen re-renders while typing.
      // Do NOT set localText here: doing so would force a re-render during typing.
      debounceTimerRef.current = setTimeout(() => {
        lastPropagatedQueryRef.current = lastNativeTextRef.current;
        isTypingRef.current = false;
        onSearchChange(lastNativeTextRef.current);
      }, 200);
    },
    [onSearchChange]
  );

  const handleClear = React.useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    isTypingRef.current = false;
    lastNativeTextRef.current = '';
    lastPropagatedQueryRef.current = '';
    setLocalText('');
    onSearchChange('');
    inputRef.current?.clear();
    inputRef.current?.focus();
  }, [onSearchChange]);

  const handleSubmit = React.useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    isTypingRef.current = false;
    const current = lastNativeTextRef.current;
    lastPropagatedQueryRef.current = current;
    onSearchChange(current);
    onSubmitSearch?.(current);
  }, [onSubmitSearch, onSearchChange]);

  return (
    <View style={[styles.searchHeader, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
      <Pressable
        style={styles.searchBackBtn}
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="CHIUDI RICERCA"
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
      </Pressable>

      <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          key={inputKey}
          ref={inputRef}
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="CERCA ANIME, SERIE, FILM..."
          placeholderTextColor={theme.colors.textMuted}
          defaultValue={lastNativeTextRef.current}
          onChangeText={handleChangeText}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          inputMode="search"
          keyboardType="default"
          autoFocus={isInitialMount.current && inputKey === 0}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          disableFullscreenUI={true}
        />
        {localText.length > 0 && (
          <Pressable
            onPress={handleClear}
            hitSlop={12}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="CANCELLA TESTO"
          >
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      <Pressable
        style={[
          styles.filterBtn,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          activeFilterCount > 0 && {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
          },
        ]}
        onPress={onOpenFilters}
        accessibilityRole="button"
        accessibilityLabel="FILTRI DI RICERCA"
      >
        <Ionicons
          name="options-outline"
          size={20}
          color={activeFilterCount > 0 ? getContrastTextColor(theme.colors.primary) : theme.colors.text}
        />
        {activeFilterCount > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: getContrastTextColor(theme.colors.primary) }]}>
            <Text style={[styles.filterBadgeText, { color: theme.colors.primary }]}>{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
});

export interface HomeAppBarProps {
  onSearchPress: () => void;
  onSchedulePress?: () => void;
  activeDownloadsCount?: number;
  onDownloadsPress?: () => void;
}

export function HomeAppBar({
  onSearchPress,
  onSchedulePress,
  activeDownloadsCount = 0,
  onDownloadsPress,
}: HomeAppBarProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.appBar, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
      <View style={styles.brandRow}>
        <Text style={[styles.brandPrefix, { color: theme.colors.text }]}>KURO</Text>
        <Text style={[styles.brandSuffix, { color: theme.colors.primary }]}>TV</Text>
        <View style={[styles.mobileBadge, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.mobileBadgeText, { color: theme.colors.textSecondary }]}>MOBILE</Text>
        </View>
      </View>

      <View style={styles.appBarActions}>
        {onDownloadsPress && (
          <Pressable
            style={[
              styles.downloadButton,
              {
                backgroundColor: theme.colors.card,
                borderColor: activeDownloadsCount > 0 ? theme.colors.primary : theme.colors.border,
                borderWidth: 1,
              },
            ]}
            onPress={onDownloadsPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="SCARICATI"
          >
            <Ionicons
              name={activeDownloadsCount > 0 ? 'cloud-download' : 'cloud-download-outline'}
              size={20}
              color={activeDownloadsCount > 0 ? theme.colors.primary : theme.colors.text}
            />
            {activeDownloadsCount > 0 && (
              <View
                style={[
                  styles.downloadBadge,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.downloadBadgeText,
                    { color: getContrastTextColor(theme.colors.primary) },
                  ]}
                >
                  {activeDownloadsCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {onSchedulePress && (
          <Pressable
            style={[
              styles.scheduleButton,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderWidth: 1,
              },
            ]}
            onPress={onSchedulePress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="PALINSESTO"
          >
            <Ionicons name="calendar-outline" size={20} color={theme.colors.text} />
          </Pressable>
        )}

        <Pressable
          style={[styles.searchButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}
          onPress={onSearchPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="CERCA ANIME"
        >
          <Ionicons name="search" size={20} color={theme.colors.text} />
        </Pressable>
      </View>
    </View>
  );
}
