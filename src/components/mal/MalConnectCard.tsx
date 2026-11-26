import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getContrastTextColor, useTheme } from '@/theme';
import {
  MAL_API_CONFIG_URL,
  MAL_REDIRECT_URI,
  MalAuthService,
  addMalDataListener,
  getEffectiveMalClientId,
  isValidMalClientId,
  setStoredMalClientId,
} from '@/services/mal';
import { malStyles as styles } from './mal.styles';
import malSvg from '../../../assets/icons/myanimelist.svg';

export interface MalConnectCardProps {
  onConnected?: () => void;
}

export const MalConnectCard: React.FC<MalConnectCardProps> = React.memo(
  function MalConnectCard({ onConnected }) {
    const { theme } = useTheme();
    const primaryContrast = getContrastTextColor(theme.colors.primary);

    const [authStatus, setAuthStatus] = React.useState(() => MalAuthService.getStatus());
    const initialClientId = React.useMemo(() => getEffectiveMalClientId(), []);
    const inputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
    const lastNativeTextRef = React.useRef<string>(initialClientId);
    const [inputKey, setInputKey] = React.useState(0);
    const [hasText, setHasText] = React.useState(() => initialClientId.length > 0);
    const [isClientIdValid, setIsClientIdValid] = React.useState(() =>
      isValidMalClientId(initialClientId)
    );
    const [isGuideExpanded, setIsGuideExpanded] = React.useState(false);
    const [copiedUri, setCopiedUri] = React.useState(false);
    const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

    React.useEffect(() => {
      const unsub = addMalDataListener(() => {
        const nextStatus = MalAuthService.getStatus();
        setAuthStatus((prev) => {
          if (prev.profileScopeId !== nextStatus.profileScopeId) {
            const scopedId = getEffectiveMalClientId();
            lastNativeTextRef.current = scopedId;
            setHasText(scopedId.length > 0);
            setIsClientIdValid(isValidMalClientId(scopedId));
            setInputKey((k) => k + 1);
          }
          return nextStatus;
        });
      });
      return () => {
        unsub();
        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current);
        }
      };
    }, []);

    const handleChangeClientId = React.useCallback((text: string) => {
      lastNativeTextRef.current = text;
      const nextHasText = text.trim().length > 0;
      const nextValid = isValidMalClientId(text);
      setHasText((prev) => (prev !== nextHasText ? nextHasText : prev));
      setIsClientIdValid((prev) => (prev !== nextValid ? nextValid : prev));
      setErrorMsg((prev) => (prev ? null : prev));
    }, []);

    const handleClearClientId = React.useCallback(() => {
      Haptics.selectionAsync().catch(() => {});
      lastNativeTextRef.current = '';
      setHasText(false);
      setIsClientIdValid(false);
      setStoredMalClientId('');
      setErrorMsg(null);
      setInputKey((k) => k + 1);
    }, []);

    const handleCopyRedirectUri = React.useCallback(async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      try {
        await Clipboard.setStringAsync(MAL_REDIRECT_URI);
        setCopiedUri(true);
        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = setTimeout(() => setCopiedUri(false), 2500);
      } catch {
        // Ignore clipboard errors gracefully
      }
    }, []);

    const handleConnect = React.useCallback(async () => {
      if (isSubmitting) return;
      const candidate = lastNativeTextRef.current.trim();
      if (!isValidMalClientId(candidate)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setErrorMsg(
          'INSERISCI UN CLIENT ID MYANIMELIST VALIDO (ALMENO 16 CARATTERI ALFANUMERICI).'
        );
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setIsSubmitting(true);
      setErrorMsg(null);

      try {
        const res = await MalAuthService.startLogin(candidate);
        if (res.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onConnected?.();
        } else if (!res.cancelled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          setErrorMsg(res.error || 'AUTENTICAZIONE MYANIMELIST FALLITA.');
        }
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setErrorMsg((err?.message || 'ERRORE DURANTE IL LOGIN MYANIMELIST.').toUpperCase());
      } finally {
        setIsSubmitting(false);
      }
    }, [isSubmitting, onConnected]);

    return (
      <View
        style={[
          styles.connectCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.connectHeader}>
          <Image source={malSvg} style={styles.connectIcon} contentFit="contain" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.connectTitle, { color: theme.colors.text }]}>
              COLLEGA MYANIMELIST
            </Text>
            <Text style={[styles.connectSubtitle, { color: theme.colors.textSecondary }]}>
              {authStatus.isKuroSyncLinked
                ? `PROFILO KUROSYNC: ${(authStatus.kuroSyncProfileName || 'PRINCIPALE').toUpperCase()} • ACCOUNT E TOKEN MAL LEGATI A QUESTO PROFILO`
                : 'SFOGLIA IN CORSO, DA GUARDARE E COMPLETATI • PROFILO LOCALE DISCONNESSO DA KUROSYNC'}
            </Text>
          </View>
        </View>

        {/* Expandable Setup Guide */}
        <Pressable
          style={[
            styles.guideToggleBtn,
            {
              backgroundColor: theme.colors.card,
              borderColor: isGuideExpanded ? theme.colors.primary : theme.colors.border,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setIsGuideExpanded((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel="GUIDA CONFIGURAZIONE CLIENT ID MYANIMELIST"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Ionicons name="help-circle-outline" size={18} color={theme.colors.primary} />
            <Text style={[styles.secondaryBtnText, { color: theme.colors.text }]}>
              {isGuideExpanded ? 'NASCONDI GUIDA CLIENT ID' : 'COME OTTENERE IL CLIENT ID'}
            </Text>
          </View>
          <Ionicons
            name={isGuideExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.textMuted}
          />
        </Pressable>

        {isGuideExpanded && (
          <View
            style={[
              styles.guideBox,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.guideStepText, { color: theme.colors.text }]}>
              1. APRI MYANIMELIST.NET/APICONFIG E CREA UNA NUOVA APP.
            </Text>
            <Text style={[styles.guideStepText, { color: theme.colors.textSecondary }]}>
              2. APP TYPE: SELEZIONA &quot;ANDROID&quot; OPPURE &quot;OTHER&quot; (NON &quot;WEB&quot;, COSÌ NON SERVE CLIENT SECRET).
            </Text>
            <Text style={[styles.guideStepText, { color: theme.colors.textSecondary }]}>
              3. APP DESCRIPTION: ALMENO 50 CARATTERI ALFANUMERICI SENZA CARATTERI SPECIALI.
            </Text>
            <Text style={[styles.guideStepText, { color: theme.colors.primary }]}>
              4. APP REDIRECT URL: {MAL_REDIRECT_URI}
            </Text>
            <Text style={[styles.guideStepText, { color: theme.colors.textSecondary }]}>
              5. COMMERCIAL: NON-COMMERCIAL • PURPOSE: PERSONAL / HOBBY. COPIA IL CLIENT ID GENERATO QUI SOTTO.
            </Text>

            <View style={styles.guideActionsRow}>
              <Pressable
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: copiedUri
                      ? `${theme.colors.success || '#10B981'}18`
                      : theme.colors.surface,
                    borderColor: copiedUri
                      ? theme.colors.success || '#10B981'
                      : theme.colors.primary,
                    flex: 1,
                  },
                ]}
                onPress={handleCopyRedirectUri}
                accessibilityRole="button"
                accessibilityLabel={`COPIA REDIRECT URI ${MAL_REDIRECT_URI}`}
              >
                <Ionicons
                  name={copiedUri ? 'checkmark-circle' : 'copy-outline'}
                  size={16}
                  color={copiedUri ? theme.colors.success || '#10B981' : theme.colors.primary}
                />
                <Text
                  style={[
                    styles.secondaryBtnText,
                    {
                      color: copiedUri
                        ? theme.colors.success || '#10B981'
                        : theme.colors.primary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {copiedUri ? 'COPIATO!' : 'COPIA REDIRECT URI'}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  Linking.openURL(MAL_API_CONFIG_URL).catch(() => {});
                }}
                accessibilityRole="link"
                accessibilityLabel="APRI PORTALE APICONFIG MYANIMELIST"
              >
                <Ionicons name="open-outline" size={16} color={theme.colors.text} />
                <Text style={[styles.secondaryBtnText, { color: theme.colors.text }]}>
                  APRI MAL
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Uncontrolled Client ID Input */}
        <View>
          <Text style={[styles.fieldLabel, { color: theme.colors.textMuted }]}>
            CLIENT ID PERSONALE (SOLO LOCALE)
          </Text>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.colors.card,
                borderColor: isClientIdValid
                  ? theme.colors.success || '#10B981'
                  : hasText
                  ? theme.colors.warning || '#F59E0B'
                  : theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name="key-outline"
              size={17}
              color={
                isClientIdValid
                  ? theme.colors.success || '#10B981'
                  : theme.colors.textMuted
              }
            />
            <TextInput
              key={inputKey}
              ref={inputRef}
              style={[styles.textInput, { color: theme.colors.text }]}
              placeholder="INCOLLA IL TUO CLIENT ID MAL..."
              placeholderTextColor={theme.colors.textMuted}
              defaultValue={lastNativeTextRef.current}
              onChangeText={handleChangeClientId}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              disableFullscreenUI={true}
              returnKeyType="done"
              onSubmitEditing={handleConnect}
              accessibilityLabel="CLIENT ID MYANIMELIST"
            />
            {hasText && (
              <Pressable
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                onPress={handleClearClientId}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="PULISCI CLIENT ID"
              >
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {errorMsg ? (
          <View
            style={[
              styles.inlineBanner,
              {
                marginHorizontal: 0,
                marginTop: 0,
                backgroundColor: `${theme.colors.error || '#EF4444'}18`,
                borderColor: theme.colors.error || '#EF4444',
              },
            ]}
          >
            <Ionicons name="alert-circle" size={16} color={theme.colors.error || '#EF4444'} />
            <Text
              style={[
                styles.inlineBannerText,
                { color: theme.colors.error || '#EF4444' },
              ]}
            >
              {errorMsg}
            </Text>
          </View>
        ) : null}

        {/* Connect CTA */}
        <Pressable
          style={[
            styles.primaryBtn,
            {
              backgroundColor: isClientIdValid ? theme.colors.primary : theme.colors.surfaceSubtle,
              opacity: isSubmitting ? 0.7 : 1,
            },
          ]}
          onPress={handleConnect}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="CONNETTI MYANIMELIST"
        >
          {isSubmitting ? (
            <ActivityIndicator
              size="small"
              color={isClientIdValid ? primaryContrast : theme.colors.text}
            />
          ) : (
            <>
              <Ionicons
                name="log-in-outline"
                size={18}
                color={isClientIdValid ? primaryContrast : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.primaryBtnText,
                  { color: isClientIdValid ? primaryContrast : theme.colors.textMuted },
                ]}
              >
                CONNETTI MYANIMELIST
              </Text>
            </>
          )}
        </Pressable>
      </View>
    );
  }
);
