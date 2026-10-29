import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/src/theme/colors';

export function LoadingView({ message = 'Cargando…' }: { message?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  style,
}: {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.empty, style]}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  text: { marginTop: 12, color: colors.muted, fontSize: 14 },
  empty: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.card,
  },
  emptyTitle: { fontWeight: '600', color: colors.text, textAlign: 'center' },
  emptySub: { marginTop: 6, color: colors.muted, fontSize: 13, textAlign: 'center' },
});
