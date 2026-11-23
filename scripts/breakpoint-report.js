#!/usr/bin/env node
/**
 * Build a small HTML report from a k6 --summary-export JSON file.
 * No dependencies, plain Node.js.
 *
 *   node scripts/breakpoint-report.js results/breakpoint-summary.json results/breakpoint-report.html
 *
 * Reads the metrics the thresholds check (p95 duration, failed rate,
 * checks rate) plus the per-check breakdown, and writes a single
 * self-contained HTML file. Run outputs stay in results/ (git-ignored).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
  console.error('Usage: node scripts/breakpoint-report.js <summary.json> <report.html>');
  process.exit(2);
}
if (!fs.existsSync(input)) {
  console.error(`Summary file not found: ${input}`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(input, 'utf8'));
const metrics = summary.metrics || {};

function metric(name) {
  return metrics[name] || {};
}
function p95(name) {
  const values = metric(name).values || {};
  return values['p(95)'] !== undefined ? values['p(95)'] : 'n/a';
}
function rate(name) {
  const values = metric(name).values || {};
  return values.rate !== undefined ? (values.rate * 100).toFixed(2) + '%' : 'n/a';
}

const checks = (summary.root_group && summary.root_group.checks) || [];
const checkRows = checks
  .map((c) => `<tr><td>${escapeHtml(c.name || '')}</td><td>${c.passes || 0}</td><td>${c.fails || 0}</td></tr>`)
  .join('\n');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>k6 breakpoint report</title>
<style>body{font-family:sans-serif;max-width:800px;margin:2em auto;padding:0 1em}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#eee}</style>
</head>
<body>
<h1>k6 breakpoint report</h1>
<p>Generated from <code>${escapeHtml(path.basename(input))}</code>. Thresholds live in <code>config/thresholds.js</code>; the breaking point is the VU level where p95 or the failed rate first crosses its limit.</p>
<table>
<tr><th>Metric</th><th>Value</th></tr>
<tr><td>http_req_duration p(95)</td><td>${p95('http_req_duration')} ms (limit 3000 ms)</td></tr>
<tr><td>http_req_failed rate</td><td>${rate('http_req_failed')} (limit 15%)</td></tr>
<tr><td>checks passed rate</td><td>${rate('checks')} (limit 85%)</td></tr>
<tr><td>iterations</td><td>${(metric('iterations').values || {}).count || 'n/a'}</td></tr>
</table>
<h2>Checks</h2>
<table>
<tr><th>Check</th><th>Passes</th><th>Fails</th></tr>
${checkRows || '<tr><td colspan="3">No check data in summary file.</td></tr>'}
</table>
</body>
</html>
`;

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, html);
console.log(`HTML report written to ${output}`);
