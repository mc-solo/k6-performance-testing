# Testing

## What is tested

All four scripts hit public demo APIs only: JSONPlaceholder
(`https://jsonplaceholder.typicode.com`) and httpbin
(`https://httpbin.org`). No work or client system is tested here, and
the load is kept light on purpose because these are shared demo APIs.

| Script | What it does |
| --- | --- |
| `scripts/load-test.js` | Steady load: 10 virtual users for 1 minute. |
| `scripts/stress-test.js` | Ramps 10 → 25 → 50 → 100 VUs, then back to 0 (about 2 minutes). Finds where response time and errors start to grow. |
| `scripts/spike-test.js` | Sudden jump 5 → 50 VUs, hold, then back down (about 1 minute 20 seconds). Checks how the API handles a burst. |
| `scripts/soak-test.js` | Steady low load, 10 VUs for 5 minutes. Catches slow problems (memory leaks, degrading response times) that only show up over time. Shortened from a real soak; see below. |
| `scripts/breakpoint-test.js` | Ramps 5 → 10 → 25 → 50 → 100 → 150 → 200 VUs, then back to 0 (about 4 minutes). Finds the breaking point: the VU level where errors or p95 first jump past the threshold. |

Endpoints used: `GET /posts`, `GET /posts/1`, `POST /posts`,
`GET /users` on JSONPlaceholder, and `GET /get`, `GET /status/200`,
`GET /delay/1` on httpbin. The `POST /posts` body comes from
`test-data/new-post.json`; JSONPlaceholder echoes it back with a fake
id and does not persist it, which is fine for a load test.

## Thresholds (SLAs checked)

These live in `config/thresholds.js` and are targets to check against,
not results. The stress and spike limits are looser because response
times are expected to grow under heavy load.

| Script | p95 response time | Failed requests | Checks passed |
| --- | --- | --- | --- |
| Load | < 800 ms | < 5% | > 95% |
| Stress | < 1500 ms | < 10% | > 90% |
| Spike | < 2000 ms | < 10% | > 90% |
| Soak | < 800 ms | < 5% | > 95% |
| Breakpoint | < 3000 ms | < 15% | > 85% |

## How to run

From the repo root (full install and env-var instructions are in
[SETUP.md](SETUP.md)):

```bash
k6 run scripts/load-test.js
k6 run scripts/stress-test.js
k6 run scripts/spike-test.js
k6 run scripts/soak-test.js
k6 run scripts/breakpoint-test.js
```

Breakpoint run with saved results and an HTML report:

```bash
./scripts/run-breakpoint.sh
```

That writes `results/breakpoint-summary.json`,
`results/breakpoint-results.json` and `results/breakpoint-report.html`
(`results/` is git-ignored). Open the HTML report to see p95, failed
rate, checks rate and the per-check breakdown; the breaking point is
the VU level where p95 or the failed rate first crosses its limit.
Watch the terminal during the run to see which stage that was, the
summary JSON alone does not record the VU level per stage.
```

Smoke run before a full run:

```bash
k6 run --vus 2 --duration 10s scripts/load-test.js
```

## How to read the reports

k6 prints a summary to the terminal at the end of every run. The
lines that matter:

- **`http_req_duration`** — response times. `p(95)` is the value the
  thresholds check: 95% of requests were faster than this. Compare it
  with the p95 limit in the table above.
- **`http_req_failed`** — share of failed requests. Compare with the
  failed-requests limit.
- **`checks`** — share of `check()` assertions that passed. A check
  failing tells you *which* assertion broke (for example
  `GET /posts is 200`), while a threshold failing tells you the run as
  a whole missed its SLA.
- **`✓` / `✗` next to each threshold** — `✓` means the threshold
  passed, `✗` means it failed. A failed threshold makes k6 exit with
  a non-zero code, so CI can treat it as a failed run.
- **`data_received` / `data_sent`** and **`iterations`** — how much
  traffic the run actually generated; useful to confirm the load shape
  (VUs and duration) did what you expected.

Save the summary for later instead of relying on terminal scrollback:

```bash
k6 run --summary-export results/load-summary.json scripts/load-test.js
```

`results/` is git-ignored. Open the JSON file to see the same metrics
(`metrics.http_req_duration.values['p(95)']`,
`metrics.http_req_failed.values.rate`,
`metrics.checks.values.rate`) plus a per-check breakdown under
`root_group.checks`.

### What a failure means

- **p95 over the limit, checks passing:** the API answers correctly
  but slowly under that load. Note the VU level where it crossed the
  limit (stress and spike runs show this per stage in the terminal
  output); that is the finding.
- **Checks failing:** an assertion broke, for example a status other
  than 200 or a body that does not match `test-data/expected.json`.
  Check whether the demo API changed before blaming the script.
- **Failed requests rising:** the target is erroring or refusing
  connections. Against shared demo APIs, back off: lower the VUs in
  `config/scenarios.js` and re-run.

## Soak test note

A full soak test normally runs for 1 hour or more. The soak script
here runs for 5 minutes at 10 VUs, so it is practical to run locally.
For a real soak, change `duration` in `config/scenarios.js`
(`SCENARIOS.soak`) to `SOAK_FULL_DURATION` (`'1h'`, or longer) and run
it when the target can be left alone, for example overnight.

## Current status: not run yet

k6 was **not installed** on the machine where this repo was built, so
no script has been run yet and no results are claimed anywhere in this
repo. The scripts were syntax-checked only. Run
`k6 run --vus 2 --duration 10s scripts/load-test.js` after installing
k6 and record the real result in the README before claiming anything
on a CV. The breakpoint script is in the same state: written and
syntax-checked only, never run, so no breaking point has been found
yet.
