import fs from 'fs';

// Cargamos directamente las funciones de scanner.js para probar el comportamiento real
let scannerCode = fs.readFileSync('src/scanner.js', 'utf8');

// Quitamos los imports de arriba (líneas 1 a 6) para poder ejecutarlo en Node
scannerCode = scannerCode.replace(/import\s+[\s\S]*?from\s+['"].*?['"];/g, '');

// Quitamos las declaraciones "export " para evitar errores de sintaxis
scannerCode = scannerCode.replace(/\bexport\s+/g, '');

// Creamos mocks para los objetos de Capacitor
const mockSetup = `
const Capacitor = {
  isNativePlatform: () => false
};
const CameraPreview = {};
const CapacitorPluginMlKitTextRecognition = {};
const createWorker = () => {};
const Filesystem = {};
const Directory = {};
const Share = {};
const document = {
  querySelector: () => null
};
const window = {
  location: { origin: 'http://localhost' }
};

${scannerCode}

// Exponemos las funciones al scope global
globalThis.extractPlate = extractPlate;
globalThis.tryCorrectPlate = tryCorrectPlate;
globalThis.normalizePlate = normalizePlate;
globalThis.scorePlate = scorePlate;
`;

// Ejecutamos el setup
new Function(mockSetup)();

const testCases = [
  // ==========================================
  // FORMATO LEGACY (3 Letras + 3 Números)
  // ==========================================
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

  // ==========================================
  // FORMATO MERCOSUR (2 Letras + 3 Números + 2 Letras)
  // ==========================================
  { input: 'AB 123 CD', expected: 'AB123CD', desc: 'Mercosur perfecto con espacios' },
  { input: 'AB123CD', expected: 'AB123CD', desc: 'Mercosur perfecto sin espacios' },
  { input: 'AB\n123\nCD', expected: 'AB123CD', desc: 'Mercosur partido en tres líneas' },
  { input: 'A8 123 CD', expected: 'AB123CD', desc: 'Letra leída como número (8 -> B)' },
  { input: 'AB 1Z3 CD', expected: 'AB123CD', desc: 'Número leído como letra (Z -> 2)' },
  { input: 'AB 123 C0', expected: 'AB123CO', desc: 'Letra leída como número (0 -> O)' },
  { input: 'AB 12S CD', expected: 'AB125CD', desc: 'Número leído como letra (S -> 5)' },
  { input: 'A8 1Z3 CD', expected: 'AB123CD', desc: 'Múltiples errores (8->B, Z->2)' },
  { input: 'MERCOSUR\nAB 123 CD\nTOYOTA', expected: 'AB123CD', desc: 'Mercosur con ruido de portapatente y marca' }
];

console.log('\n==================================================');
console.log('  EJECUTANDO PRUEBAS DE VERIFICACIÓN DE PATENTES  ');
console.log('==================================================\n');

let passed = 0;
let failed = 0;

for (const { input, expected, desc } of testCases) {
  const result = extractPlate(input);
  if (result === expected) {
    console.log(`✅ [OK] ${desc}`);
    passed++;
  } else {
    console.log(`❌ [FALLÓ] ${desc}`);
    console.log(`   - Entrada: "${input.replace(/\n/g, '\\n')}"`);
    console.log(`   - Obtenido: ${result ? `"${result}"` : 'null'}`);
    console.log(`   - Esperado: "${expected}"`);
    failed++;
  }
}

console.log('\n==================================================');
console.log(`  RESULTADO: ${passed} pasadas, ${failed} falladas  `);
console.log('==================================================\n');
if (failed > 0) {
  process.exit(1);
}
