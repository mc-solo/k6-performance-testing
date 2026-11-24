#!/usr/bin/env node
/**
 * Compare two k6 run result JSON files and print a readable trend
 * comparison. No dependencies, plain Node.js.
 *
 *   node scripts/compare-results.js <baseline.json> <current.json> [scenario]
 *
 *   node scripts/compare-results.js test-data/compare-sample-a.json test-data/compare-sample-b.json load
 *
 * The two result files are k6 `--summary-export` JSON files, normally
 * from results/ (git-ignored). The scenario argument is optional and
 * defaults to `load`; it picks which entry of config/thresholds.js the
 * runs are checked against. No thresholds, URLs, timeouts or file
 * paths are hard-coded here: the result files come from the command
 * line and the thresholds are imported from ../config/thresholds.js.
 * (That config file is written for k6's ESM loader, so it is loaded
 * here with a dynamic import, which Node supports.)
 *
 * Exit codes: 0 = current run passes every threshold, 1 = current run
 * fails at least one threshold, or a file/threshold could not be read,
 * 2 = wrong usage.
 *
 * A metric counts as "unchanged" when its change is inside the small
 * comparison tolerance below. That tolerance is not a threshold: it
 * only keeps tiny run-to-run noise from being reported as a trend.
 * The SLA limits themselves always come from config/thresholds.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Comparison tolerance: changes smaller than this are reported as
// "unchanged" instead of improved/worsened. Durations use a relative
// tolerance, rates use percentage points. These are not SLA limits.
const DURATION_TOLERANCE_PCT = 1; // 1% of the baseline value
const RATE_TOLERANCE_PP = 0.05; // 0.05 percentage points

// Metrics compared in the main table. Anything else present in both
// files (for example a custom Trend metric) is compared in the
// "Other metrics" section below the main table.
const MAIN_DURATION_METRIC = 'http_req_duration';
const MAIN_FAILED_METRIC = 'http_req_failed';
const MAIN_CHECKS_METRIC = 'checks';

function usageError(message) {
  console.error(message);
  console.error('Usage: node scripts/compare-results.js <baseline.json> <current.json> [scenario]');
  console.error('Example: node scripts/compare-results.js test-data/compare-sample-a.json test-data/compare-sample-b.json load');
  process.exit(2);
}

function readSummary(file) {
  if (!fs.existsSync(file)) {
    console.error(`Result file not found: ${file}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Could not parse ${file} as JSON: ${err.message}`);
    process.exit(1);
  }
}

// Pull the number out of a threshold string such as 'p(95)<800',
// 'rate<0.05' or 'rate>0.95'. `pattern` matches the part before the
// number (for example /p\(95\)</ or /rate</).
function thresholdValue(entries, pattern) {
  if (!Array.isArray(entries)) {
    return null;
  }
  for (const entry of entries) {
    const match = String(entry).match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

function valuesOf(summary, name) {
  const metric = (summary.metrics || {})[name];
  return (metric && metric.values) || null;
}

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatMs(value) {
  return value === null ? 'n/a' : `${trimNumber(value)} ms`;
}

function formatPct(value) {
  return value === null ? 'n/a' : `${trimNumber(value)}%`;
}

// Round to two decimals and drop trailing zeros, so 620 stays 620
// and 98.5 stays 98.5 instead of printing 98.50.
function trimNumber(value) {
  return String(Math.round(value * 100) / 100);
}

function formatDelta(delta, unit) {
  if (delta === null) {
    return 'n/a';
  }
  const sign = delta > 0 ? '+' : '';
  return `${sign}${trimNumber(delta)} ${unit}`;
}

function formatDeltaPct(deltaPct) {
  if (deltaPct === null) {
    return 'n/a';
  }
  const sign = deltaPct > 0 ? '+' : '';
  return `${sign}${trimNumber(deltaPct)}%`;
}

// Lower is better for durations and error rates; higher is better
// for the checks pass rate. A change inside the tolerance counts as
// unchanged. Returns 'improved', 'worsened', 'unchanged' or 'n/a'.
function trend(baseline, current, lowerIsBetter, tolerance) {
  if (baseline === null || current === null) {
    return 'n/a';
  }
  const delta = current - baseline;
  if (Math.abs(delta) <= tolerance) {
    return 'unchanged';
  }
  const gotBetter = lowerIsBetter ? delta < 0 : delta > 0;
  return gotBetter ? 'improved' : 'worsened';
}

function trendLabel(trendResult) {
  return { improved: 'improved', worsened: 'worsened', unchanged: 'unchanged', 'n/a': 'n/a' }[trendResult] || 'n/a';
}

function pad(value, width) {
  return String(value).padEnd(width, ' ');
}

function printRow(columns, widths) {
  console.log(columns.map((column, i) => pad(column, widths[i])).join('  ').trimEnd());
}

async function main() {
  const baselineFile = process.argv[2];
  const currentFile = process.argv[3];
  const scenario = process.argv[4] || 'load';
  if (!baselineFile || !currentFile || process.argv.length > 5) {
    usageError('Compare needs two result files and an optional scenario name.');
  }

  const thresholdsPath = path.join(__dirname, '..', 'config', 'thresholds.js');
  let thresholdsModule;
  try {
    thresholdsModule = await import(pathToFileURL(thresholdsPath).href);
  } catch (err) {
    console.error(`Could not load thresholds from config/thresholds.js: ${err.message}`);
    process.exit(1);
  }
  const thresholds = thresholdsModule.THRESHOLDS || {};
  if (!thresholds[scenario]) {
    console.error(`Unknown scenario "${scenario}". Available scenarios: ${Object.keys(thresholds).join(', ')}`);
    process.exit(1);
  }
  const scenarioThresholds = thresholds[scenario];
  const p95Limit = thresholdValue(scenarioThresholds.http_req_duration, /p\(95\)<([\d.]+)/);
  const failedLimit = thresholdValue(scenarioThresholds.http_req_failed, /rate<([\d.]+)/);
  const checksLimit = thresholdValue(scenarioThresholds.checks, /rate>([\d.]+)/);
  if (p95Limit === null || failedLimit === null || checksLimit === null) {
    console.error(`Thresholds for scenario "${scenario}" in config/thresholds.js are not in the expected shape (p(95)<N, rate<N, rate>N).`);
    process.exit(1);
  }

  const baseline = readSummary(baselineFile);
  const current = readSummary(currentFile);

  const baselineDuration = valuesOf(baseline, MAIN_DURATION_METRIC);
  const currentDuration = valuesOf(current, MAIN_DURATION_METRIC);
  const baselineFailed = valuesOf(baseline, MAIN_FAILED_METRIC);
  const currentFailed = valuesOf(current, MAIN_FAILED_METRIC);
  const baselineChecks = valuesOf(baseline, MAIN_CHECKS_METRIC);
  const currentChecks = valuesOf(current, MAIN_CHECKS_METRIC);

  const baselineP95 = num(baselineDuration && baselineDuration['p(95)']);
  const currentP95 = num(currentDuration && currentDuration['p(95)']);
  const baselineAvg = num(baselineDuration && baselineDuration.avg);
  const currentAvg = num(currentDuration && currentDuration.avg);
  const baselineMax = num(baselineDuration && baselineDuration.max);
  const currentMax = num(currentDuration && currentDuration.max);
  // k6 stores failed/checks rates as 0-1 fractions; the table shows %.
  const baselineFailedPct = num(baselineFailed && baselineFailed.rate) === null ? null : baselineFailed.rate * 100;
  const currentFailedPct = num(currentFailed && currentFailed.rate) === null ? null : currentFailed.rate * 100;
  const baselineChecksPct = num(baselineChecks && baselineChecks.rate) === null ? null : baselineChecks.rate * 100;
  const currentChecksPct = num(currentChecks && currentChecks.rate) === null ? null : currentChecks.rate * 100;

  const rows = [
    {
      metric: 'p95 response time',
      baseline: formatMs(baselineP95),
      current: formatMs(currentP95),
      delta: formatDelta(currentP95 === null || baselineP95 === null ? null : currentP95 - baselineP95, 'ms'),
      deltaPct: formatDeltaPct(baselineP95 === null || currentP95 === null || baselineP95 === 0 ? null : ((currentP95 - baselineP95) / baselineP95) * 100),
      trend: trend(baselineP95, currentP95, true, baselineP95 === null ? 0 : (baselineP95 * DURATION_TOLERANCE_PCT) / 100),
      limit: `p95 < ${trimNumber(p95Limit)} ms`,
    },
    {
      metric: 'avg response time',
      baseline: formatMs(baselineAvg),
      current: formatMs(currentAvg),
      delta: formatDelta(currentAvg === null || baselineAvg === null ? null : currentAvg - baselineAvg, 'ms'),
      deltaPct: formatDeltaPct(baselineAvg === null || currentAvg === null || baselineAvg === 0 ? null : ((currentAvg - baselineAvg) / baselineAvg) * 100),
      trend: trend(baselineAvg, currentAvg, true, baselineAvg === null ? 0 : (baselineAvg * DURATION_TOLERANCE_PCT) / 100),
      limit: `p95 < ${trimNumber(p95Limit)} ms`,
    },
    {
      metric: 'max response time',
      baseline: formatMs(baselineMax),
      current: formatMs(currentMax),
      delta: formatDelta(currentMax === null || baselineMax === null ? null : currentMax - baselineMax, 'ms'),
      deltaPct: formatDeltaPct(baselineMax === null || currentMax === null || baselineMax === 0 ? null : ((currentMax - baselineMax) / baselineMax) * 100),
      trend: trend(baselineMax, currentMax, true, baselineMax === null ? 0 : (baselineMax * DURATION_TOLERANCE_PCT) / 100),
      limit: `p95 < ${trimNumber(p95Limit)} ms`,
    },
    {
      metric: 'error rate',
      baseline: formatPct(baselineFailedPct),
      current: formatPct(currentFailedPct),
      delta: formatDelta(currentFailedPct === null || baselineFailedPct === null ? null : currentFailedPct - baselineFailedPct, 'pp'),
      deltaPct: formatDeltaPct(baselineFailedPct === null || currentFailedPct === null || baselineFailedPct === 0 ? null : ((currentFailedPct - baselineFailedPct) / baselineFailedPct) * 100),
      trend: trend(baselineFailedPct, currentFailedPct, true, RATE_TOLERANCE_PP),
      limit: `failed < ${trimNumber(failedLimit * 100)}%`,
    },
    {
      metric: 'checks pass rate',
      baseline: formatPct(baselineChecksPct),
      current: formatPct(currentChecksPct),
      delta: formatDelta(currentChecksPct === null || baselineChecksPct === null ? null : currentChecksPct - baselineChecksPct, 'pp'),
      deltaPct: formatDeltaPct(baselineChecksPct === null || currentChecksPct === null || baselineChecksPct === 0 ? null : ((currentChecksPct - baselineChecksPct) / baselineChecksPct) * 100),
      trend: trend(baselineChecksPct, currentChecksPct, false, RATE_TOLERANCE_PP),
      limit: `checks > ${trimNumber(checksLimit * 100)}%`,
    },
  ];

  console.log('k6 results trend comparison');
  console.log(`Baseline: ${path.basename(baselineFile)}`);
  console.log(`Current:  ${path.basename(currentFile)}`);
  console.log(`Scenario: ${scenario} (thresholds from config/thresholds.js)`);
  console.log('');

  const widths = [20, 14, 14, 14, 10, 10];
  printRow(['Metric', 'Baseline', 'Current', 'Change', 'Change %', 'Trend'], widths);
  printRow(['------', '--------', '-------', '------', '--------', '-----'], widths);
  for (const row of rows) {
    printRow([row.metric, row.baseline, row.current, row.delta, row.deltaPct, trendLabel(row.trend)], widths);
  }
  console.log('');
  console.log('Thresholds (from config/thresholds.js, scenario '
    + `${scenario}): p95 < ${trimNumber(p95Limit)} ms, failed rate < ${trimNumber(failedLimit * 100)}%, checks > ${trimNumber(checksLimit * 100)}%.`);
  console.log('Lower is better for response times and error rate; higher is better for checks pass rate.');
  console.log(`"unchanged" means the change is within the comparison tolerance (${DURATION_TOLERANCE_PCT}% for durations, ${RATE_TOLERANCE_PP} pp for rates).`);
  console.log('');

  // Threshold verdict per run: PASS/FAIL is judged on the run's own
  // value against the scenario limits, not on the trend.
  function verdict(label, p95, failedPct, checksPct) {
    const p95Pass = p95 !== null && p95 < p95Limit;
    const failedPass = failedPct !== null && failedPct < failedLimit * 100;
    const checksPass = checksPct !== null && checksPct > checksLimit * 100;
    const parts = [
      `p95 ${formatMs(p95)} ${p95 === null ? '(no data)' : p95Pass ? 'PASS' : 'FAIL'}`,
      `failed ${formatPct(failedPct)} ${failedPct === null ? '(no data)' : failedPass ? 'PASS' : 'FAIL'}`,
      `checks ${formatPct(checksPct)} ${checksPct === null ? '(no data)' : checksPass ? 'PASS' : 'FAIL'}`,
    ];
    const allPass = p95Pass && failedPass && checksPass;
    console.log(`${label}: ${parts.join(', ')}`);
    return allPass;
  }
  const baselinePass = verdict('Baseline', baselineP95, baselineFailedPct, baselineChecksPct);
  const currentPass = verdict('Current ', currentP95, currentFailedPct, currentChecksPct);
  console.log('');

  // Any other metric present in both files, for example a custom
  // Trend metric a script added with `new Trend(...)`. Only Trend
  // metrics (avg / p95 / max) and true Rate metrics (rate between 0
  // and 1, such as a custom error rate) are compared. Counters and
  // gauges such as iterations or data_received are skipped: their
  // `rate` is a per-second throughput, not a 0-1 fraction, and a
  // count difference is expected between runs of different lengths.
  const mainMetrics = [MAIN_DURATION_METRIC, MAIN_FAILED_METRIC, MAIN_CHECKS_METRIC];
  function isComparableOther(summary, name) {
    const metric = (summary.metrics || {})[name];
    if (!metric || !metric.values) {
      return false;
    }
    if (metric.type === 'trend') {
      return num(metric.values.avg) !== null || num(metric.values['p(95)']) !== null;
    }
    if (metric.type === 'rate') {
      const rate = num(metric.values.rate);
      return rate !== null && rate >= 0 && rate <= 1;
    }
    return false;
  }
  const otherNames = Object.keys((baseline.metrics || {}))
    .filter((name) => Object.prototype.hasOwnProperty.call(current.metrics || {}, name))
    .filter((name) => !mainMetrics.includes(name))
    .filter((name) => isComparableOther(baseline, name) && isComparableOther(current, name))
    .sort();
  if (otherNames.length > 0) {
    console.log('Other metrics (present in both runs, including any custom metrics):');
    for (const name of otherNames) {
      const a = valuesOf(baseline, name);
      const b = valuesOf(current, name);
      const metricType = ((baseline.metrics || {})[name] || {}).type;
      const parts = [];
      if (metricType === 'trend') {
        if (num(a.avg) !== null && num(b.avg) !== null) {
          parts.push(`avg ${formatMs(a.avg)} -> ${formatMs(b.avg)} (${trendLabel(trend(a.avg, b.avg, true, (a.avg * DURATION_TOLERANCE_PCT) / 100))})`);
        }
        if (num(a['p(95)']) !== null && num(b['p(95)']) !== null) {
          parts.push(`p95 ${formatMs(a['p(95)'])} -> ${formatMs(b['p(95)'])} (${trendLabel(trend(a['p(95)'], b['p(95)'], true, (a['p(95)'] * DURATION_TOLERANCE_PCT) / 100))})`);
        }
        if (num(a.max) !== null && num(b.max) !== null) {
          parts.push(`max ${formatMs(a.max)} -> ${formatMs(b.max)} (${trendLabel(trend(a.max, b.max, true, (a.max * DURATION_TOLERANCE_PCT) / 100))})`);
        }
      }
      if (metricType === 'rate' && num(a.rate) !== null && num(b.rate) !== null) {
        parts.push(`rate ${formatPct(a.rate * 100)} -> ${formatPct(b.rate * 100)} (${trendLabel(trend(a.rate, b.rate, true, RATE_TOLERANCE_PP / 100))})`);
      }
      console.log(`  ${name}: ${parts.join(', ')}`);
    }
    console.log('');
  }

  const improved = rows.filter((row) => row.trend === 'improved').length;
  const worsened = rows.filter((row) => row.trend === 'worsened').length;
  const unchanged = rows.filter((row) => row.trend === 'unchanged').length;
  console.log(`Summary: ${improved} improved, ${worsened} worsened, ${unchanged} unchanged (of ${rows.length} main metrics).`);
  if (!baselinePass || !currentPass) {
    console.log('Note: at least one run fails a threshold above; check the PASS/FAIL lines, not just the trend.');
  }
  if (!currentPass) {
    console.log('Current run FAILS at least one threshold for this scenario.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`compare-results failed: ${err.message}`);
  process.exit(1);
});
