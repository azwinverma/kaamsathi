# KaamSathi mobile (कामसाथी)

Flutter app for KaamSathi: hajiri (attendance), talab (payroll) and worker
self-service for Nepal's blue-collar workforce. English + Nepali.

## Development

```sh
flutter pub get
flutter run                 # debug, talks to the local Django dev server
flutter analyze && flutter test
```

Without `API_BASE_URL`, debug/profile builds use the local backend:
`http://10.0.2.2:8000/api/v1` on the Android emulator and
`http://localhost:8000/api/v1` elsewhere (see `lib/core/config.dart`). On a
physical phone, point at your machine's LAN IP:

```sh
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:8000/api/v1
```

Cleartext HTTP only works in debug: Android's debug
`network_security_config.xml` allows it, iOS allows it only for local-network
hosts (`NSAllowsLocalNetworking`).

## API URL for release builds

Release builds read the API URL at compile time:

```sh
--dart-define=API_BASE_URL=https://api.<domain>/api/v1
```

If it is omitted, release builds fall back to `AppConfig.productionBaseUrl`
(`https://api.kaamsathi.com/api/v1` in `lib/core/config.dart`), never to
localhost. **Always pass `API_BASE_URL` explicitly for store builds** so the
target environment is visible in the build command. Release builds are
HTTPS-only (Android `src/main/res/xml/network_security_config.xml`, iOS ATS).

## Versioning

`version:` in `pubspec.yaml` is the single source of truth, e.g. `1.2.0+14`:

- `1.2.0` is the version name (Android `versionName`, iOS
  `CFBundleShortVersionString`).
- `14` is the build number (Android `versionCode`, iOS `CFBundleVersion`). It
  must increase for every upload to Play Console / App Store Connect.

Android reads these through `flutter.versionCode` / `flutter.versionName` in
`android/app/build.gradle.kts`; iOS through `$(FLUTTER_BUILD_NAME)` /
`$(FLUTTER_BUILD_NUMBER)` in `Info.plist`. You can override them per build with
`--build-name=1.2.0 --build-number=14`.

## Android release signing

1. Generate an upload keystore once (keep it and its passwords somewhere safe,
   e.g. a password manager; losing it means you cannot update the app without
   a Play Console key reset):

   ```sh
   keytool -genkey -v -keystore ~/kaamsathi-upload-keystore.jks \
     -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

2. Create `android/key.properties` (gitignored, copy from
   `android/key.properties.example`):

   ```properties
   storePassword=<keystore password>
   keyPassword=<key password>
   keyAlias=upload
   storeFile=/Users/<you>/kaamsathi-upload-keystore.jks
   ```

   `storeFile` may be absolute or relative to `android/app/`. `key.properties`,
   `*.jks` and `*.keystore` are all gitignored. Never commit them.

3. Enable Play App Signing in Play Console and upload the AAB signed with this
   upload key.

If `android/key.properties` is missing, the release build is **signed with the
debug key** and Gradle prints a large warning banner. That is fine for local
testing (`flutter build apk --release`) but such builds cannot go to Play.

Release builds are minified and resource-shrunk with R8
(`android/app/proguard-rules.pro`). If a release build crashes with a
`ClassNotFoundException`, add a targeted `-keep` rule there.

## Build commands

```sh
API=https://api.<domain>/api/v1

# Android APK (sideloading / testing)
flutter build apk --release --dart-define=API_BASE_URL=$API

# Android App Bundle (Play Store)
flutter build appbundle --release --dart-define=API_BASE_URL=$API
# -> build/app/outputs/bundle/release/app-release.aab

# iOS (App Store / TestFlight); needs Xcode, an Apple Developer team and
# signing set up in Xcode (Runner target -> Signing & Capabilities)
flutter build ipa --release --dart-define=API_BASE_URL=$API
# -> build/ios/ipa/*.ipa (upload with Transporter or `xcrun altool`)
```

The universal APK is ~80 MB (three ABIs); use `--split-per-abi` for smaller
sideload APKs. The AAB lets Play deliver per-device splits automatically.

Android toolchain: AGP 8.9.1, Kotlin 2.1.0, Gradle 8.12, compileSdk 36,
NDK 27.0.12077973. Gradle must run on **JDK 17 or 21** (JDK 24 fails with
"Unsupported class file major version 68"). If your default `java` is newer,
run `flutter config --jdk-dir=<path to JDK 17>` or export `JAVA_HOME` before
building.

Optionally add `--obfuscate --split-debug-info=build/symbols` and keep the
`build/symbols` folder for each release to symbolicate crash reports.

## iOS permissions and localisation

Permission prompts are in `ios/Runner/Info.plist` (English) and localised in
`ios/Runner/en.lproj/InfoPlist.strings` and `ios/Runner/ne.lproj/InfoPlist.strings`
(Nepali). Keep the three in sync when adding a permission. Used permissions:
camera (site QR scan for hajiri, document photos), location when in use
(confirm you are at the work site on check-in), photo library (upload ID /
certificate photos).
