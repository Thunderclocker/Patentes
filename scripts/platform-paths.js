const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function isDirectory(candidate) {
  return Boolean(candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
}

function findJavaHome() {
  const candidates = [process.env.JAVA_HOME];

  if (process.platform === 'win32') {
    const portableRoot = path.join(__dirname, '..', '.tools', 'windows');
    if (isDirectory(portableRoot)) {
      const portableJdks = fs.readdirSync(portableRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('jdk-21'))
        .map((entry) => path.join(portableRoot, entry.name));
      candidates.push(...portableJdks);
    }
    candidates.push(
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'jdk-21.0.8.9-hotspot')
    );
  } else {
    candidates.push(path.join(__dirname, '..', '.tools', 'jdk-21'));
  }

  for (const candidate of candidates) {
    if (!isDirectory(candidate)) continue;
    const executable = path.join(candidate, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    if (fs.existsSync(executable)) return path.resolve(candidate);
  }

  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  const located = spawnSync(locator, ['java'], { encoding: 'utf8' });
  if (located.status === 0) {
    const executable = located.stdout.split(/\r?\n/).find(Boolean);
    if (executable) return path.dirname(path.dirname(executable.trim()));
  }
  return null;
}

function findAndroidSdk() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT];

  if (process.platform === 'win32') {
    candidates.push(
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Android', 'Sdk'),
      path.join(__dirname, '..', '.tools', 'windows', 'android-sdk')
    );
  } else {
    candidates.push(path.join(__dirname, '..', '.tools', 'android-sdk'));
  }

  for (const candidate of candidates) {
    if (!isDirectory(candidate)) continue;
    const adb = path.join(candidate, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
    if (fs.existsSync(adb)) return path.resolve(candidate);
  }
  return null;
}

module.exports = { findAndroidSdk, findJavaHome };
