# Production solver release gate

Run the benchmark on the minimum supported computer (4 physical cores / 8 GB RAM)
with representative anonymized 30-class school inputs:

```bash
python benchmarks/run_production_benchmark.py fixtures/school-*.json \
  --runs 5 --reference-results benchmarks/reference-quality.json \
  --output benchmarks/latest-report.json
```

The command fails unless at least 95% of runs produce a valid timetable within
10 minutes. When 60-minute reference quality scores are supplied, it also fails
unless at least 90% of runs are within 10% of their reference score.

Decomposition must remain disabled until this gate passes on datasets whose
resource-conflict graph has more than one component and merged outputs pass all
global timetable invariants. This prevents a locally valid split from creating
teacher or room conflicts after merge.
