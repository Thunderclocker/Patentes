@echo off
set "NODE_DIR="
for /d %%D in ("%~dp0.tools\windows\node-v*-win-x64") do set "NODE_DIR=%%~fD"
if not defined NODE_DIR goto missing_node
if not exist "%NODE_DIR%\npm.cmd" goto missing_node
set "PATH=%NODE_DIR%;%PATH%"
call "%NODE_DIR%\npm.cmd" %*
exit /b %ERRORLEVEL%

:missing_node
echo No se encontro Node.js portatil en .tools\windows
echo Instala Node.js 20 o superior, o agrega su ZIP oficial a esa carpeta.
exit /b 1
