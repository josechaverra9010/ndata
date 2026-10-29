import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** URL base del backend NutriData */
function defaultApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (fromExtra) return fromExtra.replace(/\/$/, '');
  // Android emulator → host machine
  if (Platform.OS === 'android') return 'http://10.0.2.2:8001/api';
  return 'http://localhost:8001/api';
}

export const API_URL = defaultApiUrl();

export function assetUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = API_URL.replace(/\/api$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
