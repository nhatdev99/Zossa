import {
  SalaryConfig,
  AttendanceRecord,
  calculateDailySalary,
  calculateMonthlySalary,
  resolveShiftRates,
  normalizeConfig,
  TaxSettings,
  parseTime,
  formatTime,
  getScheduledHours,
  splitScheduledHours,
  buildShiftTimestamps,
} from '../salaryCalculator';

describe('salaryCalculator', () => {
  const mockConfig: SalaryConfig = {
    shifts: {
      day: { baseHours: 8, baseRate: 100, overtimeHours: 2, overtimeRate: 150, extraHours: 0, extraRate: 0 },
      night: { baseHours: 8, baseRate: 120, overtimeHours: 2, overtimeRate: 180, extraHours: 2, extraRate: 56 },
      offDay: { baseHours: 8, baseRate: 200, overtimeHours: 2, overtimeRate: 250, extraHours: 0, extraRate: 0, isOff: true },
      offNight: { baseHours: 8, baseRate: 250, overtimeHours: 2, overtimeRate: 300, extraHours: 2, extraRate: 56, isOff: true },
    },
    shiftOrder: ['day', 'night', 'offDay', 'offNight'],
    taxRate: 0,
  };

  test('calculateDailySalary - Day shift', () => {
    const record: AttendanceRecord = {
      id: '1',
      date: '2023-10-01',
      shiftType: 'day',
      actualHours: 8,
      overtimeHours: 2,
    };

    const result = calculateDailySalary(record, mockConfig);
    expect(result.base).toBe(800); // 8 * 100
    expect(result.ot).toBe(300);   // 2 * 150
    expect(result.extra).toBe(0);
    expect(result.total).toBe(1100);
  });

  test('calculateMonthlySalary - Only returns records for specific month', () => {
    const records: AttendanceRecord[] = [
      { id: '1', date: '2023-10-01', shiftType: 'day', actualHours: 8, overtimeHours: 0 },
      { id: '2', date: '2023-10-15', shiftType: 'night', actualHours: 8, overtimeHours: 1 },
      { id: '3', date: '2023-11-01', shiftType: 'day', actualHours: 8, overtimeHours: 0 }, // KhÃ¡c thÃ¡ng
    ];

    const result = calculateMonthlySalary(records, mockConfig, '2023-10');

    expect(result.totalDays).toBe(2);
    expect(result.totalHours).toBe(16);
    expect(result.totalOvertimeHours).toBe(1);
    
    // Day: 8 * 100 = 800
    // Night: 8 * 120 = 960, OT: 1 * 180 = 180, Extra: 2 * 56 = 112. Total = 1252
    // Total Base = 800 + 960 = 1760
    // Total OT = 180, Total Extra = 112
    // Total Salary = 2052
    expect(result.totalBaseSalary).toBe(1760);
    expect(result.totalOvertimeSalary).toBe(180);
    expect(result.totalExtraSalary).toBe(112);
    expect(result.totalSalary).toBe(2052);
  });

  test('resolveShiftRates - Auto mode from base salary', () => {
    const rates = resolveShiftRates(
      {
        calcMode: 'auto',
        baseSalary: 31200000,
        workDayMode: 'custom',
        customWorkDays: 26,
        baseHours: 8,
        baseRate: 0,
        overtimeHours: 2,
        overtimeRate: 0,
        extraHours: 1,
        extraRate: 0,
        overtimeMultiplier: 1.5,
        extraMultiplier: 2,
      },
      '2026-03-01'
    );

    expect(Math.round(rates.baseRate)).toBe(150000);
    expect(Math.round(rates.overtimeRate)).toBe(225000);
    expect(Math.round(rates.extraRate)).toBe(300000);
  });

  test('normalizeConfig - migrate cấu hình 4 ca cũ giữ nguyên số liệu', () => {
    const legacy = {
      day: { baseHours: 9.5, baseRate: 100000, overtimeHours: 1.5, overtimeRate: 150000 },
      night: { baseHours: 9.5, baseRate: 120000, overtimeHours: 1.5, overtimeRate: 180000, allowance: 50000 },
      offDay: { baseHours: 9.5, baseRate: 200000, overtimeHours: 1.5, overtimeRate: 250000 },
      offNight: { baseHours: 9.5, baseRate: 250000, overtimeHours: 1.5, overtimeRate: 300000 },
      taxRate: 5,
    };
    const migrated = normalizeConfig(legacy);

    expect(migrated.shiftOrder).toEqual(['day', 'night', 'offDay', 'offNight']);
    expect(migrated.shifts.night.baseRate).toBe(120000);
    expect(migrated.shifts.night.allowance).toBe(50000);
    expect(migrated.shifts.offDay.isOff).toBe(true);
    expect(migrated.shifts.day.isOff).toBe(false);
    expect(migrated.taxRate).toBe(5);

    // Bản ghi cũ vẫn tính ra cùng một số tiền
    const record: AttendanceRecord = { id: 'x', date: '2023-10-01', shiftType: 'night', actualHours: 9.5, overtimeHours: 0 };
    expect(calculateDailySalary(record, migrated).total).toBe(9.5 * 120000 + 50000);
  });

  test('normalizeConfig - cấu hình mới được giữ nguyên', () => {
    expect(normalizeConfig(mockConfig)).toBe(mockConfig);
  });

  test('calculateDailySalary - ca đã bị xoá tính 0 và không crash', () => {
    const record: AttendanceRecord = { id: 'y', date: '2023-10-01', shiftType: 'deleted-shift', actualHours: 8, overtimeHours: 2 };
    expect(calculateDailySalary(record, mockConfig).total).toBe(0);
  });

  test('calculateMonthlySalary - tính thuế theo taxRate', () => {
    const cfg = { ...mockConfig, taxRate: 10 };
    const records: AttendanceRecord[] = [
      { id: '1', date: '2023-10-01', shiftType: 'day', actualHours: 8, overtimeHours: 0 },
    ];
    const r = calculateMonthlySalary(records, cfg, '2023-10');
    expect(r.totalSalary).toBe(800);
    expect(r.taxAmount).toBe(80);
    expect(r.netSalary).toBe(720);
  });

  // ---- Thuế TNCN + BHXH theo luật 2026 ----
  const oneHourConfig = (rate: number, tax: any): SalaryConfig => ({
    shifts: {
      work: { baseHours: 8, baseRate: rate, overtimeHours: 0, overtimeRate: 0 },
    },
    shiftOrder: ['work'],
    taxRate: 0,
    tax,
  });
  const oneHourRecord = (date: string): AttendanceRecord => ({
    id: 'r', date, shiftType: 'work', actualHours: 1, overtimeHours: 0,
  });
  const progressive: TaxSettings = {
    mode: 'progressive', insuranceEnabled: true, insuranceBasis: 'gross', insuranceSalary: 0,
    region: 1, dependents: 0, exemptPremium: true, normalHourlyRate: 0, otMonthlyCapHours: 40,
  };

  test('TNCN 2026 - 40 triệu, BH 10,5%, không phụ thuộc → thuế 1,53 triệu', () => {
    const r = calculateMonthlySalary([oneHourRecord('2026-08-05')], oneHourConfig(40_000_000, progressive), '2026-08');
    expect(r.insuranceAmount).toBe(4_200_000);
    expect(r.taxableIncome).toBe(20_300_000);
    expect(Math.round(r.taxAmount)).toBe(1_530_000);
    expect(Math.round(r.netSalary)).toBe(34_270_000);
  });

  test('TNCN 2026 - 30 triệu, 1 người phụ thuộc → thuế 257.500', () => {
    const cfg = oneHourConfig(30_000_000, { ...progressive, dependents: 1 });
    const r = calculateMonthlySalary([oneHourRecord('2026-08-05')], cfg, '2026-08');
    expect(r.insuranceAmount).toBe(3_150_000);
    expect(r.taxableIncome).toBe(5_150_000);
    expect(Math.round(r.taxAmount)).toBe(257_500);
  });

  test('TNCN - lương dưới mức giảm trừ thì không phải nộp thuế', () => {
    const r = calculateMonthlySalary([oneHourRecord('2026-08-05')], oneHourConfig(15_000_000, progressive), '2026-08');
    expect(r.taxAmount).toBe(0);
    expect(r.taxableIncome).toBe(0);
  });

  test('TNCN - tháng trước 2026 dùng biểu thuế 7 bậc và giảm trừ 11 triệu', () => {
    const cfg = oneHourConfig(20_000_000, { ...progressive, insuranceEnabled: false });
    const r = calculateMonthlySalary([oneHourRecord('2025-06-05')], cfg, '2025-06');
    expect(r.taxableIncome).toBe(9_000_000);
    expect(Math.round(r.taxAmount)).toBe(650_000);
  });

  test('BHXH - áp trần 50,6 triệu (BHXH, BHYT) và 106,2 triệu (BHTN, vùng I) từ 7/2026', () => {
    const r = calculateMonthlySalary([oneHourRecord('2026-08-05')], oneHourConfig(100_000_000, progressive), '2026-08');
    expect(Math.round(r.insuranceBreakdown.bhxh)).toBe(4_048_000);
    expect(Math.round(r.insuranceBreakdown.bhyt)).toBe(759_000);
    expect(Math.round(r.insuranceBreakdown.bhtn)).toBe(1_000_000);
  });

  test('BHXH - mức lương đóng cố định thay vì theo tổng thu nhập', () => {
    const cfg = oneHourConfig(20_000_000, { ...progressive, insuranceBasis: 'fixed', insuranceSalary: 8_000_000 });
    const r = calculateMonthlySalary([oneHourRecord('2026-08-05')], cfg, '2026-08');
    expect(r.insuranceAmount).toBe(840_000);
  });

  test('Miễn thuế phụ trội ca đêm và tăng ca (trần 40 giờ/tháng)', () => {
    const cfg: SalaryConfig = {
      shifts: {
        day: { baseHours: 8, baseRate: 100_000, overtimeHours: 0, overtimeRate: 150_000 },
        night: { baseHours: 8, baseRate: 130_000, overtimeHours: 0, overtimeRate: 200_000, isNight: true },
      },
      shiftOrder: ['day', 'night'],
      taxRate: 0,
      tax: { ...progressive, insuranceEnabled: false },
    };
    const records: AttendanceRecord[] = [
      { id: 'n', date: '2026-08-01', shiftType: 'night', actualHours: 8, overtimeHours: 0 },
      { id: 'o', date: '2026-08-02', shiftType: 'day', actualHours: 8, overtimeHours: 50 },
    ];
    const r = calculateMonthlySalary(records, cfg, '2026-08');
    // Đêm: (130k-100k) x 8h = 240k. Tăng ca: (150k-100k) x 40h (trần) = 2.000k
    expect(r.exemptAmount).toBe(2_240_000);
  });

  test('Cấu hình cũ chỉ có taxRate vẫn khấu trừ cố định như trước', () => {
    const cfg = { ...mockConfig, taxRate: 10 };
    const r = calculateMonthlySalary(
      [{ id: '1', date: '2023-10-01', shiftType: 'day', actualHours: 8, overtimeHours: 0 }], cfg, '2023-10');
    expect(r.taxMode).toBe('flat');
    expect(r.taxAmount).toBe(80);
    expect(r.insuranceAmount).toBe(0);
  });

  // ---- Giờ vào / ra của ca (chấm công nhanh) ----
  const shiftWith = (startTime?: string, endTime?: string, breakMinutes = 0, baseHours = 8) => ({
    baseHours, baseRate: 100, overtimeHours: 0, overtimeRate: 150, startTime, endTime, breakMinutes,
  });

  test('parseTime / formatTime', () => {
    expect(parseTime('07:30')).toBe(450);
    expect(parseTime('7:05')).toBe(425);
    expect(parseTime('24:00')).toBe(null);
    expect(parseTime('abc')).toBe(null);
    expect(parseTime(undefined)).toBe(null);
    expect(formatTime(450)).toBe('07:30');
    expect(formatTime(1440 + 60)).toBe('01:00');
    expect(formatTime(-60)).toBe('23:00');
  });

  test('getScheduledHours - ca ngày 07:00-15:00 = 8 giờ', () => {
    expect(getScheduledHours(shiftWith('07:00', '15:00'))).toBe(8);
  });

  test('getScheduledHours - ca đêm qua nửa đêm 22:00-06:00 = 8 giờ', () => {
    expect(getScheduledHours(shiftWith('22:00', '06:00'))).toBe(8);
  });

  test('getScheduledHours - trừ nghỉ giữa ca (08:00-17:00 nghỉ 60 phút = 8 giờ)', () => {
    expect(getScheduledHours(shiftWith('08:00', '17:00', 60))).toBe(8);
  });

  test('getScheduledHours - chưa cài hoặc giờ vào trùng giờ ra thì null', () => {
    expect(getScheduledHours(shiftWith())).toBe(null);
    expect(getScheduledHours(shiftWith('08:00', '08:00'))).toBe(null);
  });

  test('splitScheduledHours - phần vượt giờ cơ bản thành tăng ca', () => {
    const r = splitScheduledHours(shiftWith('07:00', '17:30', 0, 8));
    expect(r).toEqual({ total: 10.5, actualHours: 8, overtimeHours: 2.5 });
    const short = splitScheduledHours(shiftWith('08:00', '12:00', 0, 8));
    expect(short).toEqual({ total: 4, actualHours: 4, overtimeHours: 0 });
  });

  test('buildShiftTimestamps - ca đêm kết thúc vào ngày hôm sau', () => {
    const t = buildShiftTimestamps('2026-11-30', shiftWith('22:00', '06:00'))!;
    expect(t.checkIn.getDate()).toBe(30);
    expect(t.checkIn.getHours()).toBe(22);
    expect(t.checkOut.getMonth()).toBe(11);
    expect(t.checkOut.getDate()).toBe(1);
    expect(t.checkOut.getHours()).toBe(6);
    expect(buildShiftTimestamps('2026-11-30', shiftWith())).toBe(null);
  });
});
