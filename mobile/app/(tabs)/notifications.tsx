import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/context/AuthContext';
import { apiFetch } from '@/src/lib/api';
import type { NotificationItem } from '@/src/lib/types';
import { Card, PrimaryButton } from '@/src/components/Ui';
import { EmptyState, LoadingView } from '@/src/components/Feedback';
import { colors } from '@/src/theme/colors';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const patientId = user?.id;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) return;
    try {
      const qs = filter === 'unread' ? '?unread_only=true' : '';
      const data = await apiFetch<{ notifications: NotificationItem[]; unread_count: number }>(
        `/patient/${patientId}/notifications/inbox${qs}`
      );
      setItems(data.notifications ?? []);
      setUnread(data.unread_count ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId, filter]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const markAllRead = async () => {
    if (!patientId) return;
    await apiFetch(`/patient/${patientId}/notifications/read-all`, { method: 'POST' });
    load();
  };

  const markRead = async (item: NotificationItem) => {
    if (!patientId || item.read || item.source !== 'stored') return;
    const numId = parseInt(item.id, 10);
    if (Number.isNaN(numId)) return;
    await apiFetch(`/patient/${patientId}/notifications/${numId}/read`, { method: 'PATCH' });
    load();
  };

  if (loading && !items.length) return <LoadingView message="Cargando alertas…" />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
      }
    >
      <View style={styles.toolbar}>
        <View style={styles.filters}>
          {(['all', 'unread'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, filter === f && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'all' ? 'Todas' : `Sin leer (${unread})`}
              </Text>
            </Pressable>
          ))}
        </View>
        {unread > 0 ? (
          <Pressable onPress={markAllRead}>
            <Text style={styles.markAll}>Marcar todas</Text>
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 ? (
        <EmptyState title="Sin notificaciones" subtitle="Aquí verás recordatorios y mensajes de tu nutricionista." />
      ) : (
        items.map((item) => (
          <Pressable key={item.id} onPress={() => markRead(item)}>
            <Card style={[styles.item, !item.read && styles.unread]}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.message}</Text>
              <Text style={styles.date}>{item.date}</Text>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  toolbar: { marginBottom: 12, gap: 8 },
  filters: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  chipTextActive: { color: '#fff' },
  markAll: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  item: { marginBottom: 10 },
  unread: { borderColor: colors.primary, borderWidth: 1.5 },
  title: { fontWeight: '700', color: colors.text, fontSize: 15 },
  body: { marginTop: 4, color: colors.muted, lineHeight: 20 },
  date: { marginTop: 8, fontSize: 11, color: colors.muted },
});
