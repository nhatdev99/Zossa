import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  color?: string;
  highlightIndex?: number;
  format: (v: number) => string;
}

/** Biểu đồ cột đơn giản, vẽ bằng View (không cần thư viện đồ hoạ). Chạm vào cột để xem giá trị. */
export function BarChart({ data, height = 150, color, highlightIndex, format }: BarChartProps) {
  const theme = useAppTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const base = color ?? theme.colors.primary;
  const active = selected ?? highlightIndex ?? null;

  return (
    <View>
      <Text style={[styles.tip, { color: theme.colors.onSurfaceVariant }]}>
        {active !== null && data[active]
          ? `${data[active].label}: ${format(data[active].value)}`
          : 'Chạm vào cột để xem chi tiết'}
      </Text>
      <View style={[styles.row, { height }]}>
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max((d.value / max) * height, 3) : 0;
          const on = active === i;
          return (
            <TouchableOpacity
              key={d.label}
              style={styles.col}
              activeOpacity={0.7}
              onPress={() => setSelected(selected === i ? null : i)}
            >
              <View
                style={{
                  width: '100%',
                  height: h,
                  borderRadius: 6,
                  backgroundColor: on ? base : theme.colors.primaryContainer,
                }}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((d) => (
          <Text key={d.label} style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

interface GroupDatum {
  label: string;
  a: number;
  b: number;
}

/** Biểu đồ cột đôi: so sánh hai giá trị cùng tháng (ví dụ Gross và Thực nhận). */
export function GroupedBars({
  data,
  height = 150,
  colorA,
  colorB,
}: {
  data: GroupDatum[];
  height?: number;
  colorA: string;
  colorB: string;
}) {
  const theme = useAppTheme();
  const max = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);
  return (
    <View>
      <View style={[styles.row, { height }]}>
        {data.map((d) => (
          <View key={d.label} style={[styles.col, { flexDirection: 'row', alignItems: 'flex-end', gap: 1 }]}>
            <View style={{ flex: 1, height: d.a > 0 ? Math.max((d.a / max) * height, 3) : 0, backgroundColor: colorA, borderRadius: 4 }} />
            <View style={{ flex: 1, height: d.b > 0 ? Math.max((d.b / max) * height, 3) : 0, backgroundColor: colorB, borderRadius: 4 }} />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {data.map((d) => (
          <Text key={d.label} style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Thanh ngang chia tỷ lệ các phần (cơ cấu thu nhập). */
export function StackedBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const theme = useAppTheme();
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) {
    return <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>Chưa có dữ liệu trong tháng này.</Text>;
  }
  return (
    <View>
      <View style={{ flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden' }}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <View key={p.label} style={{ flex: p.value, backgroundColor: p.color }} />
        ))}
      </View>
      <View style={{ marginTop: 10, gap: 6 }}>
        {parts.map((p) => (
          <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color }} />
            <Text style={{ flex: 1, color: theme.colors.onSurface, fontSize: 13 }}>{p.label}</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>
              {Math.round((p.value / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tip: { fontSize: 12, marginBottom: 8, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  labels: { flexDirection: 'row', gap: 5, marginTop: 6 },
  label: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600' },
});
