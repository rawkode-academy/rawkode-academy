"""Owner sign-in setup for the Rawkode Tools MCP server.

Run with `cuenv task owner`, which supplies Python and google-auth-oauthlib
from the flake, and the OAuth clients and Infisical machine identity from
1Password. It signs in with Google (openid only) through the Desktop OAuth
client to learn the owner's Google account ID, writes that ID and the MCP's
Web OAuth client to Infisical (/projects/basin), and starts the deploy
workflow. Google account IDs are the same for every OAuth client, so the
Desktop client's sign-in identifies the account the Web client will see.
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

INFISICAL = "https://app.infisical.com"
INFISICAL_PROJECT = "6575a392d7a5ef0555ade86b"
INFISICAL_ENVIRONMENT = "production"
INFISICAL_PATH = "/projects/basin"
SECRET_NAMES = ("MCP_GOOGLE_CLIENT_ID", "MCP_GOOGLE_CLIENT_SECRET", "MCP_OWNER_GOOGLE_SUB")
DEPLOY_WORKFLOW = "rawkode-tools-mcp-default.yml"


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"{name} wasn't supplied; run this with `cuenv task owner`.")
    return value


def owner_sub() -> str:
    config = {"installed": {
        "client_id": required("GOOGLE_OAUTH_CLIENT_ID"),
        "client_secret": required("GOOGLE_OAUTH_CLIENT_SECRET"),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["http://localhost"],
    }}
    flow = InstalledAppFlow.from_client_config(config, ["openid"], autogenerate_code_verifier=True)
    print("Opening Google sign-in: choose the account that will approve MCP connections.", file=sys.stderr)
    with contextlib.redirect_stdout(sys.stderr):
        credentials = flow.run_local_server(host="127.0.0.1", port=0, open_browser=True, timeout_seconds=300, prompt="select_account")
    # The ID token came straight from Google's token endpoint over TLS, so its
    # claims can be read without re-verifying the signature here.
    parts = (credentials.id_token or "").split(".")
    payload = parts[1] if len(parts) == 3 else ""
    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))) if payload else {}
    sub = str(claims.get("sub", ""))
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", sub):
        raise SystemExit("Google didn't return an account ID; nothing was saved.")
    return sub


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


def store(values: tuple[str, ...]):
    status, login = infisical("POST", "/api/v1/auth/universal-auth/login", body={
        "clientId": required("INFISICAL_UNIVERSAL_AUTH_CLIENT_ID"),
        "clientSecret": required("INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET"),
    })
    if status != 200 or "accessToken" not in login:
        raise SystemExit(f"Infisical login failed (HTTP {status}); nothing was saved.")
    token = login["accessToken"]
    scope = {"workspaceId": INFISICAL_PROJECT, "environment": INFISICAL_ENVIRONMENT, "secretPath": INFISICAL_PATH}
    for index, name in enumerate(SECRET_NAMES):
        exists, _ = infisical("GET", f"/api/v3/secrets/raw/{name}", token, query=scope)
        status, _ = infisical("PATCH" if exists == 200 else "POST", f"/api/v3/secrets/raw/{name}", token, body={**scope, "secretValue": values[index], "type": "shared"})
        if status != 200:
            raise SystemExit(f"Writing value {index + 1} of {len(SECRET_NAMES)} to Infisical failed (HTTP {status}).")
    print(f"Saved the MCP sign-in client and owner ID to Infisical {INFISICAL_PATH}.", file=sys.stderr)


def deploy():
    try:
        subprocess.run(["gh", "workflow", "run", DEPLOY_WORKFLOW, "--repo", "rawkode-academy/rawkode-academy", "--ref", "main"], check=True, stdout=subprocess.DEVNULL)
        print("Started the deploy workflow.", file=sys.stderr)
    except (OSError, subprocess.CalledProcessError):
        print(f"Couldn't start {DEPLOY_WORKFLOW} (not on main yet, or gh isn't signed in). The next deploy from main picks the values up.", file=sys.stderr)


def main():
    client = (required("MCP_GOOGLE_CLIENT_ID"), required("MCP_GOOGLE_CLIENT_SECRET"))
    store((*client, owner_sub()))
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
        raise SystemExit(f"Owner setup failed ({type(error).__name__}); no credential details were printed.") from None
