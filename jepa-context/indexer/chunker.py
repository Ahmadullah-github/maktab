"""
Smart code chunking for the Maktab web package.
Chunks by: React components, hooks, routes, types, schemas.
"""

import re
from pathlib import Path
from dataclasses import dataclass
from typing import Generator


@dataclass
class CodeChunk:
    """A chunk of code with metadata."""

    content: str
    file_path: str
    chunk_type: str  # component, hook, route, type, schema, util
    name: str  # Component/function name
    start_line: int
    end_line: int

    @property
    def id(self) -> str:
        return f"{self.file_path}::{self.name}"

    def to_metadata(self) -> dict:
        return {
            "file_path": self.file_path,
            "chunk_type": self.chunk_type,
            "name": self.name,
            "start_line": self.start_line,
            "end_line": self.end_line,
        }


class CodeChunker:
    """Chunks TypeScript/React code intelligently."""

    # Patterns for different code structures
    PATTERNS = {
        "component": re.compile(
            r"^(?:export\s+)?(?:default\s+)?function\s+([A-Z][a-zA-Z0-9]*)\s*\(",
            re.MULTILINE,
        ),
        "hook": re.compile(
            r"^(?:export\s+)?(?:const|function)\s+(use[A-Z][a-zA-Z0-9]*)", re.MULTILINE
        ),
        "type": re.compile(
            r"^(?:export\s+)?(?:type|interface)\s+([A-Z][a-zA-Z0-9]*)", re.MULTILINE
        ),
        "schema": re.compile(
            r"^(?:export\s+)?const\s+([a-z][a-zA-Z0-9]*Schema)\s*=", re.MULTILINE
        ),
        "const_export": re.compile(
            r"^export\s+const\s+([a-zA-Z][a-zA-Z0-9]*)\s*=", re.MULTILINE
        ),
    }

    def __init__(self, max_chunk_lines: int = 150):
        self.max_chunk_lines = max_chunk_lines

    def chunk_file(
        self, file_path: Path, base_path: Path
    ) -> Generator[CodeChunk, None, None]:
        """Chunk a single file into semantic pieces."""
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            return

        relative_path = str(file_path.relative_to(base_path))
        lines = content.split("\n")
        chunk_type = self._detect_file_type(relative_path)

        # For small files, keep as single chunk
        if len(lines) <= self.max_chunk_lines:
            name = file_path.stem
            if chunk_type == "component" and name[0].isupper():
                pass  # Keep component name
            elif chunk_type == "hook" and name.startswith("use"):
                pass  # Keep hook name
            else:
                name = self._extract_main_export(content) or name

            yield CodeChunk(
                content=content,
                file_path=relative_path,
                chunk_type=chunk_type,
                name=name,
                start_line=1,
                end_line=len(lines),
            )
            return

        # For larger files, try to split by exports/functions
        chunks = list(self._split_by_structure(content, relative_path, chunk_type))

        if chunks:
            yield from chunks
        else:
            # Fallback: chunk by lines
            yield from self._chunk_by_lines(
                content, relative_path, chunk_type, file_path.stem
            )

    def _detect_file_type(self, path: str) -> str:
        """Detect the type of code based on path."""
        path_lower = path.lower()

        if "/hooks/" in path or path.endswith(".hook.ts") or path.endswith(".hook.tsx"):
            return "hook"
        if "/components/" in path or "/features/" in path:
            return "component"
        if "/routes/" in path:
            return "route"
        if "/types/" in path or path.endswith(".types.ts"):
            return "type"
        if "/schemas/" in path or path.endswith(".schema.ts"):
            return "schema"
        if "/stores/" in path:
            return "store"
        if "/lib/" in path or "/utils/" in path:
            return "util"
        if "api.ts" in path:
            return "api"

        return "other"

    def _extract_main_export(self, content: str) -> str | None:
        """Extract the main export name from content."""
        for pattern_name, pattern in self.PATTERNS.items():
            match = pattern.search(content)
            if match:
                return match.group(1)
        return None

    def _split_by_structure(
        self, content: str, file_path: str, chunk_type: str
    ) -> Generator[CodeChunk, None, None]:
        """Split content by code structure (functions, components, etc.)."""
        lines = content.split("\n")

        # Find all export/function boundaries
        boundaries = []
        for i, line in enumerate(lines):
            if (
                line.startswith("export ")
                or line.startswith("function ")
                or line.startswith("const ")
                or line.startswith("type ")
                or line.startswith("interface ")
            ):
                boundaries.append(i)

        if len(boundaries) < 2:
            return

        # Add end boundary
        boundaries.append(len(lines))

        for i in range(len(boundaries) - 1):
            start = boundaries[i]
            end = boundaries[i + 1]
            chunk_content = "\n".join(lines[start:end]).strip()

            if not chunk_content or len(chunk_content) < 20:
                continue

            name = self._extract_main_export(chunk_content) or f"chunk_{i}"

            yield CodeChunk(
                content=chunk_content,
                file_path=file_path,
                chunk_type=chunk_type,
                name=name,
                start_line=start + 1,
                end_line=end,
            )

    def _chunk_by_lines(
        self, content: str, file_path: str, chunk_type: str, base_name: str
    ) -> Generator[CodeChunk, None, None]:
        """Fallback: chunk by line count."""
        lines = content.split("\n")

        for i in range(0, len(lines), self.max_chunk_lines):
            chunk_lines = lines[i : i + self.max_chunk_lines]
            chunk_content = "\n".join(chunk_lines)

            yield CodeChunk(
                content=chunk_content,
                file_path=file_path,
                chunk_type=chunk_type,
                name=f"{base_name}_part{i // self.max_chunk_lines + 1}",
                start_line=i + 1,
                end_line=min(i + self.max_chunk_lines, len(lines)),
            )
