#!/usr/bin/env python3
"""Local Docker web app for ecommerce image production management.

This intentionally uses only Python standard-library modules so the first
Docker version can run without package installation risk.
"""

from __future__ import annotations

import csv
import io
import json
import mimetypes
import os
import re
import shutil
import sqlite3
import sys
import time
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse


APP_ROOT = Path(__file__).resolve().parent
REPO_ROOT = APP_ROOT.parent
STATIC_ROOT = APP_ROOT / "static"
DATA_ROOT = Path(os.environ.get("EIS_DATA_DIR", "/data")).resolve()
DB_PATH = DATA_ROOT / "database.sqlite"
HOST = os.environ.get("EIS_HOST", "0.0.0.0")
PORT = int(os.environ.get("EIS_PORT", "8080"))

STAGES = [
    {"id": "stop_scroll", "order": 1, "title": "01 主图", "prompt_file": "prompts/stop_scroll_主图Prompt.md"},
    {"id": "explain", "order": 2, "title": "02 卖点图", "prompt_file": "prompts/explain_卖点Prompt.md"},
    {"id": "choose", "order": 3, "title": "03 SKU 选择图", "prompt_file": "prompts/choose_SKU选择Prompt.md"},
    {"id": "desire", "order": 4, "title": "04 购买欲图", "prompt_file": "prompts/desire_购买欲Prompt.md"},
    {"id": "quality", "order": 5, "title": "05 品质证明图", "prompt_file": "prompts/quality_品质证明Prompt.md"},
    {"id": "use", "order": 6, "title": "06 使用场景图", "prompt_file": "prompts/use_使用场景Prompt.md"},
    {"id": "aspire", "order": 7, "title": "07 向往场景图", "prompt_file": "prompts/aspire_向往场景Prompt.md"},
    {"id": "premium", "order": 8, "title": "08 高端体验图", "prompt_file": "prompts/premium_高端体验Prompt.md"},
    {"id": "trust", "order": 9, "title": "09 信任成交图", "prompt_file": "prompts/trust_信任成交Prompt.md"},
]

STAGE_STATUS = {
    "not_started",
    "package_ready",
    "waiting_for_manual_gpt",
    "uploaded",
    "approved",
    "needs_redo",
    "skipped",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def safe_slug(value: str, fallback: str = "item") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_\-\u4e00-\u9fff]+", "_", value.strip())
    cleaned = cleaned.strip("_-")
    return cleaned[:80] or fallback


def safe_download_name(value: str, fallback: str = "download") -> str:
    path = Path(value)
    stem = re.sub(r"[^a-zA-Z0-9_\-]+", "_", path.stem).strip("_-") or fallback
    suffix = re.sub(r"[^a-zA-Z0-9.]+", "", path.suffix)
    return f"{stem[:80]}{suffix}"


def json_dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def json_loads(value: str | None, default):
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def dict_from_row(row: sqlite3.Row) -> dict:
    return {key: row[key] for key in row.keys()}


def ensure_data_dirs() -> None:
    for path in [
        DATA_ROOT,
        DATA_ROOT / "fixed_library" / "brand",
        DATA_ROOT / "fixed_library" / "prompts",
        DATA_ROOT / "fixed_library" / "visual_assets",
        DATA_ROOT / "projects",
        DATA_ROOT / "exports",
    ]:
        path.mkdir(parents=True, exist_ok=True)


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    ensure_data_dirs()
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS projects (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              product_name TEXT NOT NULL,
              product_url TEXT DEFAULT '',
              notes TEXT DEFAULT '',
              product_description TEXT DEFAULT '',
              sku_description TEXT DEFAULT '',
              status TEXT NOT NULL DEFAULT 'draft',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS prompts (
              id TEXT PRIMARY KEY,
              stage_id TEXT NOT NULL,
              name TEXT NOT NULL,
              content TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1,
              is_default INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_prompt_overrides (
              project_id TEXT NOT NULL,
              stage_id TEXT NOT NULL,
              content TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              PRIMARY KEY (project_id, stage_id),
              FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS stage_tasks (
              project_id TEXT NOT NULL,
              stage_id TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'not_started',
              image_url TEXT DEFAULT '',
              notes TEXT DEFAULT '',
              checklist TEXT DEFAULT '{}',
              updated_at TEXT NOT NULL,
              PRIMARY KEY (project_id, stage_id),
              FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS assets (
              id TEXT PRIMARY KEY,
              project_id TEXT,
              scope TEXT NOT NULL,
              kind TEXT NOT NULL,
              stage_id TEXT DEFAULT '',
              sku_id TEXT DEFAULT '',
              filename TEXT NOT NULL,
              path TEXT NOT NULL,
              mime_type TEXT DEFAULT '',
              size_bytes INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS skus (
              id TEXT PRIMARY KEY,
              project_id TEXT NOT NULL,
              sku_name TEXT NOT NULL,
              description TEXT DEFAULT '',
              status TEXT NOT NULL DEFAULT 'not_started',
              image_url TEXT DEFAULT '',
              notes TEXT DEFAULT '',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            """
        )
        seed_prompts(conn)


def seed_prompts(conn: sqlite3.Connection) -> None:
    count = conn.execute("SELECT COUNT(*) AS c FROM prompts").fetchone()["c"]
    if count:
        return
    timestamp = now_iso()
    for stage in STAGES:
        prompt_path = REPO_ROOT / stage["prompt_file"]
        content = prompt_path.read_text(encoding="utf-8") if prompt_path.exists() else ""
        conn.execute(
            """
            INSERT INTO prompts (id, stage_id, name, content, version, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, 1, ?, ?)
            """,
            (f"default_{stage['id']}", stage["id"], stage["title"], content, timestamp, timestamp),
        )


def project_dir(project_id: str) -> Path:
    return DATA_ROOT / "projects" / project_id


def stage_dir(project_id: str, stage_id: str) -> Path:
    return project_dir(project_id) / "generated_images" / safe_slug(stage_id)


def ensure_project_dirs(project_id: str) -> None:
    base = project_dir(project_id)
    for path in [
        base / "raw_assets",
        base / "extracted_assets",
        base / "packages",
        base / "exports",
        base / "sku_images",
    ]:
        path.mkdir(parents=True, exist_ok=True)
    for stage in STAGES:
        stage_dir(project_id, stage["id"]).mkdir(parents=True, exist_ok=True)


def get_project(conn: sqlite3.Connection, project_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()


def list_assets(conn: sqlite3.Connection, project_id: str, *, kind: str | None = None, stage_id: str | None = None, sku_id: str | None = None) -> list[dict]:
    sql = "SELECT * FROM assets WHERE project_id = ?"
    params: list[str] = [project_id]
    if kind is not None:
        sql += " AND kind = ?"
        params.append(kind)
    if stage_id is not None:
        sql += " AND stage_id = ?"
        params.append(stage_id)
    if sku_id is not None:
        sql += " AND sku_id = ?"
        params.append(sku_id)
    sql += " ORDER BY created_at DESC"
    return [dict_from_row(row) for row in conn.execute(sql, params).fetchall()]


def public_file_url(relative_path: str) -> str:
    return "/files/" + quote(relative_path.replace("\\", "/"))


def asset_to_api(asset: dict) -> dict:
    item = dict(asset)
    item["url"] = public_file_url(item["path"])
    return item


def parse_body(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length") or 0)
    if not length:
        return {}
    raw = handler.rfile.read(length)
    content_type = handler.headers.get("Content-Type", "")
    if "application/json" in content_type:
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON body")
    if "application/x-www-form-urlencoded" in content_type:
        return {k: v[-1] for k, v in parse_qs(raw.decode("utf-8")).items()}
    return {"_raw": raw}


@dataclass
class UploadedFile:
    filename: str
    data: bytes
    mime_type: str


def parse_multipart(handler: BaseHTTPRequestHandler) -> tuple[dict, list[UploadedFile]]:
    content_type = handler.headers.get("Content-Type", "")
    length = int(handler.headers.get("Content-Length") or 0)
    if "multipart/form-data" not in content_type or not length:
        raise ValueError("Expected multipart/form-data upload")
    raw = handler.rfile.read(length)
    message = BytesParser(policy=policy.default).parsebytes(
        b"Content-Type: " + content_type.encode("utf-8") + b"\r\n"
        b"MIME-Version: 1.0\r\n\r\n"
        + raw
    )
    fields: dict[str, str] = {}
    uploads: list[UploadedFile] = []
    for part in message.iter_parts():
        disposition = part.get("Content-Disposition", "")
        if "form-data" not in disposition:
            continue
        name = part.get_param("name", header="content-disposition")
        filename = part.get_filename()
        payload = part.get_payload(decode=True) or b""
        if filename:
            uploads.append(
                UploadedFile(
                    filename=Path(filename).name,
                    data=payload,
                    mime_type=part.get_content_type() or "application/octet-stream",
                )
            )
        elif name:
            charset = part.get_content_charset() or "utf-8"
            fields[name] = payload.decode(charset, errors="replace")
    return fields, uploads


class AppHandler(BaseHTTPRequestHandler):
    server_version = "EcommerceImageSystem/0.1"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def send_json(self, payload, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text: str, content_type: str = "text/plain; charset=utf-8", status: int = 200) -> None:
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message: str, status: int = 400) -> None:
        self.send_json({"error": message}, status)

    def do_GET(self) -> None:
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            if path == "/" or path == "/index.html":
                return self.serve_static("index.html")
            if path.startswith("/static/"):
                return self.serve_static(path.removeprefix("/static/"))
            if path.startswith("/files/"):
                return self.serve_file(path.removeprefix("/files/"))
            if path == "/api/health":
                return self.send_json({"ok": True, "time": now_iso()})
            if path == "/api/stages":
                return self.send_json({"stages": STAGES, "statuses": sorted(STAGE_STATUS)})
            if path == "/api/prompts":
                return self.api_list_prompts()
            if path == "/api/projects":
                return self.api_list_projects()

            match = re.fullmatch(r"/api/projects/([^/]+)", path)
            if match:
                return self.api_get_project(match.group(1))

            match = re.fullmatch(r"/api/projects/([^/]+)/package/([^/]+)", path)
            if match:
                return self.api_download_package(match.group(1), match.group(2))

            match = re.fullmatch(r"/api/projects/([^/]+)/export\.(json|csv)", path)
            if match:
                return self.api_export_project(match.group(1), match.group(2))

            self.send_error_json("Not found", HTTPStatus.NOT_FOUND)
        except Exception as exc:  # pragma: no cover - safety net for local app
            self.send_error_json(str(exc), HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_POST(self) -> None:
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            if path == "/api/projects":
                return self.api_create_project()

            match = re.fullmatch(r"/api/projects/([^/]+)/assets", path)
            if match:
                return self.api_upload_assets(match.group(1), parse_qs(parsed.query))

            match = re.fullmatch(r"/api/projects/([^/]+)/skus", path)
            if match:
                return self.api_create_sku(match.group(1))

            match = re.fullmatch(r"/api/projects/([^/]+)/skus/([^/]+)/assets", path)
            if match:
                return self.api_upload_sku_assets(match.group(1), match.group(2))

            self.send_error_json("Not found", HTTPStatus.NOT_FOUND)
        except ValueError as exc:
            self.send_error_json(str(exc), HTTPStatus.BAD_REQUEST)
        except Exception as exc:  # pragma: no cover
            self.send_error_json(str(exc), HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_PUT(self) -> None:
        try:
            path = urlparse(self.path).path
            match = re.fullmatch(r"/api/prompts/([^/]+)", path)
            if match:
                return self.api_update_prompt(match.group(1))

            match = re.fullmatch(r"/api/projects/([^/]+)", path)
            if match:
                return self.api_update_project(match.group(1))

            match = re.fullmatch(r"/api/projects/([^/]+)/stages/([^/]+)", path)
            if match:
                return self.api_update_stage(match.group(1), match.group(2))

            match = re.fullmatch(r"/api/projects/([^/]+)/skus/([^/]+)", path)
            if match:
                return self.api_update_sku(match.group(1), match.group(2))

            self.send_error_json("Not found", HTTPStatus.NOT_FOUND)
        except ValueError as exc:
            self.send_error_json(str(exc), HTTPStatus.BAD_REQUEST)
        except Exception as exc:  # pragma: no cover
            self.send_error_json(str(exc), HTTPStatus.INTERNAL_SERVER_ERROR)

    def serve_static(self, filename: str) -> None:
        safe_name = filename.strip("/") or "index.html"
        file_path = (STATIC_ROOT / safe_name).resolve()
        if not str(file_path).startswith(str(STATIC_ROOT.resolve())) or not file_path.is_file():
            return self.send_error_json("Static file not found", HTTPStatus.NOT_FOUND)
        mime_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_file(self, relative: str) -> None:
        relative = unquote(relative)
        file_path = (DATA_ROOT / relative).resolve()
        if not str(file_path).startswith(str(DATA_ROOT)) or not file_path.is_file():
            return self.send_error_json("File not found", HTTPStatus.NOT_FOUND)
        mime_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Disposition", f'inline; filename="{safe_download_name(file_path.name, "download")}"')
        self.end_headers()
        self.wfile.write(body)

    def api_list_prompts(self) -> None:
        with connect() as conn:
            rows = conn.execute("SELECT * FROM prompts ORDER BY stage_id").fetchall()
            self.send_json({"prompts": [dict_from_row(row) for row in rows]})

    def api_update_prompt(self, stage_id: str) -> None:
        body = parse_body(self)
        content = str(body.get("content", "")).strip()
        if not content:
            raise ValueError("Prompt content is required")
        timestamp = now_iso()
        with connect() as conn:
            prompt = conn.execute("SELECT * FROM prompts WHERE stage_id = ? AND is_default = 1", (stage_id,)).fetchone()
            if not prompt:
                raise ValueError("Prompt not found")
            conn.execute(
                "UPDATE prompts SET content = ?, version = version + 1, updated_at = ? WHERE id = ?",
                (content, timestamp, prompt["id"]),
            )
        self.send_json({"ok": True})

    def api_list_projects(self) -> None:
        with connect() as conn:
            rows = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
            self.send_json({"projects": [dict_from_row(row) for row in rows]})

    def api_create_project(self) -> None:
        body = parse_body(self)
        name = str(body.get("name") or body.get("product_name") or "").strip()
        product_name = str(body.get("product_name") or name).strip()
        if not name or not product_name:
            raise ValueError("Project name and product name are required")
        project_id = f"project_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        timestamp = now_iso()
        with connect() as conn:
            conn.execute(
                """
                INSERT INTO projects (id, name, product_name, product_url, notes, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
                """,
                (
                    project_id,
                    name,
                    product_name,
                    str(body.get("product_url") or ""),
                    str(body.get("notes") or ""),
                    timestamp,
                    timestamp,
                ),
            )
            for stage in STAGES:
                conn.execute(
                    "INSERT INTO stage_tasks (project_id, stage_id, status, updated_at) VALUES (?, ?, 'not_started', ?)",
                    (project_id, stage["id"], timestamp),
                )
        ensure_project_dirs(project_id)
        self.send_json({"ok": True, "project_id": project_id}, HTTPStatus.CREATED)

    def api_get_project(self, project_id: str) -> None:
        with connect() as conn:
            project = get_project(conn, project_id)
            if not project:
                return self.send_error_json("Project not found", HTTPStatus.NOT_FOUND)
            prompts = {
                row["stage_id"]: dict_from_row(row)
                for row in conn.execute("SELECT * FROM prompts WHERE is_default = 1").fetchall()
            }
            overrides = {
                row["stage_id"]: dict_from_row(row)
                for row in conn.execute(
                    "SELECT * FROM project_prompt_overrides WHERE project_id = ?",
                    (project_id,),
                ).fetchall()
            }
            stages = []
            for task in conn.execute("SELECT * FROM stage_tasks WHERE project_id = ?", (project_id,)).fetchall():
                stage_meta = next((stage for stage in STAGES if stage["id"] == task["stage_id"]), {})
                item = dict_from_row(task)
                item["checklist"] = json_loads(item.get("checklist"), {})
                item["title"] = stage_meta.get("title", item["stage_id"])
                item["order"] = stage_meta.get("order", 999)
                item["prompt"] = overrides.get(item["stage_id"], {}).get("content") or prompts.get(item["stage_id"], {}).get("content", "")
                item["has_override"] = item["stage_id"] in overrides
                item["assets"] = [asset_to_api(a) for a in list_assets(conn, project_id, kind="stage_output", stage_id=item["stage_id"])]
                stages.append(item)
            stages.sort(key=lambda item: item["order"])
            skus = []
            for sku in conn.execute("SELECT * FROM skus WHERE project_id = ? ORDER BY created_at", (project_id,)).fetchall():
                item = dict_from_row(sku)
                item["assets"] = [asset_to_api(a) for a in list_assets(conn, project_id, kind="sku_output", sku_id=item["id"])]
                skus.append(item)
            assets = [asset_to_api(dict_from_row(row)) for row in conn.execute("SELECT * FROM assets WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()]
            self.send_json(
                {
                    "project": dict_from_row(project),
                    "stages": stages,
                    "skus": skus,
                    "assets": assets,
                }
            )

    def api_update_project(self, project_id: str) -> None:
        body = parse_body(self)
        allowed = ["name", "product_name", "product_url", "notes", "product_description", "sku_description", "status"]
        updates = []
        params = []
        for key in allowed:
            if key in body:
                updates.append(f"{key} = ?")
                params.append(str(body.get(key) or ""))
        if not updates:
            raise ValueError("No project fields to update")
        updates.append("updated_at = ?")
        params.append(now_iso())
        params.append(project_id)
        with connect() as conn:
            if not get_project(conn, project_id):
                return self.send_error_json("Project not found", HTTPStatus.NOT_FOUND)
            conn.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?", params)
        self.send_json({"ok": True})

    def api_upload_assets(self, project_id: str, query: dict) -> None:
        fields, uploads = parse_multipart(self)
        kind = (query.get("kind") or fields.get("kind") or ["raw_asset"])[0] if isinstance(query.get("kind"), list) else fields.get("kind", "raw_asset")
        stage_id = (query.get("stage_id") or fields.get("stage_id") or [""])[0] if isinstance(query.get("stage_id"), list) else fields.get("stage_id", "")
        if not uploads:
            raise ValueError("No files uploaded")
        with connect() as conn:
            if not get_project(conn, project_id):
                return self.send_error_json("Project not found", HTTPStatus.NOT_FOUND)
            saved = [self.save_asset(conn, project_id, "product_project", kind, upload, stage_id=stage_id) for upload in uploads]
            conn.execute("UPDATE projects SET status = CASE WHEN status = 'draft' THEN 'material_provided' ELSE status END, updated_at = ? WHERE id = ?", (now_iso(), project_id))
        self.send_json({"ok": True, "assets": [asset_to_api(item) for item in saved]})

    def api_upload_sku_assets(self, project_id: str, sku_id: str) -> None:
        _, uploads = parse_multipart(self)
        if not uploads:
            raise ValueError("No files uploaded")
        with connect() as conn:
            if not get_project(conn, project_id):
                return self.send_error_json("Project not found", HTTPStatus.NOT_FOUND)
            if not conn.execute("SELECT 1 FROM skus WHERE id = ? AND project_id = ?", (sku_id, project_id)).fetchone():
                return self.send_error_json("SKU not found", HTTPStatus.NOT_FOUND)
            saved = [self.save_asset(conn, project_id, "product_project", "sku_output", upload, sku_id=sku_id) for upload in uploads]
            conn.execute("UPDATE skus SET status = 'uploaded', updated_at = ? WHERE id = ?", (now_iso(), sku_id))
        self.send_json({"ok": True, "assets": [asset_to_api(item) for item in saved]})

    def save_asset(
        self,
        conn: sqlite3.Connection,
        project_id: str,
        scope: str,
        kind: str,
        upload: UploadedFile,
        *,
        stage_id: str = "",
        sku_id: str = "",
    ) -> dict:
        ensure_project_dirs(project_id)
        filename = safe_slug(Path(upload.filename).stem, "file") + Path(upload.filename).suffix.lower()
        timestamp = str(int(time.time() * 1000))
        if kind == "raw_asset":
            folder = project_dir(project_id) / "raw_assets"
        elif kind == "extracted_asset":
            folder = project_dir(project_id) / "extracted_assets"
        elif kind == "stage_output":
            folder = stage_dir(project_id, stage_id or "unknown")
        elif kind == "sku_output":
            folder = project_dir(project_id) / "sku_images" / safe_slug(sku_id, "sku")
        else:
            folder = project_dir(project_id) / "assets" / safe_slug(kind)
        folder.mkdir(parents=True, exist_ok=True)
        file_path = folder / f"{timestamp}_{filename}"
        file_path.write_bytes(upload.data)
        relative = str(file_path.relative_to(DATA_ROOT))
        asset = {
            "id": f"asset_{uuid.uuid4().hex[:12]}",
            "project_id": project_id,
            "scope": scope,
            "kind": kind,
            "stage_id": stage_id,
            "sku_id": sku_id,
            "filename": upload.filename,
            "path": relative,
            "mime_type": upload.mime_type,
            "size_bytes": len(upload.data),
            "created_at": now_iso(),
        }
        conn.execute(
            """
            INSERT INTO assets (id, project_id, scope, kind, stage_id, sku_id, filename, path, mime_type, size_bytes, created_at)
            VALUES (:id, :project_id, :scope, :kind, :stage_id, :sku_id, :filename, :path, :mime_type, :size_bytes, :created_at)
            """,
            asset,
        )
        if kind == "stage_output" and stage_id:
            conn.execute(
                "UPDATE stage_tasks SET status = 'uploaded', updated_at = ? WHERE project_id = ? AND stage_id = ?",
                (now_iso(), project_id, stage_id),
            )
        return asset

    def api_update_stage(self, project_id: str, stage_id: str) -> None:
        body = parse_body(self)
        status = str(body.get("status") or "not_started")
        if status not in STAGE_STATUS:
            raise ValueError(f"Invalid stage status: {status}")
        checklist = body.get("checklist") if isinstance(body.get("checklist"), dict) else {}
        prompt_override = str(body.get("prompt_override") or "").strip()
        timestamp = now_iso()
        with connect() as conn:
            if not get_project(conn, project_id):
                return self.send_error_json("Project not found", HTTPStatus.NOT_FOUND)
            conn.execute(
                """
                UPDATE stage_tasks
                SET status = ?, image_url = ?, notes = ?, checklist = ?, updated_at = ?
                WHERE project_id = ? AND stage_id = ?
                """,
                (
                    status,
                    str(body.get("image_url") or ""),
                    str(body.get("notes") or ""),
                    json_dumps(checklist),
                    timestamp,
                    project_id,
                    stage_id,
                ),
            )
            if prompt_override:
                conn.execute(
                    """
                    INSERT INTO project_prompt_overrides (project_id, stage_id, content, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(project_id, stage_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
                    """,
                    (project_id, stage_id, prompt_override, timestamp),
                )
            conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (timestamp, project_id))
        self.send_json({"ok": True})

    def api_create_sku(self, project_id: str) -> None:
        body = parse_body(self)
        sku_name = str(body.get("sku_name") or "").strip()
        if not sku_name:
            raise ValueError("SKU name is required")
        sku_id = f"sku_{uuid.uuid4().hex[:10]}"
        timestamp = now_iso()
        with connect() as conn:
            if not get_project(conn, project_id):
                return self.send_error_json("Project not found", HTTPStatus.NOT_FOUND)
            conn.execute(
                """
                INSERT INTO skus (id, project_id, sku_name, description, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'not_started', ?, ?)
                """,
                (sku_id, project_id, sku_name, str(body.get("description") or ""), timestamp, timestamp),
            )
            conn.execute("UPDATE projects SET status = 'sku_images_in_progress', updated_at = ? WHERE id = ?", (timestamp, project_id))
        (project_dir(project_id) / "sku_images" / safe_slug(sku_id)).mkdir(parents=True, exist_ok=True)
        self.send_json({"ok": True, "sku_id": sku_id}, HTTPStatus.CREATED)

    def api_update_sku(self, project_id: str, sku_id: str) -> None:
        body = parse_body(self)
        allowed = ["sku_name", "description", "status", "image_url", "notes"]
        updates = []
        params = []
        for key in allowed:
            if key in body:
                updates.append(f"{key} = ?")
                params.append(str(body.get(key) or ""))
        if not updates:
            raise ValueError("No SKU fields to update")
        updates.append("updated_at = ?")
        params.extend([now_iso(), sku_id, project_id])
        with connect() as conn:
            conn.execute(f"UPDATE skus SET {', '.join(updates)} WHERE id = ? AND project_id = ?", params)
        self.send_json({"ok": True})

    def api_download_package(self, project_id: str, stage_id: str) -> None:
        with connect() as conn:
            project = get_project(conn, project_id)
            if not project:
                return self.send_error_json("Project not found", HTTPStatus.NOT_FOUND)
            stage = next((item for item in STAGES if item["id"] == stage_id), None)
            if stage_id != "extract" and not stage:
                return self.send_error_json("Stage not found", HTTPStatus.NOT_FOUND)
            package_path = self.build_package(conn, dict_from_row(project), stage_id, stage)
        body = package_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Disposition", f'attachment; filename="{safe_download_name(package_path.name, "package")}"')
        self.end_headers()
        self.wfile.write(body)

    def build_package(self, conn: sqlite3.Connection, project: dict, stage_id: str, stage: dict | None) -> Path:
        ensure_project_dirs(project["id"])
        packages = project_dir(project["id"]) / "packages"
        packages.mkdir(parents=True, exist_ok=True)
        package_name = f"{project['id']}_{safe_slug(stage_id)}_{int(time.time())}.zip"
        package_path = packages / package_name
        raw_assets = list_assets(conn, project["id"], kind="raw_asset")
        extracted_assets = list_assets(conn, project["id"], kind="extracted_asset")
        prompt = ""
        if stage_id == "extract":
            prompt = self.extract_prompt_template()
            selected_assets = raw_assets
            instruction_name = "素材提取说明.txt"
        else:
            prompt_row = conn.execute(
                """
                SELECT COALESCE(o.content, p.content) AS content
                FROM prompts p
                LEFT JOIN project_prompt_overrides o ON o.stage_id = p.stage_id AND o.project_id = ?
                WHERE p.stage_id = ? AND p.is_default = 1
                """,
                (project["id"], stage_id),
            ).fetchone()
            prompt = prompt_row["content"] if prompt_row else ""
            selected_assets = extracted_assets or raw_assets
            instruction_name = f"{stage_id}_生图说明.txt"
        with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(
                instruction_name,
                self.package_instruction(project, stage_id, stage, prompt),
            )
            archive.writestr("project_info.json", json.dumps(project, ensure_ascii=False, indent=2))
            archive.writestr("prompt.md", prompt)
            for asset in selected_assets:
                source = DATA_ROOT / asset["path"]
                if source.exists():
                    archive.write(source, f"assets/{asset['filename']}")
        if stage_id != "extract":
            conn.execute(
                "UPDATE stage_tasks SET status = 'package_ready', updated_at = ? WHERE project_id = ? AND stage_id = ?",
                (now_iso(), project["id"], stage_id),
            )
        return package_path

    def extract_prompt_template(self) -> str:
        return """请根据我提供的电商原图素材、产品链接和补充说明，整理产品生图素材包。

请输出：
1. 产品介绍：面向电商图片生产，包含真实产品类型、核心卖点、使用场景、禁用夸大表达。
2. SKU 介绍：逐个列出 SKU 名称、颜色/型号/规格/数量，不能猜测。
3. 生图素材清单：哪些原图适合当主视觉、细节、SKU、包装、场景参考。
4. 风险提醒：哪些内容缺少证据，后续生图不能虚构。

要求：
- 不新增未经素材证明的功效、认证、包装、赠品。
- 如果产品链接无法访问，只基于图片和补充说明整理。
- 输出中文，结构清晰，便于复制回系统。
"""

    def package_instruction(self, project: dict, stage_id: str, stage: dict | None, prompt: str) -> str:
        stage_title = "产品素材提取" if stage_id == "extract" else stage.get("title", stage_id)
        return f"""项目：{project.get('name')}
产品：{project.get('product_name')}
产品链接：{project.get('product_url') or '未提供'}
补充说明：{project.get('notes') or '未提供'}

当前步骤：{stage_title}

操作方式：
1. 将本压缩包中的素材上传到 GPT。
2. 将 prompt.md 的内容复制到 GPT。
3. 根据 GPT 返回结果，把文字或图片回传到系统对应步骤。

当前 Prompt 摘要：
{prompt[:1200]}
"""

    def api_export_project(self, project_id: str, fmt: str) -> None:
        with connect() as conn:
            project = get_project(conn, project_id)
            if not project:
                return self.send_error_json("Project not found", HTTPStatus.NOT_FOUND)
            data = self.build_export(conn, dict_from_row(project))
        if fmt == "json":
            self.send_json(data)
            return
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=[
                "project_id",
                "project_name",
                "product_name",
                "image_type",
                "image_order",
                "image_name",
                "local_file_path",
                "image_url",
                "sku_id",
                "sku_name",
                "sku_image_url",
                "status",
                "notes",
            ],
        )
        writer.writeheader()
        for row in data["rows"]:
            writer.writerow(row)
        self.send_text(output.getvalue(), "text/csv; charset=utf-8")

    def build_export(self, conn: sqlite3.Connection, project: dict) -> dict:
        rows = []
        missing = []
        for stage in STAGES:
            task = conn.execute(
                "SELECT * FROM stage_tasks WHERE project_id = ? AND stage_id = ?",
                (project["id"], stage["id"]),
            ).fetchone()
            assets = list_assets(conn, project["id"], kind="stage_output", stage_id=stage["id"])
            local_path = assets[0]["path"] if assets else ""
            image_url = task["image_url"] if task else ""
            if not image_url:
                missing.append(stage["id"])
            rows.append(
                {
                    "project_id": project["id"],
                    "project_name": project["name"],
                    "product_name": project["product_name"],
                    "image_type": stage["id"],
                    "image_order": stage["order"],
                    "image_name": stage["title"],
                    "local_file_path": local_path,
                    "image_url": image_url,
                    "sku_id": "",
                    "sku_name": "",
                    "sku_image_url": "",
                    "status": task["status"] if task else "not_started",
                    "notes": task["notes"] if task else "",
                }
            )
        for sku in conn.execute("SELECT * FROM skus WHERE project_id = ? ORDER BY created_at", (project["id"],)).fetchall():
            if not sku["image_url"]:
                missing.append(sku["id"])
            assets = list_assets(conn, project["id"], kind="sku_output", sku_id=sku["id"])
            rows.append(
                {
                    "project_id": project["id"],
                    "project_name": project["name"],
                    "product_name": project["product_name"],
                    "image_type": "sku",
                    "image_order": "",
                    "image_name": sku["sku_name"],
                    "local_file_path": assets[0]["path"] if assets else "",
                    "image_url": "",
                    "sku_id": sku["id"],
                    "sku_name": sku["sku_name"],
                    "sku_image_url": sku["image_url"],
                    "status": sku["status"],
                    "notes": sku["notes"],
                }
            )
        return {
            "project_id": project["id"],
            "project_name": project["name"],
            "product_name": project["product_name"],
            "exported_at": now_iso(),
            "missing_links": missing,
            "rows": rows,
        }


def main() -> None:
    init_db()
    httpd = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f"Ecommerce Image System running at http://{HOST}:{PORT}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
