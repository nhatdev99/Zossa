import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { format, subMonths } from 'date-fns';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSalaryStore } from '../store/useSalaryStore';
import { calculateMonthlySalary } from '../utils/salaryCalculator';
import { BarChart, GroupedBars, StackedBar } from '../components/charts';

type Metric = 'net' | 'gross' | 'hours' | 'ot';

const METRICS: { id: Metric; label: string }[] = [
  { id: 'net', label: 'Thực nhận' },
  { id: 'gross', label: 'Gross' },
  { id: 'hours', label: 'Giờ làm' },
  { id: 'ot', label: 'Tăng ca' },
];

const vnd = (v: number) => `${Math.round(v).toLocaleString('vi-VN')} ₫`;
const compactMoney = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace('.', ',')} tr` : vnd(v));

export default function StatisticsCompareScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<any>();

  const records = useSalaryStore((s) => s.attendance);
  const config = useSalaryStore((s) => s.config);

  const nowYear = format(new Date(), 'yyyy');
  const currentMonth = format(new Date(), 'yyyy-MM');

  const years = useMemo(() => {
    const set = new Set<string>([nowYear]);
    records.forEach((r) => set.add(r.date.slice(0, 4)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [records, nowYear]);

  const [year, setYear] = useState(nowYear);
  const [metric, setMetric] = useState<Metric>('net');

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        calculateMonthlySalary(records, config, `${year}-${String(i + 1).padStart(2, '0')}`)
      ),
    [records, config, year]
  );

  const valueOf = (m: (typeof months)[number]) =>
    metric === 'net' ? m.netSalary : metric === 'gross' ? m.totalSalary : metric === 'hours' ? m.totalHours : m.totalOvertimeHours;
  const isMoney = metric === 'net' || metric === 'gross';
  const fmt = (v: number) => (isMoney ? vnd(v) : `${Math.round(v * 10) / 10} giờ`);

  const chartData = months.map((m, i) => ({ label: `T${i + 1}`, value: valueOf(m) }));
  const monthsWithData = months.map((m, i) => ({ m, i })).filter(({ m }) => m.totalDays > 0);

  const total = monthsWithData.reduce((s, { m }) => s + valueOf(m), 0);
  const average = monthsWithData.length ? total / monthsWithData.length : 0;
  const best = monthsWithData.reduce<{ i: number; v: number } | null>(
    (acc, { m, i }) => (!acc || valueOf(m) > acc.v ? { i, v: valueOf(m) } : acc),
    null
  );
  const worst = monthsWithData.reduce<{ i: number; v: number } | null>(
    (acc, { m, i }) => (!acc || valueOf(m) < acc.v ? { i, v: valueOf(m) } : acc),
    null
  );

  const cur = useMemo(() => calculateMonthlySalary(records, config, currentMonth), [records, config, currentMonth]);
  const prev = useMemo(
    () => calculateMonthlySalary(records, config, format(subMonths(new Date(), 1), 'yyyy-MM')),
    [records, config]
  );
  const delta = prev.netSalary > 0 ? ((cur.netSalary - prev.netSalary) / prev.netSalary) * 100 : null;

  const SummaryCell = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      {!!sub && <Text style={styles.summarySub}>{sub}</Text>}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Thống kê và so sánh</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {years.map((y) => (
          <TouchableOpacity key={y} style={[styles.chip, year === y && styles.chipOn]} onPress={() => setYear(y)}>
            <Text style={[styles.chipText, year === y && styles.chipTextOn]}>Năm {y}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>So sánh các tháng trong năm {year}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { paddingVertical: 10 }]}>
          {METRICS.map((mt) => (
            <TouchableOpacity key={mt.id} style={[styles.chipSmall, metric === mt.id && styles.chipOn]} onPress={() => setMetric(mt.id)}>
              <Text style={[styles.chipText, metric === mt.id && styles.chipTextOn]}>{mt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <BarChart
          data={chartData}
          format={fmt}
          highlightIndex={year === nowYear ? Number(currentMonth.slice(5)) - 1 : undefined}
        />

        {monthsWithData.length === 0 ? (
          <Text style={styles.empty}>Chưa có dữ liệu chấm công trong năm {year}.</Text>
        ) : (
          <View style={styles.summaryGrid}>
            <SummaryCell label={metric === 'hours' || metric === 'ot' ? 'Tổng cả năm' : 'Tổng cả năm'} value={isMoney ? compactMoney(total) : fmt(total)} />
            <SummaryCell label="Trung bình tháng" value={isMoney ? compactMoney(average) : fmt(average)} sub={`${monthsWithData.length} tháng có dữ liệu`} />
            {best && <SummaryCell label="Cao nhất" value={isMoney ? compactMoney(best.v) : fmt(best.v)} sub={`Tháng ${best.i + 1}`} />}
            {worst && <SummaryCell label="Thấp nhất" value={isMoney ? compactMoney(worst.v) : fmt(worst.v)} sub={`Tháng ${worst.i + 1}`} />}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gross và thực nhận theo tháng</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: theme.colors.secondary }]} /><Text style={styles.legendText}>Gross</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: theme.colors.primary }]} /><Text style={styles.legendText}>Thực nhận</Text></View>
        </View>
        <GroupedBars
          data={months.map((m, i) => ({ label: `T${i + 1}`, a: m.totalSalary, b: m.netSalary }))}
          colorA={theme.colors.secondary}
          colorB={theme.colors.primary}
        />
        <Text style={styles.hintText}>Khoảng chênh giữa hai cột là thuế và bảo hiểm đã trừ.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tháng này so với tháng trước</Text>
        <View style={styles.compareRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Thực nhận tháng này</Text>
            <Text style={styles.bigValue}>{vnd(cur.netSalary)}</Text>
          </View>
          {delta !== null && (
            <View style={[styles.deltaPill, { backgroundColor: delta >= 0 ? theme.colors.primaryContainer : theme.colors.errorContainer }]}>
              <Ionicons
                name={delta >= 0 ? 'trending-up' : 'trending-down'}
                size={16}
                color={delta >= 0 ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer}
              />
              <Text style={{ fontWeight: '700', color: delta >= 0 ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer }}>
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(1).replace('.', ',')}%
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.hintText}>
          Tháng trước: {vnd(prev.netSalary)} · {Math.round(prev.totalHours + prev.totalOvertimeHours)} giờ. Tháng này: {Math.round(cur.totalHours + cur.totalOvertimeHours)} giờ.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cơ cấu thu nhập tháng này</Text>
        <StackedBar
          parts={[
            { label: 'Lương cơ bản', value: cur.totalBaseSalary, color: theme.colors.primary },
            { label: 'Tăng ca', value: cur.totalOvertimeSalary, color: theme.colors.secondary },
            { label: 'Phụ cấp và giờ phụ', value: cur.totalExtraSalary + cur.totalAllowanceSalary, color: theme.colors.tertiary },
          ]}
        />
      </View>

      <TouchableOpacity style={styles.exportBtn} onPress={() => navigation.navigate('Export')} activeOpacity={0.9}>
        <Ionicons name="download-outline" size={20} color={theme.colors.onPrimary} />
        <Text style={styles.exportText}>Xuất dữ liệu ra CSV</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.surface },
    content: { padding: 20, paddingBottom: 60, gap: 14 },
    screenTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
    chipRow: { gap: 8 },
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: theme.colors.surfaceContainerHigh },
    chipSmall: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.colors.surfaceContainerHigh },
    chipOn: { backgroundColor: theme.colors.primary },
    chipText: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurfaceVariant },
    chipTextOn: { color: theme.colors.onPrimary },
    card: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: 16,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
    empty: { marginTop: 14, fontSize: 13, color: theme.colors.onSurfaceVariant },
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
    summaryCell: { width: '48%', backgroundColor: theme.colors.surfaceContainerHigh, borderRadius: 14, padding: 12 },
    summaryLabel: { fontSize: 12, color: theme.colors.onSurfaceVariant, fontWeight: '600' },
    summaryValue: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface, marginTop: 4 },
    summarySub: { fontSize: 11, color: theme.colors.onSurfaceVariant, marginTop: 2 },
    legend: { flexDirection: 'row', gap: 16, marginVertical: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { fontSize: 12, color: theme.colors.onSurfaceVariant },
    dot: { width: 10, height: 10, borderRadius: 5 },
    hintText: { fontSize: 12, lineHeight: 18, color: theme.colors.onSurfaceVariant, marginTop: 10 },
    compareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
    bigValue: { fontSize: 22, fontWeight: '800', color: theme.colors.onSurface, marginTop: 4 },
    deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
    exportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 54,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
    },
    exportText: { fontSize: 16, fontWeight: '700', color: theme.colors.onPrimary },
  });
