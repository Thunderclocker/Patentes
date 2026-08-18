const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { findAndroidSdk, findJavaHome } = require('./platform-paths');

const root = path.join(__dirname, '..');
const androidDir = path.join(root, 'android');
const gradleOnly = process.argv.includes('--gradle-only');

function run(command, args, options = {}) {
  console.log(`> ${path.basename(command)} ${args.join(' ')}`);
  const needsWindowsShell = process.platform === 'win32' && /\.(bat|cmd)$/i.test(command);
  const executable = needsWindowsShell ? (process.env.ComSpec || 'cmd.exe') : command;
  const commandArgs = needsWindowsShell
    ? ['/d', '/c', 'call', command, ...args]
    : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

const javaHome = findJavaHome();
const androidSdk = findAndroidSdk();

if (!javaHome) {
  console.error('No se encontró un JDK compatible. Instalá Android Studio o JDK 21 y definí JAVA_HOME.');
  process.exit(1);
}
if (!androidSdk) {
  console.error('No se encontró el Android SDK para Windows. Instalalo desde Android Studio y definí ANDROID_HOME.');
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
};

let generatedApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (process.platform === 'win32') {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const externalBuildDir = path.join(localAppData, 'EstacionaScan', 'gradle-build');
  env.ESTACIONASCAN_BUILD_DIR = externalBuildDir;
  generatedApk = path.join(externalBuildDir, 'app', 'outputs', 'apk', 'debug', 'app-debug.apk');
}
env.PATH = [
  path.join(javaHome, 'bin'),
  path.join(androidSdk, 'platform-tools'),
  env.PATH || '',
].join(path.delimiter);

const sdkForGradle = androidSdk.replace(/\\/g, '/');
fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${sdkForGradle}\n`, 'utf8');

if (!gradleOnly) {
  run(process.execPath, [path.join(root, 'scripts', 'prepare-www.js')], { env });
  run(process.execPath, [path.join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'], { env });
}

const gradle = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
run(gradle, ['assembleDebug', '--no-daemon', '--no-watch-fs'], { cwd: androidDir, env });

if (!fs.existsSync(generatedApk)) {
  console.error(`Gradle terminó sin generar el APK esperado: ${generatedApk}`);
  process.exit(1);
}

const destination = path.join(root, 'estacionascan.apk');
fs.copyFileSync(generatedApk, destination);
const sizeMb = (fs.statSync(destination).size / 1024 / 1024).toFixed(1);
console.log(`APK verificado: ${destination} (${sizeMb} MB)`);
