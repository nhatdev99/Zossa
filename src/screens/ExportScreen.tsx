import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format as formatDate } from 'date-fns';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSalaryStore } from '../store/useSalaryStore';
import { CsvSeparator, buildMonthCsv, buildYearCsv } from '../utils/csv';
import { buildMonthXlsx, buildYearXlsx } from '../utils/xlsxReports';
import { shareCsv, shareXlsx } from '../services/csvExport';
import { BRAND } from '../config/brand';

type Scope = 'month' | 'year';
type Format = 'xlsx' | 'csv';

export default function ExportScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const records = useSalaryStore((s) => s.attendance);
  const config = useSalaryStore((s) => s.config);

  const nowMonth = formatDate(new Date(), 'yyyy-MM');

  const monthList = useMemo(() => {
    const set = new Set<string>([nowMonth]);
    records.forEach((r) => set.add(r.date.slice(0, 7)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [records, nowMonth]);
  const yearList = useMemo(() => Array.from(new Set(monthList.map((m) => m.slice(0, 4)))), [monthList]);

  const [scope, setScope] = useState<Scope>('month');
  const [month, setMonth] = useState(nowMonth);
  const [year, setYear] = useState(nowMonth.slice(0, 4));
  const [sep, setSep] = useState<CsvSeparator>(';');
  const [format, setFormat] = useState<Format>('xlsx');
  const [busy, setBusy] = useState(false);

  const countRecords =
    scope === 'month'
      ? records.filter((r) => r.date.startsWith(month)).length
      : records.filter((r) => r.date.startsWith(year)).length;

  const handleExport = async () => {
    if (countRecords === 0) {
      Alert.alert('Chưa có dữ liệu', 'Khoảng thời gian này chưa có ngày chấm công nào để xuất.');
      return;
    }
    setBusy(true);
    try {
      const stem = scope === 'month' ? month : year;
      if (format === 'xlsx') {
        const bytes =
          scope === 'month'
            ? buildMonthXlsx(records, config, month)
            : buildYearXlsx(records, config, year);
        await shareXlsx(`${BRAND}_${stem}.xlsx`, bytes);
      } else if (scope === 'month') {
        await shareCsv(`${BRAND}_${month}.csv`, buildMonthCsv(records, config, month, sep));
      } else {
        await shareCsv(`${BRAND}_${year}.csv`, buildYearCsv(records, config, year, sep));
      }
    } catch (e: any) {
      Alert.alert('Không thể xuất file', e?.message || 'Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Xuất dữ liệu</Text>
      <Text style={styles.subtitle}>Chọn Excel để có bảng đẹp, hoặc CSV nếu cần dữ liệu thô. File chỉ nằm trên máy cho đến khi bạn chọn nơi lưu hoặc gửi.</Text>

      <Text style={styles.section}>Định dạng file</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Excel (.xlsx)" on={format === 'xlsx'} onPress={() => setFormat('xlsx')} />
        <Chip label="CSV thô" on={format === 'csv'} onPress={() => setFormat('csv')} />
      </View>
      <Text style={styles.hint}>
        {format === 'xlsx'
          ? 'Bảng có màu, căn lề, định dạng số, dòng tổng và trang tổng kết, mở được bằng Excel, Numbers, Google Sheets. Nên dùng để xem và in.'
          : 'Văn bản thuần, không màu và không căn lề. Chỉ nên dùng để đưa dữ liệu vào phần mềm khác.'}
      </Text>

      <Text style={styles.section}>Bạn muốn xuất</Text>
      <View style={styles.scopeRow}>
        {([
          { id: 'month', title: 'Theo tháng', desc: 'Từng ngày chấm công và tổng kết lương của một tháng', icon: 'calendar-outline' },
          { id: 'year', title: 'Theo năm', desc: 'Tổng hợp 12 tháng của một năm, mỗi tháng một dòng', icon: 'stats-chart-outline' },
        ] as { id: Scope; title: string; desc: string; icon: any }[]).map((o) => {
          const on = scope === o.id;
          return (
            <TouchableOpacity key={o.id} style={[styles.scopeCard, on && styles.scopeCardOn]} onPress={() => setScope(o.id)} activeOpacity={0.85}>
              <Ionicons name={o.icon} size={22} color={on ? theme.colors.primary : theme.colors.outline} />
              <Text style={[styles.scopeTitle, on && { color: theme.colors.primary }]}>{o.title}</Text>
              <Text style={styles.scopeDesc}>{o.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.section}>{scope === 'month' ? 'Chọn tháng' : 'Chọn năm'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {scope === 'month'
          ? monthList.map((m) => <Chip key={m} label={`${m.slice(5)}/${m.slice(0, 4)}`} on={month === m} onPress={() => setMonth(m)} />)
          : yearList.map((y) => <Chip key={y} label={`Năm ${y}`} on={year === y} onPress={() => setYear(y)} />)}
      </ScrollView>

      {format === 'csv' && (
        <>
          <Text style={styles.section}>Dấu phân cách cột</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Chấm phẩy ( ; )" on={sep === ';'} onPress={() => setSep(';')} />
            <Chip label="Dấu phẩy ( , )" on={sep === ','} onPress={() => setSep(',')} />
          </View>
          <Text style={styles.hint}>
            Excel tiếng Việt thường cần chấm phẩy. Nếu mở file thấy mọi thứ dồn vào một cột, hãy xuất lại với lựa chọn còn lại.
          </Text>
        </>
      )}

      <View style={styles.preview}>
        <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
        <Text style={styles.previewText}>
          {`${BRAND}_${scope === 'month' ? month : year}.${format}`} · {countRecords} ngày chấm công
        </Text>
      </View>

      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={handleExport} disabled={busy} activeOpacity={0.9}>
        <Ionicons name="share-outline" size={20} color={theme.colors.onPrimary} />
        <Text style={styles.btnText}>{busy ? 'Đang tạo file...' : format === 'xlsx' ? 'Xuất Excel' : 'Xuất CSV'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.surface },
    content: { padding: 20, paddingBottom: 60 },
    title: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
    subtitle: { fontSize: 13, lineHeight: 19, color: theme.colors.onSurfaceVariant, marginTop: 6 },
    section: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface, marginTop: 22, marginBottom: 10 },
    scopeRow: { gap: 10 },
    scopeCard: {
      padding: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceContainerLow,
      gap: 4,
    },
    scopeCardOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer },
    scopeTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
    scopeDesc: { fontSize: 12, color: theme.colors.onSurfaceVariant },
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: theme.colors.surfaceContainerHigh },
    chipOn: { backgroundColor: theme.colors.primary },
    chipText: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurfaceVariant },
    chipTextOn: { color: theme.colors.onPrimary },
    hint: { fontSize: 12, lineHeight: 18, color: theme.colors.onSurfaceVariant, marginTop: 10 },
    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 24,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    previewText: { flex: 1, fontSize: 13, color: theme.colors.onSurface },
    btn: {
      marginTop: 16,
      height: 54,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
    },
    btnText: { fontSize: 16, fontWeight: '700', color: theme.colors.onPrimary },
  });
