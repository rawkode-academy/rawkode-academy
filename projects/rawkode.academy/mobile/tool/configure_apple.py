"""Configure generated iOS and macOS runners for the native OIDC callback."""
from pathlib import Path
import plistlib

scheme = 'academy.rawkode.app'
for platform in ('ios', 'macos'):
    path = Path(platform) / 'Runner' / 'Info.plist'
    if not path.exists():
        continue
    with path.open('rb') as source:
        info = plistlib.load(source)
    types = info.setdefault('CFBundleURLTypes', [])
    if not any(scheme in entry.get('CFBundleURLSchemes', []) for entry in types):
        types.append({'CFBundleTypeRole': 'Editor', 'CFBundleURLSchemes': [scheme]})
    with path.open('wb') as target:
        plistlib.dump(info, target, sort_keys=False)

# The sandboxed macOS runner needs outbound network access for auth and media.
for name in ('DebugProfile.entitlements', 'Release.entitlements'):
    path = Path('macos/Runner') / name
    if not path.exists():
        continue
    with path.open('rb') as source:
        entitlements = plistlib.load(source)
    entitlements['com.apple.security.network.client'] = True
    entitlements.setdefault('keychain-access-groups', [])
    with path.open('wb') as target:
        plistlib.dump(entitlements, target, sort_keys=False)
