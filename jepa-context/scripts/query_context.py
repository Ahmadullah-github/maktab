#!/usr/bin/env python3
"""
Query the codebase index and output context for AI chat.

Usage:
    python scripts/query_context.py "your query here"
    python scripts/query_context.py "create a new teacher form" --type component
    python scripts/query_context.py "useTeachers hook" -n 5 --copy
    python scripts/query_context.py "solver constraints" --package solver
    python scripts/query_context.py "API routes" --package api,web
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import click
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

from indexer.index import CodebaseIndex

console = Console()

COLLECTIONS = {
    "web": "maktab_web",
    "api": "maktab_api",
    "solver": "maktab_solver",
}


def format_as_markdown(results: list, query: str) -> str:
    """Format results as markdown for pasting into chat."""

    lines = [
        f"## Context for: {query}",
        "",
        f"Found {len(results)} relevant code sections:",
        "",
    ]

    for i, result in enumerate(results, 1):
        meta = result["metadata"]
        distance = result["distance"]
        relevance = max(0, 100 - (distance * 50))  # Convert distance to relevance %
        package = meta.get("package", "unknown")

        lines.extend(
            [
                f"### {i}. {meta['name']} ({meta['chunk_type']}) [{package}]",
                f"**File:** `{meta['file_path']}` (lines {meta['start_line']}-{meta['end_line']})",
                f"**Relevance:** {relevance:.0f}%",
                "",
                "```typescript",
                result["content"].strip(),
                "```",
                "",
            ]
        )

    return "\n".join(lines)


def format_for_steering(results: list, query: str) -> str:
    """Format results as a steering-compatible context block."""

    lines = [
        "<!-- AUTO-GENERATED CONTEXT -->",
        f"<!-- Query: {query} -->",
        "",
        "<relevant-code>",
    ]

    for result in results:
        meta = result["metadata"]
        package = meta.get("package", "unknown")
        lines.extend(
            [
                f"<file path=\"{meta['file_path']}\" type=\"{meta['chunk_type']}\" name=\"{meta['name']}\" package=\"{package}\">",
                result["content"].strip(),
                "</file>",
                "",
            ]
        )

    lines.append("</relevant-code>")

    return "\n".join(lines)


def format_for_llm(results: list, query: str) -> str:
    """Format results optimized for LLM consumption - compact, structured, token-efficient."""

    lines = [
        f'<context query="{query}" results="{len(results)}">',
    ]

    for result in results:
        meta = result["metadata"]
        package = meta.get("package", "unknown")
        # Compact format: path|type|name|package as attributes, code as content
        lines.extend(
            [
                f"<code path=\"{meta['file_path']}\" type=\"{meta['chunk_type']}\" name=\"{meta['name']}\" package=\"{package}\" lines=\"{meta['start_line']}-{meta['end_line']}\">",
                result["content"].strip(),
                "</code>",
            ]
        )

    lines.append("</context>")

    return "\n".join(lines)


@click.command()
@click.argument("query")
@click.option("-n", "--num-results", default=8, help="Number of results to return")
@click.option(
    "-t",
    "--type",
    "chunk_type",
    multiple=True,
    help="Filter by chunk type (component, hook, route, type, schema, util, api)",
)
@click.option(
    "-p",
    "--package",
    default="all",
    help="Package to search (web, api, solver, all, or comma-separated list)",
)
@click.option(
    "-f",
    "--format",
    "output_format",
    type=click.Choice(["markdown", "steering", "llm", "raw"]),
    default="markdown",
    help="Output format (llm = optimized for AI)",
)
@click.option(
    "--copy", "-c", is_flag=True, help="Copy output to clipboard (requires pyperclip)"
)
@click.option("--output", "-o", type=click.Path(), help="Write output to file")
def main(
    query: str,
    num_results: int,
    chunk_type: tuple,
    package: str,
    output_format: str,
    copy: bool,
    output: str,
):
    """Query the codebase for relevant context."""

    db_path = Path(__file__).parent.parent / "db"

    if not db_path.exists():
        console.print("[red]Error: Index not found. Run index_codebase.py first.[/red]")
        sys.exit(1)

    # Determine which packages to search
    if package == "all":
        packages_to_search = list(COLLECTIONS.keys())
    else:
        packages_to_search = [p.strip() for p in package.split(",")]
        # Validate package names
        invalid = [p for p in packages_to_search if p not in COLLECTIONS]
        if invalid:
            console.print(f"[red]Error: Invalid package(s): {', '.join(invalid)}[/red]")
            console.print(f"[dim]Valid packages: {', '.join(COLLECTIONS.keys())}[/dim]")
            sys.exit(1)

    # Query each package and combine results
    all_results = []
    chunk_types = list(chunk_type) if chunk_type else None

    for pkg in packages_to_search:
        collection = COLLECTIONS[pkg]
        index = CodebaseIndex(
            db_path=str(db_path),
            collection_name=collection,
        )

        results = index.query(query, n_results=num_results, chunk_types=chunk_types)

        # Add package info to metadata
        for result in results:
            result["metadata"]["package"] = pkg

        all_results.extend(results)

    if not all_results:
        console.print("[yellow]No results found.[/yellow]")
        sys.exit(0)

    # Sort by distance (relevance) and limit to num_results
    all_results.sort(key=lambda x: x["distance"])
    all_results = all_results[:num_results]

    # Format output
    if output_format == "markdown":
        formatted = format_as_markdown(all_results, query)
    elif output_format == "steering":
        formatted = format_for_steering(all_results, query)
    elif output_format == "llm":
        formatted = format_for_llm(all_results, query)
    else:  # raw
        formatted = str(all_results)

    # Output
    if output:
        Path(output).write_text(formatted)
        console.print(f"[green]Written to {output}[/green]")
    elif copy:
        try:
            import pyperclip

            pyperclip.copy(formatted)
            console.print("[green]Copied to clipboard![/green]")
            console.print(
                f"[dim]Found {len(all_results)} results across {len(packages_to_search)} package(s)[/dim]"
            )
        except ImportError:
            console.print("[yellow]pyperclip not installed. Printing instead:[/yellow]")
            console.print(formatted)
    else:
        # Print to console
        if output_format == "markdown":
            console.print(Markdown(formatted))
        else:
            console.print(formatted)


if __name__ == "__main__":
    main()
