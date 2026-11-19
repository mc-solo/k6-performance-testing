# k6 Performance Testing

k6 load, stress, spike and soak tests against public demo APIs, by
**Wondwosen Asegid, SDET**. A small, honest practice repo: real scripts,
real thresholds, no invented results.

> No work or client system is tested here. The targets are public demo
> APIs only: https://jsonplaceholder.typicode.com and https://httpbin.org.
> The load is kept light on purpose, because these are shared demo APIs.

## What is in here

| Script | What it does |
| --- | --- |
| `load-test.js` | Steady load: 10 virtual users for 1 minute |
| `stress-test.js` | Ramps 10 → 25 → 50 → 100 VUs, then back to 0 (about 2 minutes) |
| `spike-test.js` | Sudden jump 5 → 50 VUs, hold, then back down (about 1 minute 20 seconds) |
| `soak-test.js` | Steady low load, 10 VUs for 5 minutes (shortened, see below) |
| `lib/common.js` | Shared helpers: base URLs, POST payload, `GET /posts/1` and `GET /users` checks. Imported by all 4 scripts. |

Endpoints used: `GET /posts`, `GET /posts/1`, `POST /posts`, `GET /users`
on JSONPlaceholder, and `GET /get`, `GET /status/200`, `GET /delay/1`
on httpbin.

## Thresholds (SLAs checked)

| Script | p95 response time | Failed requests | Checks passed |
| --- | --- | --- | --- |
| Load | < 800 ms | < 5% | > 95% |
| Stress | < 1500 ms | < 10% | > 90% |
| Spike | < 2000 ms | < 10% | > 90% |
| Soak | < 800 ms | < 5% | > 95% |

These are the thresholds in the scripts (`http_req_duration`,
`http_req_failed`, `checks`). They are targets to check against, not
results. The stress and spike limits are looser because response times
are expected to grow under heavy load; the point of those tests is to
see where that happens.

## Install k6

No `npm install` is needed for this repo. k6 runs the `.js` files
directly.

- **Linux (Debian / Ubuntu):**
  ```bash
  sudo gpg -k
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update
  sudo apt-get install k6
  ```
- **macOS:** `brew install k6`
- **Windows:** `choco install k6` or `winget install k6`

Check it worked:

```bash
k6 --version
```

## How to run

From this folder:

```bash
k6 run load-test.js
k6 run stress-test.js
k6 run spike-test.js
k6 run soak-test.js
```

Short smoke run of any script (overrides the VUs and duration):

```bash
k6 run --vus 2 --duration 10s load-test.js
```

Save a summary to a file:

```bash
k6 run --summary-export results/load-summary.json load-test.js
```

The `results/` folder is git-ignored, so run outputs stay local.

You can point the scripts at a different base URL without editing them:

```bash
REST_BASE_URL=https://jsonplaceholder.typicode.com k6 run load-test.js
```

## Soak test note

A full soak test normally runs for 1 hour or more. The soak script here
runs for 5 minutes at 10 VUs, so it is practical to run locally. To run
a real soak, change `duration` in `soak-test.js` to `'1h'` (or longer)
and run it when the target can be left alone.

## Verification

- k6 was **not installed** on the machine where this scaffold was built
  (2026-11-18), so no script has been run yet and no results are claimed.
- The scripts were syntax-reviewed by hand instead: imports, options,
  checks and thresholds were checked against the k6 docs and against
  the working k6 scripts in `api-testing-suite/k6/`.
- Run `k6 run --vus 2 --duration 10s load-test.js` after installing k6
  and record the real result here before claiming anything on a CV.
