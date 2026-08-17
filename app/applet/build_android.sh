#!/usr/bin/env bash
set -ex

export TOOLS_DIR=/tmp/tools
mkdir -p $TOOLS_DIR

export JAVA_HOME=$TOOLS_DIR/jdk-21.0.6+7
export ANDROID_HOME=$TOOLS_DIR/android-sdk
export GRADLE_HOME=$TOOLS_DIR/gradle-8.14.3

echo "=== STEP 1: Bootstrapping Toolchain (Java, Gradle, Android SDK) ==="

if [ ! -d "$JAVA_HOME" ]; then
  echo "Downloading OpenJDK 21..."
  cd $TOOLS_DIR
  wget -O openjdk21.tar.gz https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.6%2B7/OpenJDK21U-jdk_x64_linux_hotspot_21.0.6_7.tar.gz
  tar -xzf openjdk21.tar.gz
  rm -f openjdk21.tar.gz
fi

if [ ! -d "$GRADLE_HOME" ]; then
  echo "Downloading Gradle 8.14.3..."
  cd $TOOLS_DIR
  wget -O gradle.zip https://services.gradle.org/distributions/gradle-8.14.3-bin.zip
  unzip -q gradle.zip
  rm -f gradle.zip
fi

if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
  echo "Setting up Android SDK commandline tools..."
  mkdir -p $ANDROID_HOME/cmdline-tools
  cd $ANDROID_HOME/cmdline-tools
  wget -O cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  unzip -q cmdtools.zip
  if [ -d "cmdline-tools" ]; then
    mv cmdline-tools latest
  fi
  rm -f cmdtools.zip
fi

export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$GRADLE_HOME/bin:$PATH

echo "Java version:"
java -version

echo "Gradle version:"
gradle -v | head -n 4

echo "Pre-accepting Android SDK licenses..."
mkdir -p $ANDROID_HOME/licenses
echo "8933bad161af4178b1185d1a37fbf41ea5269c55" > $ANDROID_HOME/licenses/android-sdk-license
echo "d56f5187479451eabf01fb78af6dfcb131a64810" >> $ANDROID_HOME/licenses/android-sdk-license
echo "24333f1a436f9661d49eab137b545f22e8964893" > $ANDROID_HOME/licenses/android-sdk-arm-dbt-license

echo "Installing Android platforms and build-tools..."
sdkmanager --sdk_root=$ANDROID_HOME "platforms;android-36" "build-tools;35.0.0" "platform-tools"

echo "=== STEP 2: Building Web Assets & Syncing to Capacitor Android ==="
cd /app/applet
echo "sdk.dir=$ANDROID_HOME" > /app/applet/android/local.properties
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
