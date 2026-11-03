"""
Content writes for the importers: rich-text descriptions, the platform-videos
D1 database and the website's cache invalidation endpoint.

Videos live in D1 (projects/rawkode.academy/platform/videos). description is
the plain text, kept until every reader uses description_doc, a TipTap /
ProseMirror document as written by @rawkodeacademy/rich-text. After a write the
website must be told, or it serves its cached copy for up to an hour.

Only the standard library is used, so this module is testable without the
importer's dependencies.
"""

import json
import logging
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

logger = logging.getLogger(__name__)

CLOUDFLARE_API = "https://api.cloudflare.com/client/v4"
# platform-videos (projects/rawkode.academy/platform/videos/service.cue)
VIDEOS_DATABASE_ID = "0e96020b-eb03-456c-a593-fa73f2e845d4"
CACHE_INVALIDATION_URL = "https://rawkode.academy/api/cache/invalidate"

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """
    urllib follows a redirected POST as a GET and copies the Authorization
    header to the new location, whatever its host. Never follow: a redirect
    is reported as an HTTPError instead, and the bearer token stays put.
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def _urlopen(request, timeout):
    return _OPENER.open(request, timeout=timeout)


_PARAGRAPH_BREAK = re.compile(r"\n[ \t]*\n+")
_URL = re.compile(r"https?://[^\s<>\"]+")
_URL_TRAILING = ".,;:!?'\")]}"


def _inline(line):
    """Text and link nodes for one line; bare http(s) URLs become links."""
    nodes = []
    position = 0
    for match in _URL.finditer(line):
        url = match.group(0).rstrip(_URL_TRAILING)
        start, end = match.start(), match.start() + len(url)
        if not url.split("://", 1)[1]:
            continue
        if start > position:
            nodes.append({"type": "text", "text": line[position:start]})
        nodes.append({
            "type": "text",
            "text": url,
            "marks": [{"type": "link", "attrs": {"href": url}}],
        })
        position = end
    if position < len(line):
        nodes.append({"type": "text", "text": line[position:]})
    return nodes


def text_to_doc(text):
    """
    Convert plain text (a YouTube or Descript description) to a rich-text
    document: one paragraph per blank-line separated block, single newlines
    as hard breaks, bare URLs as links. Returns None for empty text, since a
    document needs at least one block.
    """
    if not text:
        return None
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return None
    paragraphs = []
    for block in _PARAGRAPH_BREAK.split(text):
        content = []
        for line in block.split("\n"):
            line = line.rstrip()
            if not line:
                continue
            if content:
                content.append({"type": "hardBreak"})
            content.extend(_inline(line))
        if content:
            paragraphs.append({"type": "paragraph", "content": content})
    if not paragraphs:
        return None
    return {"type": "doc", "content": paragraphs}


def generate_slug(title):
    """URL-friendly slug from a title."""
    slug = title.lower()
    slug = re.sub(r"[^\w\s-]", " ", slug)
    slug = re.sub(r"\s+", " ", slug)
    slug = slug.strip().replace(" ", "-")
    return re.sub(r"-+", "-", slug)


VIDEO_COLUMNS = (
    "id",
    "title",
    "subtitle",
    "slug",
    "description",
    "description_doc",
    "duration",
    "publishedAt",
    "youtube_id",
    "updated_at",
)


def video_row(video_id, title, description, duration, published_at, youtube_id=None, now=None):
    """
    A platform-videos row. published_at is a datetime or Unix seconds
    (publishedAt is stored in seconds); updated_at is milliseconds.
    """
    description = (description or "").replace("\r\n", "\n").strip()
    if isinstance(published_at, datetime):
        published_at = int(published_at.timestamp())
    now = now if now is not None else time.time()
    doc = text_to_doc(description)
    first_line = description.split("\n", 1)[0][:200] if description else ""
    return {
        "id": video_id,
        "title": title or "",
        "subtitle": first_line or None,
        "slug": generate_slug(title or ""),
        "description": description,
        "description_doc": json.dumps(doc, ensure_ascii=False, separators=(",", ":")) if doc else None,
        "duration": int(duration) if duration else None,
        "publishedAt": int(published_at),
        "youtube_id": youtube_id,
        "updated_at": int(now * 1000),
    }


def insert_video_statement(row):
    """
    Parameterised insert for D1. Existing rows are left alone, so a re-run
    never overwrites a description that was edited after the import.
    """
    columns = ", ".join(f"`{c}`" for c in VIDEO_COLUMNS)
    placeholders = ", ".join("?" for _ in VIDEO_COLUMNS)
    sql = (
        f"INSERT INTO `videos` ({columns}) VALUES ({placeholders}) "
        "ON CONFLICT(`id`) DO NOTHING"
    )
    return sql, [row[c] for c in VIDEO_COLUMNS]


def sql_literal(value):
    """A SQLite literal. SQLite strings have no backslash escapes."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def insert_video_sql(row):
    """The insert as a SQL script, for `wrangler d1 execute --file`."""
    columns = ", ".join(f"`{c}`" for c in VIDEO_COLUMNS)
    values = ", ".join(sql_literal(row[c]) for c in VIDEO_COLUMNS)
    return f"INSERT INTO `videos` ({columns}) VALUES ({values}) ON CONFLICT(`id`) DO NOTHING;"


class D1Error(RuntimeError):
    pass


class D1Client:
    """Minimal client for the Cloudflare D1 HTTP query API."""

    def __init__(self, account_id, api_token, database_id=VIDEOS_DATABASE_ID, timeout=60):
        self.account_id = account_id
        self.api_token = api_token
        self.database_id = database_id
        self.timeout = timeout

    @classmethod
    def from_env(cls, database_id=None):
        """Build from CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN, or None if unset."""
        account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
        api_token = os.environ.get("CLOUDFLARE_API_TOKEN")
        if not account_id or not api_token:
            return None
        return cls(
            account_id,
            api_token,
            database_id or os.environ.get("VIDEOS_D1_DATABASE_ID") or VIDEOS_DATABASE_ID,
        )

    def query(self, sql, params=None):
        url = f"{CLOUDFLARE_API}/accounts/{self.account_id}/d1/database/{self.database_id}/query"
        body = json.dumps({"sql": sql, "params": list(params or [])}).encode()
        request = urllib.request.Request(url, data=body, method="POST", headers={
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        })
        try:
            with _urlopen(request, self.timeout) as response:
                payload = json.load(response)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            raise D1Error(f"D1 query failed ({e.code}): {detail}") from e
        if not payload.get("success"):
            raise D1Error(f"D1 query failed: {payload.get('errors')}")
        return payload["result"]


def write_video(client, row):
    """Insert the row; returns True if a row was created, False if it existed."""
    sql, params = insert_video_statement(row)
    try:
        result = client.query(sql, params)
    except D1Error as e:
        # slug is UNIQUE; ON CONFLICT(id) does not cover another video's slug.
        if "videos.slug" in str(e):
            raise D1Error(
                f"Slug '{row['slug']}' is already used by another video. Re-run with "
                "--skip-d1 and insert the printed SQL with a distinct slug."
            ) from e
        raise
    changes = (result[0].get("meta") or {}).get("changes", 0) if result else 0
    if changes:
        logger.info(f"Created video {row['id']} in platform-videos")
    else:
        logger.warning(f"Video {row['id']} already exists in platform-videos; left unchanged")
    return bool(changes)


def invalidate_cache(tags, token=None, url=None, attempts=3, timeout=120):
    """
    Ask the website to refetch content carrying these cache tags (e.g.
    "videos:<id>"); the endpoint adds each entity's collection tag. Returns
    True on success. Without CACHE_INVALIDATION_TOKEN it only warns: the
    website's hourly change detection picks the write up eventually.
    """
    token = token or os.environ.get("CACHE_INVALIDATION_TOKEN")
    url = url or os.environ.get("CACHE_INVALIDATION_URL") or CACHE_INVALIDATION_URL
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" and parsed.hostname not in ("localhost", "127.0.0.1"):
        logger.warning(f"Refusing to send the invalidation token to a non-https URL: {url}")
        return False
    if not token:
        logger.warning(
            "CACHE_INVALIDATION_TOKEN is not set; skipping cache invalidation. "
            "The website shows the change after its hourly change detection, or run: "
            f"just invalidate-content '{json.dumps({'tags': list(tags)})}'"
        )
        return False
    body = json.dumps({"tags": list(tags)}).encode()
    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(url, data=body, method="POST", headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        })
        try:
            # The endpoint purges twice ~50s apart before answering.
            with _urlopen(request, timeout) as response:
                raw = response.read()
            try:
                result = json.loads(raw) if raw else {}
            except ValueError:
                result = {}
            logger.info(f"Invalidated website cache: {', '.join(result.get('purged', tags))}")
            return True
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            # 502: generation bumped but the CDN purge failed; retrying is safe.
            # 3xx: redirects are not followed (see _NoRedirect).
            if e.code < 500 or attempt == attempts:
                logger.warning(f"Cache invalidation failed ({e.code}): {detail}")
                return False
            logger.warning(f"Cache invalidation failed ({e.code}), retrying: {detail}")
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == attempts:
                logger.warning(f"Cache invalidation failed: {e}")
                return False
            logger.warning(f"Cache invalidation failed, retrying: {e}")
        time.sleep(2 * attempt)
    return False
