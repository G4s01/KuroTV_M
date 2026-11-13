import React, { useState } from 'react';
import {
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { settingsStyles as styles } from './settings.styles';
import { SyncManager, parseKuroSyncDeepLink, type ProfileItem } from '@/services/sync';
import { AppStorage, StorageKeys } from '@/services/storage/app-storage';
import { QrScannerModal } from './QrScannerModal';
import { getContrastTextColor } from '@/theme';

interface SyncConnectModalProps {
  visible: boolean;
  initialTab?: 'qr' | 'manual';
  theme: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SyncConnectModal: React.FC<SyncConnectModalProps> = React.memo(({
  visible,
  initialTab = 'qr',
  theme,
  onClose,
  onSuccess,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'qr' | 'manual'>(initialTab);

  // QR / Deep Link state
  const [deepLinkInput, setDeepLinkInput] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Manual state - initialized without hardcoded personal URL
  const [serverUrl, setServerUrl] = useState(() => AppStorage.getString(StorageKeys.SYNC_SERVER_URL) || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Netflix-style Profile Selection Step in Manual Mode
  const [manualStep, setManualStep] = useState<'credentials' | 'select_profile'>('credentials');
  const [availableProfiles, setAvailableProfiles] = useState<ProfileItem[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const primaryContrast = getContrastTextColor(theme.colors.primary);

  React.useEffect(() => {
    setActiveTab(initialTab);
    setManualStep('credentials');
    setAvailableProfiles([]);
    setSelectedProfileId(null);
    setErrorMsg(null);
  }, [initialTab, visible]);

  const handleClose = () => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setErrorMsg(null);
    setManualStep('credentials');
    setIsScannerOpen(false);
    onClose();
  };

  const handleConnectWithRaw = async (inputStr: string) => {
    const raw = inputStr.trim();
    if (!raw) {
      setErrorMsg('INQUADRA UN QR KUROSYNC O INCOLLA IL LINK / TOKEN');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      let res: { ok: boolean; isExpiredQr?: boolean; message?: string };
      const parsed = parseKuroSyncDeepLink(raw);
      if (parsed && (parsed.token || parsed.url)) {
        res = await SyncManager.connectFromDeepLink(raw);
      } else {
        // Raw token: requires serverUrl
        const targetUrl = serverUrl.trim() || AppStorage.getString(StorageKeys.SYNC_SERVER_URL) || '';
        if (!targetUrl) {
          setErrorMsg('URL DEL SERVER MANCANTE: CONFIGURA IL SERVER SU MANUALE O USA UN LINK COMPLETO');
          setIsLoading(false);
          return;
        }
        res = await SyncManager.connectWithToken(targetUrl, raw);
      }

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onSuccess?.();
        handleClose();
        router.replace('/(tabs)');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        if (res.isExpiredQr || res.message?.includes('410') || res.message?.toLowerCase().includes('scaduto')) {
          setErrorMsg('Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.');
        } else {
          setErrorMsg(res.message || 'CONNESSIONE FALLITA');
        }
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (err?.status === 410 || String(err?.message).includes('410') || String(err?.message).toLowerCase().includes('scaduto')) {
        setErrorMsg('Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.');
      } else {
        setErrorMsg(err?.message || 'ERRORE DI RETE');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectQr = () => {
    handleConnectWithRaw(deepLinkInput);
  };

  const handleScanQr = (scannedData: string) => {
    setIsScannerOpen(false);
    const clean = scannedData.trim();
    setDeepLinkInput(clean);
    handleConnectWithRaw(clean);
  };

  /**
   * Master Password Flow - Step 1: Validate credentials & list profiles
   */
  const handleFetchProfiles = async () => {
    const url = serverUrl.trim();
    const pass = password.trim();

    if (!url) {
      setErrorMsg("INSERISCI L'URL DELLA TUA ISTANZA KUROTV_S");
      return;
    }
    if (!pass) {
      setErrorMsg('LA MASTER PASSWORD È RICHIESTA');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const profiles = await SyncManager.listProfilesWithPassword(url, pass);
      if (!profiles || profiles.length === 0) {
        setErrorMsg('NESSUN PROFILO TROVATO SULL\'ISTANZA KUROTV_S');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setAvailableProfiles(profiles);
      setManualStep('select_profile');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMsg(err?.message || 'AUTENTICAZIONE FALLITA');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Master Password Flow - Step 2: User taps desired profile -> Login & initial sync
   */
  const handleSelectProfileAndLogin = async (profile: ProfileItem) => {
    const url = serverUrl.trim();
    const pass = password.trim();
    setSelectedProfileId(profile.id);
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await SyncManager.loginDeviceWithProfile({
        serverUrl: url,
        password: pass,
        profileId: profile.id,
        profileName: profile.name,
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onSuccess?.();
        handleClose();
        router.replace('/(tabs)');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setErrorMsg(res.message || 'LOGIN FALLITO');
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMsg(err?.message || 'ERRORE DI RETE');
    } finally {
      setIsLoading(false);
      setSelectedProfileId(null);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={handleClose}
      >
        <Pressable
          style={styles.syncModalOverlay}
          onPress={handleClose}
          accessibilityRole="none"
        >
          <Pressable
            style={[
              styles.syncModalCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.syncModalHeader}>
              <View style={styles.syncModalTitleRow}>
                {manualStep === 'select_profile' ? (
                  <Pressable
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setManualStep('credentials');
                      setErrorMsg(null);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="TORNA ALLE CREDENZIALI"
                  >
                    <Ionicons name="arrow-back-outline" size={20} color={theme.colors.text} />
                  </Pressable>
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.primary} />
                )}
                <Text style={[styles.syncModalTitle, { color: theme.colors.text }]}>
                  {manualStep === 'select_profile' ? 'CHI STA GUARDANDO?' : 'COLLEGA KUROSYNC'}
                </Text>
              </View>
              <Pressable
                style={styles.syncModalCloseBtn}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="CHIUDI"
              >
                <Ionicons name="close-outline" size={22} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            {/* Tab Row (Visible only during credentials input) */}
            {manualStep === 'credentials' ? (
              <View style={styles.syncTabRow}>
                <Pressable
                  style={[
                    styles.syncTabBtn,
                    {
                      backgroundColor: activeTab === 'qr' ? `${theme.colors.primary}22` : theme.colors.card,
                      borderColor: activeTab === 'qr' ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveTab('qr');
                    setErrorMsg(null);
                  }}
                  accessibilityRole="tab"
                >
                  <Text
                    style={[
                      styles.syncTabBtnText,
                      { color: activeTab === 'qr' ? theme.colors.primary : theme.colors.textMuted },
                    ]}
                  >
                    QR O LINK
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.syncTabBtn,
                    {
                      backgroundColor:
                        activeTab === 'manual' ? `${theme.colors.primary}22` : theme.colors.card,
                      borderColor: activeTab === 'manual' ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveTab('manual');
                    setErrorMsg(null);
                  }}
                  accessibilityRole="tab"
                >
                  <Text
                    style={[
                      styles.syncTabBtnText,
                      { color: activeTab === 'manual' ? theme.colors.primary : theme.colors.textMuted },
                    ]}
                  >
                    MANUALE
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* TAB 1: QR o Link */}
            {activeTab === 'qr' ? (
              <View style={{ gap: 12 }}>
                <Text style={[styles.syncDesc, { color: theme.colors.textMuted, marginBottom: 2 }]}>
                  INQUADRA IL QR DALLA WEB CONSOLE DI KUROTV_S CON LA FOTOCAMERA, OPPURE INCOLLA QUI IL LINK O TOKEN.
                </Text>

                {/* Camera Scanner Trigger Button */}
                <Pressable
                  style={[
                    styles.syncBtn,
                    {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                      minHeight: 46,
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setIsScannerOpen(true);
                  }}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel="SCANSIONA QR CON FOTOCAMERA"
                >
                  <Ionicons name="camera-outline" size={18} color={primaryContrast} />
                  <Text style={[styles.syncBtnText, { color: primaryContrast }]}>
                    SCANSIONA CON FOTOCAMERA
                  </Text>
                </Pressable>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
                  <Text style={{ color: theme.colors.textMuted, fontFamily: 'monospace', fontSize: 10, fontWeight: '700' }}>
                    OPPURE INCOLLA LINK O TOKEN
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
                </View>

                <View style={styles.syncFieldGroup}>
                  <Text style={[styles.syncFieldLabel, { color: theme.colors.textMuted }]}>
                    LINK O TOKEN DI CONNESSIONE
                  </Text>
                  <TextInput
                    style={[
                      styles.syncInput,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: errorMsg ? theme.colors.error || '#EF4444' : theme.colors.border,
                        color: theme.colors.text,
                        minHeight: 56,
                      },
                    ]}
                    value={deepLinkInput}
                    onChangeText={(t) => {
                      setDeepLinkInput(t);
                      setErrorMsg(null);
                    }}
                    placeholder="kurosync://connect?url=...&token=..."
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline={true}
                    editable={!isLoading}
                  />
                </View>

                {deepLinkInput.length > 0 ? (
                  <Pressable
                    style={{ alignSelf: 'flex-end', padding: 6 }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPress={() => setDeepLinkInput('')}
                    accessibilityRole="button"
                    accessibilityLabel="CANCELLA TESTO"
                  >
                    <Text style={{ color: theme.colors.primary, fontFamily: 'monospace', fontSize: 11, fontWeight: '700' }}>
                      CANCELLA TESTO
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : manualStep === 'credentials' ? (
              /* TAB 2 - Step 1: Input URL & Password */
              <View style={{ gap: 12 }}>
                <View style={styles.syncFieldGroup}>
                  <Text style={[styles.syncFieldLabel, { color: theme.colors.textMuted }]}>
                    URL ISTANZA KUROTV_S
                  </Text>
                  <TextInput
                    style={[
                      styles.syncInput,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                    value={serverUrl}
                    onChangeText={setServerUrl}
                    placeholder="https://tuo-kurotv-s.tuonome.workers.dev"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>

                <View style={styles.syncFieldGroup}>
                  <Text style={[styles.syncFieldLabel, { color: theme.colors.textMuted }]}>
                    MASTER PASSWORD
                  </Text>
                  <View style={{ position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      style={[
                        styles.syncInput,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: errorMsg ? theme.colors.error || '#EF4444' : theme.colors.border,
                          color: theme.colors.text,
                          paddingRight: 44,
                        },
                      ]}
                      value={password}
                      onChangeText={(p) => {
                        setPassword(p);
                        setErrorMsg(null);
                      }}
                      placeholder="Master Password"
                      placeholderTextColor={theme.colors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                    />
                    <Pressable
                      style={{ position: 'absolute', right: 10, padding: 8 }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => setShowPassword(!showPassword)}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'NASCONDI PASSWORD' : 'MOSTRA PASSWORD'}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={theme.colors.textMuted}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              /* TAB 2 - Step 2: Netflix-style Profile Selector */
              <View style={{ gap: 14 }}>
                <View style={styles.netflixProfileHeader}>
                  <Text style={[styles.netflixProfileHeaderSubtitle, { color: theme.colors.textMuted }]}>
                    SELEZIONA IL TUO PROFILO PER FINALIZZARE L'ACCESSO
                  </Text>
                </View>

                <ScrollView
                  style={{ maxHeight: 260 }}
                  contentContainerStyle={styles.netflixProfileGrid}
                  showsVerticalScrollIndicator={false}
                >
                  {availableProfiles.map((p) => {
                    const isSelected = selectedProfileId === p.id;
                    const avatarBg = p.avatarColor || p.avatar_color || '#E50914';
                    const isSingle = availableProfiles.length === 1;

                    return (
                      <Pressable
                        key={p.id}
                        style={[
                          styles.netflixProfileCard,
                          isSingle ? { minWidth: 120 } : null,
                        ]}
                        onPress={() => {
                          if (isLoading) return;
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          handleSelectProfileAndLogin(p);
                        }}
                        disabled={isLoading}
                        accessibilityRole="button"
                        accessibilityLabel={`SELEZIONA PROFILO ${p.name}`}
                      >
                        <View
                          style={[
                            isSingle ? styles.netflixAvatarBoxLarge : styles.netflixAvatarBox,
                            {
                              backgroundColor: avatarBg,
                              borderColor: isSelected ? theme.colors.primary : 'rgba(255, 255, 255, 0.2)',
                            },
                          ]}
                        >
                          {isLoading && isSelected ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Ionicons name="person" size={isSingle ? 48 : 36} color="#FFFFFF" />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.netflixProfileName,
                            { color: isSelected ? theme.colors.primary : theme.colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                        {isSingle ? (
                          <View
                            style={{
                              backgroundColor: `${theme.colors.primary}20`,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text
                              style={{
                                color: theme.colors.primary,
                                fontFamily: 'monospace',
                                fontSize: 9,
                                fontWeight: '800',
                              }}
                            >
                              PROFILO UNICO
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Error Notice */}
            {errorMsg ? (
              <View
                style={[
                  styles.syncNoticeBox,
                  {
                    backgroundColor: `${theme.colors.error || '#EF4444'}18`,
                    borderColor: theme.colors.error || '#EF4444',
                  },
                ]}
              >
                <Ionicons name="alert-circle" size={15} color={theme.colors.error || '#EF4444'} />
                <Text style={[styles.syncNoticeText, { color: theme.colors.error || '#EF4444' }]}>
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {/* Primary Action Button (Only in QR mode or credentials input step) */}
            {manualStep === 'credentials' ? (
              <Pressable
                style={[
                  styles.syncBtn,
                  {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                    opacity: isLoading ? 0.7 : 1,
                    marginTop: 6,
                  },
                ]}
                onPress={activeTab === 'qr' ? handleConnectQr : handleFetchProfiles}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={activeTab === 'qr' ? 'CONNETTI ISTANZA' : 'AVANTI SELEZIONA PROFILO'}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={primaryContrast} />
                ) : (
                  <>
                    <Ionicons
                      name={activeTab === 'qr' ? 'link' : 'arrow-forward-outline'}
                      size={18}
                      color={primaryContrast}
                    />
                    <Text style={[styles.syncBtnText, { color: primaryContrast }]}>
                      {activeTab === 'qr' ? 'CONNETTI ISTANZA' : 'AVANTI (SELEZIONA PROFILO)'}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* QR Camera Scanner Modal */}
      <QrScannerModal
        visible={visible && isScannerOpen}
        title="SCANSIONA QR KUROSYNC"
        theme={theme}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanQr}
      />
    </>
  );
});
