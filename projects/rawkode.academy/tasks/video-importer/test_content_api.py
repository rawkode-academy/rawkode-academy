"""Tests for content_api. Run: python -I -m unittest discover -s . -p 'test_*.py'"""

import http.server
import io
import json
import threading
import unittest
import urllib.error
from datetime import datetime, timezone
from unittest import mock

import content_api
from content_api import (
    D1Client,
    insert_video_sql,
    insert_video_statement,
    invalidate_cache,
    text_to_doc,
    video_row,
    write_video,
)


def text(value, href=None):
    node = {"type": "text", "text": value}
    if href:
        node["marks"] = [{"type": "link", "attrs": {"href": href}}]
    return node


class TextToDocTest(unittest.TestCase):
    def test_empty(self):
        self.assertIsNone(text_to_doc(""))
        self.assertIsNone(text_to_doc(None))
        self.assertIsNone(text_to_doc(" \n\n \r\n"))

    def test_paragraphs_and_hard_breaks(self):
        doc = text_to_doc("First line\nsecond line\r\n\r\n\nNext paragraph  \n")
        self.assertEqual(doc, {
            "type": "doc",
            "content": [
                {"type": "paragraph", "content": [
                    text("First line"), {"type": "hardBreak"}, text("second line"),
                ]},
                {"type": "paragraph", "content": [text("Next paragraph")]},
            ],
        })

    def test_links(self):
        doc = text_to_doc("Docs: https://example.com/a?b=1. And (https://x.dev)")
        self.assertEqual(doc["content"][0]["content"], [
            text("Docs: "),
            text("https://example.com/a?b=1", "https://example.com/a?b=1"),
            text(". And ("),
            text("https://x.dev", "https://x.dev"),
            text(")"),
        ])

    def test_bare_scheme_is_text(self):
        doc = text_to_doc("see https://.")
        self.assertEqual(doc["content"][0]["content"], [text("see https://.")])

    def test_no_empty_text_nodes(self):
        doc = text_to_doc("https://a.io\n\n\n  \nhttps://b.io")
        for paragraph in doc["content"]:
            for node in paragraph["content"]:
                if node["type"] == "text":
                    self.assertTrue(node["text"])


class VideoRowTest(unittest.TestCase):
    def test_row(self):
        published = datetime(2025, 1, 2, tzinfo=timezone.utc)
        row = video_row(
            "abc", "Hello, World! It's Live", "Intro line\n\nMore https://a.io",
            3600, published, youtube_id="yt1", now=1.5,
        )
        self.assertEqual(row["slug"], "hello-world-it-s-live")
        self.assertEqual(row["subtitle"], "Intro line")
        self.assertEqual(row["description"], "Intro line\n\nMore https://a.io")
        self.assertEqual(json.loads(row["description_doc"]), text_to_doc(row["description"]))
        self.assertEqual(row["publishedAt"], int(published.timestamp()))
        self.assertEqual(row["updated_at"], 1500)
        self.assertEqual(row["youtube_id"], "yt1")
        self.assertEqual(row["duration"], 3600)

    def test_empty_description(self):
        row = video_row("abc", "T", "", 0, 10, now=0)
        self.assertEqual(row["description"], "")
        self.assertIsNone(row["description_doc"])
        self.assertIsNone(row["subtitle"])
        self.assertIsNone(row["duration"])

    def test_statement_is_parameterised(self):
        row = video_row("abc", "T", "It's", 1, 10, now=0)
        sql, params = insert_video_statement(row)
        self.assertEqual(sql.count("?"), len(params))
        self.assertIn("ON CONFLICT(`id`) DO NOTHING", sql)
        self.assertIn("`description_doc`", sql)
        self.assertNotIn("It's", sql)

    def test_sql_script_quotes(self):
        row = video_row("abc", "T?", "It's\nfine?", 1, 10, now=0)
        sql = insert_video_sql(row)
        # Real newlines and doubled quotes: SQLite has no backslash escapes.
        self.assertIn("'It''s\nfine?'", sql)
        self.assertIn("'T?'", sql)
        self.assertIn("NULL", sql)  # youtube_id
        self.assertTrue(sql.endswith("DO NOTHING;"))


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def respond(payload):
    return FakeResponse(json.dumps(payload).encode())


class D1ClientTest(unittest.TestCase):
    def test_from_env(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            self.assertIsNone(D1Client.from_env())
        with mock.patch.dict("os.environ", {"CLOUDFLARE_ACCOUNT_ID": "acct", "CLOUDFLARE_API_TOKEN": "tok"}, clear=True):
            client = D1Client.from_env()
            self.assertEqual(client.database_id, content_api.VIDEOS_DATABASE_ID)

    def test_write_video(self):
        client = D1Client("acct", "tok", "db")
        row = video_row("abc", "T", "D", 1, 10, now=0)
        with mock.patch("content_api._urlopen", return_value=respond(
            {"success": True, "result": [{"results": [], "meta": {"changes": 1}}]},
        )) as urlopen:
            self.assertTrue(write_video(client, row))
        request = urlopen.call_args[0][0]
        self.assertEqual(request.full_url, "https://api.cloudflare.com/client/v4/accounts/acct/d1/database/db/query")
        self.assertEqual(request.get_header("Authorization"), "Bearer tok")
        body = json.loads(request.data)
        self.assertEqual(body["params"][0], "abc")

    def test_existing_row(self):
        client = D1Client("acct", "tok", "db")
        row = video_row("abc", "T", "D", 1, 10, now=0)
        with mock.patch("content_api._urlopen", return_value=respond(
            {"success": True, "result": [{"results": [], "meta": {"changes": 0}}]},
        )):
            self.assertFalse(write_video(client, row))

    def test_slug_conflict_explains(self):
        client = D1Client("acct", "tok", "db")
        row = video_row("abc", "Same Title", "D", 1, 10, now=0)
        with mock.patch("content_api._urlopen", return_value=respond(
            {"success": False, "errors": [{"message": "UNIQUE constraint failed: videos.slug: SQLITE_CONSTRAINT"}]},
        )):
            with self.assertRaisesRegex(content_api.D1Error, "same-title.*--skip-d1"):
                write_video(client, row)

    def test_failure(self):
        client = D1Client("acct", "tok", "db")
        with mock.patch("content_api._urlopen", return_value=respond({"success": False, "errors": ["x"]})):
            with self.assertRaises(content_api.D1Error):
                client.query("SELECT 1")


class InvalidateCacheTest(unittest.TestCase):
    def test_no_token_is_noop(self):
        with mock.patch.dict("os.environ", {}, clear=True), mock.patch("content_api._urlopen") as urlopen:
            with self.assertLogs(content_api.logger, "WARNING"):
                self.assertFalse(invalidate_cache(["videos:abc"]))
            urlopen.assert_not_called()

    def test_posts_tags(self):
        with mock.patch.dict("os.environ", {"CACHE_INVALIDATION_TOKEN": "secret"}, clear=True), \
                mock.patch("content_api._urlopen", return_value=respond({"ok": True, "purged": ["videos:abc", "videos"]})) as urlopen:
            self.assertTrue(invalidate_cache(["videos:abc"]))
        request = urlopen.call_args[0][0]
        self.assertEqual(request.full_url, "https://rawkode.academy/api/cache/invalidate")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.get_header("Authorization"), "Bearer secret")
        self.assertEqual(json.loads(request.data), {"tags": ["videos:abc"]})

    def test_retries_5xx(self):
        error = urllib.error.HTTPError("u", 502, "bad", {}, io.BytesIO(b"{}"))
        with mock.patch("content_api._urlopen", side_effect=[error, respond({"purged": []})]) as urlopen, \
                mock.patch("time.sleep"):
            self.assertTrue(invalidate_cache(["videos:abc"], token="t"))
        self.assertEqual(urlopen.call_count, 2)

    def test_4xx_not_retried(self):
        error = urllib.error.HTTPError("u", 401, "no", {}, io.BytesIO(b"{}"))
        with mock.patch("content_api._urlopen", side_effect=[error]) as urlopen:
            with self.assertLogs(content_api.logger, "WARNING"):
                self.assertFalse(invalidate_cache(["videos:abc"], token="t"))
        self.assertEqual(urlopen.call_count, 1)

    def test_non_json_success_is_ok(self):
        with mock.patch("content_api._urlopen", return_value=FakeResponse(b"<html>ok</html>")):
            self.assertTrue(invalidate_cache(["videos:abc"], token="t"))

    def test_refuses_plain_http(self):
        with mock.patch("content_api._urlopen") as urlopen:
            with self.assertLogs(content_api.logger, "WARNING"):
                self.assertFalse(invalidate_cache(["videos:abc"], token="t", url="http://example.com/x"))
            urlopen.assert_not_called()

    def test_redirect_does_not_forward_token(self):
        seen = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                self.send_response(302)
                self.send_header("Location", f"http://localhost:{self.server.server_port}/elsewhere")
                self.send_header("Content-Length", "0")
                self.end_headers()

            def do_GET(self):
                seen.append(self.headers.get("Authorization"))
                body = b'{"purged":[]}'
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with self.assertLogs(content_api.logger, "WARNING"):
                ok = invalidate_cache(
                    ["videos:abc"], token="secret",
                    url=f"http://127.0.0.1:{server.server_port}/api/cache/invalidate",
                )
        finally:
            server.shutdown()
            server.server_close()
        self.assertFalse(ok)
        self.assertEqual(seen, [])


if __name__ == "__main__":
    unittest.main()
