"""Check the merged Android manifest used by the APK's OAuth callback."""
from pathlib import Path
from xml.etree import ElementTree

namespace = "{http://schemas.android.com/apk/res/android}"
manifests = list(Path("build/app/intermediates/merged_manifests/debug").rglob("AndroidManifest.xml"))
if len(manifests) != 1:
    raise SystemExit(f"Expected one merged debug manifest, found {len(manifests)}")

root = ElementTree.parse(manifests[0]).getroot()
activities = root.findall("./application/activity")
main = next((activity for activity in activities if activity.get(f"{namespace}name", "").endswith(".MainActivity")), None)
if main is None or main.get(f"{namespace}taskAffinity") != root.get("package"):
    raise SystemExit("MainActivity must share the application task with AppAuth")
manager = next((activity for activity in activities if activity.get(f"{namespace}name") == "net.openid.appauth.AuthorizationManagementActivity"), None)
app = root.find("application")
default_affinity = app.get(f"{namespace}taskAffinity", root.get("package")) if app is not None else None
if (manager is None or manager.get(f"{namespace}exported") != "false" or
    manager.get(f"{namespace}taskAffinity", default_affinity) != main.get(f"{namespace}taskAffinity")):
    raise SystemExit("AppAuth management activity must be private and share the app task")
receiver = next((activity for activity in activities if activity.get(f"{namespace}name") == "net.openid.appauth.RedirectUriReceiverActivity"), None)
if receiver is None or receiver.get(f"{namespace}exported") != "true":
    raise SystemExit("AppAuth redirect receiver is missing or not exported")

for intent_filter in receiver.findall("intent-filter"):
    actions = {node.get(f"{namespace}name") for node in intent_filter.findall("action")}
    categories = {node.get(f"{namespace}name") for node in intent_filter.findall("category")}
    schemes = {node.get(f"{namespace}scheme") for node in intent_filter.findall("data")}
    if ("android.intent.action.VIEW" in actions and
        {"android.intent.category.DEFAULT", "android.intent.category.BROWSABLE"} <= categories and
        "academy.rawkode.app" in schemes):
        print("Android AppAuth redirect receiver is registered")
        break
else:
    raise SystemExit("AppAuth redirect scheme or intent filter is missing")
