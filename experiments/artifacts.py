"""Canonical JSON and atomic publication of content-addressed research artifacts."""
from __future__ import annotations
import hashlib
import json
import os
import tempfile
from pathlib import Path


def canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()


def digest(value) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def file_digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, value, *, immutable: bool = False):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = canonical(value) + b"\n"
    if immutable and path.exists():
        if path.read_bytes() != data:
            raise ValueError(f"Immutable artifact differs: {path}")
        return
    fd, temp = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        if immutable:
            # Link publishes without overwriting an artifact created concurrently.
            try:
                os.link(temp, path)
            except FileExistsError:
                if path.read_bytes() != data:
                    raise ValueError(f"Immutable artifact differs: {path}")
        else:
            os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
