#!/usr/bin/env bash
# Script to generate Android launcher icons (Legacy, Round, and Adaptive Foreground)
# from a high-resolution source image using ImageMagick (convert).

set -euo pipefail

SOURCE="/home/cristian/.gemini/antigravity/brain/d454fb1d-3fc8-455b-b447-436133574d32/media__1782332061021.jpg"
RES_DIR="/home/cristian/Escritorio/Estacionamiento/android/app/src/main/res"

if [ ! -f "$SOURCE" ]; then
  echo "Error: Source file $SOURCE not found."
  exit 1
fi

echo "Generando iconos desde: $SOURCE"

# 1. Crear una versión circular con fondo transparente a 1024x1024
convert "$SOURCE" -alpha on \
  \( +clone -threshold -1 -draw "circle 512,512 512,0" \) \
  -compose CopyOpacity -composite /tmp/round_source.png

# Densidades y tamaños
# formato: folder_suffix|legacy_size|foreground_canvas_size|foreground_circle_size
DENSITIES=(
  "mdpi|48|108|72"
  "hdpi|72|162|108"
  "xhdpi|96|216|144"
  "xxhdpi|144|324|216"
  "xxxhdpi|192|432|288"
)

for item in "${DENSITIES[@]}"; do
  IFS='|' read -r suffix legacy_size fg_canvas fg_circle <<< "$item"
  dir="$RES_DIR/mipmap-$suffix"
  mkdir -p "$dir"
  
  echo "Procesando mipmap-$suffix..."
  
  # a. Legacy icon (cuadrado original redimensionado)
  convert "$SOURCE" -resize "${legacy_size}x${legacy_size}" "$dir/ic_launcher.png"
  
  # b. Round icon (circular redimensionado)
  convert /tmp/round_source.png -resize "${legacy_size}x${legacy_size}" "$dir/ic_launcher_round.png"
  
  # c. Adaptive Foreground icon (círculo redimensionado centrado en canvas transparente)
  # Redimensionar el círculo al tamaño seguro
  convert /tmp/round_source.png -resize "${fg_circle}x${fg_circle}" /tmp/fg_temp.png
  # Crear canvas transparente del tamaño requerido y sobreponer el círculo en el centro
  convert -size "${fg_canvas}x${fg_canvas}" xc:none /tmp/fg_temp.png -gravity center -composite "$dir/ic_launcher_foreground.png"
done

# Limpieza
rm -f /tmp/round_source.png /tmp/fg_temp.png

echo "Iconos generados exitosamente!"
