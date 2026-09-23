export const EXPORT_HEADERS = ['Fecha', 'Hora', 'Patente', 'Piso', 'Dársena', 'Modelo', 'Color'];

export function canonicalHeader(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function buildHeaderMap(headerRow) {
  if (!Array.isArray(headerRow)) throw new TypeError('headerRow debe ser un array');
  const positions = new Map();
  headerRow.forEach((value, index) => {
    const key = canonicalHeader(value);
    if (!key) return;
    if (positions.has(key)) throw new Error(`Encabezado duplicado: ${value}`);
    positions.set(key, index);
  });

  const missing = EXPORT_HEADERS.filter(h => !positions.has(canonicalHeader(h)));
  if (missing.length) throw new Error(`Faltan encabezados requeridos: ${missing.join(', ')}`);

  return Object.fromEntries(EXPORT_HEADERS.map(h => [h, positions.get(canonicalHeader(h))]));
}

export function projectExportRow(row, headerMap) {
  if (!Array.isArray(row)) throw new TypeError('row debe ser un array');
  return EXPORT_HEADERS.map(h => row[headerMap[h]] ?? '');
}

export function normalizeFloorForEstadias(value) {
  const floor = String(value ?? '').trim().toUpperCase();
  if (floor === 'EP') return 'EP';
  const match = /^P([1-4])$/.exec(floor);
  if (match) return match[1];
  if (/^[1-4]$/.test(floor)) return floor;
  throw new Error(`Piso no reconocido: ${value}`);
}

export function normalizeIdentifier(value) {
  return String(value ?? '').trim().replace(/\s+/g, '');
}

function isExcelColumn(column) {
  const letters = column.replace('$', '');
  let number = 0;
  for (const char of letters) number = number * 26 + char.charCodeAt(0) - 64;
  return number >= 1 && number <= 16384; // XFD, última columna válida de Excel.
}

function translateFormulaSegment(segment, rowDelta) {
  return segment.replace(/(?<![A-Z0-9_.])(\$?[A-Z]{1,3})(\$?)(\d+)(?![A-Z0-9_.(])/g, (match, column, absoluteRow, rowText) => {
    if (!isExcelColumn(column) || absoluteRow === '$') return match;
    const translated = Number(rowText) + rowDelta;
    if (translated < 1) throw new Error(`La traducción produce una fila inválida: ${translated}`);
    return `${column}${translated}`;
  });
}

function findMatchingBracket(formula, start) {
  let depth = 0;
  for (let index = start; index < formula.length; index += 1) {
    if (formula[index] === '[') depth += 1;
    else if (formula[index] === ']') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

export function translateFormulaRows(formula, rowDelta) {
  if (typeof formula !== 'string' || !formula.startsWith('=')) {
    throw new TypeError('formula debe ser una fórmula Excel que empiece con =');
  }
  if (!Number.isInteger(rowDelta)) throw new TypeError('rowDelta debe ser entero');

  let result = '';
  let codeStart = 0;
  let index = 0;
  while (index < formula.length) {
    const opener = formula[index];
    if (opener === '[') {
      result += translateFormulaSegment(formula.slice(codeStart, index), rowDelta);
      const literalStart = index;
      const close = findMatchingBracket(formula, index);
      index = close === -1 ? formula.length : close + 1;
      result += formula.slice(literalStart, index);
      codeStart = index;
      continue;
    }

    if (opener !== '"' && opener !== "'") {
      index += 1;
      continue;
    }

    result += translateFormulaSegment(formula.slice(codeStart, index), rowDelta);
    const literalStart = index;
    index += 1;
    while (index < formula.length) {
      if (formula[index] !== opener) {
        index += 1;
        continue;
      }
      if (formula[index + 1] === opener) {
        index += 2;
        continue;
      }
      index += 1;
      break;
    }
    result += formula.slice(literalStart, index);
    codeStart = index;
  }

  return result + translateFormulaSegment(formula.slice(codeStart), rowDelta);
}

export function assertSafeOutputPath(inputPath, outputPath) {
  if (!inputPath || !outputPath) throw new Error('Se requieren inputPath y outputPath');
  if (pathIdentity(inputPath) === pathIdentity(outputPath)) {
    throw new Error('La salida debe ser una copia distinta; no se permite sobrescribir el libro vigente');
  }
}

function pathIdentity(value) {
  return String(value).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase();
}
