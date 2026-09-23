import assert from 'node:assert/strict';
import {
  EXPORT_HEADERS,
  buildHeaderMap,
  projectExportRow,
  normalizeFloorForEstadias,
  normalizeIdentifier,
  assertSafeOutputPath
} from './estadias-import-core.mjs';

const header = ['', 'Color', 'Modelo', 'Piso', 'Patente', 'Hora', 'Fecha', 'Dársena'];
const map = buildHeaderMap(header);
assert.deepEqual(projectExportRow(
  [0, 'Blanco', 'YARIS', 'P3', 'AA386RZ', '23:10', '18/08/2026', '12'],
  map
), ['18/08/2026', '23:10', 'AA386RZ', 'P3', '12', 'YARIS', 'Blanco']);

assert.throws(() => buildHeaderMap(['Fecha', 'Hora']), /Faltan encabezados requeridos/);

assert.equal(normalizeFloorForEstadias('EP'), 'EP');
assert.equal(normalizeFloorForEstadias('P1'), '1');
assert.equal(normalizeFloorForEstadias('P2'), '2');
assert.equal(normalizeFloorForEstadias('P3'), '3');
assert.equal(normalizeFloorForEstadias('P4'), '4');
assert.equal(normalizeFloorForEstadias('4'), '4');
assert.throws(() => normalizeFloorForEstadias('P5'), /Piso no reconocido/);

assert.equal(normalizeIdentifier('28 NEOSTAR'), '28NEOSTAR');
assert.equal(normalizeIdentifier('5ENN'), '5ENN');
assert.equal(normalizeIdentifier('S/P TOYOTA YARIS'), 'S/PTOYOTAYARIS');

assert.doesNotThrow(() => assertSafeOutputPath('ESTADIAS_CORPORATE_2026_V5.xlsx', 'ESTADIAS_CORPORATE_2026_V5_PRUEBA.xlsx'));
assert.throws(
  () => assertSafeOutputPath('ESTADIAS_CORPORATE_2026_V5.xlsx', 'ESTADIAS_CORPORATE_2026_V5.xlsx'),
  /no se permite sobrescribir/
);

assert.deepEqual(EXPORT_HEADERS, ['Fecha', 'Hora', 'Patente', 'Piso', 'Dársena', 'Modelo', 'Color']);
console.log('✓ Contrato base EstacionaScan → ESTADIAS validado');
