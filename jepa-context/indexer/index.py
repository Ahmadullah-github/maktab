"""
Main indexing logic - combines chunking, embedding, and ChromaDB storage.
"""

import chromadb
from chromadb.config import Settings
from pathlib import Path
from typing import List, Optional
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

from .chunker import CodeChunker, CodeChunk
from .embedder import CodeEmbedder

console = Console()


class CodebaseIndex:
    """Index and query a codebase using semantic embeddings."""

    # File extensions to index
    EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".py"}

    # Directories to skip
    SKIP_DIRS = {
        "node_modules",
        ".git",
        "dist",
        "build",
        ".venv",
        "__pycache__",
        "tests",
        ".pytest_cache",
    }

    def __init__(
        self,
        db_path: str = "./db",
        collection_name: str = "maktab_web",
        embedding_model: str = "BAAI/bge-small-en-v1.5",  # Good balance of speed/quality
    ):
        self.db_path = Path(db_path)
        self.db_path.mkdir(parents=True, exist_ok=True)

        # Initialize ChromaDB with persistent storage
        self.client = chromadb.PersistentClient(
            path=str(self.db_path),
            settings=Settings(anonymized_telemetry=False),
        )

        self.collection_name = collection_name
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"description": "Maktab web package code index"},
        )

        self.chunker = CodeChunker(max_chunk_lines=150)
        self.embedder = CodeEmbedder(model_name=embedding_model)

    def index_directory(self, directory: Path, clear_existing: bool = False) -> int:
        """
        Index all code files in a directory.

        Args:
            directory: Path to the directory to index
            clear_existing: Whether to clear existing index first

        Returns:
            Number of chunks indexed
        """
        if clear_existing:
            self.client.delete_collection(self.collection_name)
            self.collection = self.client.create_collection(
                name=self.collection_name,
                metadata={"description": "Maktab web package code index"},
            )

        # Collect all files
        files = list(self._find_files(directory))
        console.print(f"[blue]Found {len(files)} files to index[/blue]")

        # Chunk all files
        all_chunks: List[CodeChunk] = []
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("{task.completed}/{task.total}"),
            console=console,
        ) as progress:
            task = progress.add_task("Chunking files...", total=len(files))

            for file_path in files:
                chunks = list(self.chunker.chunk_file(file_path, directory))
                all_chunks.extend(chunks)
                progress.advance(task)

        console.print(f"[blue]Created {len(all_chunks)} chunks[/blue]")

        if not all_chunks:
            return 0

        # Generate embeddings
        console.print("[blue]Generating embeddings...[/blue]")
        texts = [chunk.content for chunk in all_chunks]
        embeddings = self.embedder.embed(texts, batch_size=16)

        # Store in ChromaDB
        console.print("[blue]Storing in database...[/blue]")

        # ChromaDB has a batch limit, so we chunk the inserts
        batch_size = 100
        for i in range(0, len(all_chunks), batch_size):
            batch_chunks = all_chunks[i : i + batch_size]
            batch_embeddings = embeddings[i : i + batch_size]

            self.collection.add(
                ids=[chunk.id for chunk in batch_chunks],
                embeddings=batch_embeddings.tolist(),
                documents=[chunk.content for chunk in batch_chunks],
                metadatas=[chunk.to_metadata() for chunk in batch_chunks],
            )

        console.print(f"[green]✓ Indexed {len(all_chunks)} chunks[/green]")
        return len(all_chunks)

    def query(
        self,
        query_text: str,
        n_results: int = 10,
        chunk_types: Optional[List[str]] = None,
    ) -> List[dict]:
        """
        Query the index for relevant code chunks.

        Args:
            query_text: Natural language query or code snippet
            n_results: Number of results to return
            chunk_types: Filter by chunk types (component, hook, route, etc.)

        Returns:
            List of results with content, metadata, and similarity score
        """
        # Build where filter if chunk_types specified
        where_filter = None
        if chunk_types:
            where_filter = {"chunk_type": {"$in": chunk_types}}

        # Query ChromaDB
        results = self.collection.query(
            query_embeddings=[self.embedder.embed_single(query_text).tolist()],
            n_results=n_results,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )

        # Format results
        formatted = []
        for i in range(len(results["ids"][0])):
            formatted.append(
                {
                    "id": results["ids"][0][i],
                    "content": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i],
                }
            )

        return formatted

    def _find_files(self, directory: Path):
        """Find all indexable files in directory."""
        for path in directory.rglob("*"):
            if path.is_file() and path.suffix in self.EXTENSIONS:
                # Skip excluded directories
                if any(skip in path.parts for skip in self.SKIP_DIRS):
                    continue
                yield path

    def get_stats(self) -> dict:
        """Get index statistics."""
        count = self.collection.count()
        return {
            "total_chunks": count,
            "collection_name": self.collection_name,
            "db_path": str(self.db_path),
        }
