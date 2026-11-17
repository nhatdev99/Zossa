import {
  AttendanceRecord,
  SalaryConfig,
  calculateDailySalary,
  calculateMonthlySalary,
  getShiftColor,
  getShiftName,
} from './salaryCalculator';
import { BRAND } from '../config/brand';
import { Cell, CellStyle, Sheet, buildXlsx, colLetter, excelDate, tint } from './xlsx';

// Bảng màu thương hiệu
const GREEN = '0B6E5B';
const INK = '16191C';
const MUTED = '666C72';
const LINE = 'D8D3C6';
const ZEBRA = 'F6F8F7';
const SOFT_GREEN = 'DDEFE9';
const SOFT_AMBER = 'FBEBD0';
const RED = 'B3261E';
const GREY = '9AA0A6';

const MONEY = '#,##0';
const MONEY_DASH = '#,##0;-#,##0;"–"';
const HOURS = '0.0';
const HOURS_DASH = '0.0;-0.0;"–"';
const MONEY_VND = '#,##0 "₫"';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const round2 = (v: number) => Math.round(v * 100) / 100;
const roundMoney = (v: number) => Math.round(v);

const title = (text: string, span: number, row = 1): { cell: Cell[]; merge: string } => ({
  cell: [{ v: text, s: { bold: true, size: 16, color: GREEN, valign: 'center' } }],
  merge: `A${row}:${colLetter(span - 1)}${row}`,
});

const header = (labels: string[]): Cell[] =>
  labels.map((v) => ({
    v,
    s: {
      bold: true,
      color: 'FFFFFF',
      fill: GREEN,
      halign: 'center',
      valign: 'center',
      wrap: true,
      border: 'all',
      borderColor: GREEN,
    } as CellStyle,
  }));

const exportedLine = (at: Date) =>
  `${BRAND} · xuất ngày ${pad2(at.getDate())}/${pad2(at.getMonth() + 1)}/${at.getFullYear()} · số liệu ước tính, chỉ để tham khảo`;

/** Bảng chấm công chi tiết + tổng kết của một tháng (YYYY-MM). */
export function buildMonthXlsx(
  records: AttendanceRecord[],
  config: SalaryConfig,
  month: string,
  exportedAt: Date = new Date()
): Uint8Array {
  const [yy, mm] = month.split('-');
  const monthRecords = records
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  const m = calculateMonthlySalary(records, config, month);

  // ---- Sheet 1: chi tiết ----
  const cols = 11;
  const t1 = title(`Bảng chấm công và lương · Tháng ${mm}/${yy}`, cols);
  const detailRows: (Cell | null)[][] = [
    t1.cell,
    [{ v: exportedLine(exportedAt), s: { italic: true, size: 9, color: MUTED } }],
    [],
    header([
      'Ngày', 'Thứ', 'Ca', 'Giờ làm', 'Giờ tăng ca', 'Lương cơ bản (₫)', 'Tăng ca (₫)',
      'Giờ phụ (₫)', 'Phụ cấp (₫)', 'Tổng ngày (₫)', 'Ghi chú',
    ]),
  ];

  const first = detailRows.length + 1;
  monthRecords.forEach((r, i) => {
    const d = calculateDailySalary(r, config);
    const [y, mo, da] = r.date.split('-').map(Number);
    const base = { border: 'all', borderColor: LINE, fill: i % 2 ? ZEBRA : undefined, valign: 'center' } as CellStyle;
    const shiftColor = getShiftColor(config, r.shiftType, GREEN);
    detailRows.push([
      { v: excelDate(r.date), s: { ...base, numFmt: 'dd/mm/yyyy', halign: 'center' } },
      { v: WEEKDAYS[new Date(y, mo - 1, da).getDay()], s: { ...base, halign: 'center', color: MUTED } },
      { v: getShiftName(config, r.shiftType), s: { ...base, fill: tint(shiftColor, 0.8), bold: true, halign: 'left' } },
      { v: round2(r.actualHours), s: { ...base, numFmt: HOURS, halign: 'center' } },
      { v: round2(r.overtimeHours), s: { ...base, numFmt: HOURS, halign: 'center' } },
      { v: roundMoney(d.base), s: { ...base, numFmt: MONEY, halign: 'right' } },
      { v: roundMoney(d.ot), s: { ...base, numFmt: MONEY, halign: 'right' } },
      { v: roundMoney(d.extra), s: { ...base, numFmt: MONEY, halign: 'right' } },
      { v: roundMoney(d.allowance), s: { ...base, numFmt: MONEY, halign: 'right' } },
      { v: roundMoney(d.total), s: { ...base, numFmt: MONEY, halign: 'right', bold: true } },
      { v: r.note ?? '', s: { ...base, halign: 'left', wrap: true } },
    ]);
  });

  const merges = [t1.merge, `A2:${colLetter(cols - 1)}2`];
  const last = detailRows.length;
  if (monthRecords.length) {
    const totalStyle: CellStyle = {
      bold: true, fill: SOFT_GREEN, border: 'all', borderColor: GREEN, borderStyle: 'medium', valign: 'center',
    };
    const sum = (c: number, vals: number[], fmt: string): Cell => ({
      f: `SUM(${colLetter(c)}${first}:${colLetter(c)}${last})`,
      v: vals.reduce((a, b) => a + b, 0),
      s: { ...totalStyle, numFmt: fmt, halign: c <= 4 ? 'center' : 'right' },
    });
    const days = monthRecords.map((r) => calculateDailySalary(r, config));
    detailRows.push([
      { v: `Tổng cộng · ${monthRecords.length} ngày công`, s: { ...totalStyle, halign: 'left' } },
      { s: totalStyle },
      { s: totalStyle },
      sum(3, monthRecords.map((r) => round2(r.actualHours)), HOURS),
      sum(4, monthRecords.map((r) => round2(r.overtimeHours)), HOURS),
      sum(5, days.map((d) => roundMoney(d.base)), MONEY),
      sum(6, days.map((d) => roundMoney(d.ot)), MONEY),
      sum(7, days.map((d) => roundMoney(d.extra)), MONEY),
      sum(8, days.map((d) => roundMoney(d.allowance)), MONEY),
      sum(9, days.map((d) => roundMoney(d.total)), MONEY),
      { s: totalStyle },
    ]);
    merges.push(`A${detailRows.length}:C${detailRows.length}`);
  } else {
    detailRows.push([{ v: 'Tháng này chưa có ngày chấm công nào.', s: { italic: true, color: MUTED } }]);
    merges.push(`A${detailRows.length}:${colLetter(cols - 1)}${detailRows.length}`);
  }

  const detail: Sheet = {
    name: 'Chi tiết',
    rows: detailRows,
    colWidths: [13, 7, 18, 10, 12, 17, 14, 13, 14, 16, 28],
    rowHeights: { 1: 32, 3: 6, 4: 34 },
    merges,
    freezeRows: 4,
    landscape: true,
    showGridLines: false,
  };

  // ---- Sheet 2: tổng kết ----
  const t2 = title(`Tổng kết lương · Tháng ${mm}/${yy}`, 2);
  const section = (label: string): Cell[] => [
    { v: label, s: { bold: true, color: 'FFFFFF', fill: GREEN, valign: 'center' } },
    { s: { fill: GREEN } },
  ];
  const line = (label: string, value: number, opts: { bold?: boolean; fill?: string; negative?: boolean; fmt?: string; top?: boolean } = {}): Cell[] => {
    const s: CellStyle = {
      border: opts.top ? 'topBottom' : 'bottom',
      borderColor: opts.top ? GREEN : LINE,
      fill: opts.fill,
      bold: opts.bold,
      valign: 'center',
    };
    return [
      { v: label, s: { ...s, halign: 'left' } },
      { v: value, s: { ...s, halign: 'right', numFmt: opts.fmt ?? MONEY_VND, color: opts.negative ? RED : INK } },
    ];
  };

  const sumRows: (Cell | null)[][] = [t2.cell, [{ v: exportedLine(exportedAt), s: { italic: true, size: 9, color: MUTED } }], []];
  sumRows.push(section('THU NHẬP'));
  sumRows.push(line('Số ngày công', m.totalDays, { fmt: '0' }));
  sumRows.push(line('Lương cơ bản', roundMoney(m.totalBaseSalary)));
  sumRows.push(line('Tăng ca', roundMoney(m.totalOvertimeSalary)));
  sumRows.push(line('Giờ phụ và phụ cấp', roundMoney(m.totalExtraSalary + m.totalAllowanceSalary)));
  sumRows.push(line('Tổng thu nhập (Gross)', roundMoney(m.totalSalary), { bold: true, fill: SOFT_GREEN, top: true }));

  if (m.insuranceAmount > 0 || m.taxAmount > 0) {
    sumRows.push([]);
    sumRows.push(section('KHẤU TRỪ'));
    if (m.insuranceAmount > 0) {
      sumRows.push(line('BHXH (8%)', roundMoney(m.insuranceBreakdown.bhxh), { negative: true }));
      sumRows.push(line('BHYT (1,5%)', roundMoney(m.insuranceBreakdown.bhyt), { negative: true }));
      sumRows.push(line('BHTN (1%)', roundMoney(m.insuranceBreakdown.bhtn), { negative: true }));
    }
    if (m.taxMode === 'progressive') {
      sumRows.push(line('Thuế TNCN', roundMoney(m.taxAmount), { negative: true }));
    } else if (m.taxMode === 'flat') {
      sumRows.push(line(`Khấu trừ cố định (${config.taxRate || 0}%)`, roundMoney(m.taxAmount), { negative: true }));
    }
  }

  if (m.taxMode === 'progressive') {
    sumRows.push([]);
    sumRows.push(section('TÍNH THUẾ TNCN'));
    sumRows.push(line('Phụ trội đêm, tăng ca (miễn thuế)', roundMoney(m.exemptAmount)));
    sumRows.push(line('Giảm trừ gia cảnh', roundMoney(m.personalDeduction + m.dependentDeduction)));
    sumRows.push(line('Thu nhập tính thuế', roundMoney(m.taxableIncome), { bold: true, top: true }));
  }

  sumRows.push([]);
  const netRowIndex = sumRows.length + 1;
  sumRows.push([
    { v: 'THỰC NHẬN', s: { bold: true, size: 14, color: 'FFFFFF', fill: GREEN, valign: 'center', halign: 'left' } },
    { v: roundMoney(m.netSalary), s: { bold: true, size: 14, color: 'FFFFFF', fill: GREEN, valign: 'center', halign: 'right', numFmt: MONEY_VND } },
  ]);

  const summary: Sheet = {
    name: 'Tổng kết',
    rows: sumRows,
    colWidths: [40, 24],
    rowHeights: { 1: 32, [netRowIndex]: 34 },
    merges: [t2.merge, 'A2:B2'],
    showGridLines: false,
  };
  // Khoảng trắng giữa các phần thấp hơn
  sumRows.forEach((row, i) => {
    if (row.length === 0) summary.rowHeights![i + 1] = 10;
  });

  return buildXlsx([detail, summary]);
}

/** Bảng tổng hợp 12 tháng của một năm (YYYY). */
export function buildYearXlsx(
  records: AttendanceRecord[],
  config: SalaryConfig,
  year: string,
  exportedAt: Date = new Date()
): Uint8Array {
  const cols = 10;
  const t = title(`Tổng hợp lương năm ${year}`, cols);
  const rows: (Cell | null)[][] = [
    t.cell,
    [{ v: exportedLine(exportedAt), s: { italic: true, size: 9, color: MUTED } }],
    [],
    header([
      'Tháng', 'Ngày công', 'Giờ làm', 'Giờ tăng ca', 'Gross (₫)', 'Bảo hiểm (₫)',
      'Miễn thuế (₫)', 'Thu nhập tính thuế (₫)', 'Thuế (₫)', 'Thực nhận (₫)',
    ]),
  ];

  const months = Array.from({ length: 12 }, (_, i) =>
    calculateMonthlySalary(records, config, `${year}-${pad2(i + 1)}`)
  );
  const withData = months.map((m, i) => ({ m, i })).filter(({ m }) => m.totalDays > 0);
  const best = withData.length > 1 ? withData.reduce((a, b) => (b.m.netSalary > a.m.netSalary ? b : a)) : null;
  const worst = withData.length > 1 ? withData.reduce((a, b) => (b.m.netSalary < a.m.netSalary ? b : a)) : null;

  const first = rows.length + 1;
  months.forEach((m, i) => {
    const has = m.totalDays > 0;
    const base: CellStyle = {
      border: 'all', borderColor: LINE, fill: i % 2 ? ZEBRA : undefined, valign: 'center', color: has ? INK : GREY,
    };
    const netStyle: CellStyle = {
      ...base, numFmt: MONEY_DASH, halign: 'right', bold: true,
      fill: best && best.i === i ? SOFT_GREEN : worst && worst.i === i ? SOFT_AMBER : base.fill,
    };
    rows.push([
      { v: `Tháng ${i + 1}`, s: { ...base, halign: 'left', bold: has } },
      { v: m.totalDays, s: { ...base, numFmt: '0;-0;"–"', halign: 'center' } },
      { v: round2(m.totalHours), s: { ...base, numFmt: HOURS_DASH, halign: 'center' } },
      { v: round2(m.totalOvertimeHours), s: { ...base, numFmt: HOURS_DASH, halign: 'center' } },
      { v: roundMoney(m.totalSalary), s: { ...base, numFmt: MONEY_DASH, halign: 'right' } },
      { v: roundMoney(m.insuranceAmount), s: { ...base, numFmt: MONEY_DASH, halign: 'right' } },
      { v: roundMoney(m.exemptAmount), s: { ...base, numFmt: MONEY_DASH, halign: 'right' } },
      { v: roundMoney(m.taxableIncome), s: { ...base, numFmt: MONEY_DASH, halign: 'right' } },
      { v: roundMoney(m.taxAmount), s: { ...base, numFmt: MONEY_DASH, halign: 'right' } },
      { v: roundMoney(m.netSalary), s: netStyle },
    ]);
  });
  const last = rows.length;

  const totalStyle: CellStyle = {
    bold: true, fill: SOFT_GREEN, border: 'all', borderColor: GREEN, borderStyle: 'medium', valign: 'center',
  };
  const sum = (c: number, v: number, fmt: string, halign: 'center' | 'right'): Cell => ({
    f: `SUM(${colLetter(c)}${first}:${colLetter(c)}${last})`,
    v,
    s: { ...totalStyle, numFmt: fmt, halign },
  });
  const tot = {
    days: months.reduce((s, m) => s + m.totalDays, 0),
    hours: round2(months.reduce((s, m) => s + m.totalHours, 0)),
    ot: round2(months.reduce((s, m) => s + m.totalOvertimeHours, 0)),
    gross: roundMoney(months.reduce((s, m) => s + roundMoney(m.totalSalary), 0)),
    ins: roundMoney(months.reduce((s, m) => s + roundMoney(m.insuranceAmount), 0)),
    exempt: roundMoney(months.reduce((s, m) => s + roundMoney(m.exemptAmount), 0)),
    taxable: roundMoney(months.reduce((s, m) => s + roundMoney(m.taxableIncome), 0)),
    tax: roundMoney(months.reduce((s, m) => s + roundMoney(m.taxAmount), 0)),
    net: roundMoney(months.reduce((s, m) => s + roundMoney(m.netSalary), 0)),
  };
  rows.push([
    { v: `Cả năm ${year}`, s: { ...totalStyle, halign: 'left' } },
    sum(1, tot.days, '0', 'center'),
    sum(2, tot.hours, HOURS, 'center'),
    sum(3, tot.ot, HOURS, 'center'),
    sum(4, tot.gross, MONEY, 'right'),
    sum(5, tot.ins, MONEY, 'right'),
    sum(6, tot.exempt, MONEY, 'right'),
    sum(7, tot.taxable, MONEY, 'right'),
    sum(8, tot.tax, MONEY, 'right'),
    sum(9, tot.net, MONEY, 'right'),
  ]);

  const stat = (label: string, value: Cell): (Cell | null)[] => [
    { v: label, s: { color: MUTED, valign: 'center' } },
    null, null, null, null, null, null, null,
    { s: { valign: 'center' } },
    value,
  ];
  rows.push([]);
  const avg = withData.length ? roundMoney(tot.net / withData.length) : 0;
  rows.push(
    stat('Trung bình mỗi tháng có dữ liệu (thực nhận)', {
      f: `IFERROR(AVERAGEIF(${colLetter(1)}${first}:${colLetter(1)}${last},">0",${colLetter(9)}${first}:${colLetter(9)}${last}),0)`,
      v: avg,
      s: { numFmt: MONEY, halign: 'right', bold: true },
    })
  );
  if (best && worst) {
    rows.push(stat(`Tháng cao nhất: Tháng ${best.i + 1}`, { v: roundMoney(best.m.netSalary), s: { numFmt: MONEY, halign: 'right', fill: SOFT_GREEN, bold: true } }));
    rows.push(stat(`Tháng thấp nhất: Tháng ${worst.i + 1}`, { v: roundMoney(worst.m.netSalary), s: { numFmt: MONEY, halign: 'right', fill: SOFT_AMBER, bold: true } }));
  }

  const merges = [t.merge, `A2:${colLetter(cols - 1)}2`];
  // Nhãn thống kê gộp từ cột A đến I
  for (let r = last + 3; r <= rows.length; r++) merges.push(`A${r}:I${r}`);

  const sheet: Sheet = {
    name: `Năm ${year}`,
    rows,
    colWidths: [16, 11, 10, 12, 16, 15, 15, 20, 14, 17],
    rowHeights: { 1: 32, 3: 6, 4: 36 },
    merges,
    freezeRows: 4,
    landscape: true,
    showGridLines: false,
  };
  return buildXlsx([sheet]);
}
