#!/bin/sh

# Build debug apk and load it on connected device or simulator
# Fails if more than one device is connected
# failing to get found?
#react-native bundle --dev false --platform android --entry-file index.js --bundle-output ./android/app/build/intermediates/assets/debug/index.android.bundle --assets-dest ./android/app/build/intermediates/res/merged/debug
cd android
./gradlew assembleDebug
cd ..
echo "Uninstalling previous apk..."
adb uninstall com.murphysw.golfmover
echo "Installing new debug apk..."
adb install android/app/build/outputs/apk/app-debug.apk
