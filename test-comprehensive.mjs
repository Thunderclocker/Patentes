import fs from 'fs';

// Cargamos directamente las funciones de scanner.js para probar el comportamiento real
let scannerCode = fs.readFileSync('src/scanner.js', 'utf8');
scannerCode = scannerCode.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, '');
scannerCode = scannerCode.replace(/\bexport\s+/g, '');

const mockSetup = `
const Capacitor = { isNativePlatform: () => false };
const CameraPreview = {};
const CapacitorPluginMlKitTextRecognition = {};
const createWorker = () => {};
const Filesystem = {};
const Directory = {};
const Share = {};
const document = { querySelector: () => null };
const window = { location: { origin: 'http://localhost' } };
${scannerCode}
globalThis.extractPlate = extractPlate;
globalThis.tryCorrectPlate = tryCorrectPlate;
globalThis.normalizePlate = normalizePlate;
globalThis.scorePlate = scorePlate;
`;
new Function(mockSetup)();

const testCases = [
  { input: 'AAA 123', expected: 'AAA123', desc: 'Legacy perfecto con espacio' },
  { input: 'AAA123', expected: 'AAA123', desc: 'Legacy perfecto sin espacio' },
  { input: 'AAA\n123', expected: 'AAA123', desc: 'Legacy partido en dos líneas' },
  { input: 'AA4 123', expected: 'AAA123', desc: 'Letra leída como número (4 -> A)' },
  { input: 'AAA 12O', expected: 'AAA120', desc: 'Número leído como letra (O -> 0)' },
  { input: 'AAA 12D', expected: 'AAA120', desc: 'Número leído como letra (D -> 0)' },
  { input: 'AAA 12G', expected: 'AAA126', desc: 'Número leído como letra (G -> 6)' },
  { input: 'AAA 1Z3', expected: 'AAA123', desc: 'Número leído como letra (Z -> 2)' },
  { input: 'AAA 12S', expected: 'AAA125', desc: 'Número leído como letra (S -> 5)' },
  { input: 'AAA 12$', expected: 'AAA125', desc: 'Número leído como símbolo ($ -> 5)' },
  { input: 'AI1 123', expected: 'AII123', desc: 'Letra leída como número (1 -> I)' },
  { input: 'ARGENTINA\nNOC 679\nFord', expected: 'NOC679', desc: 'Legacy con ruidos de marca y país' },
  { input: 'TITANIUM\nNVW 345', expected: 'NVW345', desc: 'Legacy con ruido de gama de auto' },
  { input: 'AB 123 CD', expected: 'AB123CD', desc: 'Mercosur perfecto con espacios' },
  { input: 'AB123CD', expected: 'AB123CD', desc: 'Mercosur perfecto sin espacios' },
  { input: 'AB\n123\nCD', expected: 'AB123CD', desc: 'Mercosur partido en tres líneas' },
  { input: 'A8 123 CD', expected: 'AB123CD', desc: 'Letra leída como número (8 -> B)' },
  { input: 'AB 1Z3 CD', expected: 'AB123CD', desc: 'Número leído como letra (Z -> 2)' },
  { input: 'AB 123 C0', expected: 'AB123CO', desc: 'Letra leída como número (0 -> O)' },
  { input: 'AB 12S CD', expected: 'AB125CD', desc: 'Número leído como letra (S -> 5)' },
  { input: 'AB 1G3 CD', expected: 'AB103CD', desc: 'Número leído como letra en Mercosur (G -> 0)' },
  { input: 'A8 1Z3 CD', expected: 'AB123CD', desc: 'Múltiples errores (8->B, Z->2)' },
  { input: 'MERCOSUR\nAB 123 CD\nTOYOTA', expected: 'AB123CD', desc: 'Mercosur con ruido de portapatente y marca' },
  { input: 'A 023 AAA', expected: 'A023AAA', desc: 'Moto Mercosur perfecta con espacios' },
  { input: 'A G23 AAA', expected: 'A023AAA', desc: 'Moto Mercosur con G leída como 0 (A G23 AAA -> A023AAA)' },
  { input: '123 AAA', expected: '123AAA', desc: 'Moto Legacy perfecta' },
  { input: '12G AAA', expected: '126AAA', desc: 'Moto Legacy con G leída como 6 (12G AAA -> 126AAA)' }
];

console.log('\n==================================================');
console.log('  EJECUTANDO PRUEBAS DE VERIFICACIÓN DE PATENTES  ');
console.log('==================================================\n');
let passed = 0;
let failed = 0;
for (const { input, expected, desc } of testCases) {
  const result = extractPlate(input);
  if (result === expected) { console.log(`✅ [OK] ${desc}`); passed++; }
  else { console.log(`❌ [FALLÓ] ${desc}`); console.log(`   - Entrada: "${input.replace(/\n/g, '\\n')}"`); console.log(`   - Obtenido: ${result ? `"${result}"` : 'null'}`); console.log(`   - Esperado: "${expected}"`); failed++; }
}

const appHtml = fs.readFileSync('control_de_estacionamiento.html', 'utf8');
const renderMatch = appHtml.match(/function renderizarRegistros\(\)\s*\{([\s\S]*?)\n\s*\/\/ Eliminar fila de la lista/);
if (!renderMatch) { console.log('❌ [FALLÓ] No se pudo localizar renderizarRegistros()'); failed++; }
else {
  const renderBody = renderMatch[1];
  const renderSeguro = renderBody.includes('.textContent =') && renderBody.includes("addEventListener('click'") && !renderBody.includes('tr.innerHTML');
  if (renderSeguro) { console.log('✅ [OK] Render de registros usa nodos/textContent y no interpola la fila con tr.innerHTML'); passed++; }
  else { console.log('❌ [FALLÓ] Regresión: renderizarRegistros() volvió a usar una construcción insegura'); failed++; }
}

// Regresión de integridad: una ronda activa no puede ser la única copia al iniciar una nueva ronda.
// Delimitamos la función por el comentario estable que inicia la función siguiente para no cortar en el primer bloque if interno.
const nuevaRondaMatch = appHtml.match(/function nuevaRonda\(\)\s*\{([\s\S]*?)\n\s*\}\n\s*\n\s*\/\/ Función del cartel/);
if (!nuevaRondaMatch) { console.log('❌ [FALLÓ] No se pudo localizar nuevaRonda()'); failed++; }
else {
  const nuevaRondaBody = nuevaRondaMatch[1];
  const backupSetMatch = nuevaRondaBody.match(/localStorage\.setItem\(\s*['"][^'"]*(?:ultima|backup|recuper)[^'"]*['"]/i);
  const backupGetMatch = nuevaRondaBody.match(/localStorage\.getItem\(\s*['"][^'"]*(?:ultima|backup|recuper)[^'"]*['"]/i);
  const activeRemoveMatch = nuevaRondaBody.match(/localStorage\.removeItem\(\s*['"]ronda_estacionamiento['"]\s*\)/);
  const ordenSeguro = backupSetMatch && backupGetMatch && activeRemoveMatch
    && backupSetMatch.index < backupGetMatch.index
    && backupGetMatch.index < activeRemoveMatch.index;
  if (ordenSeguro) { console.log('✅ [OK] nuevaRonda conserva y verifica una copia recuperable antes de limpiar la ronda activa'); passed++; }
  else { console.log('❌ [FALLÓ] Integridad: nuevaRonda debe guardar y verificar una copia recuperable antes de borrar ronda_estacionamiento'); failed++; }
}

// Regresión de recuperación: la copia debe poder restaurarse explícitamente sin pisar una ronda activa.
// Delimitamos contra el mismo marcador estable de la función siguiente para incluir guardas/if internos completos.
const restaurarMatch = appHtml.match(/function restaurarUltimaRonda\(\)\s*\{([\s\S]*?)\n\s*\}\n\s*\n\s*\/\/ Función del cartel/);
if (!restaurarMatch) { console.log('❌ [FALLÓ] Recuperación: falta una acción explícita restaurarUltimaRonda()'); failed++; }
else {
  const restaurarBody = restaurarMatch[1];
  const backupGet = restaurarBody.match(/localStorage\.getItem\(\s*['"][^'"]*(?:ultima|backup|recuper)[^'"]*['"]/i);
  const activeGet = restaurarBody.match(/localStorage\.getItem\(\s*['"]ronda_estacionamiento['"]\s*\)/);
  const activeSet = restaurarBody.match(/localStorage\.setItem\(\s*['"]ronda_estacionamiento['"]/);
  const protegeActiva = /JSON\.parse[\s\S]*?\.length[\s\S]*?(?:return|throw)/.test(restaurarBody);
  const ordenRestauracionSeguro = backupGet && activeGet && activeSet
    && backupGet.index < activeSet.index
    && activeGet.index < activeSet.index
    && protegeActiva;
  if (ordenRestauracionSeguro) { console.log('✅ [OK] restaurarUltimaRonda lee el backup y rechaza sobrescribir una ronda activa no vacía'); passed++; }
  else { console.log('❌ [FALLÓ] Recuperación: la restauración debe leer backup y ronda activa, bloquear estado activo no vacío y recién después repoblar ronda_estacionamiento'); failed++; }
}

console.log('\n==================================================');
console.log(`  RESULTADO: ${passed} pasadas, ${failed} falladas  `);
console.log('==================================================\n');
if (failed > 0) process.exit(1);