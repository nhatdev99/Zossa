/**
 * Bộ ghi file Excel (.xlsx) tối giản, không phụ thuộc thư viện ngoài, chạy được trong React Native.
 * Hỗ trợ: nhiều sheet, màu nền và màu chữ, in đậm, căn lề, viền, định dạng số và ngày, độ rộng cột,
 * gộp ô, cố định hàng tiêu đề, công thức (kèm giá trị tính sẵn).
 */

export type CellValue = string | number | null;

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  size?: number;
  color?: string; // RRGGBB
  fill?: string; // RRGGBB
  halign?: 'left' | 'center' | 'right';
  valign?: 'top' | 'center' | 'bottom';
  wrap?: boolean;
  numFmt?: string; // ví dụ '#,##0', '0.0', 'dd/mm/yyyy'
  border?: 'all' | 'top' | 'bottom' | 'topBottom';
  borderColor?: string; // RRGGBB
  borderStyle?: 'thin' | 'medium';
}

export interface Cell {
  v?: CellValue;
  /** Công thức (không có dấu =). Nên kèm v là giá trị đã tính. */
  f?: string;
  s?: CellStyle;
}

export interface Sheet {
  name: string;
  rows: (Cell | null)[][];
  colWidths?: number[];
  rowHeights?: Record<number, number>; // chỉ số hàng bắt đầu từ 1
  merges?: string[]; // ví dụ 'A1:K1'
  freezeRows?: number; // số hàng cố định ở trên
  landscape?: boolean;
  showGridLines?: boolean;
}

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

const xmlEscape = (text: string): string =>
  text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const colLetter = (index: number): string => {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** 'YYYY-MM-DD' -> số ngày của Excel */
export const excelDate = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569;
};

/** Trộn màu RRGGBB với trắng: amount 0 = giữ nguyên, 1 = trắng. */
export const tint = (hex: string, amount: number): string => {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 'F3F4F6';
  const ch = (i: number) => {
    const c = parseInt(clean.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return (ch(0) + ch(2) + ch(4)).toUpperCase();
};

const utf8 = (text: string): Uint8Array => {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const n = text.charCodeAt(i + 1);
      if (n >= 0xdc00 && n <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (n - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
};

// ---------------------------------------------------------------------------
// Bảng style
// ---------------------------------------------------------------------------

class StyleBook {
  private fonts: string[] = ['<font><sz val="11"/><color rgb="FF16191C"/><name val="Calibri"/><family val="2"/></font>'];
  private fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  private borders: string[] = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  private numFmts: Map<string, number> = new Map();
  private xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private cache: Map<string, number> = new Map();

  private indexOf(list: string[], xml: string): number {
    const i = list.indexOf(xml);
    if (i >= 0) return i;
    list.push(xml);
    return list.length - 1;
  }

  private numFmtId(code?: string): number {
    if (!code) return 0;
    if (code === '0') return 1;
    if (code === '#,##0') return 3;
    if (code === '0.00') return 2;
    let id = this.numFmts.get(code);
    if (!id) {
      id = 164 + this.numFmts.size;
      this.numFmts.set(code, id);
    }
    return id;
  }

  get(style?: CellStyle): number {
    if (!style) return 0;
    const key = JSON.stringify(style);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const font =
      '<font>' +
      (style.bold ? '<b/>' : '') +
      (style.italic ? '<i/>' : '') +
      `<sz val="${style.size ?? 11}"/>` +
      `<color rgb="FF${style.color ?? '16191C'}"/>` +
      '<name val="Calibri"/><family val="2"/></font>';
    const fontId = this.indexOf(this.fonts, font);

    let fillId = 0;
    if (style.fill) {
      fillId = this.indexOf(
        this.fills,
        `<fill><patternFill patternType="solid"><fgColor rgb="FF${style.fill}"/><bgColor indexed="64"/></patternFill></fill>`
      );
    }

    let borderId = 0;
    if (style.border) {
      const st = style.borderStyle ?? 'thin';
      const col = `<color rgb="FF${style.borderColor ?? 'D8D3C6'}"/>`;
      const side = (name: string, on: boolean) => (on ? `<${name} style="${st}">${col}</${name}>` : `<${name}/>`);
      const all = style.border === 'all';
      const top = all || style.border === 'top' || style.border === 'topBottom';
      const bottom = all || style.border === 'bottom' || style.border === 'topBottom';
      borderId = this.indexOf(
        this.borders,
        `<border>${side('left', all)}${side('right', all)}${side('top', top)}${side('bottom', bottom)}<diagonal/></border>`
      );
    }

    const numId = this.numFmtId(style.numFmt);
    const align =
      style.halign || style.valign || style.wrap
        ? `<alignment${style.halign ? ` horizontal="${style.halign}"` : ''} vertical="${style.valign ?? 'center'}"${
            style.wrap ? ' wrapText="1"' : ''
          }/>`
        : '';
    const xf =
      `<xf numFmtId="${numId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
      (numId ? ' applyNumberFormat="1"' : '') +
      ' applyFont="1"' +
      (fillId ? ' applyFill="1"' : '') +
      (borderId ? ' applyBorder="1"' : '') +
      (align ? ' applyAlignment="1">' + align + '</xf>' : '/>');

    this.xfs.push(xf);
    const id = this.xfs.length - 1;
    this.cache.set(key, id);
    return id;
  }

  toXml(): string {
    const numFmts = this.numFmts.size
      ? `<numFmts count="${this.numFmts.size}">` +
        Array.from(this.numFmts.entries())
          .map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${xmlEscape(code)}"/>`)
          .join('') +
        '</numFmts>'
      : '';
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      numFmts +
      `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join('')}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    );
  }
}

// ---------------------------------------------------------------------------
// Sheet XML
// ---------------------------------------------------------------------------

const sheetXml = (sheet: Sheet, book: StyleBook): string => {
  const rowsXml: string[] = [];
  let maxCol = 0;

  sheet.rows.forEach((row, r) => {
    const rowNum = r + 1;
    const cells: string[] = [];
    row.forEach((cell, c) => {
      if (!cell) return;
      maxCol = Math.max(maxCol, c + 1);
      const ref = `${colLetter(c)}${rowNum}`;
      const s = book.get(cell.s);
      const sAttr = s ? ` s="${s}"` : '';
      if (cell.f !== undefined) {
        const cached = typeof cell.v === 'number' ? `<v>${cell.v}</v>` : '';
        cells.push(`<c r="${ref}"${sAttr}><f>${xmlEscape(cell.f)}</f>${cached}</c>`);
      } else if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
        cells.push(`<c r="${ref}"${sAttr}><v>${cell.v}</v></c>`);
      } else if (typeof cell.v === 'string' && cell.v !== '') {
        cells.push(
          `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.v)}</t></is></c>`
        );
      } else {
        cells.push(`<c r="${ref}"${sAttr}/>`); // ô trống nhưng có style (nền, viền)
      }
    });
    const ht = sheet.rowHeights?.[rowNum];
    rowsXml.push(
      `<row r="${rowNum}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${cells.join('')}</row>`
    );
  });

  const lastRef = `${colLetter(Math.max(maxCol, 1) - 1)}${Math.max(sheet.rows.length, 1)}`;
  const pane = sheet.freezeRows
    ? `<pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/>` +
      `<selection pane="bottomLeft" activeCell="A${sheet.freezeRows + 1}" sqref="A${sheet.freezeRows + 1}"/>`
    : '';
  const cols = sheet.colWidths?.length
    ? '<cols>' +
      sheet.colWidths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('') +
      '</cols>'
    : '';
  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : '';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<dimension ref="A1:${lastRef}"/>` +
    `<sheetViews><sheetView workbookViewId="0"${sheet.showGridLines === false ? ' showGridLines="0"' : ''}>${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="18"/>' +
    cols +
    `<sheetData>${rowsXml.join('')}</sheetData>` +
    merges +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    `<pageSetup paperSize="9" orientation="${sheet.landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>` +
    '</worksheet>'
  );
};

// ---------------------------------------------------------------------------
// ZIP (không nén)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export const crc32 = (data: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export const zipStore = (files: { name: string; data: Uint8Array }[]): Uint8Array => {
  const DOS_TIME = (12 << 11) | (0 << 5); // 12:00
  const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01
  const entries = files.map((f) => ({ name: utf8(f.name), data: f.data, crc: crc32(f.data), offset: 0 }));

  let size = 22;
  entries.forEach((e) => {
    size += 30 + e.name.length + e.data.length + 46 + e.name.length;
  });

  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let p = 0;
  const u16 = (v: number) => {
    view.setUint16(p, v, true);
    p += 2;
  };
  const u32 = (v: number) => {
    view.setUint32(p, v >>> 0, true);
    p += 4;
  };

  entries.forEach((e) => {
    e.offset = p;
    u32(0x04034b50);
    u16(20);
    u16(0x0800); // tên file UTF-8
    u16(0);
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(e.crc);
    u32(e.data.length);
    u32(e.data.length);
    u16(e.name.length);
    u16(0);
    out.set(e.name, p);
    p += e.name.length;
    out.set(e.data, p);
    p += e.data.length;
  });

  const cdStart = p;
  entries.forEach((e) => {
    u32(0x02014b50);
    u16(20);
    u16(20);
    u16(0x0800);
    u16(0);
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(e.crc);
    u32(e.data.length);
    u32(e.data.length);
    u16(e.name.length);
    u16(0);
    u16(0);
    u16(0);
    u16(0);
    u32(0);
    u32(e.offset);
    out.set(e.name, p);
    p += e.name.length;
  });
  const cdSize = p - cdStart;

  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(entries.length);
  u16(entries.length);
  u32(cdSize);
  u32(cdStart);
  u16(0);
  return out;
};

// ---------------------------------------------------------------------------
// Workbook
// ---------------------------------------------------------------------------

const safeSheetName = (name: string, index: number): string => {
  const cleaned = name.replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
};

export const buildXlsx = (sheets: Sheet[]): Uint8Array => {
  const book = new StyleBook();
  const sheetFiles = sheets.map((s) => sheetXml(s, book)); // phải chạy trước để gom style
  const names = sheets.map((s, i) => safeSheetName(s.name, i));

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join('') +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>' +
    '<sheets>' +
    names.map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>';

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      )
      .join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>';

  const files = [
    { name: '[Content_Types].xml', data: utf8(contentTypes) },
    { name: '_rels/.rels', data: utf8(rootRels) },
    { name: 'xl/workbook.xml', data: utf8(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRels) },
    { name: 'xl/styles.xml', data: utf8(book.toXml()) },
    ...sheetFiles.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: utf8(xml) })),
  ];
  return zipStore(files);
};
