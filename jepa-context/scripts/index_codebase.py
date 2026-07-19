#!/usr/bin/env python3
"""
Index the Maktab codebase (web, api, solver packages).

Usage:
    python scripts/index_codebase.py [--clear] [--package web|api|solver|all]
"""

import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import click
from rich.console import Console
from rich.table import Table

from indexer.index import CodebaseIndex

console = Console()

PACKAGES = {
    "web": {
        "path": "../packages/web/src",
        "collection": "maktab_web",
        "description": "React frontend",
    },
    "api": {
        "path": "../packages/api/src",
        "collection": "maktab_api",
        "description": "Express backend",
    },
    "solver": {
        "path": "../packages/solver",
        "collection": "maktab_solver",
        "description": "Python solver",
    },
}


def index_package(package_name: str, clear: bool, model: str) -> dict:
    """Index a single package and return stats."""
    pkg = PACKAGES[package_name]
    pkg_path = Path(__file__).parent.parent / pkg["path"]

    if not pkg_path.exists():
        console.print(f"[red]Error: Path not found: {pkg_path}[/red]")
        return None

    console.print(
        f"\n[bold cyan]Indexing {package_name}:[/bold cyan] {pkg['description']}"
    )
    console.print(f"[dim]Path: {pkg_path.resolve()}[/dim]")

    db_path = Path(__file__).parent.parent / "db"

    index = CodebaseIndex(
        db_path=str(db_path),
        collection_name=pkg["collection"],
        embedding_model=model,
    )

    count = index.index_directory(pkg_path, clear_existing=clear)
    stats = index.get_stats()

    console.print(f"[green]✓[/green] Indexed {stats['total_chunks']} chunks")

    return {
        "package": package_name,
        "description": pkg["description"],
        "chunks": stats["total_chunks"],
    }


@click.command()
@click.option(
    "--package",
    "-p",
    type=click.Choice(["web", "api", "solver", "all"], case_sensitive=False),
    default="all",
    help="Package to index (default: all)",
)
@click.option(
    "--clear", "-c", is_flag=True, help="Clear existing index before indexing"
)
@click.option(
    "--model", "-m", default="BAAI/bge-small-en-v1.5", help="Embedding model to use"
)
def main(package: str, clear: bool, model: str):
    """Index the Maktab codebase for semantic search."""

    console.print("[bold]Maktab Codebase Indexer[/bold]")
    console.print(f"[dim]Model: {model}[/dim]")

    if clear:
        console.print("[yellow]⚠ Clearing existing indexes[/yellow]")

    packages_to_index = list(PACKAGES.keys()) if package == "all" else [package]
    results = []

    for pkg_name in packages_to_index:
        result = index_package(pkg_name, clear, model)
        if result:
            results.append(result)

    # Summary table
    console.print("\n[bold green]Indexing Complete![/bold green]")
    table = Table(title="Summary")
    table.add_column("Package", style="cyan")
    table.add_column("Description", style="dim")
    table.add_column("Chunks", justify="right", style="green")

    total_chunks = 0
    for result in results:
        table.add_row(result["package"], result["description"], str(result["chunks"]))
        total_chunks += result["chunks"]

    table.add_row("", "", "", style="dim")
    table.add_row("[bold]Total[/bold]", "", f"[bold]{total_chunks}[/bold]")

    console.print(table)


if __name__ == "__main__":
    main()
