"""One-time consent for the Academy channel's YouTube Analytics access.

Run with `cuenv task consent`, which supplies Python and google-auth-oauthlib
from nixpkgs, and the Google OAuth client and Infisical machine identity from
1Password. It opens Google
consent in the browser, checks the grant is for exactly the Academy channel,
writes the OAuth client and refresh token to Infisical (/projects/basin), and
starts the deploy workflow that uploads them to the Worker. Nothing is written
to disk. Run it again whenever the alert says the grant was revoked.

`cuenv task mcp-owner` runs it with `mcp-owner`: Google sign-in (openid only)
to learn the owner's Google account ID, then the MCP's Web OAuth client (from
1Password) and that ID are written to Infisical for the analytics MCP sign-in.
"""
import base64
import contextlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

from google_auth_oauthlib.flow import InstalledAppFlow

CHANNEL = "UCrber_mFvp_FEF7D9u8PDEA"
SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]
INFISICAL = "https://app.infisical.com"
INFISICAL_PROJECT = "6575a392d7a5ef0555ade86b"
INFISICAL_ENVIRONMENT = "production"
SECRET_NAMES = ("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN")
MCP_SECRET_NAMES = ("MCP_GOOGLE_CLIENT_ID", "MCP_GOOGLE_CLIENT_SECRET", "MCP_OWNER_GOOGLE_SUB")
INFISICAL_PATH = "/projects/basin"
DEPLOY_WORKFLOW = "rawkode-academy-platform-youtube-control-default.yml"


def client_config() -> dict:
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise SystemExit("The Google OAuth client ID and secret weren't supplied; run this with `cuenv task consent`.")
    return {"installed": {
        "client_id": client_id,
        "client_secret": client_secret,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["http://localhost"],
    }}


def consent(config: dict):
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


def owner_sub(config: dict) -> str:
    flow = InstalledAppFlow.from_client_config(config, ["openid"], autogenerate_code_verifier=True)
    print("Opening Google sign-in: choose the Google account that will connect the analytics MCP.", file=sys.stderr)
    with contextlib.redirect_stdout(sys.stderr):
        credentials = flow.run_local_server(host="127.0.0.1", port=0, open_browser=True, timeout_seconds=300, prompt="select_account")
    # The ID token came straight from Google's token endpoint over TLS, so its
    # claims can be read without re-verifying the signature here.
    payload = credentials.id_token.split(".")[1] if credentials.id_token else ""
    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)) or b"{}") if payload else {}
    sub = str(claims.get("sub", ""))
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", sub):
        raise SystemExit("Google didn't return an account ID; nothing was saved.")
    return sub


def mcp_client() -> tuple[str, str]:
    client_id = os.environ.get("MCP_GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("MCP_GOOGLE_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise SystemExit("The MCP's Google Web OAuth client wasn't supplied; run this with `cuenv task mcp-owner`.")
    return client_id, client_secret


def store(values: tuple[str, ...], names: tuple[str, ...] = SECRET_NAMES):
    status, login = infisical("POST", "/api/v1/auth/universal-auth/login", body={
        "clientId": os.environ["INFISICAL_UNIVERSAL_AUTH_CLIENT_ID"],
        "clientSecret": os.environ["INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET"],
    })
    if status != 200 or "accessToken" not in login:
        raise SystemExit(f"Infisical login failed (HTTP {status}); nothing was saved.")
    token = login["accessToken"]
    scope = {"workspaceId": INFISICAL_PROJECT, "environment": INFISICAL_ENVIRONMENT, "secretPath": INFISICAL_PATH}
    for index, name in enumerate(names):
        value = values[index]
        exists, _ = infisical("GET", f"/api/v3/secrets/raw/{name}", token, query=scope)
        status, _ = infisical("PATCH" if exists == 200 else "POST", f"/api/v3/secrets/raw/{name}", token, body={**scope, "secretValue": value, "type": "shared"})
        if status != 200:
            raise SystemExit(f"Writing credential {index + 1} of {len(names)} to Infisical failed (HTTP {status}).")
    print(f"Saved {len(names)} values to Infisical {INFISICAL_PATH}.", file=sys.stderr)


def deploy():
    try:
        subprocess.run(["gh", "workflow", "run", DEPLOY_WORKFLOW, "--repo", "rawkode-academy/rawkode-academy", "--ref", "main"], check=True, stdout=subprocess.DEVNULL)
        print("Started the deploy workflow; it uploads the new credential to the Worker.", file=sys.stderr)
    except (OSError, subprocess.CalledProcessError):
        print(f"Couldn't start {DEPLOY_WORKFLOW} (not on main yet, or gh isn't signed in). The next deploy from main uploads the credential.", file=sys.stderr)


def main():
    if sys.argv[1:] == ["mcp-owner"]:
        client = mcp_client()
        store((*client, owner_sub(client_config())), MCP_SECRET_NAMES)
        deploy()
        return
    credentials = consent(client_config())
    store((credentials.client_id, credentials.client_secret, credentials.refresh_token))
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
