import json
import logging
import urllib.parse
import urllib.request

log = logging.getLogger(__name__)

CONTROL_PLANE_MINION_ID = "production-control-plane"


def _request_json(method, url, headers=None, payload=None, timeout=10):
    data = None
    request_headers = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        request_headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        url,
        data=data,
        headers=request_headers,
        method=method,
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8")
    return json.loads(body or "{}")


def _login(host, client_id, client_secret):
    login_url = f"{host.rstrip('/')}/api/v1/auth/universal-auth/login"
    payload = {
        "clientId": client_id,
        "clientSecret": client_secret,
    }
    response = _request_json("POST", login_url, payload=payload)
    return response.get("accessToken")


def _list_secrets(host, access_token, workspace_id, env_slug, secret_path):
    query = urllib.parse.urlencode(
        {
            "workspaceId": workspace_id,
            "environment": env_slug,
            "secretPath": secret_path,
            "includeImports": "true",
            "recursive": "true",
        }
    )
    url = f"{host.rstrip('/')}/api/v3/secrets/raw?{query}"
    response = _request_json(
        "GET",
        url,
        headers={"Authorization": f"Bearer {access_token}"},
    )

    values = {}
    for secret in response.get("secrets", []):
        key = secret.get("secretKey") or secret.get("secret_key") or secret.get("key")
        value = secret.get("secretValue") or secret.get("secret_value") or secret.get("value")
        if key and value is not None:
            values[str(key)] = value
    return values


def ext_pillar(
    minion_id,
    pillar,
    host="https://app.infisical.com",
    credentials_file="/etc/salt/credentials/infisical-runtime.json",
    env_slug="production",
    secret_path="/projects/rawkode-cloud",
    github_client_id_key="",
    github_client_secret_key="",
    github_org="rawkode-academy",
    github_team="platform",
    github_roles=None,
):
    if minion_id != CONTROL_PLANE_MINION_ID:
        return {}

    try:
        with open(credentials_file, encoding="utf-8") as f:
            creds = json.load(f)
    except Exception as exc:
        log.error("Unable to load Infisical credentials from %s: %s", credentials_file, exc)
        return {}

    client_id = creds.get("client_id")
    client_secret = creds.get("client_secret")
    workspace_id = creds.get("project_id")
    if not client_id or not client_secret or not workspace_id:
        log.error("Infisical credentials are missing required keys")
        return {}

    try:
        access_token = _login(host, client_id, client_secret)
        if not access_token:
            log.error("Infisical login did not return an access token")
            return {}
        secret_values = _list_secrets(
            host,
            access_token,
            workspace_id,
            env_slug,
            secret_path,
        )
    except Exception as exc:
        log.error("Infisical request failed: %s", exc)
        return {}

    if not secret_values:
        log.error("No secrets found in Infisical at %s", secret_path)
        return {}

    github_client_id = secret_values.get(github_client_id_key, "") if github_client_id_key else ""
    github_client_secret = secret_values.get(github_client_secret_key, "") if github_client_secret_key else ""

    return {
        "infisical": {"secrets": secret_values},
        "teleport": {
            "github": {
                "client_id": github_client_id,
                "client_secret": github_client_secret,
                "org": github_org,
                "team": github_team,
                "roles": github_roles or ["access", "editor"],
            }
        },
    }
