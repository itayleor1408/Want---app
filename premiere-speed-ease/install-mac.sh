#!/bin/bash
# Installs Speed Ease for Premiere Pro (macOS). Run: bash install-mac.sh
set -e
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/SpeedEase"
for v in 9 10 11 12; do defaults write com.adobe.CSXS.$v PlayerDebugMode 1; done
rm -rf "$DEST"; mkdir -p "$DEST"
cp -R "$(dirname "$0")/CSXS" "$(dirname "$0")/css" "$(dirname "$0")/js" "$(dirname "$0")/jsx" "$(dirname "$0")/index.html" "$DEST/"
echo "Installed. Restart Premiere Pro -> Window > Extensions > Speed Ease"
