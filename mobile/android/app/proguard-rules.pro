# KaamSathi release R8 rules.
# Most plugins ship their own consumer ProGuard rules inside their AARs; these
# rules only cover what Flutter + our plugin set need beyond that. If a release
# build crashes with ClassNotFoundException / NoSuchMethodException, add a
# targeted -keep here (check build/app/outputs/mapping/release/missing_rules.txt).

# ---- Flutter embedding / engine ------------------------------------------
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugins.** { *; }      # GeneratedPluginRegistrant + first-party plugins
-dontwarn io.flutter.embedding.**

# Deferred components reference Play Core, which we do not bundle.
-dontwarn com.google.android.play.core.**

# ---- Plugin method-channel entry points ----------------------------------
# Plugins are instantiated reflectively by GeneratedPluginRegistrant.
-keep class * implements io.flutter.embedding.engine.plugins.FlutterPlugin { *; }

# flutter_secure_storage (Android Keystore + Tink; Tink pulls optional annotations)
-keep class com.it_nomads.fluttersecurestorage.** { *; }
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
-dontwarn com.google.crypto.tink.**

# mobile_scanner (CameraX + ML Kit barcode scanning)
-keep class dev.steenbakker.mobile_scanner.** { *; }
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-dontwarn com.google.mlkit.**

# geolocator (Play Services location / fused provider)
-keep class com.baseflow.geolocator.** { *; }
-dontwarn com.google.android.gms.**

# sqflite (used directly and by cached_network_image's cache manager)
-keep class com.tekartik.sqflite.** { *; }

# open_filex (FileProvider declared in the plugin manifest)
-keep class com.crazecoder.openfile.** { *; }

# image_picker / path_provider / shared_preferences / connectivity_plus are
# io.flutter.plugins.* or dev.fluttercommunity.plus.* and covered above/below.
-keep class dev.fluttercommunity.plus.** { *; }

# Keep annotations & generic signatures (needed by any reflection-based code).
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keepattributes SourceFile,LineNumberTable
