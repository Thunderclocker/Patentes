# EstacionaScan

Aplicación web offline empaquetada con Capacitor para relevar patentes y ubicaciones durante una ronda de estacionamiento.

## Preparar el proyecto en Windows

Requisitos:

- Node.js 20 LTS o superior.
- Android Studio con Android SDK, para generar el APK.
- JDK 21; el JDK incluido en Android Studio también es compatible.

Desde PowerShell, en esta carpeta:

```powershell
.\npm-local.cmd ci
.\npm-local.cmd run doctor
.\npm-local.cmd test
```

Este equipo ya tiene una copia oficial y verificada de Node.js en `.tools/windows`. El wrapper `npm-local.cmd` permite usarla sin modificar el sistema ni depender del `PATH` global.

`node_modules` no se debe copiar entre Linux y Windows. Si el diagnóstico informa que `esbuild` pertenece a otra plataforma, eliminá `node_modules` y ejecutá nuevamente `npm ci`.

## Probar la aplicación en Windows

```powershell
.\npm-local.cmd start
```

Abrí `http://localhost:4173`. El navegador pedirá permiso para usar la cámara. En Windows se usa Tesseract.js; dentro del APK se usa ML Kit.

## Generar el APK

Con Android Studio y su SDK instalados:

```powershell
.\npm-local.cmd run android:apk
```

El comando detecta el JDK y el SDK, actualiza el archivo local ignorado `android/local.properties`, sincroniza Capacitor, compila con `gradlew.bat` y copia el resultado a:

```text
estacionascan.apk
```

Después, instalá ese archivo en el teléfono para comprobar cámara, enfoque, linterna, OCR nativo y exportación.

## Comandos

- `.\npm-local.cmd test`: pruebas estrictas del reconocimiento de patentes.
- `.\npm-local.cmd run test:exploratory`: casos exploratorios que muestran lecturas aproximadas.
- `.\npm-local.cmd run build:web`: genera `www/` con todos los recursos offline.
- `.\npm-local.cmd start`: genera y sirve la aplicación web en Windows.
- `.\npm-local.cmd run android:apk`: genera y verifica el APK completo.
