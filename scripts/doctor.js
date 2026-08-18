const fs = require('fs');
const path = require('path');
const { findAndroidSdk, findJavaHome } = require('./platform-paths');

const root = path.join(__dirname, '..');
let failures = 0;

function report(ok, label, required = true) {
  console.log(`${ok ? '[OK]' : required ? '[ERROR]' : '[AVISO]'} ${label}`);
  if (!ok && required) failures += 1;
}

const major = Number(process.versions.node.split('.')[0]);
report(major >= 20, `Node.js ${process.versions.node} (se requiere 20 o superior)`);
report(fs.existsSync(path.join(root, 'node_modules')), 'Dependencias instaladas');

let esbuildWorks = false;
try {
  const esbuild = require('esbuild');
  esbuild.transformSync('const value = 1;', { minify: true });
  esbuildWorks = true;
} catch {
  // El mensaje de doctor indica cómo repararlo.
}
report(esbuildWorks, 'esbuild corresponde a Windows; si falla, ejecutá npm ci');

const tesseractDataAvailable = [
  path.join(root, 'www', 'assets', 'tesseract', 'lang', 'eng.traineddata.gz'),
  path.join(root, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0', 'eng.traineddata.gz'),
  path.join(root, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'),
].some((candidate) => fs.existsSync(candidate));
report(tesseractDataAvailable, 'Datos offline de Tesseract');
report(Boolean(findJavaHome()), 'JDK disponible para compilar Android', false);
report(Boolean(findAndroidSdk()), 'Android SDK disponible para compilar el APK', false);

if (failures > 0) process.exit(1);
