import React, { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { ReminderSettings, TimeReminder, useReminderStore } from '../store/useReminderStore';
import { ReminderResult, applyReminders } from '../services/reminders';

const WEEKDAYS: { id: number; label: string }[] = [
  { id: 2, label: 'T2' },
  { id: 3, label: 'T3' },
  { id: 4, label: 'T4' },
  { id: 5, label: 'T5' },
  { id: 6, label: 'T6' },
  { id: 7, label: 'T7' },
  { id: 1, label: 'CN' },
];

const pad = (n: number) => String(n).padStart(2, '0');

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const settings = useReminderStore((s) => s.settings);
  const update = useReminderStore((s) => s.update);
  const [status, setStatus] = useState<ReminderResult>('ok');

  // Mỗi lần đổi cài đặt: đặt lại lịch nhắc ngay
  const change = (patch: Partial<ReminderSettings>) => {
    const next = { ...settings, ...patch };
    update(patch);
    applyReminders(next)
      .then(setStatus)
      .catch(() => setStatus('denied'));
  };

  useEffect(() => {
    applyReminders(settings).then(setStatus).catch(() => setStatus('denied'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Stepper = ({
    label,
    value,
    onMinus,
    onPlus,
  }: {
    label: string;
    value: string;
    onMinus: () => void;
    onPlus: () => void;
  }) => (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity onPress={onMinus} hitSlop={8}>
          <Ionicons name="remove-circle-outline" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity onPress={onPlus} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTimeCard = (
    title: string,
    desc: string,
    key: 'checkIn' | 'checkOut'
  ) => {
    const r: TimeReminder = settings[key];
    const set = (p: Partial<TimeReminder>) => change({ [key]: { ...r, ...p } } as Partial<ReminderSettings>);
    return (
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.hint}>{desc}</Text>
          </View>
          <Switch value={r.enabled} onValueChange={(v) => set({ enabled: v })} />
        </View>
        {r.enabled && (
          <View style={styles.stepperGroup}>
            <Stepper
              label="Giờ"
              value={pad(r.hour)}
              onMinus={() => set({ hour: (r.hour + 23) % 24 })}
              onPlus={() => set({ hour: (r.hour + 1) % 24 })}
            />
            <Text style={styles.colon}>:</Text>
            <Stepper
              label="Phút"
              value={pad(r.minute)}
              onMinus={() => set({ minute: (r.minute + 55) % 60 })}
              onPlus={() => set({ minute: (r.minute + 5) % 60 })}
            />
          </View>
        )}
      </View>
    );
  };

  const toggleDay = (id: number) => {
    const has = settings.weekdays.includes(id);
    const next = has ? settings.weekdays.filter((d) => d !== id) : [...settings.weekdays, id];
    change({ weekdays: next });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nhắc nhở</Text>
      <Text style={styles.subtitle}>
        Thông báo được tạo ngay trên máy, hoạt động khi không có mạng và không gửi dữ liệu đi đâu.
      </Text>

      {status === 'denied' && (
        <View style={styles.warn}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warnText}>Rosala chưa được phép gửi thông báo.</Text>
            <TouchableOpacity onPress={() => Linking.openSettings()}>
              <Text style={styles.link}>Mở Cài đặt của điện thoại</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {renderTimeCard('Nhắc vào ca', 'Nhắc bạn bấm Check In đúng giờ.', 'checkIn')}
      {renderTimeCard('Nhắc kết thúc ca', 'Nhắc bạn bấm Check Out để ghi đủ giờ.', 'checkOut')}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nhắc vào những ngày</Text>
        <View style={styles.dayRow}>
          {WEEKDAYS.map((d) => {
            const on = settings.weekdays.includes(d.id);
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.day, on && styles.dayOn]}
                onPress={() => toggleDay(d.id)}
              >
                <Text style={[styles.dayText, on && styles.dayTextOn]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Nhắc chốt bảng lương</Text>
            <Text style={styles.hint}>Mỗi tháng một lần lúc 9:00, nhắc xem lại bảng lương và xuất CSV.</Text>
          </View>
          <Switch
            value={settings.payroll.enabled}
            onValueChange={(v) => change({ payroll: { ...settings.payroll, enabled: v } })}
          />
        </View>
        {settings.payroll.enabled && (
          <View style={styles.stepperGroup}>
            <Stepper
              label="Ngày trong tháng"
              value={String(settings.payroll.day)}
              onMinus={() =>
                change({ payroll: { ...settings.payroll, day: settings.payroll.day <= 1 ? 28 : settings.payroll.day - 1 } })
              }
              onPlus={() =>
                change({ payroll: { ...settings.payroll, day: settings.payroll.day >= 28 ? 1 : settings.payroll.day + 1 } })
              }
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.surface },
    content: { padding: 20, paddingBottom: 60, gap: 14 },
    title: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
    subtitle: { fontSize: 13, lineHeight: 19, color: theme.colors.onSurfaceVariant, marginBottom: 4 },
    card: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: 16,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
    hint: { fontSize: 12, lineHeight: 18, color: theme.colors.onSurfaceVariant, marginTop: 4 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepperGroup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 14 },
    stepper: { alignItems: 'center' },
    stepperLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.onSurfaceVariant, marginBottom: 4 },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepperValue: { fontSize: 28, fontWeight: '800', color: theme.colors.onSurface, minWidth: 44, textAlign: 'center' },
    colon: { fontSize: 28, fontWeight: '800', color: theme.colors.onSurface, marginTop: 14 },
    dayRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
    day: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainerHigh,
    },
    dayOn: { backgroundColor: theme.colors.primary },
    dayText: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurfaceVariant },
    dayTextOn: { color: theme.colors.onPrimary },
    warn: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.colors.errorContainer,
    },
    warnText: { fontSize: 13, color: theme.colors.onErrorContainer },
    link: { fontSize: 13, fontWeight: '700', color: theme.colors.error, marginTop: 4 },
  });
