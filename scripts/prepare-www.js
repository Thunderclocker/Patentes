const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const src = path.join(root, 'control_de_estacionamiento.html');
const dest = path.join(root, 'www', 'index.html');
const tessDest = path.join(root, 'www', 'assets', 'tesseract');
const tessLangDest = path.join(tessDest, 'lang');

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyTesseractAssets() {
  const tessRoot = path.join(root, 'node_modules', 'tesseract.js', 'dist');
  const tessCore = path.join(root, 'node_modules', 'tesseract.js-core');

  copyFile(path.join(tessRoot, 'worker.min.js'), path.join(tessDest, 'worker.min.js'));
  copyFile(
    path.join(tessCore, 'tesseract-core.wasm.js'),
    path.join(tessDest, 'tesseract-core.wasm.js')
  );
  copyFile(
    path.join(tessCore, 'tesseract-core.wasm'),
    path.join(tessDest, 'tesseract-core.wasm')
  );

  fs.mkdirSync(tessLangDest, { recursive: true });
  const engCandidates = [
    path.join(root, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0', 'eng.traineddata.gz'),
    path.join(root, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'),
  ];
  for (const engPath of engCandidates) {
    if (fs.existsSync(engPath)) {
      copyFile(engPath, path.join(tessLangDest, 'eng.traineddata.gz'));
      break;
    }
  }
}

function copyExcelAssets() {
  const xlsxSrc = path.join(root, 'node_modules', 'xlsx-js-style', 'dist', 'xlsx.min.js');
  const xlsxDest = path.join(root, 'www', 'assets', 'xlsx.full.min.js');
  copyFile(xlsxSrc, xlsxDest);
}

async function bundleScanner() {
  await esbuild.build({
    entryPoints: [path.join(root, 'src', 'scanner.js')],
    outfile: path.join(root, 'www', 'assets', 'scanner.bundle.js'),
    bundle: true,
    format: 'iife',
    globalName: 'RondaScanner',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    sourcemap: false,
  });
}

let html = fs.readFileSync(src, 'utf8');

html = html
  .replace(
    '<script src="https://cdn.tailwindcss.com"></script>',
    '<script src="assets/tailwind.min.js"></script>'
  )
  .replace(
    /<link href="https:\/\/fonts\.googleapis\.com[^>]+>/,
    ''
  )
  .replace(
    '<script src="https://unpkg.com/lucide@latest"></script>',
    '<script src="assets/lucide.min.js"></script>'
  )
  .replace(
    "font-family: 'Plus Jakarta Sans', sans-serif;",
    "font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;"
  )
  .replace(
    '<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>',
    '<script src="assets/xlsx.full.min.js"></script>'
  );

if (!html.includes('scanner.bundle.js')) {
  html = html.replace(
    '    <!-- LÓGICA DE CONTROL DE LA APLICACIÓN -->\n    <script>',
    '    <!-- LÓGICA DE CONTROL DE LA APLICACIÓN -->\n    <script src="assets/scanner.bundle.js"></script>\n    <script>'
  );
}


async function main() {
  copyTesseractAssets();
  copyExcelAssets();
  await bundleScanner();
  fs.writeFileSync(dest, html);
  console.log('Build web completado: ML Kit OCR + auto-scan');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
