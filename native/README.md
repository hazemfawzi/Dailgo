# Dailgo Today companion widgets

The website's `/today` shortcut is separate from these native home-screen widgets.
The widgets show read-only task titles from `/api/widgets/today`. Tokens are generated
by the signed-in user under Life tools → Home screen, expire in 30 days and can be
revoked individually. Neither widget can write to the workspace. No credentials are
included in source, builds or screenshots. A valid HTTPS server is required; HTTP and
redirects are rejected so a token cannot be forwarded to another host.

## Android

Open `android/` in Android Studio with JDK 17, Android SDK 35 and Gradle 8.9. Run
`gradle :app:assembleDebug :app:lintDebug` (the CI job does the same). Install the APK,
open Dailgo, paste the HTTPS origin and a read-only token, then add Dailgo from the
home-screen widget picker. Tokens are encrypted using Android Keystore; Android
backup is disabled. Updates are requested every 30 minutes and may be deferred by
the OS; the refresh button requests an immediate update. Production distribution
requires the owner's Android signing configuration; this repository does not create it.

## iPhone / iPad

On a Mac with Xcode 16+ and XcodeGen:

```sh
cd native/ios
xcodegen generate
xcodebuild -project DailgoWidget.xcodeproj -scheme Dailgo -sdk iphonesimulator \
  -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

For a physical phone, set your Apple development team and unique bundle identifiers
in `project.yml`, generate again, and enable the shared Keychain entitlement for the
app and widget extension. The access group must match both targets and the provisioning
profiles. The token is stored in that Keychain group, not in UserDefaults. Open the
companion app to enter the origin and token, then add Dailgo from the widget gallery.
iOS controls refresh frequency; the timeline requests 15-minute updates, which are
not a real-time guarantee. App Store/TestFlight publishing requires the owner's Apple
Developer account and signing profiles, and is not performed by the web deployment.

The Linux web workspace has no Android SDK, Gradle, Swift or Xcode. Native compilation
must pass the dedicated CI jobs; physical-device delivery, Keychain provisioning,
voice permissions and Push delivery require checks on the intended phone.
