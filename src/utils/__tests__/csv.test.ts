import { buildMonthCsv, buildYearCsv } from '../csv';
import { AttendanceRecord, SalaryConfig } from '../salaryCalculator';

describe('CSV export', () => {
  const config: SalaryConfig = {
    shifts: { work: { name: 'Ca "sáng"', baseHours: 8, baseRate: 100000, overtimeHours: 0, overtimeRate: 150000 } },
    shiftOrder: ['work'],
    taxRate: 0,
  };
  const records: AttendanceRecord[] = [
    { id: '2', date: '2026-03-02', shiftType: 'work', actualHours: 8.5, overtimeHours: 1, note: 'ghi chú; có dấu' },
    { id: '1', date: '2026-03-01', shiftType: 'work', actualHours: 8, overtimeHours: 0 },
    { id: '3', date: '2026-04-01', shiftType: 'work', actualHours: 8, overtimeHours: 0 },
  ];

  test('tháng: sắp xếp theo ngày, escape ngoặc kép và dấu phân cách, dấu phẩy thập phân khi dùng ;', () => {
    const lines = buildMonthCsv(records, config, '2026-03', ';').split('\r\n');
    expect(lines[0].split(';')[0]).toBe('Ngày');
    expect(lines[1].startsWith('2026-03-01;"Ca ""sáng""";8;0;800000')).toBe(true);
    expect(lines[2]).toContain('8,5;1;850000;150000');
    expect(lines[2]).toContain('"ghi chú; có dấu"');
    expect(lines.some((l) => l.startsWith('Thực nhận;'))).toBe(true);
    expect(lines.filter((l) => l.startsWith('2026-04')).length).toBe(0);
  });

  test('tháng: phân cách là dấu phẩy thì số thập phân dùng dấu chấm', () => {
    const csv = buildMonthCsv(records, config, '2026-03', ',');
    expect(csv).toContain(',8.5,1,');
  });

  test('năm: đủ 12 tháng + dòng tổng, khớp từng tháng', () => {
    const lines = buildYearCsv(records, config, '2026', ';').split('\r\n');
    expect(lines.length).toBe(1 + 12 + 1);
    const total = lines[lines.length - 1].split(';');
    expect(total[0]).toBe('Cả năm 2026');
    expect(total[1]).toBe('3');
    const march = lines[3].split(';');
    expect(march[0]).toBe('2026-03');
    expect(march[1]).toBe('2');
  });
});
