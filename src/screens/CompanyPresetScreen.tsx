import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSalaryStore } from '../store/useSalaryStore';
import { COMPANY_PRESETS, applyCompanyPreset } from '../utils/companyPresets';

const num = (v: string) => {
  const n = Number(v.replace(/\s+/g, '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
};
const vnd = (v: number) => `${Math.round(v).toLocaleString('vi-VN')} ₫`;

export default function CompanyPresetScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const config = useSalaryStore((s) => s.config);
  const updateConfig = useSalaryStore((s) => s.updateConfig);

  const [presetId, setPresetId] = useState(config.company?.id ?? COMPANY_PRESETS[0].id);
  const preset = COMPANY_PRESETS.find((p) => p.id === presetId) ?? COMPANY_PRESETS[0];

  const [salary, setSalary] = useState(
    config.company?.id === preset.id && config.company.baseSalary ? String(config.company.baseSalary) : ''
  );
  const [workDays, setWorkDays] = useState(
    String(config.company?.id === preset.id ? config.company.workDays : preset.defaultWorkDays)
  );

  const [includeOff, setIncludeOff] = useState(config.company?.includeOffDays ?? true);

  const input = {
    baseSalary: num(salary),
    workDays: num(workDays),
    includeOffDays: includeOff,
  };
  const valid = input.baseSalary > 0 && input.workDays > 0;
  const p = preset.preview(input);

  const handleApply = () => {
    if (!valid) {
      Alert.alert('Thông báo', 'Vui lòng nhập lương cơ bản và số ngày công lớn hơn 0.');
      return;
    }
    Alert.alert(
      `Áp dụng công thức ${preset.name}`,
      `Ca ngày, Ca đêm${includeOff ? ' và các ca ngày nghỉ' : ''} sẽ được tính lại theo công thức này (giữ giờ vào ra, phụ cấp, các ca khác, thuế và bảo hiểm). Các ngày đã chấm công sẽ được tính lại theo đơn giá mới.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Áp dụng',
          onPress: () => {
            const next = applyCompanyPreset(config, preset.id, input);
            updateConfig({ shifts: next.shifts, shiftOrder: next.shiftOrder, company: next.company });
            Alert.alert('Đã áp dụng', `Công thức ${preset.name} đã được lưu.`);
          },
        },
      ]
    );
  };

  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && { color: theme.colors.primary }]}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Công thức lương công ty</Text>
      <Text style={styles.subtitle}>Chọn công ty, nhập lương cơ bản. Đơn giá giờ và tăng ca được tính tự động.</Text>

      {COMPANY_PRESETS.map((c) => {
        const on = c.id === preset.id;
        return (
          <TouchableOpacity
            key={c.id}
            style={[styles.presetCard, on && styles.presetCardOn]}
            onPress={() => setPresetId(c.id)}
            activeOpacity={0.85}
          >
            <Ionicons name="business-outline" size={22} color={on ? theme.colors.primary : theme.colors.outline} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.presetTitle, on && { color: theme.colors.primary }]}>{c.name}</Text>
              <Text style={styles.presetDesc}>{c.description}</Text>
            </View>
            {config.company?.id === c.id && <Text style={styles.badge}>Đang dùng</Text>}
          </TouchableOpacity>
        );
      })}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Công thức</Text>
        {preset.formula.map((line) => (
          <Text key={line} style={styles.formula}>
            • {line}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Lương cơ bản mỗi tháng</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={salary}
            onChangeText={setSalary}
            placeholder="Ví dụ: 10450000"
            placeholderTextColor={theme.colors.outline}
          />
          <Text style={styles.suffix}>₫</Text>
        </View>
        <Text style={[styles.label, { marginTop: 16 }]}>Số ngày công chuẩn trong tháng</Text>
        <View style={styles.inputRow}>
          <TextInput style={styles.input} keyboardType="numeric" value={workDays} onChangeText={setWorkDays} />
          <Text style={styles.suffix}>ngày</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kết quả tính</Text>
        <Row label="Lương 1 ngày công" value={valid ? vnd(p.dailyPay) : '-'} />
        <Row label="Giờ cơ bản (9,5 giờ/ngày)" value={valid ? vnd(p.hourly) : '-'} strong />
        <Row label="Giờ tăng ca, ca ngày (x1,5)" value={valid ? vnd(p.dayOvertime) : '-'} />
        <Row label="Giờ tăng ca, ca đêm (x2,1)" value={valid ? vnd(p.nightOvertime) : '-'} />
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Công thức ngày nghỉ</Text>
            <Text style={styles.hintInline}>Tách riêng khỏi công thức lương ca ngày và ca đêm.</Text>
          </View>
          <Switch value={includeOff} onValueChange={setIncludeOff} />
        </View>

        {includeOff && (
          <>
            {preset.offFormula.map((line) => (
              <Text key={line} style={styles.formula}>
                • {line}
              </Text>
            ))}

            <View style={{ marginTop: 10 }}>
              <Row label="Nghỉ (ngày) mỗi giờ (x2)" value={valid ? vnd(p.offDay) : '-'} strong />
              <Row label="Nghỉ (đêm) 19h–22h, 6h–7h (x2)" value={valid ? vnd(p.offNightDaytime) : '-'} strong />
              <Row label="Nghỉ (đêm) 22h–6h (x2,7)" value={valid ? vnd(p.offNight) : '-'} strong />
            </View>
          </>
        )}
      </View>

      <TouchableOpacity style={[styles.btn, !valid && { opacity: 0.5 }]} onPress={handleApply} activeOpacity={0.9}>
        <Ionicons name="checkmark-circle-outline" size={22} color={theme.colors.onPrimary} />
        <Text style={styles.btnText}>Áp dụng công thức</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Công thức chỉ đặt đơn giá cho Ca ngày, Ca đêm và các ca ngày nghỉ. Phụ cấp, giờ phụ, giờ vào ra của từng ca vẫn chỉnh riêng được. Công thức dựa trên thông tin bạn cung cấp, hãy đối chiếu với bảng lương thực tế.
      </Text>
    </ScrollView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.surface },
    content: { padding: 20, paddingBottom: 60, gap: 14 },
    title: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
    subtitle: { fontSize: 13, lineHeight: 19, color: theme.colors.onSurfaceVariant },
    presetCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    presetCardOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer },
    presetTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
    presetDesc: { fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: 2 },
    badge: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },
    card: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: 16,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 8 },
    hintInline: { fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: -4, marginBottom: 8 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    formula: { fontSize: 13, lineHeight: 20, color: theme.colors.onSurfaceVariant },
    label: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
    inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
    input: { flex: 1, fontSize: 20, fontWeight: '700', color: theme.colors.onSurface, padding: 0 },
    suffix: { fontSize: 14, color: theme.colors.outline },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
    rowLabel: { fontSize: 14, color: theme.colors.onSurfaceVariant },
    rowValue: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
    btn: {
      height: 54,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
    },
    btnText: { fontSize: 16, fontWeight: '700', color: theme.colors.onPrimary },
    hint: { fontSize: 12, lineHeight: 18, color: theme.colors.onSurfaceVariant },
  });
