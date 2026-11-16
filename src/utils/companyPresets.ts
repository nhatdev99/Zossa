import { SalaryConfig, ShiftConfig, resolveShiftRates } from './salaryCalculator';

export interface CompanyInput {
  baseSalary: number; // Lương cơ bản tháng (người dùng tự nhập)
  workDays: number; // Số ngày công chuẩn trong tháng
  includeOffDays?: boolean; // Có áp dụng công thức ngày nghỉ (mặc định có)
  offMultiplier?: number; // Hệ số ngày nghỉ so với đơn giá tăng ca (mặc định 2)
}

export interface CompanyPreview {
  dailyPay: number;
  hourly: number;
  dayOvertime: number;
  nightOvertime: number;
  offDay: number; // Đơn giá giờ ngày nghỉ (ca ngày)
  offNight: number; // Đơn giá giờ ngày nghỉ (ca đêm)
}

export interface CompanyPreset {
  id: string;
  name: string;
  description: string;
  defaultWorkDays: number;
  defaultOffMultiplier: number;
  /** Công thức lương ca ngày / ca đêm */
  formula: string[];
  /** Công thức ngày nghỉ, tách riêng khỏi công thức lương */
  offFormula: string[];
  build: (
    input: CompanyInput,
    existing?: Record<string, ShiftConfig>
  ) => { shifts: Record<string, ShiftConfig>; shiftOrder: string[] };
  preview: (input: CompanyInput) => CompanyPreview;
}

// ---------------------------------------------------------------------------
// Nidec Việt Nam
//  Công thức lương
//   Ca ngày: lương cơ bản / ngày công (mặc định 22) = lương 1 ngày
//            / 9,5 giờ = đơn giá giờ cơ bản; x 1,5 = đơn giá giờ tăng ca
//   Ca đêm : đơn giá giờ cơ bản như ca ngày; x 2,1 = đơn giá giờ tăng ca
//  Công thức ngày nghỉ (tách riêng)
//   Nghỉ (ca ngày) = đơn giá giờ tăng ca ca ngày x 2
//   Nghỉ (ca đêm) = đơn giá giờ tăng ca ca đêm x 2
//   Mọi giờ làm trong ngày nghỉ (cả giờ cơ bản và giờ tăng ca) tính cùng đơn giá này.
// ---------------------------------------------------------------------------
const NIDEC_BASE_HOURS = 9.5;
const NIDEC_DAY_OT = 1.5;
const NIDEC_NIGHT_OT = 2.1;
const NIDEC_OFF_MULTIPLIER = 2;

const round4 = (v: number) => Math.round(v * 10000) / 10000;

const hourlyOf = (input: CompanyInput) =>
  input.workDays > 0 ? input.baseSalary / (input.workDays * NIDEC_BASE_HOURS) : 0;

const offMultiplierOf = (input: CompanyInput) =>
  input.offMultiplier && input.offMultiplier > 0 ? input.offMultiplier : NIDEC_OFF_MULTIPLIER;

const buildNidecShift = (
  id: 'day' | 'night',
  input: CompanyInput,
  existing?: ShiftConfig
): ShiftConfig => {
  const isNight = id === 'night';
  const hourly = hourlyOf(input);
  const overtimeMultiplier = isNight ? NIDEC_NIGHT_OT : NIDEC_DAY_OT;

  // Giữ nguyên "giờ phụ" (extra) đã có: đổi hệ số để số tiền không thay đổi
  const keepExtra = !!existing && (existing.extraHours ?? 0) > 0 && (existing.extraRate ?? 0) > 0 && hourly > 0;
  const extraMultiplier = keepExtra ? round4((existing!.extraRate as number) / hourly) : existing?.extraMultiplier ?? 1;

  return {
    name: existing?.name ?? (isNight ? 'Ca đêm' : 'Ca ngày'),
    color: existing?.color ?? (isNight ? '#5C6BC0' : '#FF9800'),
    icon: existing?.icon ?? (isNight ? 'moon' : 'sunny'),
    isOff: false,
    isNight,
    startTime: existing?.startTime,
    endTime: existing?.endTime,
    breakMinutes: existing?.breakMinutes,
    calcMode: 'auto',
    baseHours: NIDEC_BASE_HOURS,
    overtimeHours: existing?.overtimeHours ?? 1.5,
    baseSalary: input.baseSalary,
    workDayMode: 'custom',
    customWorkDays: input.workDays,
    overtimeMultiplier,
    extraHours: existing?.extraHours ?? 0,
    extraMultiplier,
    allowance: existing?.allowance ?? 0,
    // Đơn giá đã tính sẵn (giống cách màn Cài đặt lưu ở chế độ tự động)
    baseRate: hourly,
    overtimeRate: hourly * overtimeMultiplier,
    extraRate: hourly * extraMultiplier,
  };
};

/**
 * Ca ngày nghỉ: mọi giờ làm tính theo (đơn giá giờ tăng ca của ca tương ứng x hệ số ngày nghỉ).
 * Lưu ở chế độ thủ công với đơn giá đã tính sẵn; áp dụng lại công thức để cập nhật khi đổi lương.
 */
const buildNidecOffShift = (
  id: 'offDay' | 'offNight',
  input: CompanyInput,
  existing?: ShiftConfig
): ShiftConfig => {
  const isNight = id === 'offNight';
  const rate = hourlyOf(input) * (isNight ? NIDEC_NIGHT_OT : NIDEC_DAY_OT) * offMultiplierOf(input);

  return {
    name: existing?.name ?? (isNight ? 'Nghỉ (đêm)' : 'Nghỉ (ngày)'),
    color: existing?.color ?? (isNight ? '#7E57C2' : '#26A69A'),
    icon: existing?.icon ?? (isNight ? 'moon-outline' : 'sunny-outline'),
    isOff: true,
    isNight,
    startTime: existing?.startTime,
    endTime: existing?.endTime,
    breakMinutes: existing?.breakMinutes,
    calcMode: 'manual',
    baseHours: NIDEC_BASE_HOURS,
    overtimeHours: existing?.overtimeHours ?? 1.5,
    baseRate: rate,
    overtimeRate: rate,
    extraHours: existing?.extraHours ?? 0,
    extraRate: existing?.extraRate ?? 0,
    baseSalary: input.baseSalary,
    workDayMode: 'custom',
    customWorkDays: input.workDays,
    overtimeMultiplier: isNight ? NIDEC_NIGHT_OT : NIDEC_DAY_OT,
    extraMultiplier: existing?.extraMultiplier ?? 1,
    allowance: existing?.allowance ?? 0,
  };
};

export const NIDEC_PRESET: CompanyPreset = {
  id: 'nidec',
  name: 'Nidec Việt Nam',
  description: 'Lương theo công thức của công ty: ca ngày, ca đêm và ngày nghỉ',
  defaultWorkDays: 22,
  defaultOffMultiplier: NIDEC_OFF_MULTIPLIER,
  formula: [
    'Ca ngày: lương cơ bản / ngày công = lương 1 ngày',
    'Lương 1 ngày / 9,5 giờ = đơn giá giờ cơ bản',
    'Giờ tăng ca ca ngày = giờ cơ bản x 1,5',
    'Ca đêm: giờ cơ bản như ca ngày, giờ tăng ca = giờ cơ bản x 2,1',
  ],
  offFormula: [
    'Nghỉ (ca ngày) = đơn giá giờ tăng ca ca ngày x 2',
    'Nghỉ (ca đêm) = đơn giá giờ tăng ca ca đêm x 2',
    'Mọi giờ làm trong ngày nghỉ tính cùng đơn giá này',
  ],
  build: (input, existing) => {
    const include = input.includeOffDays !== false;
    const shifts: Record<string, ShiftConfig> = {
      day: buildNidecShift('day', input, existing?.day),
      night: buildNidecShift('night', input, existing?.night),
    };
    const shiftOrder = ['day', 'night'];
    if (include) {
      shifts.offDay = buildNidecOffShift('offDay', input, existing?.offDay);
      shifts.offNight = buildNidecOffShift('offNight', input, existing?.offNight);
      shiftOrder.push('offDay', 'offNight');
    }
    return { shifts, shiftOrder };
  },
  preview: (input) => {
    const hourly = hourlyOf(input);
    const m = offMultiplierOf(input);
    return {
      dailyPay: input.workDays > 0 ? input.baseSalary / input.workDays : 0,
      hourly,
      dayOvertime: hourly * NIDEC_DAY_OT,
      nightOvertime: hourly * NIDEC_NIGHT_OT,
      offDay: hourly * NIDEC_DAY_OT * m,
      offNight: hourly * NIDEC_NIGHT_OT * m,
    };
  },
};

export const COMPANY_PRESETS: CompanyPreset[] = [NIDEC_PRESET];

export const getCompanyPreset = (id: string): CompanyPreset | undefined =>
  COMPANY_PRESETS.find((p) => p.id === id);

/**
 * Áp dụng công thức công ty lên cấu hình hiện tại: ghi đè các ca của công ty (giữ giờ vào ra, phụ cấp,
 * giờ phụ đã cài), giữ nguyên các ca khác, thuế và bảo hiểm. Nếu tắt công thức ngày nghỉ thì
 * các ca nghỉ hiện có được giữ nguyên.
 */
export const applyCompanyPreset = (
  config: SalaryConfig,
  presetId: string,
  input: CompanyInput
): SalaryConfig => {
  const preset = getCompanyPreset(presetId);
  if (!preset) return config;
  const built = preset.build(input, config.shifts);
  return {
    ...config,
    shifts: { ...config.shifts, ...built.shifts },
    shiftOrder: [...built.shiftOrder, ...config.shiftOrder.filter((id) => !built.shiftOrder.includes(id))],
    company: {
      id: preset.id,
      baseSalary: input.baseSalary,
      workDays: input.workDays,
      offMultiplier: input.offMultiplier,
      includeOffDays: input.includeOffDays !== false,
    },
  };
};

// Dùng cho test và màn hình xem trước
export const previewShiftRates = (shift: ShiftConfig, date: string) => resolveShiftRates(shift, date);
