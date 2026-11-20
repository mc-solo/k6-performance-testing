# k6 Performance Testing

k6 load, stress, spike and soak tests against public demo APIs, by
**Wondwosen Asegid, SDET**. A small, honest practice repo: real scripts,
real thresholds, no invented results.

> No work or client system is tested here. The targets are public demo
> APIs only: https://jsonplaceholder.typicode.com and https://httpbin.org.
> The load is kept light on purpose, because these are shared demo APIs.

## Folder tree

```text
k6-performance-testing/
├── config/          # Base URLs (environments.js), load shapes (scenarios.js), thresholds (thresholds.js)
├── test-data/       # Request payloads and expected values (JSON)
├── scripts/         # load-test.js, stress-test.js, spike-test.js, soak-test.js
├── lib/             # Shared helpers (common.js)
├── docs/            # SETUP.md, TESTING.md
├── results/         # k6 run outputs (git-ignored)
├── ARCHITECTURE.md  # Folder layout, data flow, how to add a new test
└── .env.example     # Safe-default env vars (no secrets)
```

No script hard-codes a base URL, VU count, duration, threshold,
timeout or expected value: those live in `config/` and `test-data/`
and are imported. See [ARCHITECTURE.md](ARCHITECTURE.md) for the data
flow and how to add a new test.

## What is in here

| Script | What it does |
| --- | --- |
| `scripts/load-test.js` | Steady load: 10 virtual users for 1 minute |
| `scripts/stress-test.js` | Ramps 10 → 25 → 50 → 100 VUs, then back to 0 (about 2 minutes) |
| `scripts/spike-test.js` | Sudden jump 5 → 50 VUs, hold, then back down (about 1 minute 20 seconds) |
| `scripts/soak-test.js` | Steady low load, 10 VUs for 5 minutes (shortened, see below) |
| `lib/common.js` | Shared helpers: `GET /posts/1` and `GET /users` checks, POST payload builder. Imports config and test-data. |

Endpoints used: `GET /posts`, `GET /posts/1`, `POST /posts`, `GET /users`
on JSONPlaceholder, and `GET /get`, `GET /status/200`, `GET /delay/1`
on httpbin.

## Thresholds (SLAs checked)

Defined in `config/thresholds.js`. They are targets to check against,
not results.

| Script | p95 response time | Failed requests | Checks passed |
| --- | --- | --- | --- |
| Load | < 800 ms | < 5% | > 95% |
| Stress | < 1500 ms | < 10% | > 90% |
| Spike | < 2000 ms | < 10% | > 90% |
| Soak | < 800 ms | < 5% | > 95% |

The stress and spike limits are looser because response times are
expected to grow under heavy load; the point of those tests is to see
where that happens.

## Setup

No `npm install` is needed: k6 runs the `.js` files directly. Install
k6 (Linux `apt`, macOS `brew install k6`, Windows `choco install k6`),
then check with `k6 --version`. Full instructions, including env vars
(`K6_ENV`, `REST_BASE_URL`, `HTTPBIN_BASE_URL`), are in
[docs/SETUP.md](docs/SETUP.md).

## How to run

From the repo root:

```bash
k6 run scripts/load-test.js
k6 run scripts/stress-test.js
k6 run scripts/spike-test.js
k6 run scripts/soak-test.js
```

Short smoke run of any script (overrides the VUs and duration):

```bash
k6 run --vus 2 --duration 10s scripts/load-test.js
```

Save a summary to a file:

```bash
k6 run --summary-export results/load-summary.json scripts/load-test.js
```

The `results/` folder is git-ignored, so run outputs stay local.

You can point the scripts at a different base URL without editing them:

```bash
REST_BASE_URL=https://jsonplaceholder.typicode.com k6 run scripts/load-test.js
```

## Soak test note

A full soak test normally runs for 1 hour or more. The soak script here
runs for 5 minutes at 10 VUs, so it is practical to run locally. To run
a real soak, change `duration` in `config/scenarios.js`
(`SCENARIOS.soak`) to `SOAK_FULL_DURATION` (`'1h'`, or longer) and run
it when the target can be left alone.

## Verification

- k6 was **not installed** on the machine where this repo was built,
  so no script has been run yet and no results are claimed. There are
  no test counts or pass rates to report.
- The scripts were syntax-checked only: `node --check` passes on
  `lib/common.js`, all three `config/*.js` files and all four
  `scripts/*.js` files, and both `test-data/*.json` files parse as
  valid JSON. (k6's own `__ENV`, `open()` and `k6/*` imports are
  runtime globals/modules, so a Node syntax check cannot execute them;
  it only proves the files parse.)
- Run `k6 run --vus 2 --duration 10s scripts/load-test.js` after
  installing k6 and record the real result here before claiming
  anything on a CV.
