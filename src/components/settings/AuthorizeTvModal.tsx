import React, { useState } from 'react';
import {
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { settingsStyles as styles } from './settings.styles';
import { SyncManager, parseKuroSyncDeepLink } from '@/services/sync';
import { QrScannerModal } from './QrScannerModal';
import { getContrastTextColor } from '@/theme';

interface AuthorizeTvModalProps {
  visible: boolean;
  activeProfileName: string;
  activeProfileId: string;
  theme: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthorizeTvModal: React.FC<AuthorizeTvModalProps> = React.memo(({
  visible,
  activeProfileName,
  activeProfileId,
  theme,
  onClose,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('Android TV');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const primaryContrast = getContrastTextColor(theme.colors.primary);

  const handleClose = () => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCode('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsScannerOpen(false);
    onClose();
  };

  const handleChangeCode = (text: string) => {
    const clean = text.trim();
    const parsed = parseKuroSyncDeepLink(clean);
    let targetCode = parsed?.code || '';
    if (!targetCode) {
      if (clean.includes('CODE=')) {
        const match = clean.match(/CODE=([A-Z0-9]+)/i);
        if (match && match[1]) targetCode = match[1].toUpperCase();
      } else {
        targetCode = clean.toUpperCase();
      }
    }
    setCode(targetCode.slice(0, 8));
    setErrorMsg(null);
  };

  const handleAuthorizeWithCode = async (targetCode: string) => {
    const clean = targetCode.trim();
    if (!clean || clean.length < 4) {
      setErrorMsg('INSERISCI IL CODICE A 6 CARATTERI MOSTRATO SULLA TV');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await SyncManager.approveTvPairing(clean, activeProfileId, deviceLabel.trim());
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setSuccessMsg('TV AUTORIZZATA CON SUCCESSO! IL DISPOSITIVO È ORA COLLEGATO.');
        onSuccess?.();
        setTimeout(() => {
          handleClose();
        }, 1800);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setErrorMsg(res.message || 'AUTORIZZAZIONE TV FALLITA');
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMsg(err?.message || 'ERRORE DI RETE');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthorize = () => {
    handleAuthorizeWithCode(code);
  };

  const handleScanTvQr = (scannedData: string) => {
    setIsScannerOpen(false);
    const clean = scannedData.trim();
    const parsed = parseKuroSyncDeepLink(clean);
    let targetCode = parsed?.code || '';
    if (!targetCode) {
      if (clean.includes('CODE=')) {
        const match = clean.match(/CODE=([A-Z0-9]+)/i);
        if (match && match[1]) targetCode = match[1].toUpperCase();
      } else {
        targetCode = clean.toUpperCase();
      }
    }
    const extracted = targetCode.slice(0, 8);
    setCode(extracted);
    setErrorMsg(null);
    if (extracted.length >= 4) {
      handleAuthorizeWithCode(extracted);
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
              <Ionicons name="tv-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.syncModalTitle, { color: theme.colors.text }]}>
                AUTORIZZA ANDROID TV
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

          {/* Description */}
          <Text style={[styles.syncDesc, { color: theme.colors.textMuted }]}>
            SCANSIONA IL QR SULLO SCHERMO DELLA TV OPPURE DIGITA IL CODICE A 6 CIFRE.
          </Text>

          {/* Camera Scanner Button for TV */}
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
            accessibilityLabel="SCANSIONA QR DELLA TV"
          >
            <Ionicons name="camera-outline" size={18} color={primaryContrast} />
            <Text style={[styles.syncBtnText, { color: primaryContrast }]}>
              SCANSIONA QR DELLA TV
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
            <Text style={{ color: theme.colors.textMuted, fontFamily: 'monospace', fontSize: 10, fontWeight: '700' }}>
              OPPURE DIGITA CODICE A 6 CIFRE
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
          </View>

          {/* 6-character Code Input */}
          <View style={styles.syncFieldGroup}>
            <Text style={[styles.syncFieldLabel, { color: theme.colors.textMuted }]}>
              CODICE ACCOPPIAMENTO TV
            </Text>
            <TextInput
              style={[
                styles.syncCodeInput,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: errorMsg ? theme.colors.error || '#EF4444' : theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={code}
              onChangeText={handleChangeCode}
              placeholder="K7X9P2"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={30}
              editable={!isLoading}
              accessibilityLabel="CODICE ACCOPPIAMENTO"
            />
          </View>

          {/* Profile Row */}
          <View style={styles.syncFieldGroup}>
            <Text style={[styles.syncFieldLabel, { color: theme.colors.textMuted }]}>
              PROFILO ASSEGNATO
            </Text>
            <View
              style={[
                styles.syncInput,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                },
              ]}
            >
              <Ionicons name="person-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.text, fontFamily: 'monospace', fontWeight: '700', fontSize: 12 }}>
                {activeProfileName || 'Principale'}
              </Text>
            </View>
          </View>

          {/* Device Label */}
          <View style={styles.syncFieldGroup}>
            <Text style={[styles.syncFieldLabel, { color: theme.colors.textMuted }]}>
              NOME DISPOSITIVO (OPZIONALE)
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
              value={deviceLabel}
              onChangeText={setDeviceLabel}
              placeholder="Android TV Salotto"
              placeholderTextColor={theme.colors.textMuted}
              autoCorrect={false}
              editable={!isLoading}
              accessibilityLabel="NOME DISPOSITIVO"
            />
          </View>

          {/* Feedback messages */}
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

          {successMsg ? (
            <View
              style={[
                styles.syncNoticeBox,
                {
                  backgroundColor: `${theme.colors.success || '#10B981'}18`,
                  borderColor: theme.colors.success || '#10B981',
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={15} color={theme.colors.success || '#10B981'} />
              <Text style={[styles.syncNoticeText, { color: theme.colors.success || '#10B981' }]}>
                {successMsg}
              </Text>
            </View>
          ) : null}

          {/* Authorize Button */}
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
            onPress={handleAuthorize}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="AUTORIZZA TV"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={primaryContrast} />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={18} color={primaryContrast} />
                <Text style={[styles.syncBtnText, { color: primaryContrast }]}>
                  AUTORIZZA TV
                </Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>

    {/* TV QR Camera Scanner Modal */}
    <QrScannerModal
      visible={visible && isScannerOpen}
      title="SCANSIONA QR ANDROID TV"
      theme={theme}
      onClose={() => setIsScannerOpen(false)}
      onScan={handleScanTvQr}
    />
  </>
  );
});
