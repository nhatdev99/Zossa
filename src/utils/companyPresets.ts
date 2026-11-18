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
  offDay: number; // Đơn giá giờ ngày nghỉ (ca ngày): LCB mỗi giờ x 2
  offNightDaytime: number; // Đơn giá giờ ngày nghỉ (ca đêm) 19h–22h & 6h–7h: LCB mỗi giờ x 2
  offNight: number; // Đơn giá giờ ngày nghỉ (ca đêm) 22h–6h: LCB mỗi giờ x 2,7
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
//   Nghỉ (ngày): lương cơ bản mỗi giờ x 2
//   Nghỉ (đêm) : 19h–22h lương cơ bản mỗi giờ x 2,
//                22h–6h (hôm sau) lương cơ bản mỗi giờ x 2,7,
//                6h–7h lương cơ bản mỗi giờ x 2
// ---------------------------------------------------------------------------
const NIDEC_BASE_HOURS = 9.5;
const NIDEC_OFF_NIGHT_HOURS = 12;
const NIDEC_DAY_OT = 1.5;
const NIDEC_NIGHT_OT = 2.1;
const NIDEC_OFF_MULTIPLIER = 2;
const NIDEC_OFF_NIGHT_MULTIPLIER = 2.7;

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
 * Ca ngày nghỉ:
 * - Nghỉ (ngày): mọi giờ làm tính theo (lương cơ bản mỗi giờ x 2).
 * - Nghỉ (đêm) : 19h–22h và 6h–7h tính theo (lương cơ bản mỗi giờ x 2),
 *                22h–6h (hôm sau) tính theo (lương cơ bản mỗi giờ x 2,7).
 */
const buildNidecOffShift = (
  id: 'offDay' | 'offNight',
  input: CompanyInput,
  baseHourlyRate: number,
  existing?: ShiftConfig
): ShiftConfig => {
  const isNight = id === 'offNight';
  const dayOffRate = baseHourlyRate * NIDEC_OFF_MULTIPLIER;
  const nightOffRate = baseHourlyRate * (isNight ? NIDEC_OFF_NIGHT_MULTIPLIER : NIDEC_OFF_MULTIPLIER);

  return {
    name: existing?.name ?? (isNight ? 'Nghỉ (đêm)' : 'Nghỉ (ngày)'),
    color: existing?.color ?? (isNight ? '#7E57C2' : '#26A69A'),
    icon: existing?.icon ?? (isNight ? 'moon-outline' : 'sunny-outline'),
    isOff: true,
    isNight,
    startTime: existing?.startTime ?? (isNight ? '19:00' : undefined),
    endTime: existing?.endTime ?? (isNight ? '07:00' : undefined),
    breakMinutes: existing?.breakMinutes ?? (isNight ? 0 : undefined),
    calcMode: 'manual',
    baseHours: isNight ? NIDEC_OFF_NIGHT_HOURS : NIDEC_BASE_HOURS,
    overtimeHours: isNight ? 0 : existing?.overtimeHours ?? 1.5,
    baseRate: dayOffRate,
    overtimeRate: nightOffRate,
    extraHours: existing?.extraHours ?? 0,
    extraRate: existing?.extraRate ?? 0,
    baseSalary: input.baseSalary,
    workDayMode: 'custom',
    customWorkDays: input.workDays,
    overtimeMultiplier: isNight ? NIDEC_OFF_NIGHT_MULTIPLIER : NIDEC_OFF_MULTIPLIER,
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
    'Nghỉ (ngày): lương cơ bản mỗi giờ x 2',
    'Nghỉ (đêm): từ 19h–22h lương cơ bản mỗi giờ x 2, từ 22h–6h (hôm sau) x 2,7, từ 6h–7h x 2',
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
      offNightDaytime: hourly * NIDEC_OFF_MULTIPLIER,
      offNight: hourly * NIDEC_OFF_NIGHT_MULTIPLIER,
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

  // Nghỉ (ngày): sửa đơn giá cũ (x1,5 x 2) về x2 nếu người dùng chưa chỉnh riêng
  if (shifts.day && shifts.offDay) {
    const baseRate = resolveShiftRates(shifts.day, date).baseRate;
    const oldGeneratedRate = baseRate * NIDEC_DAY_OT * multiplier;
    const matchesOldFormula =
      Math.abs(shifts.offDay.baseRate - oldGeneratedRate) < 0.0001 &&
      Math.abs(shifts.offDay.overtimeRate - oldGeneratedRate) < 0.0001;
    if (matchesOldFormula && baseRate > 0) {
      const newRate = baseRate * NIDEC_OFF_MULTIPLIER;
      shifts.offDay = { ...shifts.offDay, baseRate: newRate, overtimeRate: newRate };
      changed = true;
    }
  }

  // Nghỉ (đêm): sửa đơn giá cũ (x2,1 x 2 hoặc cả ca x2) sang 19h–22h & 6h–7h x2, 22h–6h x2,7
  if (shifts.night && shifts.offNight) {
    const baseRate = resolveShiftRates(shifts.night, date).baseRate;
    const oldV1Rate = baseRate * NIDEC_NIGHT_OT * multiplier;
    const oldV2Rate = baseRate * NIDEC_OFF_MULTIPLIER;
    const matchesV1 =
      Math.abs(shifts.offNight.baseRate - oldV1Rate) < 0.0001 &&
      Math.abs(shifts.offNight.overtimeRate - oldV1Rate) < 0.0001;
    const matchesV2 =
      Math.abs(shifts.offNight.baseRate - oldV2Rate) < 0.0001 &&
      Math.abs(shifts.offNight.overtimeRate - oldV2Rate) < 0.0001;
    if ((matchesV1 || matchesV2) && baseRate > 0) {
      const wasDefaultHours =
        shifts.offNight.baseHours === NIDEC_BASE_HOURS && shifts.offNight.overtimeHours === 1.5;
      shifts.offNight = {
        ...shifts.offNight,
        isNight: true,
        startTime: shifts.offNight.startTime ?? '19:00',
        endTime: shifts.offNight.endTime ?? '07:00',
        breakMinutes: shifts.offNight.breakMinutes ?? 0,
        baseHours: wasDefaultHours ? NIDEC_OFF_NIGHT_HOURS : shifts.offNight.baseHours,
        overtimeHours: wasDefaultHours ? 0 : shifts.offNight.overtimeHours,
        baseRate: baseRate * NIDEC_OFF_MULTIPLIER,
        overtimeRate: baseRate * NIDEC_OFF_NIGHT_MULTIPLIER,
        overtimeMultiplier: NIDEC_OFF_NIGHT_MULTIPLIER,
      };
      changed = true;
    }
  }

  return changed
    ? { ...config, shifts, company: { ...config.company, offMultiplier: NIDEC_OFF_MULTIPLIER } }
    : config;
};

// Dùng cho test và màn hình xem trước
export const previewShiftRates = (shift: ShiftConfig, date: string) => resolveShiftRates(shift, date);
