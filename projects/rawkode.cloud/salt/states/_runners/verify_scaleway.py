import json
import logging
import re
import subprocess
import time
import urllib.parse
import urllib.request

log = logging.getLogger(__name__)

CONTROL_PLANE_MINION_ID = "production-control-plane"
MINION_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")
CREDS_FILE = "/etc/salt/credentials/scaleway-api.json"


def _run(*args):
    return subprocess.run(list(args), check=False, capture_output=True, text=True)


def _pending_key_exists(minion_id):
    proc = _run("salt-key", "--list=pre", "--out=json")
    if proc.returncode != 0:
        proc = _run("salt-key", "-l", "pre", "--out=json")
    if proc.returncode != 0:
        return False
    try:
        payload = json.loads(proc.stdout or "{}")
    except Exception:
        return False
    return minion_id in set(payload.get("minions_pre", []))


def _load_creds():
    try:
        with open(CREDS_FILE, encoding="utf-8") as f:
            creds = json.load(f)
    except Exception:
        return None
    if not creds.get("secret_key") or not creds.get("zone"):
        return None
    return creds


def _get_server(minion_id, creds):
    query = {"name": minion_id}
    project_id = creds.get("project_id")
    if project_id:
        query["project_id"] = project_id

    url = (
        f"https://api.scaleway.com/baremetal/v1/zones/{creds['zone']}/servers"
        f"?{urllib.parse.urlencode(query)}"
    )
    request = urllib.request.Request(
        url,
        headers={"X-Auth-Token": creds["secret_key"], "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        payload = json.loads(response.read())

    for server in payload.get("servers", []):
        if server.get("name") != minion_id:
            continue
        if project_id and server.get("project_id") != project_id:
            continue
        return server
    return None


def _query_grains(minion_id):
    proc = _run(
        "salt",
        "--timeout=10",
        "--out=json",
        minion_id,
        "grains.item",
        "id",
        "scw_instance_id",
    )
    if proc.returncode != 0:
        return {}
    try:
        payload = json.loads(proc.stdout or "{}")
    except Exception:
        return {}
    grains = payload.get(minion_id)
    return grains if isinstance(grains, dict) else {}


def accept(minion_id):
    if not isinstance(minion_id, str):
        return False
    minion_id = minion_id.strip()
    if minion_id == CONTROL_PLANE_MINION_ID:
        return False
    if not MINION_ID_PATTERN.fullmatch(minion_id):
        return False
    if not _pending_key_exists(minion_id):
        return False

    creds = _load_creds()
    if not creds:
        log.warning("Missing Scaleway credentials for key verification")
        return False

    try:
        server = _get_server(minion_id, creds)
    except Exception as exc:
        log.warning("Scaleway lookup failed for '%s': %s", minion_id, exc)
        return False

    expected_instance_id = server.get("id") if server else None
    if not expected_instance_id:
        return False

    if _run("salt-key", "-ya", minion_id).returncode != 0:
        return False

    for _ in range(3):
        time.sleep(2)
        grains = _query_grains(minion_id)
        if grains.get("id") == minion_id and grains.get("scw_instance_id") == expected_instance_id:
            return True

    _run("salt-key", "-yd", minion_id)
    return False
