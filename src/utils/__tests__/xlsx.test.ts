import { buildXlsx, colLetter, crc32, excelDate, tint, zipStore } from '../xlsx';
import { buildMonthXlsx, buildYearXlsx } from '../xlsxReports';
import { AttendanceRecord, SalaryConfig } from '../salaryCalculator';

const enc = (text: string): Uint8Array =>
  Uint8Array.from(unescape(encodeURIComponent(text)), (c) => c.charCodeAt(0));
const dec = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(s));
};

// Đọc danh sách file trong zip (central directory) để kiểm tra cấu trúc
const listZip = (bytes: Uint8Array) => {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: { name: string; crc: number; size: number; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec(bytes.slice(p + 46, p + 46 + nameLen));
    out.push({ name, crc, size, offset });
    p += 46 + nameLen;
  }
  return out;
};
const readEntry = (bytes: Uint8Array, e: { size: number; offset: number }) => {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nameLen = v.getUint16(e.offset + 26, true);
  const start = e.offset + 30 + nameLen;
  return bytes.slice(start, start + e.size);
};

describe('Bộ ghi Excel (.xlsx)', () => {
  const config: SalaryConfig = {
    shifts: { work: { name: 'Ca <A&B>', color: '#FF9800', baseHours: 8, baseRate: 100000, overtimeHours: 0, overtimeRate: 150000 } },
    shiftOrder: ['work'],
    taxRate: 0,
  };
  const records: AttendanceRecord[] = [
    { id: '1', date: '2026-03-01', shiftType: 'work', actualHours: 8, overtimeHours: 1, note: 'ghi chú "đặc biệt" & <test>' },
    { id: '2', date: '2026-03-02', shiftType: 'work', actualHours: 8.5, overtimeHours: 0 },
  ];

  test('CRC32 đúng với giá trị chuẩn', () => {
    expect(crc32(enc('123456789'))).toBe(0xcbf43926);
  });

  test('colLetter và excelDate', () => {
    expect(colLetter(0)).toBe('A');
    expect(colLetter(25)).toBe('Z');
    expect(colLetter(26)).toBe('AA');
    expect(excelDate('1900-03-01')).toBe(61);
    expect(excelDate('2026-01-01')).toBe(46023);
  });

  test('tint pha màu với trắng', () => {
    expect(tint('#000000', 1)).toBe('FFFFFF');
    expect(tint('#FF9800', 0)).toBe('FF9800');
  });

  test('zip chứa đủ file, CRC khớp nội dung', () => {
    const files = [{ name: 'a.txt', data: enc('xin chào') }, { name: 'b/c.txt', data: enc('') }];
    const zip = zipStore(files);
    const entries = listZip(zip);
    expect(entries.map((e) => e.name)).toEqual(['a.txt', 'b/c.txt']);
    expect(dec(readEntry(zip, entries[0]))).toBe('xin chào');
    expect(entries[0].crc).toBe(crc32(files[0].data));
  });

  test('buildXlsx: có các phần bắt buộc và style được ghi', () => {
    const bytes = buildXlsx([
      { name: 'A/B:C', rows: [[{ v: 'Xin chào', s: { bold: true, fill: '0B6E5B', color: 'FFFFFF' } }, { v: 5, s: { numFmt: '#,##0.0' } }]] },
    ]);
    const entries = listZip(bytes);
    const names = entries.map((e) => e.name);
    ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml'].forEach((n) =>
      expect(names).toContain(n)
    );
    const text = (n: string) => dec(readEntry(bytes, entries[names.indexOf(n)]));
    expect(text('xl/styles.xml')).toContain('FF0B6E5B');
    expect(text('xl/styles.xml')).toContain('#,##0.0');
    expect(text('xl/worksheets/sheet1.xml')).toContain('Xin chào');
    // tên sheet được làm sạch ký tự cấm
    expect(text('xl/workbook.xml')).toContain('name="A B C"');
  });

  test('buildXlsx: escape ký tự đặc biệt XML', () => {
    const bytes = buildXlsx([{ name: 'S', rows: [[{ v: 'a<b>&"c"' }]] }]);
    const entries = listZip(bytes);
    const xml = dec(readEntry(bytes, entries.find((e) => e.name === 'xl/worksheets/sheet1.xml')!));
    expect(xml).toContain('a&lt;b&gt;&amp;&quot;c&quot;');
  });

  test('báo cáo tháng: 2 sheet, có công thức tổng và ghi chú đã escape', () => {
    const bytes = buildMonthXlsx(records, config, '2026-03', new Date(2026, 2, 5));
    const entries = listZip(bytes);
    const get = (n: string) => dec(readEntry(bytes, entries.find((e) => e.name === n)!));
    expect(get('xl/workbook.xml')).toContain('Chi tiết');
    expect(get('xl/workbook.xml')).toContain('Tổng kết');
    const s1 = get('xl/worksheets/sheet1.xml');
    expect(s1).toContain('<f>SUM(J5:J6)</f>');
    expect(s1).toContain('ghi chú &quot;đặc biệt&quot; &amp; &lt;test&gt;');
    expect(get('xl/worksheets/sheet2.xml')).toContain('THỰC NHẬN');
  });

  test('báo cáo năm: 12 dòng tháng + dòng tổng, tháng không có dữ liệu không bị trừ', () => {
    const bytes = buildYearXlsx(records, config, '2026', new Date(2026, 2, 5));
    const entries = listZip(bytes);
    const xml = dec(readEntry(bytes, entries.find((e) => e.name === 'xl/worksheets/sheet1.xml')!));
    expect(xml).toContain('Tháng 12');
    expect(xml).toContain('<f>SUM(E5:E16)</f>');
    expect(xml).toContain('<f>IFERROR(AVERAGEIF(B5:B16,&quot;&gt;0&quot;,J5:J16),0)</f>');
    expect(xml).toContain('Cả năm 2026');
  });

  test('báo cáo tháng không có dữ liệu vẫn tạo được file', () => {
    const bytes = buildMonthXlsx([], config, '2026-05');
    expect(listZip(bytes).length).toBeGreaterThan(4);
  });
});
