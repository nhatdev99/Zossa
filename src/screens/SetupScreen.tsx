import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useProfileStore } from '../store/useProfileStore';
import { useSalaryStore } from '../store/useSalaryStore';
import { NIDEC_PRESET } from '../utils/companyPresets';
import {
  DEFAULT_TAX_SETTINGS,
  Region,
  SalaryConfig,
  ShiftConfig,
  SHIFT_COLOR_PALETTE,
  TaxMode,
  formatTime,
} from '../utils/salaryCalculator';

type PresetId = 'nidec' | 'office' | 'hourly' | 'dayNight' | 'custom';
type PayMode = 'hourly' | 'monthly';

const PRESETS: { id: PresetId; title: string; desc: string; icon: string; hours: string }[] = [
  { id: 'nidec', title: 'Nidec Việt Nam', desc: 'Công thức lương có sẵn', icon: 'business-outline', hours: '9.5' },
  { id: 'office', title: 'Hành chính', desc: 'Một ca cố định mỗi ngày', icon: 'briefcase-outline', hours: '8' },
  { id: 'dayNight', title: 'Ca ngày / đêm', desc: 'Hai ca, ca đêm cao hơn', icon: 'moon-outline', hours: '8' },
  { id: 'hourly', title: 'Làm theo giờ', desc: 'Part-time, làm thêm', icon: 'time-outline', hours: '4' },
  { id: 'custom', title: 'Tự thiết lập', desc: 'Tôi sẽ tự thêm ca sau', icon: 'options-outline', hours: '8' },
];

const TOTAL_STEPS = 4;

function parseNumber(value: string) {
  if (!value) return 0;
  const parsed = Number(value.replace(/\s+/g, '').replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return Math.round(value).toLocaleString('vi-VN');
}

export default function SetupScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const updateProfile = useProfileStore((s) => s.updateProfile);
  const completeOnboarding = useProfileStore((s) => s.completeOnboarding);
  const updateConfig = useSalaryStore((s) => s.updateConfig);

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [preset, setPreset] = useState<PresetId>('office');
  const [payMode, setPayMode] = useState<PayMode>('hourly');
  const [baseHours, setBaseHours] = useState('8');
  const [amount, setAmount] = useState('');
  const [otMultiplier, setOtMultiplier] = useState('1.5');
  const [addHoliday, setAddHoliday] = useState(true);
  const [taxRate, setTaxRate] = useState('0');
  const [workDays, setWorkDays] = useState('22');
  const [taxMode, setTaxMode] = useState<TaxMode>('progressive');
  const [dependents, setDependents] = useState(0);
  const [insuranceSalary, setInsuranceSalary] = useState('');
  const [region, setRegion] = useState<Region>(1);

  const isNidec = preset === 'nidec';
  const hours = isNidec ? 9.5 : parseNumber(baseHours);
  const money = parseNumber(amount);
  const workDaysNum = parseNumber(workDays);
  const hourlyRate = isNidec
    ? NIDEC_PRESET.preview({ baseSalary: money, workDays: workDaysNum }).hourly
    : payMode === 'hourly'
    ? money
    : hours > 0
    ? money / (26 * hours)
    : 0;

  const choosePreset = (id: PresetId) => {
    setPreset(id);
    setBaseHours(PRESETS.find((p) => p.id === id)?.hours ?? '8');
  };

  const goNext = () => {
    if (step === 1 && !fullName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên của bạn.');
      return;
    }
    if (step === 2 && isNidec) {
      if (money <= 0 || workDaysNum <= 0) {
        Alert.alert('Thông báo', 'Vui lòng nhập lương cơ bản và số ngày công.');
        return;
      }
    } else if (step === 2) {
      if (hours <= 0) {
        Alert.alert('Thông báo', 'Số giờ làm mỗi ca phải lớn hơn 0.');
        return;
      }
      if (money <= 0) {
        Alert.alert(
          'Thông báo',
          payMode === 'hourly' ? 'Vui lòng nhập đơn giá mỗi giờ.' : 'Vui lòng nhập lương cơ bản tháng.'
        );
        return;
      }
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const buildShift = (
    name: string,
    colorIdx: number,
    rateFactor: number,
    isOff: boolean,
    icon: string,
    isNight = false,
    startHour = 8
  ): ShiftConfig => {
    const mult = parseNumber(otMultiplier) > 0 ? parseNumber(otMultiplier) : 1.5;
    const rate = hourlyRate * rateFactor;
    const isAuto = payMode === 'monthly';
    return {
      name,
      color: SHIFT_COLOR_PALETTE[colorIdx % SHIFT_COLOR_PALETTE.length],
      icon,
      isOff,
      isNight,
      startTime: formatTime(startHour * 60),
      endTime: formatTime(startHour * 60 + hours * 60),
      breakMinutes: 0,
      calcMode: isAuto ? 'auto' : 'manual',
      baseHours: hours,
      overtimeHours: 0,
      baseRate: rate,
      overtimeRate: rate * mult,
      extraHours: 0,
      extraRate: 0,
      baseSalary: isAuto ? money * rateFactor : 0,
      workDayMode: 'custom',
      customWorkDays: 26,
      overtimeMultiplier: mult,
      extraMultiplier: 1,
      allowance: 0,
    };
  };

  const handleFinish = () => {
    const shifts: Record<string, ShiftConfig> = {};
    const order: string[] = [];
    const add = (id: string, shift: ShiftConfig) => {
      shifts[id] = shift;
      order.push(id);
    };

    if (preset === 'nidec') {
      const built = NIDEC_PRESET.build({ baseSalary: money, workDays: workDaysNum });
      built.shiftOrder.forEach((id) => add(id, built.shifts[id]));
    } else if (preset === 'dayNight') {
      // Luật lao động VN: làm đêm được trả ít nhất +30% so với ban ngày
      add('day', buildShift('Ca ngày', 0, 1, false, 'sunny', false, 7));
      add('night', buildShift('Ca đêm', 1, 1.3, false, 'moon', true, 22));
    } else if (preset === 'hourly') {
      add('regular', buildShift('Ca làm', 0, 1, false, 'time'));
    } else if (preset === 'office') {
      add('regular', buildShift('Ca hành chính', 0, 1, false, 'briefcase'));
    } else {
      add('regular', buildShift('Ca làm việc', 0, 1, false, 'time'));
    }

    if (addHoliday && preset !== 'nidec') {
      add('holiday', buildShift('Ngày nghỉ / lễ', 2, 2, true, 'sunny-outline'));
    }

    const config: Partial<SalaryConfig> = {
      shifts,
      shiftOrder: order,
      company: isNidec
        ? { id: 'nidec', baseSalary: money, workDays: workDaysNum, includeOffDays: true }
        : undefined,
      taxRate: taxMode === 'flat' ? Math.min(Math.max(parseNumber(taxRate), 0), 100) : 0,
      tax: {
        ...DEFAULT_TAX_SETTINGS,
        mode: taxMode,
        insuranceEnabled: taxMode === 'progressive',
        insuranceBasis: parseNumber(insuranceSalary) > 0 ? 'fixed' : 'gross',
        insuranceSalary: parseNumber(insuranceSalary),
        region,
        dependents,
      },
    };
    updateConfig(config);

    updateProfile({ fullName: fullName.trim(), employeeCode: jobTitle.trim() });
    completeOnboarding();
  };

  const renderField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { suffix?: string; placeholder?: string; numeric?: boolean; autoFocus?: boolean }
  ) => (
    <View style={styles.fieldCard}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          keyboardType={opts?.numeric ? 'numeric' : 'default'}
          placeholder={opts?.placeholder}
          placeholderTextColor={theme.colors.outline}
          autoFocus={opts?.autoFocus}
        />
        {!!opts?.suffix && <Text style={styles.fieldSuffix}>{opts.suffix}</Text>}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <View style={styles.welcome}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brand}>Rosala</Text>
            <Text style={styles.tagline}>Chấm công và tính lương theo cách của riêng bạn</Text>

            <View style={styles.badges}>
              <Badge icon="cloud-offline-outline" text="Hoàn toàn offline, không cần tài khoản" />
              <Badge icon="lock-closed-outline" text="Dữ liệu chỉ nằm trên điện thoại của bạn" />
              <Badge icon="options-outline" text="Tuỳ chỉnh ca, đơn giá, tăng ca, phụ cấp" />
            </View>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Chào bạn! Bạn tên là gì?</Text>
            <Text style={styles.stepDesc}>Tên chỉ hiển thị trong ứng dụng trên máy của bạn.</Text>
            {renderField('Tên của bạn', fullName, setFullName, { placeholder: 'Ví dụ: Lan', autoFocus: true })}
            {renderField('Công việc / chức danh (không bắt buộc)', jobTitle, setJobTitle, {
              placeholder: 'Ví dụ: Công nhân, Nhân viên bán hàng',
            })}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Thiết lập ca làm đầu tiên</Text>
            <Text style={styles.stepDesc}>Chọn mẫu gần với công việc của bạn. Mọi thứ đều sửa được sau.</Text>

            <View style={styles.presetGrid}>
              {PRESETS.map((p) => {
                const active = preset === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.presetCard, active && styles.presetCardActive]}
                    onPress={() => choosePreset(p.id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={p.icon as any}
                      size={22}
                      color={active ? theme.colors.primary : theme.colors.outline}
                    />
                    <Text style={[styles.presetTitle, active && { color: theme.colors.primary }]}>{p.title}</Text>
                    <Text style={styles.presetDesc}>{p.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isNidec ? (
            <>
              {renderField('Lương cơ bản mỗi tháng', amount, setAmount, { suffix: '₫', numeric: true, placeholder: 'Ví dụ: 10450000' })}
              {renderField('Số ngày công chuẩn', workDays, setWorkDays, { suffix: 'ngày', numeric: true })}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Công thức Nidec Việt Nam</Text>
                {NIDEC_PRESET.formula.map((line) => (
                  <Text key={line} style={styles.hint}>• {line}</Text>
                ))}
                <SummaryRow label="Giờ cơ bản" value={`${formatMoney(hourlyRate)} ₫`} />
                <SummaryRow label="Giờ tăng ca ngày (x1,5)" value={`${formatMoney(hourlyRate * 1.5)} ₫`} />
                <SummaryRow label="Giờ tăng ca đêm (x2,1)" value={`${formatMoney(hourlyRate * 2.1)} ₫`} />
                <SummaryRow label="Nghỉ (ngày) mỗi giờ (x2)" value={`${formatMoney(hourlyRate * 2)} ₫`} />
                <SummaryRow label="Nghỉ (đêm) 19h–22h, 6h–7h (x2)" value={`${formatMoney(hourlyRate * 2)} ₫`} />
                <SummaryRow label="Nghỉ (đêm) 22h–6h (x2,7)" value={`${formatMoney(hourlyRate * 2.7)} ₫`} />
              </View>
            </>
            ) : (
              <>
            <View style={styles.segment}>
              {(['hourly', 'monthly'] as PayMode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.segmentBtn, payMode === m && styles.segmentBtnActive]}
                  onPress={() => setPayMode(m)}
                >
                  <Text style={[styles.segmentText, payMode === m && styles.segmentTextActive]}>
                    {m === 'hourly' ? 'Lương theo giờ' : 'Lương theo tháng'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {renderField('Số giờ làm mỗi ca', baseHours, setBaseHours, { suffix: 'giờ', numeric: true })}
            {payMode === 'hourly'
              ? renderField('Đơn giá mỗi giờ', amount, setAmount, { suffix: '₫/giờ', numeric: true, placeholder: '30000' })
              : renderField('Lương cơ bản mỗi tháng', amount, setAmount, { suffix: '₫', numeric: true, placeholder: '7800000' })}
            {renderField('Hệ số tăng ca', otMultiplier, setOtMultiplier, { suffix: 'x', numeric: true })}

            {payMode === 'monthly' && (
              <Text style={styles.hint}>
                Đơn giá giờ = lương tháng / (26 ngày công × số giờ mỗi ca). Có thể đổi số ngày công trong Cài đặt lương.
              </Text>
            )}
            {preset === 'dayNight' && (
              <Text style={styles.hint}>Ca đêm được đặt cao hơn ca ngày 30% (mức tối thiểu theo luật lao động).</Text>
            )}

            <TouchableOpacity style={styles.toggleRow} onPress={() => setAddHoliday((v) => !v)} activeOpacity={0.8}>
              <Ionicons
                name={addHoliday ? 'checkbox' : 'square-outline'}
                size={22}
                color={addHoliday ? theme.colors.primary : theme.colors.outline}
              />
              <Text style={styles.toggleText}>Thêm ca "Ngày nghỉ / lễ" với đơn giá gấp đôi</Text>
            </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Thuế và bảo hiểm</Text>
            <Text style={styles.stepDesc}>
              Chọn cách app trừ thuế và bảo hiểm để ra số tiền thực nhận. Có thể đổi lại trong Cá nhân → Thuế và bảo hiểm.
            </Text>

            {([
              { id: 'progressive', title: 'Thuế TNCN + BHXH theo luật', desc: 'Dành cho người có hợp đồng lao động từ 3 tháng' },
              { id: 'flat', title: 'Khấu trừ cố định theo %', desc: 'Công ty trừ một tỷ lệ cố định trên tổng lương' },
              { id: 'none', title: 'Không khấu trừ', desc: 'Lương nhận trọn, ví dụ làm tự do hoặc thời vụ' },
            ] as { id: TaxMode; title: string; desc: string }[]).map((o) => {
              const active = taxMode === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.presetCard, { width: '100%', marginBottom: 10 }, active && styles.presetCardActive]}
                  onPress={() => setTaxMode(o.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.presetTitle, active && { color: theme.colors.primary }]}>{o.title}</Text>
                  <Text style={styles.presetDesc}>{o.desc}</Text>
                </TouchableOpacity>
              );
            })}

            {taxMode === 'flat' &&
              renderField('Khấu trừ trên tổng lương', taxRate, setTaxRate, { suffix: '%', numeric: true })}

            {taxMode === 'progressive' && (
              <>
                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>Số người phụ thuộc đã đăng ký (6,2 triệu/người/tháng)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                    <TouchableOpacity onPress={() => setDependents((d) => Math.max(0, d - 1))}>
                      <Ionicons name="remove-circle-outline" size={30} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.fieldInput}>{dependents}</Text>
                    <TouchableOpacity onPress={() => setDependents((d) => Math.min(20, d + 1))}>
                      <Ionicons name="add-circle-outline" size={30} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {renderField('Mức lương đóng BHXH (bỏ trống = theo tổng thu nhập)', insuranceSalary, setInsuranceSalary, {
                  suffix: '₫',
                  numeric: true,
                  placeholder: 'Theo hợp đồng lao động',
                })}

                <View style={styles.segment}>
                  {([1, 2, 3, 4] as Region[]).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.segmentBtn, region === r && styles.segmentBtnActive]}
                      onPress={() => setRegion(r)}
                    >
                      <Text style={[styles.segmentText, region === r && styles.segmentTextActive]}>Vùng {r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.hint}>
                  Vùng lương tối thiểu nơi bạn làm việc (HN, TP.HCM... thường là vùng 1). Dùng để tính trần bảo hiểm thất nghiệp.
                </Text>
              </>
            )}

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Tóm tắt</Text>
              <SummaryRow label="Tên" value={fullName.trim()} />
              <SummaryRow label="Số giờ mỗi ca" value={`${hours} giờ`} />
              <SummaryRow label="Đơn giá giờ cơ bản" value={`${formatMoney(hourlyRate)} ₫`} />
              <SummaryRow label="Giờ tăng ca" value={`${formatMoney(hourlyRate * (parseNumber(otMultiplier) || 1.5))} ₫`} />
            </View>

            <Text style={styles.hint}>
              Kết quả thuế chỉ mang tính tham khảo, số thực tế theo bảng lương và quyết toán của công ty. Dữ liệu của bạn được lưu hoàn toàn trên máy này. Hãy xuất bản sao lưu trong mục Cá nhân để không mất khi
              đổi điện thoại.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.footerRow}>
          {step > 0 ? (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
              <Text style={styles.backText}>Quay lại</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={step === TOTAL_STEPS - 1 ? handleFinish : goNext}
            activeOpacity={0.9}
          >
            <Text style={styles.nextText}>
              {step === 0 ? 'Bắt đầu' : step === TOTAL_STEPS - 1 ? 'Hoàn tất' : 'Tiếp tục'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Badge({ icon, text }: { icon: any; text: string }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={20} color={theme.colors.primary} />
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: { padding: 24, paddingTop: 72, paddingBottom: 24, flexGrow: 1 },
    welcome: { alignItems: 'center', paddingTop: 24 },
    logo: { width: 120, height: 120, marginBottom: 16 },
    brand: { fontSize: 34, fontWeight: '800', color: theme.colors.onSurface },
    tagline: {
      fontSize: 16,
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
      marginTop: 8,
      marginBottom: 32,
    },
    badges: { alignSelf: 'stretch', gap: 12 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    badgeText: { flex: 1, fontSize: 14, color: theme.colors.onSurface },
    stepTitle: { fontSize: 26, fontWeight: '800', color: theme.colors.onSurface, marginBottom: 6 },
    stepDesc: { fontSize: 14, color: theme.colors.onSurfaceVariant, marginBottom: 20, lineHeight: 20 },
    fieldCard: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: 14,
      marginBottom: 12,
    },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurfaceVariant, marginBottom: 6 },
    fieldRow: { flexDirection: 'row', alignItems: 'center' },
    fieldInput: { flex: 1, fontSize: 18, fontWeight: '600', color: theme.colors.onSurface, padding: 0 },
    fieldSuffix: { fontSize: 14, color: theme.colors.outline, marginLeft: 8 },
    presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    presetCard: {
      width: '48%',
      padding: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceContainerLow,
      gap: 4,
    },
    presetCardActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer },
    presetTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginTop: 4 },
    presetDesc: { fontSize: 12, color: theme.colors.onSurfaceVariant },
    segment: {
      flexDirection: 'row',
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceContainerHigh,
      padding: 4,
      marginBottom: 12,
    },
    segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
    segmentBtnActive: { backgroundColor: theme.colors.primary },
    segmentText: { fontSize: 14, fontWeight: '600', color: theme.colors.onSurfaceVariant },
    segmentTextActive: { color: theme.colors.onPrimary },
    hint: { fontSize: 12, color: theme.colors.onSurfaceVariant, lineHeight: 18, marginBottom: 12 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    toggleText: { flex: 1, fontSize: 14, color: theme.colors.onSurface },
    summaryCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceContainerLow,
      padding: 16,
      marginBottom: 16,
      gap: 8,
    },
    summaryTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 4 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryLabel: { fontSize: 14, color: theme.colors.onSurfaceVariant },
    summaryValue: { fontSize: 14, fontWeight: '600', color: theme.colors.onSurface },
    footer: { padding: 20, paddingBottom: 32, gap: 16 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.outlineVariant },
    dotActive: { width: 24, backgroundColor: theme.colors.primary },
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: { flex: 1, paddingVertical: 16, alignItems: 'center' },
    backText: { fontSize: 16, fontWeight: '600', color: theme.colors.onSurfaceVariant },
    nextBtn: {
      flex: 2,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
    },
    nextText: { fontSize: 16, fontWeight: '700', color: theme.colors.onPrimary },
  });
