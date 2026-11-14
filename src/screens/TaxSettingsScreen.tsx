import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSalaryStore } from '../store/useSalaryStore';
import { Region, TaxMode, getLegalParams, getTaxSettings } from '../utils/salaryCalculator';

const MODES: { id: TaxMode; label: string }[] = [
  { id: 'progressive', label: 'Thuế TNCN' },
  { id: 'flat', label: '% cố định' },
  { id: 'none', label: 'Không trừ' },
];

const num = (v: string) => {
  const n = Number(v.replace(/\s+/g, '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
};
const money = (v: number) => Math.round(v).toLocaleString('vi-VN');

export default function TaxSettingsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const config = useSalaryStore((s) => s.config);
  const updateTax = useSalaryStore((s) => s.updateTax);
  const updateConfig = useSalaryStore((s) => s.updateConfig);
  const tax = getTaxSettings(config);

  const [flatText, setFlatText] = useState(config.taxRate ? String(config.taxRate) : '');
  const [insText, setInsText] = useState(tax.insuranceSalary ? String(tax.insuranceSalary) : '');
  const [capText, setCapText] = useState(String(tax.otMonthlyCapHours));
  const [normalText, setNormalText] = useState(tax.normalHourlyRate ? String(tax.normalHourlyRate) : '');

  const legal = getLegalParams(new Date().toISOString().slice(0, 7), tax.region);

  const Segment = <T extends string | number>({
    items,
    value,
    onChange,
  }: {
    items: { id: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
  }) => (
    <View style={styles.segment}>
      {items.map((it) => (
        <TouchableOpacity
          key={String(it.id)}
          style={[styles.segmentBtn, value === it.id && styles.segmentBtnActive]}
          onPress={() => onChange(it.id)}
        >
          <Text style={[styles.segmentText, value === it.id && styles.segmentTextActive]}>{it.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Cách khấu trừ thuế</Text>
      <Segment items={MODES} value={tax.mode} onChange={(mode) => updateTax({ mode })} />

      {tax.mode === 'flat' && (
        <View style={styles.card}>
          <Text style={styles.label}>Tỷ lệ khấu trừ trên tổng lương</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={flatText}
              onChangeText={(t) => {
                setFlatText(t);
                updateConfig({ taxRate: Math.min(Math.max(num(t), 0), 100) });
              }}
              placeholder="0"
              placeholderTextColor={theme.colors.outline}
            />
            <Text style={styles.suffix}>%</Text>
          </View>
        </View>
      )}

      {tax.mode === 'progressive' && (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Số người phụ thuộc đã đăng ký</Text>
            <View style={styles.row}>
              <TouchableOpacity onPress={() => updateTax({ dependents: Math.max(0, tax.dependents - 1) })}>
                <Ionicons name="remove-circle-outline" size={32} color={theme.colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.input, { textAlign: 'center' }]}>{tax.dependents}</Text>
              <TouchableOpacity onPress={() => updateTax({ dependents: Math.min(20, tax.dependents + 1) })}>
                <Ionicons name="add-circle-outline" size={32} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              Giảm trừ bản thân {money(legal.personalDeduction)} ₫ và mỗi người phụ thuộc {money(legal.dependentDeduction)} ₫/tháng.
              Muốn được giảm trừ khi quyết toán, cần đã đăng ký người phụ thuộc với cơ quan thuế.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Miễn thuế phần phụ trội làm đêm, tăng ca</Text>
                <Text style={styles.hint}>
                  Chỉ phần trả cao hơn lương giờ ngày thường được miễn. Áp dụng cho ca đêm, ca ngày nghỉ/lễ và giờ tăng ca.
                </Text>
              </View>
              <Switch value={tax.exemptPremium} onValueChange={(v) => updateTax({ exemptPremium: v })} />
            </View>

            {tax.exemptPremium && (
              <>
                <Text style={[styles.label, { marginTop: 14 }]}>Trần giờ tăng ca được miễn thuế mỗi tháng</Text>
                <View style={styles.row}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={capText}
                    onChangeText={(t) => {
                      setCapText(t);
                      updateTax({ otMonthlyCapHours: Math.max(0, num(t)) });
                    }}
                  />
                  <Text style={styles.suffix}>giờ</Text>
                </View>
                <Text style={styles.hint}>Luật lao động giới hạn 40 giờ/tháng. Điền 0 nếu không muốn giới hạn.</Text>

                <Text style={[styles.label, { marginTop: 14 }]}>Đơn giá giờ ngày thường (mốc tính phụ trội)</Text>
                <View style={styles.row}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={normalText}
                    onChangeText={(t) => {
                      setNormalText(t);
                      updateTax({ normalHourlyRate: Math.max(0, num(t)) });
                    }}
                    placeholder="Tự động"
                    placeholderTextColor={theme.colors.outline}
                  />
                  <Text style={styles.suffix}>₫/giờ</Text>
                </View>
                <Text style={styles.hint}>Bỏ trống: app lấy đơn giá giờ thấp nhất của các ca ngày làm việc thường.</Text>
              </>
            )}
          </View>
        </>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Bảo hiểm bắt buộc</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Trừ BHXH 8% + BHYT 1,5% + BHTN 1%</Text>
            <Text style={styles.hint}>Phần người lao động đóng, tổng 10,5% trên mức lương đóng bảo hiểm.</Text>
          </View>
          <Switch value={tax.insuranceEnabled} onValueChange={(v) => updateTax({ insuranceEnabled: v })} />
        </View>

        {tax.insuranceEnabled && (
          <>
            <Text style={[styles.label, { marginTop: 14 }]}>Mức lương đóng bảo hiểm</Text>
            <Segment
              items={[
                { id: 'fixed', label: 'Nhập số cố định' },
                { id: 'gross', label: 'Theo tổng thu nhập' },
              ]}
              value={tax.insuranceBasis}
              onChange={(insuranceBasis) => updateTax({ insuranceBasis })}
            />
            {tax.insuranceBasis === 'fixed' && (
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={insText}
                  onChangeText={(t) => {
                    setInsText(t);
                    updateTax({ insuranceSalary: Math.max(0, num(t)) });
                  }}
                  placeholder="Theo hợp đồng lao động"
                  placeholderTextColor={theme.colors.outline}
                />
                <Text style={styles.suffix}>₫</Text>
              </View>
            )}
            <Text style={styles.hint}>
              Thường là lương hợp đồng, không gồm toàn bộ tiền tăng ca. Trần BHXH/BHYT: {money(legal.bhxhCap)} ₫, trần BHTN: {money(legal.bhtnCap)} ₫.
            </Text>

            <Text style={[styles.label, { marginTop: 14 }]}>Vùng lương tối thiểu</Text>
            <Segment
              items={([1, 2, 3, 4] as Region[]).map((r) => ({ id: r, label: `Vùng ${r}` }))}
              value={tax.region}
              onChange={(region) => updateTax({ region })}
            />
          </>
        )}
      </View>

      <View style={[styles.card, { marginTop: 24 }]}>
        <Text style={styles.label}>Biểu thuế lũy tiến từ 2026 (thu nhập tính thuế/tháng)</Text>
        {[
          ['Đến 10 triệu', '5%'],
          ['Trên 10 đến 30 triệu', '10%'],
          ['Trên 30 đến 60 triệu', '20%'],
          ['Trên 60 đến 100 triệu', '30%'],
          ['Trên 100 triệu', '35%'],
        ].map(([range, rate]) => (
          <View key={range} style={styles.tableRow}>
            <Text style={styles.tableText}>{range}</Text>
            <Text style={[styles.tableText, { fontWeight: '700' }]}>{rate}</Text>
          </View>
        ))}
        <Text style={[styles.hint, { marginTop: 12 }]}>
          Thu nhập tính thuế = tổng thu nhập − phần được miễn − bảo hiểm − giảm trừ gia cảnh. Các tháng trước 2026 app tự dùng
          biểu thuế 7 bậc và mức giảm trừ cũ (11 triệu / 4,4 triệu).
        </Text>
      </View>

      <Text style={styles.disclaimer}>
        Chỉ mang tính tham khảo cho người lao động cư trú có hợp đồng từ 3 tháng. Số tiền thực tế phụ thuộc bảng lương của
        công ty, các khoản phụ cấp được miễn (ví dụ tiền ăn giữa ca) và quyết toán thuế cuối năm. Quy định cập nhật đến
        tháng 11/2026, hãy kiểm tra lại khi luật thay đổi.
      </Text>
    </ScrollView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.surface },
    content: { padding: 20, paddingBottom: 60 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 10 },
    card: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: 16,
      marginTop: 12,
    },
    label: { fontSize: 14, fontWeight: '600', color: theme.colors.onSurface },
    hint: { fontSize: 12, color: theme.colors.onSurfaceVariant, lineHeight: 18, marginTop: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
    input: { flex: 1, fontSize: 18, fontWeight: '600', color: theme.colors.onSurface, padding: 0 },
    suffix: { fontSize: 14, color: theme.colors.outline },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    segment: {
      flexDirection: 'row',
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceContainerHigh,
      padding: 4,
      marginTop: 10,
    },
    segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
    segmentBtnActive: { backgroundColor: theme.colors.primary },
    segmentText: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurfaceVariant },
    segmentTextActive: { color: theme.colors.onPrimary },
    tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    tableText: { fontSize: 14, color: theme.colors.onSurface },
    disclaimer: { fontSize: 12, color: theme.colors.onSurfaceVariant, lineHeight: 18, marginTop: 20 },
  });
