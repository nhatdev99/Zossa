import { applyCompanyPreset, NIDEC_PRESET, previewShiftRates } from '../companyPresets';
import { AttendanceRecord, SalaryConfig, calculateDailySalary } from '../salaryCalculator';

describe('Công thức công ty: Nidec Việt Nam', () => {
  // 10.450.000 / 22 = 475.000 một ngày; / 9,5 = 50.000 một giờ
  const input = { baseSalary: 10_450_000, workDays: 22 };
  const empty: SalaryConfig = { shifts: {}, shiftOrder: [], taxRate: 0 };

  test('xem trước: giờ cơ bản 50.000, tăng ca ngày 75.000, tăng ca đêm 105.000', () => {
    const p = NIDEC_PRESET.preview(input);
    expect(p.dailyPay).toBe(475_000);
    expect(p.hourly).toBe(50_000);
    expect(p.dayOvertime).toBe(75_000);
    expect(p.nightOvertime).toBe(105_000);
    expect(p.offDay).toBe(150_000);
    expect(p.offNight).toBe(210_000);
  });

  test('áp dụng: tạo ca ngày và ca đêm với hệ số 1,5 và 2,1', () => {
    const cfg = applyCompanyPreset(empty, 'nidec', input);
    expect(cfg.shiftOrder).toEqual(['day', 'night', 'offDay', 'offNight']);
    const day = previewShiftRates(cfg.shifts.day, '2026-11-10');
    const night = previewShiftRates(cfg.shifts.night, '2026-11-10');
    expect(day.baseRate).toBe(50_000);
    expect(day.overtimeRate).toBe(75_000);
    expect(night.baseRate).toBe(50_000);
    expect(night.overtimeRate).toBe(105_000);
    expect(cfg.shifts.night.isNight).toBe(true);
    expect(cfg.company).toEqual({
      id: 'nidec', baseSalary: 10_450_000, workDays: 22, offMultiplier: undefined, includeOffDays: true,
    });
  });

  test('ngày nghỉ: đơn giá = giờ tăng ca x 2 (ca ngày 150.000, ca đêm 210.000), mọi giờ cùng đơn giá', () => {
    const cfg = applyCompanyPreset(empty, 'nidec', input);
    const offDay = previewShiftRates(cfg.shifts.offDay, '2026-11-10');
    const offNight = previewShiftRates(cfg.shifts.offNight, '2026-11-10');
    expect(offDay.baseRate).toBe(150_000);
    expect(offDay.overtimeRate).toBe(150_000);
    expect(offNight.baseRate).toBe(210_000);
    expect(offNight.overtimeRate).toBe(210_000);
    expect(cfg.shifts.offDay.isOff).toBe(true);
    expect(cfg.shifts.offNight.isNight).toBe(true);
    const rec = (shiftType: string): AttendanceRecord => ({
      id: shiftType, date: '2026-11-10', shiftType, actualHours: 9.5, overtimeHours: 2,
    });
    // 11,5 giờ x 150.000 và 11,5 giờ x 210.000
    expect(calculateDailySalary(rec('offDay'), cfg).total).toBe(1_725_000);
    expect(calculateDailySalary(rec('offNight'), cfg).total).toBe(2_415_000);
  });

  test('ngày nghỉ: đổi hệ số ngày nghỉ (x3) và tắt công thức ngày nghỉ', () => {
    const x3 = applyCompanyPreset(empty, 'nidec', { ...input, offMultiplier: 3 });
    expect(previewShiftRates(x3.shifts.offDay, '2026-11-10').baseRate).toBe(225_000);

    const off: SalaryConfig = { ...empty, shifts: { offDay: { name: 'Nghỉ cũ', isOff: true, baseHours: 8, baseRate: 1, overtimeHours: 0, overtimeRate: 1 } }, shiftOrder: ['offDay'] };
    const without = applyCompanyPreset(off, 'nidec', { ...input, includeOffDays: false });
    expect(without.shiftOrder).toEqual(['day', 'night', 'offDay']);
    expect(without.shifts.offDay).toBe(off.shifts.offDay);
    expect(without.shifts.offNight).toBe(undefined);
  });

  test('lương một ngày: ca ngày 9,5 giờ + 2 giờ tăng ca = 625.000; ca đêm = 685.000', () => {
    const cfg = applyCompanyPreset(empty, 'nidec', input);
    const rec = (shiftType: string): AttendanceRecord => ({
      id: shiftType, date: '2026-11-10', shiftType, actualHours: 9.5, overtimeHours: 2,
    });
    expect(calculateDailySalary(rec('day'), cfg).total).toBe(625_000);
    expect(calculateDailySalary(rec('night'), cfg).total).toBe(685_000);
  });

  test('áp dụng lên cấu hình có sẵn: giữ giờ vào ra, phụ cấp, giờ phụ, các ca khác và thuế', () => {
    const existing: SalaryConfig = {
      shifts: {
        night: {
          name: 'Ca đêm của tôi', baseHours: 9.5, baseRate: 120000, overtimeHours: 1.5, overtimeRate: 180000,
          extraHours: 2, extraRate: 56000, allowance: 50000, startTime: '19:00', endTime: '07:00', breakMinutes: 60,
        },
        offDay: { name: 'Nghỉ', isOff: true, baseHours: 9.5, baseRate: 200000, overtimeHours: 0, overtimeRate: 250000 },
      },
      shiftOrder: ['offDay', 'night'],
      taxRate: 5,
    };
    const cfg = applyCompanyPreset(existing, 'nidec', input);
    expect(cfg.shiftOrder).toEqual(['day', 'night', 'offDay', 'offNight']);
    // Ca nghỉ giữ tên đã đặt, đơn giá theo công thức mới
    expect(cfg.shifts.offDay.name).toBe('Nghỉ');
    expect(cfg.shifts.offDay.baseRate).toBe(150_000);
    expect(cfg.taxRate).toBe(5);
    const n = cfg.shifts.night;
    expect(n.name).toBe('Ca đêm của tôi');
    expect(n.allowance).toBe(50000);
    expect(n.startTime).toBe('19:00');
    expect(n.breakMinutes).toBe(60);
    // Giờ phụ giữ nguyên 56.000 mỗi giờ dù đã chuyển sang chế độ tự động
    expect(Math.round(previewShiftRates(n, '2026-11-10').extraRate)).toBe(56000);
  });
});
