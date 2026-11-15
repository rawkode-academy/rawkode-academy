# Rawkode Academy Flutter app

Native Flutter work in progress for Android, iOS, and desktop. Kubele, CNIcon, account sign-in, the course catalog, and video playback have initial implementations. The Android workflow generates platform files and uploads a debug APK after analysis and tests. Production readiness requires end-to-end validation, additional approved features, platform setup and testing, and rollout of the matching identity and website API changes.

The mobile OAuth client and API routes in the identity and website projects must be deployed before the app can sign in or load its catalog and canonical game data. Apply the identity database migration as part of the normal deployment. Until those changes are deployed, an APK built from this branch cannot complete these flows against production services.

For local development, install Flutter and run `flutter create --platforms=android,ios,linux,macos,windows .`, `python3 tool/configure_android.py`, `flutter pub get`, `flutter test`, and `flutter run`. Platform builds require their respective SDKs and supported host operating systems. Android callback setup is automated by the script; other platforms need their own OAuth redirect and plugin configuration before they can be used.
