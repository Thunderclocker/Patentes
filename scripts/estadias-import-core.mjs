export const EXPORT_HEADERS = ['Fecha', 'Hora', 'Patente', 'Piso', 'Dársena', 'Modelo', 'Color'];

export function canonicalHeader(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function buildHeaderMap(headerRow) {
  if (!Array.isArray(headerRow)) throw new TypeError('headerRow debe ser un array');
  const positions = new Map();
  headerRow.forEach((value, index) => {
    const key = canonicalHeader(value);
    if (key) positions.set(key, index);
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

export function assertSafeOutputPath(inputPath, outputPath) {
  if (!inputPath || !outputPath) throw new Error('Se requieren inputPath y outputPath');
  if (String(inputPath) === String(outputPath)) {
    throw new Error('La salida debe ser una copia distinta; no se permite sobrescribir el libro vigente');
  }
}
