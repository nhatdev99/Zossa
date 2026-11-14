import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSalaryStore } from '../store/useSalaryStore';
import {
  ShiftType,
  formatTime,
  getShift,
  getShiftName,
  parseTime,
  splitScheduledHours,
} from '../utils/salaryCalculator';

interface Props {
  visible: boolean;
  shiftId: ShiftType | null;
  onClose: () => void;
}

/** Hộp thoại cài giờ vào, giờ ra và nghỉ giữa ca cho một loại ca (dùng trong chấm công nhanh). */
export default function ShiftTimeEditor({ visible, shiftId, onClose }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const config = useSalaryStore((s) => s.config);
  const updateShift = useSalaryStore((s) => s.updateShift);

  const shift = shiftId ? getShift(config, shiftId) : null;

  const [start, setStart] = useState(8 * 60);
  const [end, setEnd] = useState(16 * 60);
  const [breakMin, setBreakMin] = useState(0);

  // Nạp giá trị hiện tại mỗi lần mở
  useEffect(() => {
    if (!visible || !shift) return;
    setStart(parseTime(shift.startTime) ?? (shift.isNight ? 22 * 60 : 8 * 60));
    setEnd(
      parseTime(shift.endTime) ??
        ((parseTime(shift.startTime) ?? (shift.isNight ? 22 * 60 : 8 * 60)) + shift.baseHours * 60) % 1440
    );
    setBreakMin(shift.breakMinutes ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, shiftId]);

  if (!shift || !shiftId) return null;

  const preview = splitScheduledHours({
    ...shift,
    startTime: formatTime(start),
    endTime: formatTime(end),
    breakMinutes: breakMin,
  });
  const overnight = end <= start;

  const wrap = (v: number) => ((v % 1440) + 1440) % 1440;

  const Field = ({
    label,
    minutes,
    onChange,
  }: {
    label: string;
    minutes: number;
    onChange: (v: number) => void;
  }) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const Btn = ({ icon, onPress }: { icon: any; onPress: () => void }) => (
      <TouchableOpacity onPress={onPress} hitSlop={8}>
        <Ionicons name={icon} size={26} color={theme.colors.primary} />
      </TouchableOpacity>
    );
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.fieldRow}>
          <Btn icon="remove-circle-outline" onPress={() => onChange(wrap(minutes - 60))} />
          <Text style={styles.time}>{String(h).padStart(2, '0')}</Text>
          <Btn icon="add-circle-outline" onPress={() => onChange(wrap(minutes + 60))} />
          <Text style={styles.colon}>:</Text>
          <Btn icon="remove-circle-outline" onPress={() => onChange(wrap(minutes - 5))} />
          <Text style={styles.time}>{String(m).padStart(2, '0')}</Text>
          <Btn icon="add-circle-outline" onPress={() => onChange(wrap(minutes + 5))} />
        </View>
      </View>
    );
  };

  const save = () => {
    updateShift(shiftId, {
      startTime: formatTime(start),
      endTime: formatTime(end),
      breakMinutes: breakMin,
    });
    onClose();
  };

  const clear = () => {
    updateShift(shiftId, { startTime: undefined, endTime: undefined, breakMinutes: 0 });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Giờ vào ra · {getShiftName(config, shiftId)}</Text>
          <Text style={styles.subtitle}>
            Dùng khi bạn ghi nhanh một ngày. Giờ ra nhỏ hơn giờ vào nghĩa là ca qua nửa đêm.
          </Text>

          <Field label="Giờ vào ca" minutes={start} onChange={setStart} />
          <Field label="Giờ ra ca" minutes={end} onChange={setEnd} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nghỉ giữa ca (phút)</Text>
            <View style={styles.fieldRow}>
              <TouchableOpacity onPress={() => setBreakMin(Math.max(0, breakMin - 15))} hitSlop={8}>
                <Ionicons name="remove-circle-outline" size={26} color={theme.colors.primary} />
              </TouchableOpacity>
              <Text style={styles.time}>{breakMin}</Text>
              <TouchableOpacity onPress={() => setBreakMin(Math.min(240, breakMin + 15))} hitSlop={8}>
                <Ionicons name="add-circle-outline" size={26} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.preview}>
            {preview ? (
              <>
                <Text style={styles.previewMain}>
                  {formatTime(start)} → {formatTime(end)}
                  {overnight ? ' (hôm sau)' : ''} · {preview.total} giờ
                </Text>
                <Text style={styles.previewSub}>
                  Giờ cơ bản {preview.actualHours}
                  {preview.overtimeHours > 0 ? ` + tăng ca ${preview.overtimeHours}` : ''} (ca tính cơ bản {shift.baseHours} giờ)
                </Text>
              </>
            ) : (
              <Text style={styles.previewSub}>Giờ vào và giờ ra đang trùng nhau, hãy chọn lại.</Text>
            )}
          </View>

          <TouchableOpacity style={[styles.saveBtn, !preview && { opacity: 0.5 }]} onPress={save} disabled={!preview}>
            <Text style={styles.saveText}>Lưu giờ</Text>
          </TouchableOpacity>
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={clear}>
              <Text style={[styles.link, { color: theme.colors.error }]}>Xoá giờ đã cài</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.link}>Huỷ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
    card: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 20 },
    title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
    subtitle: { fontSize: 12, lineHeight: 18, color: theme.colors.onSurfaceVariant, marginTop: 4, marginBottom: 8 },
    field: { marginTop: 14 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurfaceVariant, marginBottom: 6 },
    fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    time: { fontSize: 26, fontWeight: '800', color: theme.colors.onSurface, minWidth: 40, textAlign: 'center' },
    colon: { fontSize: 26, fontWeight: '800', color: theme.colors.onSurface, marginHorizontal: 4 },
    preview: {
      marginTop: 18,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    previewMain: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
    previewSub: { fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: 2 },
    saveBtn: { marginTop: 16, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
    saveText: { fontSize: 16, fontWeight: '700', color: theme.colors.onPrimary },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
    link: { fontSize: 14, fontWeight: '600', color: theme.colors.onSurfaceVariant },
  });
