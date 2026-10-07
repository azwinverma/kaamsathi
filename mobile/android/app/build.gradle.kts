import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing: read android/key.properties (gitignored; see
// key.properties.example and mobile/README.md). When it is missing the release
// build falls back to the debug keystore so local `flutter build apk --release`
// still works -- such an artifact must NEVER be uploaded to the Play Store.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    FileInputStream(keystorePropertiesFile).use { keystoreProperties.load(it) }
}

android {
    namespace = "com.kaamsathi.app"
    // Pinned above Flutter 3.29's defaults (35 / 26.3): flutter_secure_storage 10
    // needs compileSdk 36 and current plugins are built against NDK 27.
    compileSdk = 36
    ndkVersion = "27.0.12077973"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        // Production application id.
        applicationId = "com.kaamsathi.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = keystoreProperties.getProperty("storeFile")?.let { file(it) }
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                // Warn loudly only when a release artifact is actually being built.
                // logger.quiet (not warn) so the banner survives `flutter build`,
                // which runs Gradle with -q and would hide WARN-level output.
                val buildingRelease = gradle.startParameter.taskNames.any {
                    it.contains("Release", ignoreCase = true)
                }
                if (buildingRelease) logger.quiet(
                    """
                    |
                    |==========================================================================
                    |  WARNING: android/key.properties not found.
                    |  The RELEASE build is being signed with the DEBUG keystore.
                    |  This APK/AAB is for local testing only -- Google Play will reject it.
                    |  See mobile/README.md ("Release signing") to set up an upload key.
                    |==========================================================================
                    |
                    """.trimMargin()
                )
                signingConfigs.getByName("debug")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

flutter {
    source = "../.."
}
