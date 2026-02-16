from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from typing import Dict, Iterable, List, Tuple

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DB_PATH = os.environ.get("DB_PATH", "cpg.db")
CREATE_INDEXES = os.environ.get("CPG_CREATE_INDEXES", "1") == "1"

app = FastAPI(title="CPG Call Graph Explorer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"]
    allow_headers=["*"]
)


@contextmanager
def get_conn() -> Iterable[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA temp_store=MEMORY")
    try:
        yield conn
    finally:
        conn.close()


def _placeholders(count: int) -> str:
    return ",".join(["?"] * count)


def _fetch_nodes(conn: sqlite3.Connection, ids: Iterable[str]) -> List[Dict]:
    ids = list(ids)
    if not ids:
        return []
    query = f"SELECT id, kind, name, package, file, line FROM nodes WHERE id IN ({_placeholders(len(ids))})"
    rows = conn.execute(query, ids).fetchall()
    return [dict(r) for r in rows]


@app.on_event("startup")
def _init_db() -> None:
    if not CREATE_INDEXES:
        return
    with get_conn() as conn:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_kind_source ON edges(kind, source)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_kind_target ON edges(kind, target)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_kind_name ON nodes(kind, name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_nodes_file ON nodes(file)")
        conn.commit()


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/functions")
def list_functions(
    q: str | None = Query(default=None, description="Search by name, package, or file"),
    limit: int = Query(default=40, ge=1, le=200),
) -> Dict[str, List[Dict]]:
    with get_conn() as conn:
        if q:
            q_like = f"%{q.lower()}%"
            rows = conn.execute(
                """
                SELECT id, name, package, file, line
                FROM nodes
                WHERE kind = 'function'
                  AND (lower(name) LIKE ? OR lower(package) LIKE ? OR lower(file) LIKE ?)
                ORDER BY name
                LIMIT ?
                """,
                (q_like, q_like, q_like, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, name, package, file, line
                FROM nodes
                WHERE kind = 'function'
                ORDER BY name
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return {"results": [dict(r) for r in rows]}


@app.get("/api/function/{function_id}")
def get_function(function_id: str) -> Dict:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, kind, name, package, file, line FROM nodes WHERE id = ?",
            (function_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Function not found")
    return dict(row)


@app.get("/api/function/{function_id}/subgraph")
def get_subgraph(
    function_id: str,
    depth: int = Query(default=2, ge=1, le=5),
    limit: int = Query(default=60, ge=10, le=200),
) -> Dict:
    with get_conn() as conn:
        root = conn.execute(
            "SELECT id, kind, name, package, file, line FROM nodes WHERE id = ?",
            (function_id,),
        ).fetchone()
        if not root:
            raise HTTPException(status_code=404, detail="Function not found")

        visited = {function_id}
        frontier = {function_id}
        edges: List[Tuple[str, str]] = []
        edge_set = set()

        for _ in range(depth):
            if not frontier or len(visited) >= limit:
                break

            frontier_list = list(frontier)
            placeholders = _placeholders(len(frontier_list))
            query = (
                "SELECT source, target FROM edges "
                "WHERE kind = 'call' AND (source IN (" + placeholders + ") OR target IN (" + placeholders + "))"
            )
            rows = conn.execute(query, frontier_list + frontier_list).fetchall()

            next_frontier = set()
            for row in rows:
                source = row["source"]
                target = row["target"]
                edge_key = (source, target)
                if edge_key not in edge_set:
                    edges.append(edge_key)
                    edge_set.add(edge_key)
                if source not in visited:
                    next_frontier.add(source)
                if target not in visited:
                    next_frontier.add(target)

            for node_id in next_frontier:
                if len(visited) >= limit:
                    break
                visited.add(node_id)

            frontier = next_frontier

        nodes = _fetch_nodes(conn, visited)

    return {
        "root": dict(root),
        "nodes": nodes,
        "edges": [{"source": s, "target": t} for s, t in edges],
    }


@app.get("/api/source")
def get_source(file: str) -> Dict:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT file, content FROM sources WHERE file = ?",
            (file,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Source not found")
    return dict(row)
