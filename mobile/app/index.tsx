import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingView } from '@/src/components/Feedback';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingView message="Iniciando NutriData…" />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}
