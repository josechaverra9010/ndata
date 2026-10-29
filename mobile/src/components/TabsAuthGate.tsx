import { Redirect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingView } from '@/src/components/Feedback';

export default function TabsAuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingView />;
  if (!user) return <Redirect href="/login" />;
  return <>{children}</>;
}
