# /// script
# requires-python = ">=3.11"
# dependencies = ["google-auth-oauthlib>=1.2.2,<2"]
# ///
"""Run on the desktop where the Google consent browser is opened, once per channel."""
import argparse
import json
import os
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/youtube.force-ssl",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client-secrets", required=True)
    parser.add_argument("--channel", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output).expanduser()
    if output.exists():
        raise SystemExit("Credential file already exists; choose a new path for an intentional reauthorization.")
    config = json.loads(Path(args.client_secrets).expanduser().read_text())
    if "installed" not in config:
        raise SystemExit("Use a Desktop app OAuth client from Google Cloud.")
    # Restrict endpoints even if the supplied config is edited or untrusted.
    config["installed"]["auth_uri"] = "https://accounts.google.com/o/oauth2/auth"
    config["installed"]["token_uri"] = "https://oauth2.googleapis.com/token"
    flow = InstalledAppFlow.from_client_config(config, SCOPES, autogenerate_code_verifier=True)
    credentials = flow.run_local_server(host="127.0.0.1", port=0, open_browser=True, timeout_seconds=300, access_type="offline", prompt="consent")
    if not credentials.refresh_token:
        raise SystemExit("Google did not issue a refresh token; no credentials were saved.")
    if not set(SCOPES).issubset(set(credentials.granted_scopes or credentials.scopes or [])):
        raise SystemExit("Publishing and analytics both require consent; no credentials were saved.")
    response = flow.authorized_session().get("https://www.googleapis.com/youtube/v3/channels", params={"part": "id", "mine": "true"}, timeout=30)
    channel_response = response.json() if response.status_code == 200 else {}
    channels = channel_response.get("items", [])
    if len(channels) != 1 or channels[0].get("id") != args.channel or channel_response.get("nextPageToken"):
        raise SystemExit("Authorize exactly the requested Google/Brand channel; no credentials were saved.")
    identity = flow.authorized_session().get("https://openidconnect.googleapis.com/v1/userinfo", timeout=30)
    if identity.status_code != 200 or not identity.json().get("sub"):
        raise SystemExit("Google did not confirm the owner's subject ID; no credentials were saved.")
    subject = identity.json()["sub"]
    value = {"client_id": credentials.client_id, "client_secret": credentials.client_secret, "refresh_token": credentials.refresh_token, "channel_id": args.channel, "google_subject": subject, "scopes": credentials.granted_scopes or credentials.scopes}
    output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as file:
        json.dump(value, file)
        file.write("\n")
    print(f"Authorized channel {args.channel}. Credentials saved to {output}.")
    print(f"MCP owner Google subject: {subject}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # OAuth exceptions may contain callback URLs; never log their payloads.
        raise SystemExit(f"Authorization failed ({type(error).__name__}); no credential details were logged.") from None
