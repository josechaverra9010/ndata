import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/src/config/api';

const TOKEN_KEY = 'userToken';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiUpload<T = unknown>(
  path: string,
  form: FormData,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    method: options.method || 'POST',
    headers,
    body: form,
  });

  const text = await res.text();
  let data: T | { detail?: string } = {} as T;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text } as { detail?: string };
    }
  }

  if (!res.ok) {
    const detail =
      typeof data === 'object' && data && 'detail' in data
        ? String((data as { detail?: string }).detail)
        : `Error ${res.status}`;
    throw new ApiError(detail, res.status);
  }

  return data as T;
}

export interface MealVisionFood {
  name: string;
  portion_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: number;
}

export interface MealPhotoAnalysis {
  description?: string;
  foods: MealVisionFood[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  notes?: string;
}

export interface AnalyzeMealPhotoResponse {
  success: boolean;
  analysis: MealPhotoAnalysis;
  foods_added?: MealVisionFood[];
  added_to_meal?: boolean;
  photo_url?: string;
}

export async function analyzeMealPhoto(
  patientId: number,
  uri: string,
  mealType: string,
  addToMeal: boolean
): Promise<AnalyzeMealPhotoResponse> {
  const form = new FormData();
  form.append('file', {
    uri,
    name: 'meal.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('meal_type', mealType);
  form.append('add_to_meal', addToMeal ? 'true' : 'false');
  form.append('save_photo', 'true');
  return apiUpload<AnalyzeMealPhotoResponse>(
    `/patient/${patientId}/meals/analyze-photo`,
    form
  );
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: T | { detail?: string } = {} as T;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text } as { detail?: string };
    }
  }

  if (!res.ok) {
    const detail =
      typeof data === 'object' && data && 'detail' in data
        ? String((data as { detail?: string }).detail)
        : `Error ${res.status}`;
    throw new ApiError(detail, res.status);
  }

  return data as T;
}
