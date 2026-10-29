import { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/lib/api';
import type { AppointmentItem } from '@/src/lib/types';
import { Card } from '@/src/components/Ui';
import { EmptyState, LoadingView } from '@/src/components/Feedback';
import { colors } from '@/src/theme/colors';

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes('confirm')) return colors.primary;
  if (s.includes('cancel')) return colors.danger;
  return colors.warning;
}

export default function AppointmentsScreen() {
  const { user } = useAuth();
  const patientId = user?.id;
  const [upcoming, setUpcoming] = useState<AppointmentItem[]>([]);
  const [past, setPast] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) return;
    try {
      const [u, p] = await Promise.all([
        apiFetch<AppointmentItem[]>(`/patients/${patientId}/appointments/upcoming`),
        apiFetch<AppointmentItem[]>(`/patients/${patientId}/appointments/past`),
      ]);
      setUpcoming(Array.isArray(u) ? u : []);
      setPast(Array.isArray(p) ? p : []);
    } catch {
      setUpcoming([]);
      setPast([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (loading) return <LoadingView message="Cargando citas…" />;

  const renderAppt = (appt: AppointmentItem) => (
    <Card key={appt.id} style={styles.appt}>
      <View style={styles.row}>
        <Text style={styles.doctor}>{appt.doctor}</Text>
        <Text style={[styles.status, { color: statusColor(appt.status) }]}>{appt.status}</Text>
      </View>
      <Text style={styles.type}>{appt.type}</Text>
      <Text style={styles.muted}>{appt.date} · {appt.time}</Text>
      {appt.meeting_link ? (
        <Pressable onPress={() => Linking.openURL(appt.meeting_link!)}>
          <Text style={styles.link}>Unirse a videollamada</Text>
        </Pressable>
      ) : null}
    </Card>
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
      }
    >
      <Text style={styles.section}>Próximas</Text>
      {upcoming.length === 0 ? (
        <EmptyState title="Sin citas próximas" subtitle="Solicita una cita desde la web o con tu nutricionista." />
      ) : (
        upcoming.map(renderAppt)
      )}

      <Text style={[styles.section, { marginTop: 16 }]}>Historial</Text>
      {past.length === 0 ? (
        <Text style={styles.muted}>Aún no hay citas anteriores.</Text>
      ) : (
        past.slice(0, 10).map(renderAppt)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 10 },
  appt: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  doctor: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  type: { marginTop: 4, color: colors.text },
  muted: { marginTop: 4, color: colors.muted, fontSize: 13 },
  link: { marginTop: 10, color: colors.sky, fontWeight: '600' },
});
