import { SalaryConfig, ShiftConfig, resolveShiftRates } from './salaryCalculator';

export interface CompanyInput {
  baseSalary: number; // Lương cơ bản tháng (người dùng tự nhập)
  workDays: number; // Số ngày công chuẩn trong tháng
  includeOffDays?: boolean; // Có áp dụng công thức ngày nghỉ (mặc định có)
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
//   Nghỉ (ca ngày/đêm) = đơn giá giờ cơ bản tương ứng x 2
//   Mọi giờ làm trong ngày nghỉ tính cùng đơn giá, không áp dụng hệ số tăng ca.
// ---------------------------------------------------------------------------
const NIDEC_BASE_HOURS = 9.5;
const NIDEC_DAY_OT = 1.5;
const NIDEC_NIGHT_OT = 2.1;
const NIDEC_OFF_MULTIPLIER = 2;

const round4 = (v: number) => Math.round(v * 10000) / 10000;

const hourlyOf = (input: CompanyInput) =>
  input.workDays > 0 ? input.baseSalary / (input.workDays * NIDEC_BASE_HOURS) : 0;

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
 * Ca ngày nghỉ: mọi giờ làm tính theo (đơn giá giờ cơ bản của ca tương ứng x 2).
 * Lưu ở chế độ thủ công với đơn giá đã tính sẵn; áp dụng lại công thức để cập nhật khi đổi lương.
 */
const buildNidecOffShift = (
  id: 'offDay' | 'offNight',
  input: CompanyInput,
  baseHourlyRate: number,
  existing?: ShiftConfig
): ShiftConfig => {
  const isNight = id === 'offNight';
  const rate = baseHourlyRate * NIDEC_OFF_MULTIPLIER;

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
  formula: [
    'Ca ngày: lương cơ bản / ngày công = lương 1 ngày',
    'Lương 1 ngày / 9,5 giờ = đơn giá giờ cơ bản',
    'Giờ tăng ca ca ngày = giờ cơ bản x 1,5',
    'Ca đêm: giờ cơ bản như ca ngày, giờ tăng ca = giờ cơ bản x 2,1',
  ],
  offFormula: [
    'Nghỉ (ca ngày) = đơn giá giờ cơ bản ca ngày x 2',
    'Nghỉ (ca đêm) = đơn giá giờ cơ bản ca đêm x 2',
    'Mọi giờ làm trong ngày nghỉ tính cùng đơn giá, không áp dụng tăng ca',
  ],
  build: (input, existing) => {
    const include = input.includeOffDays !== false;
    const dayShift = buildNidecShift('day', input, existing?.day);
    const nightShift = buildNidecShift('night', input, existing?.night);
    const shifts: Record<string, ShiftConfig> = {
      day: dayShift,
      night: nightShift,
    };
    const shiftOrder = ['day', 'night'];
    if (include) {
      shifts.offDay = buildNidecOffShift('offDay', input, dayShift.baseRate, existing?.offDay);
      shifts.offNight = buildNidecOffShift('offNight', input, nightShift.baseRate, existing?.offNight);
      shiftOrder.push('offDay', 'offNight');
    }
    return { shifts, shiftOrder };
  },
  preview: (input) => {
    const hourly = hourlyOf(input);
    return {
      dailyPay: input.workDays > 0 ? input.baseSalary / input.workDays : 0,
      hourly,
      dayOvertime: hourly * NIDEC_DAY_OT,
      nightOvertime: hourly * NIDEC_NIGHT_OT,
      offDay: hourly * NIDEC_OFF_MULTIPLIER,
      offNight: hourly * NIDEC_OFF_MULTIPLIER,
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
      offMultiplier: NIDEC_OFF_MULTIPLIER,
      includeOffDays: input.includeOffDays !== false,
    },
  };
};

/** Correct legacy Nidec holiday rates while preserving rates customized by the user. */
export const migrateNidecOffRates = (config: SalaryConfig): SalaryConfig => {
  if (config.company?.id !== 'nidec') return config;

  const shifts = { ...config.shifts };
  let changed = false;
  const multiplier = config.company.offMultiplier && config.company.offMultiplier > 0
    ? config.company.offMultiplier
    : NIDEC_OFF_MULTIPLIER;
  const date = '2026-01-01';

  ([
    ['day', 'offDay', NIDEC_DAY_OT],
    ['night', 'offNight', NIDEC_NIGHT_OT],
  ] as const).forEach(([workId, offId, oldOvertimeMultiplier]) => {
    const workShift = shifts[workId];
    const offShift = shifts[offId];
    if (!workShift || !offShift) return;

    const baseRate = resolveShiftRates(workShift, date).baseRate;
    const oldGeneratedRate = baseRate * oldOvertimeMultiplier * multiplier;
    const matchesOldFormula =
      Math.abs(offShift.baseRate - oldGeneratedRate) < 0.0001 &&
      Math.abs(offShift.overtimeRate - oldGeneratedRate) < 0.0001;
    if (!matchesOldFormula || baseRate <= 0) return;

    const newRate = baseRate * NIDEC_OFF_MULTIPLIER;
    shifts[offId] = { ...offShift, baseRate: newRate, overtimeRate: newRate };
    changed = true;
  });

  return changed
    ? { ...config, shifts, company: { ...config.company, offMultiplier: NIDEC_OFF_MULTIPLIER } }
    : config;
};

// Dùng cho test và màn hình xem trước
export const previewShiftRates = (shift: ShiftConfig, date: string) => resolveShiftRates(shift, date);
