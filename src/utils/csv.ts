import {
  AttendanceRecord,
  SalaryConfig,
  calculateDailySalary,
  calculateMonthlySalary,
  getShiftName,
} from './salaryCalculator';

export type CsvSeparator = ',' | ';';

const cell = (value: string | number, sep: CsvSeparator): string => {
  const text = String(value);
  if (text.includes(sep) || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

// Excel tiếng Việt dùng dấu phẩy làm dấu thập phân khi phân cách cột là ";"
const num = (value: number, sep: CsvSeparator): string => {
  const rounded = Math.round(value * 100) / 100;
  const text = String(rounded);
  return sep === ';' ? text.replace('.', ',') : text;
};

const money = (value: number) => Math.round(value);

const line = (cells: (string | number)[], sep: CsvSeparator) => cells.map((c) => cell(c, sep)).join(sep);

/** Chi tiết chấm công và lương từng ngày trong một tháng (YYYY-MM), kèm tổng kết cuối file. */
export function buildMonthCsv(
  records: AttendanceRecord[],
  config: SalaryConfig,
  month: string,
  sep: CsvSeparator = ';'
): string {
  const rows: string[] = [];
  rows.push(
    line(
      ['Ngày', 'Ca', 'Giờ làm', 'Giờ tăng ca', 'Lương cơ bản', 'Tăng ca', 'Giờ phụ', 'Phụ cấp', 'Tổng ngày', 'Ghi chú'],
      sep
    )
  );

  records
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((r) => {
      const d = calculateDailySalary(r, config);
      rows.push(
        line(
          [
            r.date,
            getShiftName(config, r.shiftType),
            num(r.actualHours, sep),
            num(r.overtimeHours, sep),
            money(d.base),
            money(d.ot),
            money(d.extra),
            money(d.allowance),
            money(d.total),
            r.note ?? '',
          ],
          sep
        )
      );
    });

  const m = calculateMonthlySalary(records, config, month);
  rows.push('');
  rows.push(line(['Tổng kết tháng', month], sep));
  rows.push(line(['Số ngày công', m.totalDays], sep));
  rows.push(line(['Tổng thu nhập (Gross)', money(m.totalSalary)], sep));
  rows.push(line(['BHXH', money(m.insuranceBreakdown.bhxh)], sep));
  rows.push(line(['BHYT', money(m.insuranceBreakdown.bhyt)], sep));
  rows.push(line(['BHTN', money(m.insuranceBreakdown.bhtn)], sep));
  rows.push(line(['Phụ trội miễn thuế', money(m.exemptAmount)], sep));
  rows.push(line(['Giảm trừ gia cảnh', money(m.personalDeduction + m.dependentDeduction)], sep));
  rows.push(line(['Thu nhập tính thuế', money(m.taxableIncome)], sep));
  rows.push(line(['Thuế', money(m.taxAmount)], sep));
  rows.push(line(['Thực nhận', money(m.netSalary)], sep));
  return rows.join('\r\n');
}

/** Tổng hợp 12 tháng của một năm (YYYY), mỗi tháng một dòng, kèm dòng tổng cả năm. */
export function buildYearCsv(
  records: AttendanceRecord[],
  config: SalaryConfig,
  year: string,
  sep: CsvSeparator = ';'
): string {
  const rows: string[] = [];
  rows.push(
    line(
      [
        'Tháng', 'Số ngày công', 'Giờ làm', 'Giờ tăng ca', 'Tổng thu nhập (Gross)',
        'Bảo hiểm', 'Phụ trội miễn thuế', 'Thu nhập tính thuế', 'Thuế', 'Thực nhận',
      ],
      sep
    )
  );

  const total = { days: 0, hours: 0, ot: 0, gross: 0, ins: 0, exempt: 0, taxable: 0, tax: 0, net: 0 };
  for (let i = 1; i <= 12; i++) {
    const month = `${year}-${String(i).padStart(2, '0')}`;
    const m = calculateMonthlySalary(records, config, month);
    total.days += m.totalDays;
    total.hours += m.totalHours;
    total.ot += m.totalOvertimeHours;
    total.gross += m.totalSalary;
    total.ins += m.insuranceAmount;
    total.exempt += m.exemptAmount;
    total.taxable += m.taxableIncome;
    total.tax += m.taxAmount;
    total.net += m.netSalary;
    rows.push(
      line(
        [
          month, m.totalDays, num(m.totalHours, sep), num(m.totalOvertimeHours, sep),
          money(m.totalSalary), money(m.insuranceAmount), money(m.exemptAmount),
          money(m.taxableIncome), money(m.taxAmount), money(m.netSalary),
        ],
        sep
      )
    );
  }
  rows.push(
    line(
      [
        `Cả năm ${year}`, total.days, num(total.hours, sep), num(total.ot, sep),
        money(total.gross), money(total.ins), money(total.exempt),
        money(total.taxable), money(total.tax), money(total.net),
      ],
      sep
    )
  );
  return rows.join('\r\n');
}
