import React, { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { settingsStyles as styles } from './settings.styles';
import { getContrastTextColor } from '@/theme';

export interface QrScannerModalProps {
  visible: boolean;
  title?: string;
  theme: any;
  onClose: () => void;
  onScan: (data: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = React.memo(({
  visible,
  title = 'SCANSIONA CODICE QR',
  theme,
  onClose,
  onScan,
}) => {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const hasScannedRef = useRef(false);

  const primaryContrast = getContrastTextColor(theme.colors.primary);

  useEffect(() => {
    if (visible) {
      hasScannedRef.current = false;
      setTorch(false);
      setCameraError(null);
    }
    return () => {
      setTorch(false);
    };
  }, [visible]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTorch(false);
    onClose();
  };

  const handleToggleTorch = () => {
    Haptics.selectionAsync().catch(() => {});
    setTorch((prev) => !prev);
  };

  const handleRequestPermission = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsRequestingPermission(true);
    try {
      await requestPermission();
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleOpenSettings = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Linking.openSettings();
    } catch {
      // Fallback
    }
  };

  const handleMountError = (event: { message: string }) => {
    setCameraError(event?.message || 'Impossibile inizializzare il sensore fotocamera');
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (hasScannedRef.current) return;
    const rawData = result?.data?.trim();
    if (!rawData) return;

    hasScannedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTorch(false);
    onScan(rawData);
    onClose();
  };

  if (!visible) return null;

  const isBlocked = Boolean(permission && !permission.granted && !permission.canAskAgain);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.qrScannerOverlay}>
        {/* State 0: Permissions Loading */}
        {!permission ? (
          <View style={[styles.qrScannerPermissionContainer, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : cameraError ? (
          /* State 1: Hardware / Mount Error */
          <View style={styles.qrScannerPermissionContainer}>
            <View
              style={[
                styles.qrScannerPermissionCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.qrScannerPermissionIconBox,
                  {
                    borderColor: theme.colors.error || '#EF4444',
                    backgroundColor: `${theme.colors.error || '#EF4444'}18`,
                  },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={28} color={theme.colors.error || '#EF4444'} />
              </View>

              <Text style={[styles.qrScannerPermissionTitle, { color: theme.colors.text }]}>
                ERRORE FOTOCAMERA
              </Text>

              <Text style={[styles.qrScannerPermissionDesc, { color: theme.colors.textMuted }]}>
                {cameraError}. PUOI UTILIZZARE IL COLLEGAMENTO MANUALE O COPIA/INCOLLA DEL TOKEN.
              </Text>

              <Pressable
                style={[
                  styles.qrScannerPermissionBtn,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    marginTop: 8,
                  },
                ]}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="CHIUDI"
              >
                <Text style={[styles.qrScannerPermissionBtnText, { color: theme.colors.textMuted }]}>
                  CHIUDI
                </Text>
              </Pressable>
            </View>
          </View>
        ) : !permission.granted ? (
          /* State 2: Permission Not Granted / Blocked */
          <View style={styles.qrScannerPermissionContainer}>
            <View
              style={[
                styles.qrScannerPermissionCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.qrScannerPermissionIconBox,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: `${theme.colors.primary}18`,
                  },
                ]}
              >
                <Ionicons
                  name={isBlocked ? 'settings-outline' : 'camera-outline'}
                  size={28}
                  color={theme.colors.primary}
                />
              </View>

              <Text style={[styles.qrScannerPermissionTitle, { color: theme.colors.text }]}>
                {isBlocked ? 'PERMESSO FOTOCAMERA NEGATO' : 'ACCESSO FOTOCAMERA NECESSARIO'}
              </Text>

              <Text style={[styles.qrScannerPermissionDesc, { color: theme.colors.textMuted }]}>
                {isBlocked
                  ? "HAI NEGATO L'ACCESSO ALLA FOTOCAMERA NELLE IMPOSTAZIONI DI SISTEMA. ABILITALO PER SCANSIONARE I CODICI QR DI KUROSYNC O DI ANDROID TV."
                  : 'PERMETTI A KUROTV DI UTILIZZARE LA FOTOCAMERA DEL DISPOSITIVO PER SCANSIONARE IL CODICE QR DI KUROSYNC O DI ANDROID TV.'}
              </Text>

              <Pressable
                style={[
                  styles.qrScannerPermissionBtn,
                  {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                    marginTop: 8,
                  },
                ]}
                onPress={isBlocked ? handleOpenSettings : handleRequestPermission}
                disabled={isRequestingPermission}
                accessibilityRole="button"
                accessibilityLabel={isBlocked ? 'APRI IMPOSTAZIONI' : 'CONCEDI PERMESSO FOTOCAMERA'}
              >
                {isRequestingPermission ? (
                  <ActivityIndicator size="small" color={primaryContrast} />
                ) : (
                  <>
                    <Ionicons
                      name={isBlocked ? 'open-outline' : 'shield-checkmark-outline'}
                      size={18}
                      color={primaryContrast}
                    />
                    <Text style={[styles.qrScannerPermissionBtnText, { color: primaryContrast }]}>
                      {isBlocked ? 'APRI IMPOSTAZIONI' : 'CONCEDI PERMESSO'}
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={[
                  styles.qrScannerPermissionBtn,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="ANNULLA E CHIUDI"
              >
                <Text style={[styles.qrScannerPermissionBtnText, { color: theme.colors.textMuted }]}>
                  ANNULLA
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* State 3: Active Camera View */
          <View style={StyleSheet.absoluteFill}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
              onMountError={handleMountError}
            />

            {/* Viewfinder Overlay with Darkened Masks and Corner Brackets */}
            <View style={styles.qrScannerMaskContainer} pointerEvents="box-none">
              <View style={styles.qrScannerMaskTop} pointerEvents="none" />
              <View style={styles.qrScannerMaskMiddle} pointerEvents="none">
                <View style={styles.qrScannerMaskSide} pointerEvents="none" />
                <View style={styles.qrScannerCutout} pointerEvents="none">
                  {/* Futuristic Corner Brackets */}
                  <View
                    style={[
                      styles.qrScannerCornerTL,
                      { borderColor: theme.colors.primary },
                    ]}
                  />
                  <View
                    style={[
                      styles.qrScannerCornerTR,
                      { borderColor: theme.colors.primary },
                    ]}
                  />
                  <View
                    style={[
                      styles.qrScannerCornerBL,
                      { borderColor: theme.colors.primary },
                    ]}
                  />
                  <View
                    style={[
                      styles.qrScannerCornerBR,
                      { borderColor: theme.colors.primary },
                    ]}
                  />
                </View>
                <View style={styles.qrScannerMaskSide} pointerEvents="none" />
              </View>
              <View style={styles.qrScannerMaskBottom} pointerEvents="none">
                <View style={styles.qrScannerGuidePill}>
                  <Ionicons name="scan-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.qrScannerGuideText}>
                    INQUADRA IL CODICE QR
                  </Text>
                </View>
              </View>
            </View>

            {/* Header Controls (Close, Title, Torch) */}
            <View
              style={[
                styles.qrScannerHeader,
                { paddingTop: Math.max(insets.top + 12, 44) },
              ]}
              pointerEvents="box-none"
            >
              <Pressable
                style={styles.qrScannerActionBtn}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="CHIUDI SCANNER"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>

              <Text style={styles.qrScannerTitle}>{title}</Text>

              <Pressable
                style={[
                  styles.qrScannerActionBtn,
                  torch && {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                  },
                ]}
                onPress={handleToggleTorch}
                accessibilityRole="button"
                accessibilityLabel={torch ? 'DISATTIVA TORCIA' : 'ATTIVA TORCIA'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={torch ? 'flash' : 'flash-off-outline'}
                  size={20}
                  color={torch ? primaryContrast : '#FFFFFF'}
                />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
});
