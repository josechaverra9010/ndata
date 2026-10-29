import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/lib/api';
import { todayInColombiaISO, todayLabelColombia } from '@/src/lib/timezone';
import type { DashboardData } from '@/src/lib/types';
import { Card, PrimaryButton, ProgressBar, StatTile } from '@/src/components/Ui';
import { EmptyState, LoadingView } from '@/src/components/Feedback';
import { colors } from '@/src/theme/colors';

export default function HomeScreen() {
  const { user } = useAuth();
  const patientId = user?.id;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingMeal, setUpdatingMeal] = useState<string | null>(null);
  const [addingWater, setAddingWater] = useState(false);

  const firstName = user?.nombres?.split(' ')[0] || user?.name?.split(' ')[0] || 'bienvenido/a';

  const load = useCallback(async () => {
    if (!patientId) return;
    try {
      const dash = await apiFetch<DashboardData>(`/patient/${patientId}/dashboard/complete`);
      setData(dash);
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

  const toggleMeal = async (mealType: string, completed: boolean, name: string) => {
    if (!patientId) return;
    setUpdatingMeal(mealType);
    try {
      const endpoint = completed ? 'uncomplete' : 'complete';
      await apiFetch(`/tracking/meal-toggle/${patientId}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ meal_type: mealType, date: todayInColombiaISO() }),
      });
      await load();
    } catch {
      Alert.alert('Error', `No se pudo actualizar ${name}`);
    } finally {
      setUpdatingMeal(null);
    }
  };

  const adjustWater = async (ml: number) => {
    if (!patientId) return;
    setAddingWater(true);
    try {
      const res = await apiFetch<{ amount_liters: number; percentage: number }>(
        `/patient/${patientId}/water/add`,
        { method: 'POST', body: JSON.stringify({ glass_ml: ml }) }
      );
      if (data) {
        setData({
          ...data,
          stats: {
            ...data.stats,
            water: {
              ...data.stats.water,
              consumed_liters: res.amount_liters,
              percentage: res.percentage,
              consumed_ml: Math.round(res.amount_liters * 1000),
            },
          },
        });
      }
    } catch {
      Alert.alert('Error', 'No se pudo registrar el agua');
    } finally {
      setAddingWater(false);
    }
  };

  if (loading && !data) return <LoadingView message="Cargando tu día…" />;

  const stats = data?.stats;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Inicio',
          headerRight: () => (
            <Pressable onPress={() => router.push('/profile')} style={{ marginRight: 12 }}>
              <Ionicons name="person-circle-outline" size={28} color="#fff" />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        <Text style={styles.greeting}>Hola, {firstName}</Text>
        <Text style={styles.date}>{todayLabelColombia()}</Text>

        {!data ? (
          <EmptyState title="Sin datos" subtitle="Revisa la conexión con el servidor." />
        ) : (
          <>
            <Card style={styles.statsRow}>
              <View style={styles.statsGrid}>
                <StatTile
                  label="Calorías"
                  value={`${stats?.calories.consumed ?? 0}`}
                  sub={`meta ${stats?.calories.target ?? 0} kcal`}
                />
                <StatTile
                  label="Comidas"
                  value={`${stats?.meals.completed ?? 0}/${stats?.meals.total ?? 0}`}
                  sub={`${stats?.meals.percentage ?? 0}% hoy`}
                />
              </View>
              <Text style={styles.sectionLabel}>Calorías del día</Text>
              <ProgressBar value={stats?.calories.percentage ?? 0} />
            </Card>

            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Agua</Text>
                <Text style={styles.muted}>
                  {(stats?.water.consumed_liters ?? 0).toFixed(1)} / {stats?.water.target_liters ?? 2} L
                </Text>
              </View>
              <ProgressBar value={stats?.water.percentage ?? 0} color={colors.sky} />
              <View style={styles.waterBtns}>
                <Pressable
                  style={styles.waterBtn}
                  disabled={addingWater}
                  onPress={() => adjustWater(-250)}
                >
                  <Ionicons name="remove" size={20} color={colors.text} />
                </Pressable>
                <Pressable
                  style={[styles.waterBtn, styles.waterBtnMain]}
                  disabled={addingWater}
                  onPress={() => adjustWater(250)}
                >
                  <Text style={styles.waterBtnText}>+250 ml</Text>
                </Pressable>
              </View>
            </Card>

            <View style={styles.quickLinks}>
              <Pressable style={styles.quickLink} onPress={() => router.push('/plan')}>
                <Ionicons name="book-outline" size={22} color={colors.primary} />
                <Text style={styles.quickText}>Mi plan</Text>
              </Pressable>
              <Pressable style={styles.quickLink} onPress={() => router.push('/(tabs)/adherence')}>
                <Ionicons name="trophy-outline" size={22} color={colors.primary} />
                <Text style={styles.quickText}>Adherencia</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Comidas de hoy</Text>
            {data.today_meals.length === 0 ? (
              <EmptyState title="Sin comidas" subtitle="Tu nutricionista aún no asignó el plan de hoy." />
            ) : (
              data.today_meals.map((meal) => (
                <Card key={meal.meal_type} style={styles.mealCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mealName}>{meal.name}</Text>
                      <Text style={styles.muted}>{meal.time} · {meal.calories} kcal</Text>
                    </View>
                    <Pressable
                      disabled={updatingMeal === meal.meal_type}
                      onPress={() => toggleMeal(meal.meal_type, meal.completed, meal.name)}
                      style={[styles.check, meal.completed && styles.checkDone]}
                    >
                      <Ionicons
                        name={meal.completed ? 'checkmark' : 'ellipse-outline'}
                        size={22}
                        color={meal.completed ? '#fff' : colors.muted}
                      />
                    </Pressable>
                  </View>
                </Card>
              ))
            )}

            {data.tip_of_day ? (
              <Card style={styles.tip}>
                <Text style={styles.tipLabel}>Tip del día</Text>
                <Text style={styles.tipText}>{data.tip_of_day}</Text>
              </Card>
            ) : null}

            {data.next_appointment ? (
              <Card>
                <Text style={styles.cardTitle}>Próxima cita</Text>
                <Text style={styles.mealName}>{data.next_appointment.doctor}</Text>
                <Text style={styles.muted}>
                  {data.next_appointment.date} · {data.next_appointment.time}
                </Text>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.text },
  date: { color: colors.muted, marginBottom: 4, textTransform: 'capitalize' },
  statsRow: { gap: 12 },
  statsGrid: { flexDirection: 'row', gap: 16 },
  sectionLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  waterBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  waterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  waterBtnMain: { flex: 1, backgroundColor: '#e0f2fe', borderColor: '#bae6fd' },
  waterBtnText: { fontWeight: '700', color: colors.sky },
  quickLinks: { flexDirection: 'row', gap: 10 },
  quickLink: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickText: { fontSize: 12, fontWeight: '600', color: colors.text },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 4 },
  mealCard: { marginBottom: 0 },
  mealName: { fontSize: 15, fontWeight: '600', color: colors.text },
  check: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  tip: { backgroundColor: '#fef9c3', borderColor: '#fde047' },
  tipLabel: { fontSize: 11, fontWeight: '700', color: '#a16207', textTransform: 'uppercase' },
  tipText: { marginTop: 4, color: '#713f12', lineHeight: 20 },
});
