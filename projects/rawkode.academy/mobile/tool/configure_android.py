"""Configure the generated Android project for network access and AppAuth."""
from pathlib import Path

root = Path('android/app')
path = root / 'build.gradle.kts'
if path.exists():
    text = path.read_text()
    before = 'defaultConfig {'
    after = 'defaultConfig {\n        manifestPlaceholders["appAuthRedirectScheme"] = "academy.rawkode.app"'
    old_min = 'minSdk = flutter.minSdkVersion'
    new_min = 'minSdk = 23'
else:
    path = root / 'build.gradle'
    text = path.read_text()
    before = 'defaultConfig {'
    after = 'defaultConfig {\n        manifestPlaceholders += [appAuthRedirectScheme: "academy.rawkode.app"]'
    candidates = [('minSdkVersion flutter.minSdkVersion', 'minSdkVersion 23'), ('minSdk = flutter.minSdkVersion', 'minSdk = 23')]
    matches = [(old, new) for old, new in candidates if old in text]
    if len(matches) != 1:
        raise SystemExit('Unexpected Android minimum SDK template')
    old_min, new_min = matches[0]
if before not in text or 'appAuthRedirectScheme' in text or old_min not in text:
    raise SystemExit('Unexpected Android Gradle template')
path.write_text(text.replace(before, after, 1).replace(old_min, new_min, 1))

manifest = root / 'src/main/AndroidManifest.xml'
xml = manifest.read_text()
# AppAuth's management activity must share the app's task. Flutter's empty
# task affinity causes the browser to close immediately as a cancelled flow.
empty_affinity = 'android:taskAffinity=""'
if xml.count(empty_affinity) != 1:
    raise SystemExit('Unexpected Android activity task affinity')
xml = xml.replace(empty_affinity, 'android:taskAffinity="${applicationId}"', 1)
permission = '<uses-permission android:name="android.permission.INTERNET"/>'
if permission not in xml:
    marker = '    <application'
    if marker not in xml:
        raise SystemExit('Unexpected Android manifest')
    xml = xml.replace(marker, f'    {permission}\n{marker}', 1)
manifest.write_text(xml)
