#!/usr/bin/env python3
"""Repeatable release gate for the 30-class feasibility and quality SLAs."""

from __future__ import annotations

import argparse
import json
import statistics
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List


def percentile_95(values: List[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(0.95 * len(ordered)))]


def run_fixture(solver_path: Path, fixture: Path, mode: str) -> Dict[str, Any]:
    payload = json.loads(fixture.read_text(encoding="utf-8"))
    payload.setdefault("config", {})["solverMode"] = mode
    started = time.monotonic()
    completed = subprocess.run(
        [sys.executable, str(solver_path)],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        capture_output=True,
        check=False,
    )
    elapsed = time.monotonic() - started
    try:
        response = json.loads(completed.stdout)
    except json.JSONDecodeError:
        response = {"outcome": "failed", "metadata": {}, "issues": []}
    metadata = response.get("metadata") or {}
    quality = metadata.get("qualityScore") or {}
    return {
        "fixture": fixture.name,
        "mode": mode,
        "elapsedSeconds": elapsed,
        "outcome": response.get("outcome", "failed"),
        "qualityScore": quality.get("overall"),
        "workers": metadata.get("workers"),
        "peakMemoryMb": metadata.get("peak_memory_mb"),
        "returnCode": completed.returncode,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("fixtures", nargs="+", type=Path)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--sla-seconds", type=float, default=600)
    parser.add_argument("--reference-results", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    solver_path = Path(__file__).resolve().parents[1] / "solver.py"
    references = (
        json.loads(args.reference_results.read_text(encoding="utf-8"))
        if args.reference_results
        else {}
    )
    results = [
        run_fixture(solver_path, fixture, "quick")
        for fixture in args.fixtures
        for _ in range(args.runs)
    ]
    valid = [row for row in results if row["outcome"] in {"success", "partial"}]
    within_sla = [row for row in valid if row["elapsedSeconds"] <= args.sla_seconds]
    feasibility_rate = len(within_sla) / max(1, len(results))

    comparable = []
    for row in valid:
        reference = references.get(row["fixture"])
        score = row["qualityScore"]
        if isinstance(reference, (int, float)) and isinstance(score, (int, float)):
            comparable.append(score >= reference * 0.9)
    quality_rate = sum(comparable) / len(comparable) if comparable else None

    report = {
        "policy": {
            "feasibilityTarget": 0.95,
            "feasibilitySlaSeconds": args.sla_seconds,
            "qualityTarget": 0.90,
            "qualityToleranceFromReference": 0.10,
        },
        "summary": {
            "runs": len(results),
            "feasibilityWithinSlaRate": feasibility_rate,
            "p95Seconds": percentile_95([row["elapsedSeconds"] for row in valid]),
            "medianSeconds": statistics.median(
                [row["elapsedSeconds"] for row in valid]
            )
            if valid
            else None,
            "qualityWithinToleranceRate": quality_rate,
        },
        "runs": results,
    }
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)

    feasibility_passed = feasibility_rate >= 0.95
    quality_passed = quality_rate is None or quality_rate >= 0.90
    return 0 if feasibility_passed and quality_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
