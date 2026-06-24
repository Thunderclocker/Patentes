import { Capacitor } from '@capacitor/core';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { CapacitorPluginMlKitTextRecognition } from '@pantrist/capacitor-plugin-ml-kit-text-recognition';
import { createWorker } from 'tesseract.js';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const MERCOSUR = /^[A-Z]{2}\d{3}[A-Z]{2}$/;
const LEGACY = /^[A-Z]{3}\d{3}$/;
const MOTO = /^[A-Z]\d{3}[A-Z]{3}$/;
const MOTO_LEGACY = /^\d{3}[A-Z]{3}$/;

let ocrWorker = null;
let ocrReady = false;
let autoScanTimer = null;
let autoScanCallback = null;
let previewActive = false;
let useNativePreview = Capacitor.isNativePlatform();
let lastRawText = '';

function getAssetBase() {
  const base = document.querySelector('base')?.href || `${window.location.origin}/`;
  return new URL('assets/tesseract/', base).href;
}
// Definición de tipos esperados por formato de patente para corrección inteligente
const PATTERNS = {
  7: [
    { name: 'MOTO', pattern: MOTO, types: ['L', 'D', 'D', 'D', 'L', 'L', 'L'] },
    { name: 'MERCOSUR', pattern: MERCOSUR, types: ['L', 'L', 'D', 'D', 'D', 'L', 'L'] }
  ],
  6: [
    { name: 'LEGACY', pattern: LEGACY, types: ['L', 'L', 'L', 'D', 'D', 'D'] },
    { name: 'MOTO_LEGACY', pattern: MOTO_LEGACY, types: ['D', 'D', 'D', 'L', 'L', 'L'] }
  ]
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

function isDigit(char) {
  return char >= '0' && char <= '9';
}

function isLetter(char) {
  return char >= 'A' && char <= 'Z';
}

function getMismatchCount(str, types) {
  let mismatches = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const expected = types[i];
    if (expected === 'D') {
      if (!isDigit(char)) mismatches++;
    } else if (expected === 'L') {
      if (!isLetter(char)) mismatches++;
    }
  }
  return mismatches;
}

function tryCorrectPlate(candidate) {
  if (!candidate) return candidate;
  const len = candidate.length;

  // Si ya coincide con algún formato de forma perfecta, lo devolvemos tal cual
  if (len === 7) {
    if (MOTO.test(candidate) || MERCOSUR.test(candidate)) return candidate;
  } else if (len === 6) {
    if (LEGACY.test(candidate) || MOTO_LEGACY.test(candidate)) return candidate;
  }

  const group = PATTERNS[len];
  if (!group) return candidate;

  let bestCorrected = candidate;
  let bestScore = 0;

  for (const item of group) {
    const mismatches = getMismatchCount(candidate, item.types);
    if (mismatches <= 2) {
      let corrected = '';
      for (let i = 0; i < len; i++) {
        const char = candidate[i];
        const expected = item.types[i];
        if (expected === 'D') {
          // El cero ('0') del formato Mercosur posee cortes stencil (gaps)
          // que el OCR de Google suele interpretar como una 'G' (letra).
          // Para Mercosur/Moto corregimos 'G' a '0'. Para Legacy se mantiene '6'.
          if ((item.name === 'MERCOSUR' || item.name === 'MOTO') && char === 'G') {
            corrected += '0';
          } else {
            corrected += LETTER_TO_DIGIT[char] || char;
          }
        } else {
          corrected += DIGIT_TO_LETTER[char] || char;
        }
      }
      if (item.pattern.test(corrected)) {
        const score = scorePlate(corrected);
        if (score > bestScore) {
          bestScore = score;
          bestCorrected = corrected;
        }
      }
    }
  }

  return bestScore > 0 ? bestCorrected : candidate;
}

// Texto basura frecuente en portapatentes y marcos
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
  return translateSymbols(raw)
    .replace(/[^A-Z0-9]/g, '');
}

function hasLettersAndDigits(s) {
  return /[A-Z]/.test(s) && /\d/.test(s);
}

function scorePlate(candidate) {
  if (!candidate || candidate.length < 4 || candidate.length > 10) return 0;
  if (!hasLettersAndDigits(candidate)) return 0;

  if (MERCOSUR.test(candidate)) return 100;
  if (LEGACY.test(candidate)) return 95;
  if (MOTO.test(candidate)) return 90;
  if (MOTO_LEGACY.test(candidate)) return 90;

  // Cualquier mezcla letras+números de 5-8 chars (moto, variaciones, OCR parcial)
  if (candidate.length >= 5 && candidate.length <= 8) return 75;
  if (candidate.length === 4) return 55;
  if (candidate.length === 9 || candidate.length === 10) return 45;

  return 0;
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
  // Ej 2 partes: "NVW" + "345" → "NVW345"
  // Ej 3 partes: "AB" + "123" + "CD" → "AB123CD"
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

function extractPlateFromMlKitResult(result) {
  const chunks = [];
  const allLines = []; // Para combinación cruzada entre bloques

  if (result.blocks) {
    for (const block of result.blocks) {
      if (block.lines) {
        const blockLines = [];
        for (const line of block.lines) {
          if (line.text) {
            chunks.push(line.text);
            blockLines.push(line.text);
            allLines.push(line.text);
          }
        }
        if (blockLines.length > 1) {
          chunks.push(blockLines.join('\n'));
          chunks.push(blockLines.join(' '));
          chunks.push(blockLines.join(''));
        }
      }
      if (block.text) chunks.push(block.text);
    }
  }
  if (result.text) chunks.push(result.text);

  // Combinar líneas adyacentes de diferentes bloques
  // (patentes legacy a veces se fragmentan: bloque1="NVW", bloque2="345")
  for (let i = 0; i < allLines.length - 1; i++) {
    const a = normalizePlate(allLines[i]);
    const b = normalizePlate(allLines[i + 1]);
    if (a.length >= 2 && a.length <= 4 && b.length >= 2 && b.length <= 4) {
      chunks.push(a + b);
    }
  }

  let bestPlate = null;
  let bestScore = 0;

  for (const chunk of chunks) {
    const plate = extractPlate(chunk);
    if (plate) {
      const score = scorePlate(plate);
      if (score > bestScore) {
        bestScore = score;
        bestPlate = plate;
      }
    }
  }

  return bestPlate;
}

function formatPlateDisplay(patente) {
  if (patente.length === 7 && MERCOSUR.test(patente)) {
    return `${patente.slice(0, 2)} ${patente.slice(2, 5)} ${patente.slice(5, 7)}`;
  }
  if (patente.length === 7 && MOTO.test(patente)) {
    return `${patente.slice(0, 3)} ${patente.slice(3, 7)}`;
  }
  if (patente.length === 6 && LEGACY.test(patente)) {
    return `${patente.slice(0, 3)} ${patente.slice(3, 6)}`;
  }
  if (patente.length === 6 && MOTO_LEGACY.test(patente)) {
    return `${patente.slice(0, 3)} ${patente.slice(3, 6)}`;
  }
  return patente;
}

function stripBase64(dataUrl) {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

function getBoxRect(boxEl) {
  const rect = boxEl.getBoundingClientRect();
  return {
    x: Math.max(0, Math.round(rect.left)),
    y: Math.max(0, Math.round(rect.top)),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}

async function ensureOcrWorker() {
  if (ocrReady && ocrWorker) return ocrWorker;
  const assetBase = getAssetBase();
  ocrWorker = await createWorker('eng', 1, {
    workerPath: `${assetBase}worker.min.js`,
    corePath: `${assetBase}tesseract-core.wasm.js`,
    langPath: `${assetBase}lang`,
    logger: () => {},
  });
  await ocrWorker.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    tessedit_pageseg_mode: '7',
  });
  ocrReady = true;
  return ocrWorker;
}

async function captureNativeFrame() {
  // Usamos captureSample() porque es extremadamente rápido (10ms), silencioso
  // y previene las caídas por falta de memoria (OOM) al no cargar imágenes de 12MP+ del sensor.
  const sample = await CameraPreview.captureSample({ quality: 85 });
  if (!sample?.value) {
    throw new Error('No se pudo capturar frame de cámara');
  }
  return sample.value;
}

function cropToViewfinder(base64Image) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Recorte central para coincidir con la máscara de la interfaz (los corchetes amarillos)
      const cropW = Math.floor(img.width * 0.90);
      const cropH = Math.floor(img.height * 0.45);
      const sx = Math.floor((img.width - cropW) / 2);
      const sy = Math.floor((img.height - cropH) / 2);

      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
      resolve(canvasToBase64(canvas));
    };
    img.onerror = () => resolve(base64Image);
    img.src = 'data:image/jpeg;base64,' + base64Image;
  });
}

// Preprocesamiento de imagen para mejorar OCR en patentes con bajo contraste
// (fondo rojo/bordó con letras blancas de las patentes antiguas)
function preprocessForOcr(base64Image, invert = false) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      // Paso 1: Dibujar con filtros de escala de grises y alto contraste
      ctx.filter = 'grayscale(100%) contrast(200%) brightness(110%)';
      ctx.drawImage(img, 0, 0);

      // Paso 2: Si se pide invertir, aplicar inversión de colores (para patentes oscuras sobre claro)
      if (invert) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];       // R
          data[i + 1] = 255 - data[i + 1]; // G
          data[i + 2] = 255 - data[i + 2]; // B
        }
        ctx.putImageData(imageData, 0, 0);
      }

      resolve(canvasToBase64(canvas));
    };
    img.onerror = () => resolve(base64Image); // Fallback: usar imagen original
    img.src = 'data:image/jpeg;base64,' + base64Image;
  });
}

async function recognizeWithMlKit(base64Image) {
  const result = await CapacitorPluginMlKitTextRecognition.detectText({
    base64Image: stripBase64(base64Image),
    rotation: 0,
  });
  lastRawText = result.text || '';
  const plate = extractPlateFromMlKitResult(result);
  return { plate, rawText: lastRawText, mlResult: result };
}

async function recognizeWithTesseract(canvas) {
  const worker = await ensureOcrWorker();
  const scaled = document.createElement('canvas');
  scaled.width = canvas.width * 2;
  scaled.height = canvas.height * 2;
  const ctx = scaled.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
  const { data } = await worker.recognize(scaled);
  lastRawText = data.text || '';
  const plate = extractPlate(lastRawText);
  return { plate, rawText: lastRawText };
}

function captureWebFrame(videoEl, canvasEl) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return null;

  const cropW = Math.floor(vw * 0.92);
  const cropH = Math.floor(vh * 0.45);
  const sx = Math.floor((vw - cropW) / 2);
  const sy = Math.floor((vh - cropH) / 2);

  canvasEl.width = cropW;
  canvasEl.height = cropH;
  const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(videoEl, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
  return canvasEl;
}

export async function startCameraPreview(boxEl) {
  if (!useNativePreview) {
    return startCameraWeb(document.getElementById('camera-preview'));
  }

  try {
    await CameraPreview.stop();
  } catch {
    /* ignore */
  }

  // Iniciamos en pantalla completa para máxima resolución de cámara
  await CameraPreview.start({
    position: 'rear',
    x: 0,
    y: 0,
    width: window.screen.width,
    height: window.screen.height,
    toBack: true,
    disableAudio: true,
    enableZoom: true,
  });

  previewActive = true;
  return true;
}

export async function startCameraWeb(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
  videoEl.srcObject = stream;
  videoEl.setAttribute('playsinline', 'true');
  videoEl.muted = true;
  await videoEl.play();
  return stream;
}

export async function stopCamera(stream, videoEl) {
  stopAutoScan();
  if (previewActive) {
    try {
      await CameraPreview.stop();
    } catch {
      /* ignore */
    }
    previewActive = false;
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (videoEl) {
    videoEl.srcObject = null;
  }
}

export async function setFlashlight(enabled, cameraStream) {
  if (previewActive) {
    try {
      await CameraPreview.setFlashMode({ flashMode: enabled ? 'torch' : 'off' });
      return true;
    } catch {
      /* fallback below */
    }
  }

  if (cameraStream) {
    const track = cameraStream.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({ advanced: [{ torch: enabled }] });
        return true;
      } catch {
        /* ignore */
      }
    }
  }
  return false;
}

export async function preloadOcr() {
  if (useNativePreview) {
    try {
      const warm = document.createElement('canvas');
      warm.width = 64;
      warm.height = 32;
      const ctx = warm.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 64, 32);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('AB123CD', 4, 22);
      await recognizeWithMlKit(canvasToBase64(warm));
    } catch (e) {
      console.warn('ML Kit warmup:', e);
    }
    return;
  }
  await ensureOcrWorker();
}

function canvasToBase64(canvas) {
  return stripBase64(canvas.toDataURL('image/jpeg', 0.92));
}

export async function recognizePlateFromVideo(videoEl, canvasEl) {
  if (previewActive) {
    const base64Raw = await captureNativeFrame();
    const base64Cropped = await cropToViewfinder(base64Raw);

    // Intento 1: imagen con preprocesamiento (escala de grises + alto contraste)
    const processed = await preprocessForOcr(base64Cropped, false);
    const result1 = await recognizeWithMlKit(processed);
    if (result1.plate && scorePlate(result1.plate) >= 90) {
      return {
        plate: result1.plate,
        display: formatPlateDisplay(result1.plate),
        rawText: result1.rawText,
      };
    }

    // Intento 2: imagen original sin preprocesar (a veces ML Kit lee mejor sin filtros)
    const result2 = await recognizeWithMlKit(base64Cropped);
    if (result2.plate && scorePlate(result2.plate) > scorePlate(result1.plate || '')) {
      return {
        plate: result2.plate,
        display: formatPlateDisplay(result2.plate),
        rawText: result2.rawText,
      };
    }

    // Intento 3: imagen invertida (para patentes con letras oscuras sobre fondo claro)
    if (!result1.plate && !result2.plate) {
      const inverted = await preprocessForOcr(base64Cropped, true);
      const result3 = await recognizeWithMlKit(inverted);
      if (result3.plate) {
        return {
          plate: result3.plate,
          display: formatPlateDisplay(result3.plate),
          rawText: result3.rawText,
        };
      }
    }

    // Devolver el mejor resultado que tengamos
    const best = (result1.plate ? result1 : result2);
    return {
      plate: best.plate,
      display: best.plate ? formatPlateDisplay(best.plate) : null,
      rawText: best.rawText || result1.rawText,
    };
  }

  const frame = captureWebFrame(videoEl, canvasEl);
  if (!frame) {
    throw new Error('La cámara aún no está lista');
  }

  const { plate, rawText } = await recognizeWithTesseract(frame);
  return {
    plate,
    display: plate ? formatPlateDisplay(plate) : null,
    rawText,
  };
}

export function getLastRawText() {
  return lastRawText;
}

export function startAutoScan(videoEl, canvasEl, onDetected, onStatus) {
  stopAutoScan();
  autoScanCallback = onDetected;
  let busy = false;
  let attempts = 0;

  autoScanTimer = setInterval(async () => {
    if (busy) return;
    if (!previewActive && (!videoEl || !videoEl.videoWidth)) return;

    busy = true;
    attempts += 1;
    try {
      if (onStatus) onStatus(`Escaneando... (${attempts})`);
      const result = await recognizePlateFromVideo(videoEl, canvasEl);
      if (onStatus) {
        onStatus(result.plate ? 'Patente encontrada' : `Buscando... ${result.rawText ? result.rawText.slice(0, 20) : ''}`);
      }
      if (result.plate && autoScanCallback) {
        stopAutoScan();
        autoScanCallback(result);
      }
    } catch (e) {
      console.warn('Auto-scan:', e);
      if (onStatus) onStatus('Error de lectura, reintentando...');
    } finally {
      busy = false;
    }
  }, 500);
}

export function stopAutoScan() {
  if (autoScanTimer) {
    clearInterval(autoScanTimer);
    autoScanTimer = null;
  }
  autoScanCallback = null;
}

if (typeof window !== 'undefined') {
  window.RondaFilesystem = Filesystem;
  window.RondaDirectory = Directory;
  window.RondaShare = Share;
}

export { formatPlateDisplay };
