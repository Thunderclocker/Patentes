import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { buildHeaderMap, projectExportRow, translateFormulaRows, assertSafeOutputPath } from './estadias-import-core.mjs';

const [,, exportPath, workbookPath, outputPath] = process.argv;
if (!exportPath || !workbookPath || !outputPath) {
  console.error('Uso: node scripts/import-estacionascan-to-estadias.mjs <export.xlsx> <ESTADIAS.xlsx> <salida.xlsx>');
  process.exit(2);
}

assertSafeOutputPath(workbookPath, outputPath);
if (fs.existsSync(outputPath)) throw new Error(`La salida ya existe: ${outputPath}`);

const exportBook = XLSX.readFile(exportPath, { cellDates: false });
const exportSheet = exportBook.Sheets.EstacionaScan ?? exportBook.Sheets[exportBook.SheetNames[0]];
if (!exportSheet) throw new Error('El export no contiene hojas');
const rows = XLSX.utils.sheet_to_json(exportSheet, { header: 1, raw: true, defval: '' });
if (rows.length < 2) throw new Error('El export no contiene filas para importar');
const headerMap = buildHeaderMap(rows[0]);
const projected = rows.slice(1).filter(row => row.some(value => String(value ?? '').trim() !== '')).map(row => projectExportRow(row, headerMap));
if (!projected.length) throw new Error('El export no contiene filas útiles');

const book = XLSX.readFile(workbookPath, { cellDates: false, cellFormula: true });
const sheet = book.Sheets.RELEVAMIENTOS;
if (!sheet) throw new Error('El libro no contiene la hoja RELEVAMIENTOS');
const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
let lastDataRow = 0;
for (let r = range.e.r; r >= 0; r -= 1) {
  let hasData = false;
  for (let c = 0; c <= 6; c += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    if (cell && cell.v !== undefined && cell.v !== '') { hasData = true; break; }
  }
  if (hasData) { lastDataRow = r; break; }
}
const sourceFormulaRow = lastDataRow;
const startRow = lastDataRow + 1;

for (let offset = 0; offset < projected.length; offset += 1) {
  const targetRow = startRow + offset;
  projected[offset].forEach((value, c) => {
    sheet[XLSX.utils.encode_cell({ r: targetRow, c })] = { t: typeof value === 'number' ? 'n' : 's', v: value };
  });
  for (let c = 7; c <= 13; c += 1) {
    const source = sheet[XLSX.utils.encode_cell({ r: sourceFormulaRow, c })];
    if (!source) continue;
    const target = { ...source };
    if (typeof source.f === 'string') target.f = translateFormulaRows(`=${source.f}`, targetRow - sourceFormulaRow).slice(1);
    delete target.v;
    delete target.w;
    sheet[XLSX.utils.encode_cell({ r: targetRow, c })] = target;
  }
}

range.e.r = Math.max(range.e.r, startRow + projected.length - 1);
range.e.c = Math.max(range.e.c, 13);
sheet['!ref'] = XLSX.utils.encode_range(range);
fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
XLSX.writeFile(book, outputPath);
console.log(`Importadas ${projected.length} filas en copia: ${outputPath}`);
