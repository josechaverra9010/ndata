import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/lib/api';
import { Card } from '@/src/components/Ui';
import { EmptyState, LoadingView } from '@/src/components/Feedback';
import { colors } from '@/src/theme/colors';

interface PlanDay {
  day: string;
  meals: { name: string; time?: string; calories?: number; description?: string }[];
}

interface WeeklyPlan {
  plan_name?: string;
  week_label?: string;
  days?: PlanDay[];
}

export default function PlanScreen() {
  const { user } = useAuth();
  const patientId = user?.id;
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;
    apiFetch<WeeklyPlan>(`/patient/${patientId}/plan/weekly`)
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <LoadingView message="Cargando plan…" />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {plan?.plan_name ? <Text style={styles.planName}>{plan.plan_name}</Text> : null}
      {plan?.week_label ? <Text style={styles.week}>{plan.week_label}</Text> : null}

      {!plan?.days?.length ? (
        <EmptyState title="Sin plan semanal" subtitle="Tu nutricionista aún no asignó un menú." />
      ) : (
        plan.days.map((day) => (
          <View key={day.day} style={styles.dayBlock}>
            <Text style={styles.dayTitle}>{day.day}</Text>
            {day.meals.map((meal, i) => (
              <Card key={i} style={styles.meal}>
                <Text style={styles.mealName}>{meal.name}</Text>
                {meal.time ? <Text style={styles.muted}>{meal.time}</Text> : null}
                {meal.description ? <Text style={styles.desc}>{meal.description}</Text> : null}
                {meal.calories ? <Text style={styles.kcal}>{meal.calories} kcal</Text> : null}
              </Card>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  planName: { fontSize: 20, fontWeight: '800', color: colors.text },
  week: { color: colors.muted, marginBottom: 16 },
  dayBlock: { marginBottom: 16 },
  dayTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  meal: { marginBottom: 8 },
  mealName: { fontWeight: '600', color: colors.text },
  muted: { fontSize: 12, color: colors.muted },
  desc: { marginTop: 4, color: colors.text, lineHeight: 20 },
  kcal: { marginTop: 4, fontSize: 12, fontWeight: '600', color: colors.primary },
});
