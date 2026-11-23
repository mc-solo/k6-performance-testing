#!/usr/bin/env bash
# Run the k6 breakpoint test and save results + an HTML report.
#
# Outputs (results/ is git-ignored):
#   results/breakpoint-summary.json  k6 summary export (metrics + checks)
#   results/breakpoint-results.json  raw per-request output
#   results/breakpoint-report.html   HTML report built from the summary
#
# Usage: ./scripts/run-breakpoint.sh
# Smoke run: k6 run --vus 2 --duration 10s scripts/breakpoint-test.js
set -e
cd "$(dirname "$0")/.."
mkdir -p results
k6 run \
  --summary-export results/breakpoint-summary.json \
  --out json=results/breakpoint-results.json \
  scripts/breakpoint-test.js
node scripts/breakpoint-report.js results/breakpoint-summary.json results/breakpoint-report.html
echo "Summary: results/breakpoint-summary.json"
echo "Report:  results/breakpoint-report.html"
