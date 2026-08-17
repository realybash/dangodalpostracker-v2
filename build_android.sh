#!/usr/bin/env bash
set -e

export TOOLS_DIR=/tmp/tools
mkdir -p $TOOLS_DIR

echo "=== STEP 1: Bootstrapping Toolchain (Java, Gradle, Android SDK) ==="

export JAVA_HOME=$TOOLS_DIR/jdk-21.0.6+7
export ANDROID_HOME=$TOOLS_DIR/android-sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$TOOLS_DIR/gradle-8.14.3/bin:$PATH

echo "Java version:"
java -version

echo "Gradle version:"
gradle -v | head -n 4

echo "Accepting Android SDK licenses and installing platforms..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true
sdkmanager "platforms;android-36" "build-tools;35.0.0" "platform-tools" > /dev/null 2>&1

echo "=== STEP 2: Building Web Assets & Syncing to Capacitor Android ==="
cd /app/applet
echo "sdk.dir=$TOOLS_DIR/android-sdk" > /app/applet/android/local.properties
npm run cap:build

echo "=== STEP 3: Initializing Gradle Wrapper in Android Project ==="
cd /app/applet/android
gradle wrapper
chmod +x gradlew

echo "=== STEP 4: Cleaning Android Build ==="
./gradlew clean --no-daemon

echo "=== STEP 5: Compiling Native Debug APK ==="
./gradlew assembleDebug --no-daemon

echo "=== STEP 6: Compiling Native Release APK (Unsigned) ==="
./gradlew assembleRelease --no-daemon

echo "=== STEP 7: Compiling Native Android App Bundle AAB (Unsigned) ==="
./gradlew bundleRelease --no-daemon

echo "=== STEP 8: Listing Generated Native Artifacts ==="
ls -lh /app/applet/android/app/build/outputs/apk/debug/app-debug.apk
ls -lh /app/applet/android/app/build/outputs/apk/release/app-release-unsigned.apk || true
ls -lh /app/applet/android/app/build/outputs/bundle/release/app-release.aab || true

echo "=== ANDROID BUILD PIPELINE COMPLETED SUCCESSFULLY ==="
