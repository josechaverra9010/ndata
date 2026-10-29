import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/lib/api';
import type { AdherenceData } from '@/src/lib/types';
import { Card, ProgressBar, StatTile } from '@/src/components/Ui';
import { EmptyState, LoadingView } from '@/src/components/Feedback';
import { colors } from '@/src/theme/colors';

const levelLabels: Record<string, string> = {
  excellent: 'Excelente',
  good: 'Buena',
  fair: 'Regular',
  low: 'Baja',
};

export default function AdherenceScreen() {
  const { user } = useAuth();
  const patientId = user?.id;
  const [data, setData] = useState<AdherenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) return;
    try {
      const res = await apiFetch<AdherenceData>(`/patient/${patientId}/adherence?days=7`);
      setData(res);
    } catch {
      setData(null);
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

  if (loading && !data) return <LoadingView message="Calculando adherencia…" />;

  const s = data?.summary;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
      }
    >
      {!data || !s ? (
        <EmptyState title="Sin datos de adherencia" subtitle="Registra comidas para ver tu progreso." />
      ) : (
        <>
          <Card>
            <Text style={styles.badge}>{levelLabels[s.level] || s.level}</Text>
            <Text style={styles.message}>{s.message}</Text>
            <View style={styles.statsGrid}>
              <StatTile label="Hoy" value={`${s.today_pct}%`} />
              <StatTile label="Semana" value={`${s.week_pct}%`} />
            </View>
            <Text style={styles.section}>Adherencia semanal</Text>
            <ProgressBar value={s.week_pct} />
            <Text style={styles.muted}>
              {s.completed_meals_week} / {s.total_meals_week} comidas · cambio {s.change > 0 ? '+' : ''}
              {s.change}% vs semana anterior
            </Text>
          </Card>

          <Text style={styles.sectionTitle}>Día a día</Text>
          {data.daily_series.map((day) => (
            <Card key={day.date} style={styles.dayRow}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <Text style={styles.dayPct}>{day.adherence_pct}%</Text>
              </View>
              <ProgressBar value={day.adherence_pct} />
              <Text style={styles.muted}>
                {day.completed_meals}/{day.total_meals} comidas
              </Text>
            </Card>
          ))}

          {data.next_action?.label ? (
            <Card style={styles.action}>
              <Text style={styles.actionLabel}>Siguiente paso</Text>
              <Text style={styles.actionText}>{data.next_action.label}</Text>
            </Card>
          ) : null}

          {data.tips?.length ? (
            <>
              <Text style={styles.sectionTitle}>Consejos</Text>
              {data.tips.map((tip, i) => (
                <Card key={i}>
                  <Text style={styles.tip}>{tip}</Text>
                </Card>
              ))}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  message: { marginTop: 10, fontSize: 15, color: colors.text, lineHeight: 22 },
  statsGrid: { flexDirection: 'row', gap: 16, marginTop: 16 },
  section: { marginTop: 16, fontSize: 12, color: colors.muted, fontWeight: '600' },
  muted: { marginTop: 6, fontSize: 12, color: colors.muted },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  dayRow: { gap: 8 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  dayLabel: { fontWeight: '600', color: colors.text },
  dayPct: { fontWeight: '700', color: colors.primary },
  action: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  actionLabel: { fontSize: 11, fontWeight: '700', color: colors.sky, textTransform: 'uppercase' },
  actionText: { marginTop: 4, fontSize: 15, color: colors.text },
  tip: { color: colors.text, lineHeight: 20 },
});
