// Test de extracción de patentes con las lecturas OCR más probables
// de las imágenes NVW 345 y NOC 679

const PATTERNS = {
  MERCOSUR: /^[A-Z]{2}\d{3}[A-Z]{2}$/,
  LEGACY:   /^[A-Z]{3}\d{3}$/,
  MOTO_NEW: /^[A-Z]\d{3}[A-Z]{3}$/,
  MOTO_OLD: /^\d{3}[A-Z]{3}$/,
};

const LETTER_TO_DIGIT = {
  'O': '0', 'Q': '0', 'D': '0', 'U': '0', 'C': '0',
  'I': '1', 'L': '1', 'J': '1',
  'Z': '2',
  'E': '3',
  'A': '4', 'H': '4',
  'S': '5', '$': '5',
  'G': '6', 'b': '6',
  'T': '7', 'Y': '7',
  'B': '8',
  'P': '9', 'g': '9',
};

const DIGIT_TO_LETTER = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '3': 'E',
  '4': 'A',
  '5': 'S',
  '6': 'G',
  '7': 'T',
  '8': 'B',
  '9': 'P',
};

function isDigit(char) { return char >= '0' && char <= '9'; }
function isLetter(char) { return char >= 'A' && char <= 'Z'; }

function tryCorrectPlate(candidate) {
  const len = candidate.length;
  let pattern = null;

  if (len === 7) {
    const p1 = candidate.slice(0, 2);
    const p2 = candidate.slice(2, 5);
    const p3 = candidate.slice(5, 7);
    if (/[A-Z]/.test(p1) && /\d/.test(p2) && /[A-Z]/.test(p3)) {
      pattern = 'LLNNNLL';
    } else if (/[A-Z]/.test(candidate[0]) && /\d/.test(p2)) {
      pattern = 'LNNNLLL';
    }
  } else if (len === 6) {
    const first3 = candidate.slice(0, 3);
    const last3 = candidate.slice(3, 6);
    const lettersFirst = (first3.match(/[A-Z]/g) || []).length;
    const digitsFirst = (first3.match(/\d/g) || []).length;
    const lettersLast = (last3.match(/[A-Z]/g) || []).length;
    const digitsLast = (last3.match(/\d/g) || []).length;
    if (lettersFirst >= digitsFirst) {
      pattern = 'LLLNNN';
    } else {
      pattern = 'NNNLLL';
    }
  }

  if (!pattern) return candidate;

  let corrected = '';
  for (let i = 0; i < len; i++) {
    const ch = candidate[i];
    const expectedType = pattern[i];
    if (expectedType === 'L') {
      if (isDigit(ch)) {
        corrected += DIGIT_TO_LETTER[ch] || ch;
      } else {
        corrected += ch;
      }
    } else if (expectedType === 'N') {
      if (isLetter(ch)) {
        corrected += LETTER_TO_DIGIT[ch] || ch;
      } else {
        corrected += ch;
      }
    } else {
      corrected += ch;
    }
  }
  return corrected;
}

function scorePlate(plate) {
  if (!plate) return 0;
  if (PATTERNS.MERCOSUR.test(plate)) return 100;
  if (PATTERNS.LEGACY.test(plate)) return 95;
  if (PATTERNS.MOTO_NEW.test(plate)) return 90;
  if (PATTERNS.MOTO_OLD.test(plate)) return 90;
  if (/^[A-Z0-9]{6,7}$/.test(plate)) return 40;
  return 0;
}

const NOISE_WORDS = /^(ARGENTINA|REPUBLICA|REPARG|MERCOSUR|MARIANOFF|FORD|FIAT|CHEVROLET|TOYOTA|VOLKSWAGEN|RENAULT|PEUGEOT|CITROEN|HONDA|SUZUKI|YAMAHA|VW|BMW|KIA|AUDI|HYUNDAI|BORA|CORSA|GOL|TITANIUM|TREND|CLASSIC)$/;

function translateSymbols(str) {
  return String(str || '')
    .toUpperCase()
    .replace(/\$/g, 'S')
    .replace(/\|/g, 'I')
    .replace(/\[/g, 'I')
    .replace(/\]/g, 'I')
    .replace(/\(/g, 'D')
    .replace(/\)/g, 'D');
}

function normalizePlate(raw) {
  return translateSymbols(raw).replace(/[^A-Z0-9]/g, '');
}

function extractPlate(text) {
  if (!text) return null;

  const sources = [];

  // Paso 1: Separar por espacios/delimitadores y filtrar ruido
  const rawParts = text.split(/[\n\r\t ,.;|/\\-]+/).map(t => t.trim()).filter(Boolean);
  const cleanParts = [];
  for (const part of rawParts) {
    const upper = translateSymbols(part).replace(/[^A-Z0-9]/g, '');
    if (!NOISE_WORDS.test(upper)) {
      cleanParts.push(part);
      sources.push(part);
    }
  }

  // Paso 2: Concatenar partes adyacentes (2 o 3 partes)
  for (let i = 0; i < cleanParts.length; i++) {
    const p1 = normalizePlate(cleanParts[i]);
    if (p1.length < 1) continue;

    // Intentar 2 partes
    if (i < cleanParts.length - 1) {
      const p2 = normalizePlate(cleanParts[i + 1]);
      if (p2.length >= 1 && (p1.length + p2.length >= 5 && p1.length + p2.length <= 8)) {
        sources.push(p1 + p2);
      }
    }

    // Intentar 3 partes
    if (i < cleanParts.length - 2) {
      const p2 = normalizePlate(cleanParts[i + 1]);
      const p3 = normalizePlate(cleanParts[i + 2]);
      if (p2.length >= 1 && p3.length >= 1) {
        const combinedLength = p1.length + p2.length + p3.length;
        if (combinedLength >= 6 && combinedLength <= 8) {
          sources.push(p1 + p2 + p3);
        }
      }
    }
  }

  let best = null;
  let bestScore = 0;

  for (const source of sources) {
    const cleaned = normalizePlate(source);
    if (!cleaned || cleaned.length < 4) continue;
    if (NOISE_WORDS.test(cleaned)) continue;

    // Para strings cortos (6-7 chars), probar directamente
    if (cleaned.length <= 7) {
      const corrected = tryCorrectPlate(cleaned);
      const score = scorePlate(corrected);
      if (score > bestScore) {
        bestScore = score;
        best = corrected;
      }
    }

    // Generar subcadenas solo de strings más largos
    if (cleaned.length > 7) {
      const candidates = new Set();
      for (let len = 6; len <= 7; len++) {
        for (let i = 0; i <= cleaned.length - len; i++) {
          candidates.add(cleaned.slice(i, i + len));
        }
      }
      for (const candidate of candidates) {
        if (NOISE_WORDS.test(candidate)) continue;
        const corrected = tryCorrectPlate(candidate);
        const score = scorePlate(corrected);
        if (score > bestScore) {
          bestScore = score;
          best = corrected;
        }
      }
    }
  }

  return bestScore >= 40 ? best : null;
}

// ---- TESTS ----

console.log('\n=== TEST: Patente NVW 345 ===');
const nvwVariants = [
  'NVW 345',
  'NVW345',
  'NVW\n345',
  'NVW 3A5',
  'NVW 34S',
  'NVW 3AS',
  'NVM 345',
  'MVW 345',
  'NVW 34$',
  'NV W345',
  'NVW3A5',
  'ARGENTINA\nNVW 345',
  'NVW 345\nFORD',
  'NVW34S',
  'NVWEAS',
];

for (const variant of nvwVariants) {
  const result = extractPlate(variant);
  const status = result === 'NVW345' ? '✅' : '❌';
  console.log(`  ${status} "${variant.replace(/\n/g, '\\n')}" → ${result || 'null'}`);
}

console.log('\n=== TEST: Patente NOC 679 ===');
const nocVariants = [
  'NOC 679',
  'NOC679',
  'NOC\n679',
  'NOC 6T9',
  'NOC G79',
  'NOC GT9',
  'N0C 679',
  'NOC679',
  'NOCE79',
  'NOC 67P',
  'MARIANOFF\nTITANIUM\nNOC 679',
  'TITANIUM\nNOC 679\nFord',
  'NOC 679\nFord\nMARIANOFF',
  'NOC 679 TITANIUM',
  'NOC\n679\nFord',
];

for (const variant of nocVariants) {
  const result = extractPlate(variant);
  const status = result === 'NOC679' ? '✅' : '❌';
  console.log(`  ${status} "${variant.replace(/\n/g, '\\n')}" → ${result || 'null'}`);
}

console.log('\n=== TEST: Patentes Mercosur (no deben romperse) ===');
const mercosurVariants = [
  'AB123CD',
  'AB 123 CD',
  'A8123CD',
  'AB1Z3CD',
];

for (const variant of mercosurVariants) {
  const result = extractPlate(variant);
  const expected = 'AB123CD';
  const status = result === expected ? '✅' : '⚠️';
  console.log(`  ${status} "${variant}" → ${result || 'null'} (esperado: ${expected})`);
}
