import React from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '@/theme';
import { settingsStyles } from './settings.styles';

export const QUICK_DOMAINS = ['ac', 'so', 'tv'] as const;

export interface SourceSettingsCardProps {
  selectedTld: string;
  customUrl: string;
  onChangeCustomUrl: (url: string) => void;
  onSelectQuickDomain: (domain: string) => void;
  onApplyCustomUrl: () => void;
  sourceNotice: string | null;
  theme: Theme;
}

export function SourceSettingsCard({
  selectedTld,
  customUrl,
  onChangeCustomUrl,
  onSelectQuickDomain,
  onApplyCustomUrl,
  sourceNotice,
  theme,
}: SourceSettingsCardProps) {
  return (
    <View style={[settingsStyles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[settingsStyles.cardTitle, { color: theme.colors.text }]}>SORGENTE</Text>
      <View style={settingsStyles.quickDomainsRow}>
        {QUICK_DOMAINS.map((domain) => {
          const active = selectedTld === domain;
          return (
            <Pressable
              key={domain}
              style={[
                settingsStyles.domainChip,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                },
                active && {
                  backgroundColor: `${theme.colors.primary}25`,
                },
              ]}
              onPress={() => onSelectQuickDomain(domain)}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text
                style={[
                  settingsStyles.domainChipText,
                  { color: theme.colors.textSecondary },
                  active && { color: theme.colors.primary, fontWeight: '800' },
                ]}
              >
                .{domain.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={settingsStyles.customUrlRow}>
        <TextInput
          style={[
            settingsStyles.customUrlInput,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          value={customUrl}
          onChangeText={onChangeCustomUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="HTTPS://..."
          placeholderTextColor={theme.colors.textMuted}
        />
        <Pressable
          style={[settingsStyles.applyBtn, { backgroundColor: theme.colors.primary }]}
          onPress={onApplyCustomUrl}
        >
          <Text style={settingsStyles.applyBtnText}>APPLICA</Text>
        </Pressable>
      </View>

      {sourceNotice ? (
        <View style={[settingsStyles.sourceNoticeBox, { backgroundColor: `${theme.colors.primary}18`, borderColor: theme.colors.primary }]}>
          <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
          <Text style={[settingsStyles.sourceNoticeText, { color: theme.colors.primary }]}>{sourceNotice}</Text>
        </View>
      ) : null}
    </View>
  );
}
