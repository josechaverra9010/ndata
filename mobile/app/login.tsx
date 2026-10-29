import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { ApiError } from '@/src/lib/api';
import { PrimaryButton } from '@/src/components/Ui';
import { LoadingView } from '@/src/components/Feedback';
import { colors } from '@/src/theme/colors';
import { API_URL } from '@/src/config/api';

export default function LoginScreen() {
  const { user, isLoading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) return <LoadingView />;
  if (user) return <Redirect href="/(tabs)" />;

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Datos incompletos', 'Ingresa correo y contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Error de conexión';
      Alert.alert('No se pudo iniciar sesión', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.logo}>NutriData</Text>
          <Text style={styles.tagline}>Tu plan nutricional en el bolsillo</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Correo</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
          />

          <PrimaryButton label="Entrar" onPress={handleLogin} loading={submitting} />

          <Text style={styles.hint}>
            Solo cuentas de paciente. Nutricionistas y administradores deben usar la web.
          </Text>
        </View>

        <Pressable onPress={() => Alert.alert('API', `Backend: ${API_URL}`)}>
          <Text style={styles.apiHint}>Configurar servidor → .env (EXPO_PUBLIC_API_URL)</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  hero: { marginBottom: 32, alignItems: 'center' },
  logo: { fontSize: 36, fontWeight: '800', color: '#fff' },
  tagline: { marginTop: 8, color: '#dcfce7', fontSize: 15 },
  form: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
  hint: { marginTop: 16, fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 },
  apiHint: {
    marginTop: 24,
    textAlign: 'center',
    color: '#bbf7d0',
    fontSize: 11,
    textDecorationLine: 'underline',
  },
});
