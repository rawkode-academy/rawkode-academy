# /// script
# requires-python = ">=3.11"
# dependencies = ["google-auth-oauthlib>=1.2.2,<2"]
# ///
"""Print the owner subject for MCP sign-in without authorizing a YouTube channel."""
import argparse
import json
import re
import secrets
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.id_token import verify_oauth2_token
from google_auth_oauthlib.flow import InstalledAppFlow


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client-secrets", required=True, help="Desktop OAuth client JSON from the same Google Cloud project")
    args = parser.parse_args()
    config = json.loads(Path(args.client_secrets).expanduser().read_text())
    if "installed" not in config:
        raise SystemExit("Use a Desktop application OAuth client from Google Cloud.")
    config["installed"]["auth_uri"] = "https://accounts.google.com/o/oauth2/v2/auth"
    config["installed"]["token_uri"] = "https://oauth2.googleapis.com/token"
    nonce = secrets.token_urlsafe(32)
    flow = InstalledAppFlow.from_client_config(config, ["openid"], autogenerate_code_verifier=True)
    credentials = flow.run_local_server(
        host="127.0.0.1", port=0, open_browser=True, timeout_seconds=300,
        access_type="online", prompt="select_account", nonce=nonce,
    )
    if not credentials.id_token:
        raise SystemExit("Google did not return an identity token; no subject was accepted.")
    identity = verify_oauth2_token(credentials.id_token, Request(), audience=config["installed"]["client_id"])
    if identity.get("nonce") != nonce or identity.get("azp", config["installed"]["client_id"]) != config["installed"]["client_id"]:
        raise SystemExit("Google identity verification failed; no subject was accepted.")
    subject = identity.get("sub", "")
    if not isinstance(subject, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", subject):
        raise SystemExit("Google did not return a valid subject; no subject was accepted.")
    print(f"MCP owner Google subject: {subject}")
    print("Use this as MCP_OWNER_GOOGLE_SUB and sign in with this same Google account in ChatGPT. No credentials were saved.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # OAuth exceptions can contain callback URLs and tokens.
        raise SystemExit(f"Owner discovery failed ({type(error).__name__}); no credential details were logged.") from None
