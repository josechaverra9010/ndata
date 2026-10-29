import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Card, PrimaryButton, StatTile } from '@/src/components/Ui';
import { colors } from '@/src/theme/colors';
import { API_URL } from '@/src/config/api';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const imc =
    user?.peso_actual && user?.altura
      ? (user.peso_actual / ((user.altura / 100) ** 2)).toFixed(1)
      : null;

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Salir de NutriData?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </Card>

      <Card style={styles.stats}>
        <StatTile label="Peso" value={user?.peso_actual ? `${user.peso_actual} kg` : '—'} />
        <StatTile label="Altura" value={user?.altura ? `${user.altura} cm` : '—'} />
        {imc ? <StatTile label="IMC" value={imc} /> : null}
      </Card>

      <Card>
        <Text style={styles.label}>Servidor API</Text>
        <Text style={styles.api}>{API_URL}</Text>
        <Text style={styles.hint}>
          Cambia EXPO_PUBLIC_API_URL en mobile/.env para apuntar a Cloud Run o tu PC en la red local.
        </Text>
      </Card>

      <PrimaryButton label="Cerrar sesión" onPress={handleLogout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  email: { marginTop: 4, color: colors.muted },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  api: { marginTop: 6, fontFamily: 'monospace', fontSize: 12, color: colors.text },
  hint: { marginTop: 8, fontSize: 12, color: colors.muted, lineHeight: 18 },
});
