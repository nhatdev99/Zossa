import { isSameMonth, parseISO } from 'date-fns';

export type SalaryCalcMode = 'manual' | 'auto';
export type WorkDayMode = 'month' | 'custom';

export interface ShiftConfig {
  name?: string; // Tên hiển thị của ca (người dùng tự đặt)
  color?: string; // Màu hiển thị trên lịch
  icon?: string; // Tên icon Ionicons
  isOff?: boolean; // Ca nghỉ / lễ (tính vào nhóm "Ngày nghỉ/lễ" ở thống kê)
  isNight?: boolean; // Ca làm đêm (22h-6h), dùng để tính phần lương phụ trội được miễn thuế
  startTime?: string; // Giờ vào ca mặc định (HH:mm), dùng cho chấm công nhanh
  endTime?: string; // Giờ ra ca mặc định (HH:mm); nhỏ hơn giờ vào nghĩa là qua nửa đêm
  breakMinutes?: number; // Thời gian nghỉ giữa ca (phút), trừ khỏi giờ làm
  baseHours: number;
  overtimeHours: number;
  baseRate: number;
  overtimeRate: number;
  extraHours?: number;
  extraRate?: number;
  calcMode?: SalaryCalcMode;
  baseSalary?: number;
  workDayMode?: WorkDayMode;
  customWorkDays?: number;
  overtimeMultiplier?: number;
  extraMultiplier?: number;
  allowance?: number;
}

export type TaxMode = 'none' | 'flat' | 'progressive';
export type InsuranceBasis = 'fixed' | 'gross';
export type Region = 1 | 2 | 3 | 4;

export interface TaxSettings {
  mode: TaxMode; // none: không khấu trừ | flat: % cố định | progressive: thuế TNCN lũy tiến theo luật
  insuranceEnabled: boolean; // Có đóng BHXH/BHYT/BHTN bắt buộc (phần người lao động)
  insuranceBasis: InsuranceBasis; // fixed: mức lương đóng BH cố định | gross: theo tổng thu nhập
  insuranceSalary: number; // Mức lương đóng BH (khi insuranceBasis = fixed)
  region: Region; // Vùng lương tối thiểu (để tính trần BHTN)
  dependents: number; // Số người phụ thuộc đã đăng ký
  exemptPremium: boolean; // Miễn thuế phần phụ trội lương làm đêm / tăng ca
  normalHourlyRate: number; // Đơn giá giờ ngày thường làm mốc (0 = tự động)
  otMonthlyCapHours: number; // Trần giờ tăng ca/tháng được miễn thuế (0 = không giới hạn)
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  mode: 'none',
  insuranceEnabled: false,
  insuranceBasis: 'fixed',
  insuranceSalary: 0,
  region: 1,
  dependents: 0,
  exemptPremium: true,
  normalHourlyRate: 0,
  otMonthlyCapHours: 40,
};

export interface SalaryConfig {
  shifts: Record<string, ShiftConfig>; // Danh sách ca do người dùng tự định nghĩa
  shiftOrder: string[]; // Thứ tự hiển thị của các ca
  taxRate: number; // Phần trăm khấu trừ cố định (dùng khi tax.mode = 'flat')
  tax?: TaxSettings; // Thuế TNCN + bảo hiểm; không có = cách tính cũ (chỉ taxRate)
  company?: {
    id: string;
    baseSalary: number;
    workDays: number;
    offMultiplier?: number;
    includeOffDays?: boolean;
  }; // Công thức lương công ty đang áp dụng
}

/** Lấy cài đặt thuế đầy đủ, tương thích dữ liệu cũ chỉ có taxRate. */
export const getTaxSettings = (config: SalaryConfig): TaxSettings => {
  if (config.tax) return { ...DEFAULT_TAX_SETTINGS, ...config.tax };
  return {
    ...DEFAULT_TAX_SETTINGS,
    mode: (config.taxRate || 0) > 0 ? 'flat' : 'none',
  };
};

// ---------------------------------------------------------------------------
// Quy định pháp luật Việt Nam (người lao động cư trú, hợp đồng từ 3 tháng)
// Cập nhật tháng 11/2026. Kiểm tra lại khi luật thay đổi.
// ---------------------------------------------------------------------------

export interface TaxBracket {
  upTo: number; // Phần thu nhập tính thuế/tháng đến mức này
  rate: number;
}

/** Biểu thuế lũy tiến 5 bậc, áp dụng từ kỳ tính thuế 2026 (Luật 109/2025/QH15). */
export const PIT_BRACKETS_2026: TaxBracket[] = [
  { upTo: 10_000_000, rate: 0.05 },
  { upTo: 30_000_000, rate: 0.1 },
  { upTo: 60_000_000, rate: 0.2 },
  { upTo: 100_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

/** Biểu thuế 7 bậc cũ, dùng cho các tháng trước 2026. */
export const PIT_BRACKETS_LEGACY: TaxBracket[] = [
  { upTo: 5_000_000, rate: 0.05 },
  { upTo: 10_000_000, rate: 0.1 },
  { upTo: 18_000_000, rate: 0.15 },
  { upTo: 32_000_000, rate: 0.2 },
  { upTo: 52_000_000, rate: 0.25 },
  { upTo: 80_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

export const INSURANCE_RATES = { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 };

/** Lương tối thiểu vùng 2026 (NĐ 293/2025/NĐ-CP). Trần BHTN = 20 lần. */
const MIN_WAGE_2026: Record<Region, number> = {
  1: 5_310_000,
  2: 4_730_000,
  3: 4_140_000,
  4: 3_700_000,
};
/** Lương tối thiểu vùng 2024-2025 (NĐ 74/2024/NĐ-CP). */
const MIN_WAGE_LEGACY: Record<Region, number> = {
  1: 4_960_000,
  2: 4_410_000,
  3: 3_860_000,
  4: 3_450_000,
};

export interface LegalParams {
  personalDeduction: number;
  dependentDeduction: number;
  brackets: TaxBracket[];
  bhxhCap: number; // Trần lương đóng BHXH, BHYT (20 lần lương cơ sở / mức tham chiếu)
  bhtnCap: number; // Trần lương đóng BHTN (20 lần lương tối thiểu vùng)
}

/** Lấy tham số pháp lý theo tháng (YYYY-MM). */
export const getLegalParams = (month: string, region: Region): LegalParams => {
  const is2026 = month >= '2026-01';
  const afterJuly2026 = month >= '2026-07';
  const minWage = (is2026 ? MIN_WAGE_2026 : MIN_WAGE_LEGACY)[region];
  return {
    personalDeduction: is2026 ? 15_500_000 : 11_000_000,
    dependentDeduction: is2026 ? 6_200_000 : 4_400_000,
    brackets: is2026 ? PIT_BRACKETS_2026 : PIT_BRACKETS_LEGACY,
    // Lương cơ sở/mức tham chiếu: 2,34 triệu đến 30/6/2026, 2,53 triệu từ 1/7/2026
    bhxhCap: 20 * (afterJuly2026 ? 2_530_000 : 2_340_000),
    bhtnCap: 20 * minWage,
  };
};

export const calcProgressiveTax = (taxableIncome: number, brackets: TaxBracket[]): number => {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (taxableIncome <= prev) break;
    const slice = Math.min(taxableIncome, b.upTo) - prev;
    tax += slice * b.rate;
    prev = b.upTo;
  }
  return tax;
};

// id của ca (vd: 'day', 'night' hoặc id tự sinh)
export type ShiftType = string;

const EMPTY_SHIFT: ShiftConfig = {
  baseHours: 0,
  overtimeHours: 0,
  baseRate: 0,
  overtimeRate: 0,
};

export const SHIFT_COLOR_PALETTE = [
  '#FF9800',
  '#5C6BC0',
  '#26A69A',
  '#7E57C2',
  '#EF5350',
  '#29B6F6',
  '#8D6E63',
  '#EC407A',
];

/** Lấy cấu hình của 1 ca; nếu ca đã bị xoá thì trả về cấu hình rỗng (không crash). */
export const getShift = (
  config: SalaryConfig,
  id: ShiftType
): ShiftConfig => config.shifts?.[id] ?? EMPTY_SHIFT;

/** Tên hiển thị của ca. */
export const getShiftName = (
  config: SalaryConfig,
  id: ShiftType
): string => config.shifts?.[id]?.name || 'Ca đã xoá';

/** Màu hiển thị của ca. */
export const getShiftColor = (
  config: SalaryConfig,
  id: ShiftType,
  fallback = '#9E9E9E'
): string => config.shifts?.[id]?.color || fallback;

// ---------------------------------------------------------------------------
// Giờ vào / giờ ra của ca (chấm công nhanh)
// ---------------------------------------------------------------------------

/** "07:30" -> 450 (phút kể từ 00:00); trả về null nếu không hợp lệ. */
export const parseTime = (value?: string): number | null => {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/** 450 -> "07:30" (tự quy về trong khoảng 0-24h). */
export const formatTime = (minutes: number): string => {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Số giờ làm theo lịch của ca = giờ ra - giờ vào - nghỉ giữa ca.
 * Giờ ra nhỏ hơn giờ vào nghĩa là ca qua nửa đêm (vd 22:00 -> 06:00 = 8 giờ).
 * Trả về null nếu ca chưa cài giờ hoặc giờ vào trùng giờ ra.
 */
export const getScheduledHours = (shift: ShiftConfig): number | null => {
  const start = parseTime(shift.startTime);
  const end = parseTime(shift.endTime);
  if (start === null || end === null || start === end) return null;
  const span = (end - start + 1440) % 1440;
  const minutes = Math.max(0, span - Math.max(0, shift.breakMinutes ?? 0));
  return Math.round((minutes / 60) * 100) / 100;
};

/** Chia giờ theo lịch thành giờ cơ bản và giờ tăng ca (phần vượt baseHours). */
export const splitScheduledHours = (
  shift: ShiftConfig
): { total: number; actualHours: number; overtimeHours: number } | null => {
  const total = getScheduledHours(shift);
  if (total === null) return null;
  const actualHours = Math.min(total, shift.baseHours);
  const overtimeHours = Math.round(Math.max(0, total - shift.baseHours) * 100) / 100;
  return { total, actualHours, overtimeHours };
};

/** Thời điểm vào / ra thực của một ngày theo lịch ca (ca đêm kết thúc vào ngày hôm sau). */
export const buildShiftTimestamps = (
  date: string,
  shift: ShiftConfig
): { checkIn: Date; checkOut: Date } | null => {
  const start = parseTime(shift.startTime);
  const end = parseTime(shift.endTime);
  if (start === null || end === null || start === end) return null;
  const [y, mo, d] = date.split('-').map(Number);
  if (!y || !mo || !d) return null;
  const checkIn = new Date(y, mo - 1, d, Math.floor(start / 60), start % 60, 0, 0);
  const checkOut = new Date(y, mo - 1, d, Math.floor(end / 60), end % 60, 0, 0);
  if (end <= start) checkOut.setDate(checkOut.getDate() + 1);
  return { checkIn, checkOut };
};

/**
 * Chuyển cấu hình dạng cũ (day/night/offDay/offNight) sang dạng mới.
 * Dữ liệu đã lưu trên máy người dùng cũ vẫn giữ nguyên số liệu.
 */
export const normalizeConfig = (raw: any): SalaryConfig => {
  if (raw && raw.shifts && raw.shiftOrder) {
    return raw as SalaryConfig;
  }
  const legacy: {
    id: string;
    name: string;
    color: string;
    icon: string;
    isOff: boolean;
    isNight?: boolean;
  }[] = [
    { id: 'day', name: 'Ca ngày', color: '#FF9800', icon: 'sunny', isOff: false },
    { id: 'night', name: 'Ca đêm', color: '#5C6BC0', icon: 'moon', isOff: false, isNight: true },
    { id: 'offDay', name: 'Nghỉ (ngày)', color: '#26A69A', icon: 'sunny-outline', isOff: true },
    { id: 'offNight', name: 'Nghỉ (đêm)', color: '#7E57C2', icon: 'moon-outline', isOff: true, isNight: true },
  ];
  const shifts: Record<string, ShiftConfig> = {};
  const shiftOrder: string[] = [];
  legacy.forEach((l) => {
    if (raw && raw[l.id]) {
      shifts[l.id] = {
        ...raw[l.id],
        name: l.name,
        color: l.color,
        icon: l.icon,
        isOff: l.isOff,
        isNight: !!l.isNight,
      };
      shiftOrder.push(l.id);
    }
  });
  return { shifts, shiftOrder, taxRate: raw?.taxRate ?? 0 };
};

export interface AttendanceRecord {
  id: string;
  date: string; // Định dạng YYYY-MM-DD
  shiftType: ShiftType;
  actualHours: number;
  overtimeHours: number;
  checkInTime?: string; // ISO timestamp
  checkOutTime?: string; // ISO timestamp
  note?: string;
}

export interface DailySalary {
  base: number;
  ot: number;
  extra: number;
  allowance: number;
  total: number;
}

export interface MonthlySalary {
  month: string; // Định dạng YYYY-MM
  totalBaseSalary: number;
  totalOvertimeSalary: number;
  totalExtraSalary: number;
  totalAllowanceSalary: number;
  totalSalary: number; // Trước thuế (Gross)
  taxAmount: number; // Tiền thuế (TNCN hoặc khấu trừ cố định)
  netSalary: number; // Thực nhận sau thuế và bảo hiểm
  insuranceAmount: number; // Tổng BHXH + BHYT + BHTN (phần người lao động)
  insuranceBreakdown: { bhxh: number; bhyt: number; bhtn: number };
  exemptAmount: number; // Phần lương phụ trội làm đêm / tăng ca được miễn thuế
  personalDeduction: number; // Giảm trừ bản thân
  dependentDeduction: number; // Giảm trừ người phụ thuộc
  taxableIncome: number; // Thu nhập tính thuế
  taxMode: TaxMode;
  totalDays: number;
  totalHours: number;
  totalOvertimeHours: number;
}

/**
 * Tách tổng số giờ làm của ca nghỉ đêm thành:
 * - dayHours: khung ngoài 22h–6h (ví dụ 19h–22h và 6h–7h)
 * - nightHours: khung ban đêm 22h–6h sáng hôm sau
 */
export const splitOffNightHours = (
  record: Pick<AttendanceRecord, 'actualHours' | 'overtimeHours' | 'checkInTime' | 'checkOutTime'>,
  shiftConfig: ShiftConfig
): { dayHours: number; nightHours: number } => {
  const totalHours = Math.max(0, (record.actualHours || 0) + (record.overtimeHours || 0));
  if (totalHours <= 0) return { dayHours: 0, nightHours: 0 };

  let startMin: number | null = null;
  if (record.checkInTime) {
    const checkIn = new Date(record.checkInTime);
    if (!Number.isNaN(checkIn.getTime())) {
      startMin = checkIn.getHours() * 60 + checkIn.getMinutes() + checkIn.getSeconds() / 60;
    }
  }
  if (startMin === null) {
    startMin = parseTime(shiftConfig.startTime) ?? 19 * 60;
  }

  const durationMin = totalHours * 60;
  const endMin = startMin + durationMin;

  // Tính tổng số phút giao với các khung đêm [22:00, 06:00 hôm sau) lặp lại mỗi 24h (1440 phút)
  const maxDay = Math.ceil(endMin / 1440) + 1;
  let nightMin = 0;
  for (let d = 0; d <= maxDay; d++) {
    const winStart = d * 1440 - 120; // 22:00 ngày trước (khi d=0 là -120..360 tức 00:00..06:00)
    const winEnd = d * 1440 + 360; // 06:00 ngày d
    const overlap = Math.max(0, Math.min(endMin, winEnd) - Math.max(startMin, winStart));
    nightMin += overlap;
  }

  const nightHours = Math.min(totalHours, Math.round((nightMin / 60) * 10000) / 10000);
  const dayHours = Math.max(0, Math.round((totalHours - nightHours) * 10000) / 10000);
  return { dayHours, nightHours };
};

/**
 * Tính toán lương cho 1 ca làm việc cụ thể
 */
export const calculateDailySalary = (
  record: AttendanceRecord,
  config: SalaryConfig
): DailySalary => {
  const shiftConfig = getShift(config, record.shiftType);
  const rates = resolveShiftRates(
    shiftConfig,
    record.date
  );
  
  // Dựa trên số giờ làm thực tế và config của loại ca đó
  let base = 0;
  let ot = 0;
  if (shiftConfig.isOff) {
    if (shiftConfig.isNight && rates.overtimeRate > 0 && rates.overtimeRate !== rates.baseRate) {
      const { dayHours, nightHours } = splitOffNightHours(record, shiftConfig);
      base = dayHours * rates.baseRate + nightHours * rates.overtimeRate;
    } else {
      base = (record.actualHours + record.overtimeHours) * rates.baseRate;
    }
  } else {
    base = record.actualHours * rates.baseRate;
    ot = record.overtimeHours * rates.overtimeRate;
  }
  const extra =
    (shiftConfig.extraHours || 0) *
    rates.extraRate;
  const allowance = shiftConfig.allowance || 0;
  
  return {
    base,
    ot,
    extra,
    allowance,
    total: base + ot + extra + allowance,
  };
};

export function resolveShiftRates(
  shiftConfig: ShiftConfig,
  date: string
) {
  const isAuto =
    shiftConfig.calcMode === 'auto';
  if (!isAuto) {
    return {
      baseRate: shiftConfig.baseRate,
      overtimeRate:
        shiftConfig.overtimeRate,
      extraRate:
        shiftConfig.extraRate || 0,
    };
  }

  const baseSalary =
    shiftConfig.baseSalary || 0;
  const baseHours =
    shiftConfig.baseHours || 0;
  const monthDays = new Date(
    parseISO(date).getFullYear(),
    parseISO(date).getMonth() + 1,
    0
  ).getDate();

  const workDays =
    shiftConfig.workDayMode === 'custom'
      ? shiftConfig.customWorkDays || 0
      : monthDays;

  const hourly =
    workDays > 0 && baseHours > 0
      ? baseSalary /
        (workDays * baseHours)
      : 0;

  const overtimeRate =
    hourly *
    (shiftConfig.overtimeMultiplier ||
      1);
  const extraRate =
    hourly *
    (shiftConfig.extraMultiplier ||
      1);

  return {
    baseRate: hourly,
    overtimeRate,
    extraRate,
  };
}

/**
 * Phần lương phụ trội được miễn thuế TNCN (Điều 4 Luật 109/2025, Điều 26 NĐ 253/2026):
 * chỉ miễn phần trả cao hơn đơn giá giờ ngày làm việc bình thường, cho
 *  - giờ làm cơ bản của ca đêm hoặc ca ngày nghỉ/lễ,
 *  - giờ tăng ca (tối đa otMonthlyCapHours giờ/tháng, phần vượt tính thuế).
 * Không áp dụng cho phụ cấp và "giờ phụ".
 */
const calcExemptPremium = (
  monthlyRecords: AttendanceRecord[],
  config: SalaryConfig,
  tax: TaxSettings
): number => {
  const sorted = [...monthlyRecords].sort((a, b) => a.date.localeCompare(b.date));
  const capped = tax.otMonthlyCapHours > 0;
  let otUsed = 0;
  let exempt = 0;

  sorted.forEach((record) => {
    const shift = getShift(config, record.shiftType);
    const rates = resolveShiftRates(shift, record.date);

    let normal = tax.normalHourlyRate;
    if (!(normal > 0)) {
      // Tự động: đơn giá giờ cơ bản thấp nhất của các ca ngày làm việc thường
      const candidates = config.shiftOrder
        .map((id) => config.shifts[id])
        .filter((sh) => sh && !sh.isOff && !sh.isNight)
        .map((sh) => resolveShiftRates(sh, record.date).baseRate)
        .filter((r) => r > 0);
      normal = candidates.length ? Math.min(...candidates) : rates.baseRate;
    }

    if (shift.isOff) {
      if (shift.isNight && rates.overtimeRate > 0 && rates.overtimeRate !== rates.baseRate) {
        const { dayHours, nightHours } = splitOffNightHours(record, shift);
        exempt +=
          Math.max(0, rates.baseRate - normal) * dayHours +
          Math.max(0, rates.overtimeRate - normal) * nightHours;
      } else {
        exempt += Math.max(0, rates.baseRate - normal) * (record.actualHours + record.overtimeHours);
      }
      return;
    }

    if (shift.isNight) {
      exempt += Math.max(0, rates.baseRate - normal) * record.actualHours;
    }

    if (record.overtimeHours > 0) {
      const remaining = capped ? Math.max(0, tax.otMonthlyCapHours - otUsed) : record.overtimeHours;
      const eligible = Math.min(record.overtimeHours, remaining);
      otUsed += record.overtimeHours;
      exempt += Math.max(0, rates.overtimeRate - normal) * eligible;
    }
  });

  return exempt;
};

/**
 * Tính tổng lương và thống kê theo tháng
 */
export const calculateMonthlySalary = (
  records: AttendanceRecord[],
  config: SalaryConfig,
  targetMonth: string // YYYY-MM
): MonthlySalary => {
  // Lấy danh sách record thuộc tháng mục tiêu
  const targetDate = parseISO(`${targetMonth}-01`);
  const monthlyRecords = records.filter((r) => isSameMonth(parseISO(r.date), targetDate));
  
  let totalBaseSalary = 0;
  let totalOvertimeSalary = 0;
  let totalExtraSalary = 0;
  let totalAllowanceSalary = 0;
  let totalHours = 0;
  let totalOvertimeHours = 0;
  
  monthlyRecords.forEach((record) => {
    const daily = calculateDailySalary(record, config);
    totalBaseSalary += daily.base;
    totalOvertimeSalary += daily.ot;
    totalExtraSalary += daily.extra;
    totalAllowanceSalary += daily.allowance;
    totalHours += record.actualHours;
    totalOvertimeHours += record.overtimeHours;
  });
  
  const totalSalary =
    totalBaseSalary +
    totalOvertimeSalary +
    totalExtraSalary +
    totalAllowanceSalary;

  const tax = getTaxSettings(config);
  const legal = getLegalParams(targetMonth, tax.region);

  // Bảo hiểm bắt buộc (phần người lao động)
  let bhxh = 0;
  let bhyt = 0;
  let bhtn = 0;
  // Tháng chưa có ngày chấm công nào thì không có khoản khấu trừ nào
  if (tax.insuranceEnabled && monthlyRecords.length > 0) {
    const insuredSalary = tax.insuranceBasis === 'gross' ? totalSalary : tax.insuranceSalary;
    const bhxhBase = Math.min(Math.max(insuredSalary, 0), legal.bhxhCap);
    const bhtnBase = Math.min(Math.max(insuredSalary, 0), legal.bhtnCap);
    bhxh = bhxhBase * INSURANCE_RATES.bhxh;
    bhyt = bhxhBase * INSURANCE_RATES.bhyt;
    bhtn = bhtnBase * INSURANCE_RATES.bhtn;
  }
  const insuranceAmount = bhxh + bhyt + bhtn;

  // Phần phụ trội làm đêm / tăng ca được miễn thuế (từ kỳ tính thuế 2026)
  const exemptAmount =
    tax.mode === 'progressive' && tax.exemptPremium && targetMonth >= '2026-01'
      ? calcExemptPremium(monthlyRecords, config, tax)
      : 0;

  const personalDeduction = tax.mode === 'progressive' ? legal.personalDeduction : 0;
  const dependentDeduction =
    tax.mode === 'progressive' ? Math.max(0, tax.dependents) * legal.dependentDeduction : 0;

  let taxableIncome = 0;
  let taxAmount = 0;
  if (tax.mode === 'progressive') {
    taxableIncome = Math.max(
      0,
      totalSalary - exemptAmount - insuranceAmount - personalDeduction - dependentDeduction
    );
    taxAmount = calcProgressiveTax(taxableIncome, legal.brackets);
  } else if (tax.mode === 'flat') {
    taxableIncome = totalSalary;
    taxAmount = (totalSalary * (config.taxRate || 0)) / 100;
  }
  const netSalary = totalSalary - insuranceAmount - taxAmount;

  return {
    month: targetMonth,
    totalBaseSalary,
    totalOvertimeSalary,
    totalExtraSalary,
    totalAllowanceSalary,
    totalSalary,
    taxAmount,
    netSalary,
    insuranceAmount,
    insuranceBreakdown: { bhxh, bhyt, bhtn },
    exemptAmount,
    personalDeduction,
    dependentDeduction,
    taxableIncome,
    taxMode: tax.mode,
    totalDays: monthlyRecords.length,
    totalHours,
    totalOvertimeHours,
  };
};
