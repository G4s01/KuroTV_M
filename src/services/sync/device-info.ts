import { Platform } from 'react-native';
import Constants from 'expo-constants';

function capitalizeWord(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const GENERIC_NAMES = new Set([
  'android',
  'generic',
  'device',
  'phone',
  'mobile',
  'smartphone',
  'simulator',
  'emulator',
  'google_sdk',
  'sdk_gphone',
  'sdk_gphone64_arm64',
  'sdk_gphone_x86',
]);

function isGeneric(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return true;
  const lower = name.trim().toLowerCase();
  if (lower.length === 0) return true;
  if (GENERIC_NAMES.has(lower)) return true;
  for (const g of GENERIC_NAMES) {
    if (lower === g || lower.startsWith(`${g}_`) || lower.startsWith(`${g}-`)) return true;
  }
  return false;
}

/**
 * Returns a recognizable, dynamic device model name.
 * e.g. "Google Pixel 8 Pro", "Samsung Galaxy S24 Ultra", "Xiaomi 13T"
 */
export function getDeviceName(): string {
  // 1. Check native Android Platform constants (Manufacturer, Brand, Model) FIRST
  if (Platform.OS === 'android') {
    try {
      const constants = (Platform.constants || {}) as {
        Brand?: string;
        Manufacturer?: string;
        Model?: string;
      };
      const manufacturer = (constants.Manufacturer || constants.Brand || '').trim();
      const model = (constants.Model || '').trim();

      if (model && !isGeneric(model)) {
        if (manufacturer && !isGeneric(manufacturer)) {
          // Avoid duplicate brand prefix, e.g. "Google Google Pixel 8"
          if (model.toLowerCase().startsWith(manufacturer.toLowerCase())) {
            return model;
          }
          return `${capitalizeWord(manufacturer)} ${model}`;
        }
        return model;
      }
      if (manufacturer && !isGeneric(manufacturer)) {
        return `${capitalizeWord(manufacturer)} Mobile`;
      }
    } catch {
      // Ignore fallback
    }
  }

  // 2. Check expo-constants deviceName (if not generic)
  try {
    const expoName = Constants?.deviceName;
    if (expoName && typeof expoName === 'string' && !isGeneric(expoName)) {
      return expoName.trim();
    }
  } catch {
    // Ignore fallback
  }

  return 'KuroTV Android';
}

/**
 * Metadata contract for KuroSync authentication & device registration
 */
export function getDeviceMetadata() {
  return {
    deviceName: getDeviceName(),
    deviceType: 'mobile' as const,
    platform: 'android' as const,
  };
}
