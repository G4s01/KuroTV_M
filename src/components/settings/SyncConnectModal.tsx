import React, { useState, useEffect, useRef } from 'react';
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
import { SyncManager, type ProfileItem } from '@/services/sync';
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
  const [isScannerOpen, setIsScannerOpen] = useState(() => initialTab === 'qr');

  // Connection mode & session data
  const [step, setStep] = useState<'credentials' | 'select_profile'>('credentials');
  const [connectionSource, setConnectionSource] = useState<'qr' | 'manual'>('qr');
  const qrSessionData = useRef<{
    serverUrl: string;
    deviceToken: string;
    deviceId?: string;
    currentProfileId?: string;
  } | null>(null);

  // Manual state
  const [serverUrl, setServerUrl] = useState(() => AppStorage.getString(StorageKeys.SYNC_SERVER_URL) || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Netflix-style Profile Selection State
  const [availableProfiles, setAvailableProfiles] = useState<ProfileItem[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const primaryContrast = getContrastTextColor(theme.colors.primary);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      setStep('credentials');
      setConnectionSource(initialTab);
      setAvailableProfiles([]);
      setSelectedProfileId(null);
      setErrorMsg(null);
      qrSessionData.current = null;
      setIsScannerOpen(initialTab === 'qr');
    } else {
      setIsScannerOpen(false);
      setIsLoading(false);
    }
  }, [initialTab, visible]);

  const handleClose = () => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setErrorMsg(null);
    setStep('credentials');
    setIsScannerOpen(false);
    onClose();
  };

  const handleSelectTab = (tab: 'qr' | 'manual') => {
    Haptics.selectionAsync().catch(() => {});
    setActiveTab(tab);
    setErrorMsg(null);
    if (tab === 'qr') {
      setIsScannerOpen(true);
    }
  };

  /**
   * QR Flow - Step 1: Handle Scanned QR Data, exchange token, and fetch profiles
   */
  const handleScanQr = async (scannedData: string) => {
    setIsScannerOpen(false);
    const clean = scannedData?.trim();
    if (!clean) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await SyncManager.prepareQrConnection(clean);
      if (res.ok && res.deviceToken && res.serverUrl) {
        qrSessionData.current = {
          serverUrl: res.serverUrl,
          deviceToken: res.deviceToken,
          deviceId: res.deviceId,
          currentProfileId: res.currentProfileId,
        };
        setConnectionSource('qr');
        setAvailableProfiles(res.profiles || []);
        setStep('select_profile');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        if (res.isExpiredQr || res.message?.includes('410') || res.message?.toLowerCase().includes('scaduto')) {
          setErrorMsg('Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.');
        } else {
          setErrorMsg(res.message || 'Scansione QR fallita');
        }
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (err?.status === 410 || String(err?.message).includes('410') || String(err?.message).toLowerCase().includes('scaduto')) {
        setErrorMsg('Il codice QR è scaduto o è già stato utilizzato. Generane uno nuovo dalla console Web.');
      } else {
        setErrorMsg(err?.message || 'Errore di connessione');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Manual Password Flow - Step 1: Validate credentials & list profiles
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
        setErrorMsg("NESSUN PROFILO TROVATO SULL'ISTANZA KUROTV_S");
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setConnectionSource('manual');
      setAvailableProfiles(profiles);
      setStep('select_profile');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMsg(err?.message || 'AUTENTICAZIONE FALLITA');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Profile Selection Step (Both QR & Manual): User taps desired profile -> Finalize login & initial sync
   */
  const handleSelectProfile = async (profile: ProfileItem) => {
    setSelectedProfileId(profile.id);
    setIsLoading(true);
    setErrorMsg(null);

    try {
      let res: { ok: boolean; message?: string };
      if (connectionSource === 'qr' && qrSessionData.current) {
        res = await SyncManager.completeQrConnection({
          serverUrl: qrSessionData.current.serverUrl,
          deviceToken: qrSessionData.current.deviceToken,
          deviceId: qrSessionData.current.deviceId,
          profileId: profile.id,
          profileName: profile.name,
        });
      } else if (connectionSource === 'manual') {
        res = await SyncManager.loginDeviceWithProfile({
          serverUrl: serverUrl.trim(),
          password: password.trim(),
          profileId: profile.id,
          profileName: profile.name,
        });
      } else {
        setErrorMsg('Sessione QR scaduta. Ripeti la scansione.');
        setStep('credentials');
        setIsLoading(false);
        setSelectedProfileId(null);
        return;
      }

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onSuccess?.();
        handleClose();
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
        visible={visible && (!isScannerOpen || step === 'select_profile')}
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
                {step === 'select_profile' ? (
                  <Pressable
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setStep('credentials');
                      setErrorMsg(null);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="TORNA INDIETRO"
                  >
                    <Ionicons name="arrow-back-outline" size={20} color={theme.colors.text} />
                  </Pressable>
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.primary} />
                )}
                <Text style={[styles.syncModalTitle, { color: theme.colors.text }]}>
                  {step === 'select_profile' ? 'CHI STA GUARDANDO?' : 'COLLEGA KUROSYNC'}
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

            {/* Symmetrical Mode Selector: QR CODE vs MANUALE (Visible only during connection step) */}
            {step === 'credentials' ? (
              <View style={styles.syncTabRow}>
                <Pressable
                  style={[
                    styles.syncTabBtn,
                    {
                      backgroundColor: activeTab === 'qr' ? `${theme.colors.primary}22` : theme.colors.card,
                      borderColor: activeTab === 'qr' ? theme.colors.primary : theme.colors.border,
                      flexDirection: 'row',
                      gap: 6,
                    },
                  ]}
                  onPress={() => handleSelectTab('qr')}
                  accessibilityRole="tab"
                  accessibilityLabel="SELEZIONA MODALITÀ QR CODE"
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={16}
                    color={activeTab === 'qr' ? theme.colors.primary : theme.colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.syncTabBtnText,
                      { color: activeTab === 'qr' ? theme.colors.primary : theme.colors.textMuted },
                    ]}
                  >
                    QR CODE
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.syncTabBtn,
                    {
                      backgroundColor:
                        activeTab === 'manual' ? `${theme.colors.primary}22` : theme.colors.card,
                      borderColor: activeTab === 'manual' ? theme.colors.primary : theme.colors.border,
                      flexDirection: 'row',
                      gap: 6,
                    },
                  ]}
                  onPress={() => handleSelectTab('manual')}
                  accessibilityRole="tab"
                  accessibilityLabel="SELEZIONA MODALITÀ MANUALE"
                >
                  <Ionicons
                    name="key-outline"
                    size={16}
                    color={activeTab === 'manual' ? theme.colors.primary : theme.colors.textMuted}
                  />
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

            {/* Content: Mode 1 - QR CODE */}
            {step === 'credentials' && activeTab === 'qr' ? (
              <View style={{ gap: 12 }}>
                <View
                  style={[
                    styles.syncQrBox,
                    { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  ]}
                >
                  <Ionicons name="qr-code-outline" size={44} color={theme.colors.primary} />
                  <Text
                    style={[
                      styles.syncDesc,
                      { color: theme.colors.textMuted, textAlign: 'center', marginBottom: 0 },
                    ]}
                  >
                    INQUADRA IL CODICE QR DALLA WEB CONSOLE DI KUROTV_S PER COLLEGARE IL DISPOSITIVO ISTANTANEAMENTE.
                  </Text>
                </View>

                {/* Direct Camera Open Button */}
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
                  accessibilityLabel="SCANSIONA CON FOTOCAMERA"
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={primaryContrast} />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={18} color={primaryContrast} />
                      <Text style={[styles.syncBtnText, { color: primaryContrast }]}>
                        SCANSIONA CON FOTOCAMERA
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* Content: Mode 2 - MANUALE */}
            {step === 'credentials' && activeTab === 'manual' ? (
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

                {/* Manual Submit Button */}
                <Pressable
                  style={[
                    styles.syncBtn,
                    {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.primary,
                      opacity: isLoading ? 0.7 : 1,
                      marginTop: 4,
                    },
                  ]}
                  onPress={handleFetchProfiles}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel="AVANTI SELEZIONA PROFILO"
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={primaryContrast} />
                  ) : (
                    <>
                      <Ionicons name="arrow-forward-outline" size={18} color={primaryContrast} />
                      <Text style={[styles.syncBtnText, { color: primaryContrast }]}>
                        AVANTI (SELEZIONA PROFILO)
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* Profile Selection Step (Unified Netflix-style picker for both QR and Manual) */}
            {step === 'select_profile' ? (
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
                          handleSelectProfile(p);
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
            ) : null}

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
