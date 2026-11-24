"""One-time consent for the Academy channel's YouTube Analytics access.

Run with `cuenv task consent`, which supplies Python and google-auth-oauthlib
from nixpkgs and the Infisical machine identity from 1Password. It opens Google
consent in the browser, checks the grant is for exactly the Academy channel,
writes the OAuth client and refresh token to Infisical (/projects/basin), and
starts the deploy workflow that uploads them to the Worker. Nothing is written
to disk. Run it again whenever the alert says the grant was revoked.
"""
import contextlib
import glob
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

CHANNEL = "UCrber_mFvp_FEF7D9u8PDEA"
SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]
INFISICAL = "https://app.infisical.com"
INFISICAL_PROJECT = "6575a392d7a5ef0555ade86b"
INFISICAL_ENVIRONMENT = "production"
# Secret names, kept apart from their values so that only these constants are logged.
SECRET_NAMES = ("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN")
INFISICAL_PATH = "/projects/basin"
DEPLOY_WORKFLOW = "rawkode-academy-platform-youtube-control-default.yml"


def client_file() -> Path:
    found = glob.glob(os.path.expanduser("~/Downloads/client_secret_*.apps.googleusercontent.com.json"))
    default = found[0] if len(found) == 1 else ""
    answer = input(f"Google Desktop OAuth client JSON [{default or 'path'}]: ").strip()
    path = Path(answer or default).expanduser()
    if not path.is_file():
        raise SystemExit(f"No such file: {path}")
    return path


def consent(config: dict):
    installed = config.get("installed")
    if not installed:
        raise SystemExit("Use a Desktop app OAuth client from Google Cloud.")
    # Restrict endpoints even if the supplied config is edited or untrusted.
    installed["auth_uri"] = "https://accounts.google.com/o/oauth2/auth"
    installed["token_uri"] = "https://oauth2.googleapis.com/token"
    flow = InstalledAppFlow.from_client_config(config, SCOPES, autogenerate_code_verifier=True)
    print("Opening Google consent: choose the Rawkode Academy channel.", file=sys.stderr)
    with contextlib.redirect_stdout(sys.stderr):
        credentials = flow.run_local_server(host="127.0.0.1", port=0, open_browser=True, timeout_seconds=300, access_type="offline", prompt="consent")
    if not credentials.refresh_token:
        raise SystemExit("Google did not issue a refresh token; nothing was saved.")
    if not set(SCOPES).issubset(set(credentials.granted_scopes or credentials.scopes or [])):
        raise SystemExit("YouTube and YouTube Analytics read access are both required; nothing was saved.")
    response = flow.authorized_session().get("https://www.googleapis.com/youtube/v3/channels", params={"part": "id", "mine": "true"}, timeout=30)
    body = response.json() if response.status_code == 200 else {}
    channels = body.get("items", [])
    if len(channels) != 1 or channels[0].get("id") != CHANNEL or body.get("nextPageToken"):
        raise SystemExit("That grant isn't for exactly the Rawkode Academy channel; nothing was saved. Run again and pick the channel, not your personal account.")
    return credentials


def infisical(method: str, path: str, token: str | None = None, body: dict | None = None, query: dict | None = None):
    url = INFISICAL + path + ("?" + urllib.parse.urlencode(query) if query else "")
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        return error.code, {}


def store(values: tuple[str, str, str]):
    status, login = infisical("POST", "/api/v1/auth/universal-auth/login", body={
        "clientId": os.environ["INFISICAL_UNIVERSAL_AUTH_CLIENT_ID"],
        "clientSecret": os.environ["INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET"],
    })
    if status != 200 or "accessToken" not in login:
        raise SystemExit(f"Infisical login failed (HTTP {status}); nothing was saved.")
    token = login["accessToken"]
    scope = {"workspaceId": INFISICAL_PROJECT, "environment": INFISICAL_ENVIRONMENT, "secretPath": INFISICAL_PATH}
    for index, name in enumerate(SECRET_NAMES):
        value = values[index]
        exists, _ = infisical("GET", f"/api/v3/secrets/raw/{name}", token, query=scope)
        status, _ = infisical("PATCH" if exists == 200 else "POST", f"/api/v3/secrets/raw/{name}", token, body={**scope, "secretValue": value, "type": "shared"})
        if status != 200:
            raise SystemExit(f"Writing {name} to Infisical failed (HTTP {status}).")
        print(f"Saved {name} to Infisical {INFISICAL_PATH}.", file=sys.stderr)


def deploy():
    try:
        subprocess.run(["gh", "workflow", "run", DEPLOY_WORKFLOW, "--repo", "rawkode-academy/rawkode-academy", "--ref", "main"], check=True, stdout=subprocess.DEVNULL)
        print("Started the deploy workflow; it uploads the new credential to the Worker.", file=sys.stderr)
    except (OSError, subprocess.CalledProcessError):
        print(f"Couldn't start {DEPLOY_WORKFLOW} (not on main yet, or gh isn't signed in). The next deploy from main uploads the credential.", file=sys.stderr)


def main():
    path = client_file()
    config = json.loads(path.read_text())
    credentials = consent(config)
    store((credentials.client_id, credentials.client_secret, credentials.refresh_token))
    if input(f"Delete {path}? Infisical now holds its client ID and secret. [y/N] ").strip().lower() == "y":
        path.unlink()
        print(f"Deleted {path}.", file=sys.stderr)
    deploy()


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        raise SystemExit("Cancelled; nothing further was saved.") from None
    except SystemExit:
        raise
    except Exception as error:
        # OAuth and HTTP exceptions can carry tokens or callback URLs; never print them.
        raise SystemExit(f"Consent failed ({type(error).__name__}); no credential details were printed.") from None
