#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export JAVA_HOME="$ROOT/.tools/jdk-21"
export ANDROID_HOME="$ROOT/.tools/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

cd "$ROOT"
npm run cap:sync
cd android
chmod +x gradlew
./gradlew assembleDebug

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK" ]; then
  cp "$APK" "$ROOT/estacionascan.apk"
  echo ""
  echo "APK generado: $ROOT/estacionascan.apk"
  ls -lh "$ROOT/estacionascan.apk"
fi
