# Architecture

## Folder tree

```text
k6-performance-testing/
├── .env.example            # Safe-default env vars (k6 reads them from the shell, not from .env)
├── .gitignore              # results/, reports/, .env, node_modules/
├── ARCHITECTURE.md         # This file
├── README.md               # Overview, run commands, honest status
├── config/
│   ├── environments.js     # Base URLs per environment (dev/prod), env-var overrides
│   ├── scenarios.js        # VUs, durations, ramp stages, sleeps per scenario
│   └── thresholds.js       # Thresholds (SLAs) and per-check time limits per scenario
├── docs/
│   ├── SETUP.md            # Install k6, env vars, run commands
│   └── TESTING.md          # What is tested, thresholds, how to read reports
├── lib/
│   └── common.js           # Shared helpers: request helpers, POST payload builder
├── results/                # k6 run outputs (git-ignored, stays local)
├── scripts/
│   ├── load-test.js        # Steady load
│   ├── stress-test.js      # Ramped stress
│   ├── spike-test.js       # Sudden spike
│   └── soak-test.js        # Steady low load, longer time
└── test-data/
    ├── expected.json       # Expected values checks assert against (posts count, post id)
    └── new-post.json       # POST /posts request payload template
```

## Why each folder exists

| Folder | Why it exists |
| --- | --- |
| `config/` | Every tunable number lives in one place. Changing VUs, a threshold or a base URL means editing config, never test logic. Nothing in `scripts/` or `lib/` may hard-code a URL, VU count, duration, threshold or timeout. |
| `test-data/` | Request payloads and expected values as data, not code. Editing a payload or an expected count does not touch a script, and the same payload can be reused by any script. |
| `scripts/` | The four test scenarios, and nothing else. Each script is thin: it imports its load shape and thresholds from `config/`, its helpers from `lib/`, and asserts against `test-data/`. |
| `lib/` | Code shared by more than one script: the `GET /posts/1` and `GET /users` checks, the POST payload builder, the JSON headers. A helper used by only one script belongs in that script, not here. |
| `docs/` | How-to documentation kept out of the README so the README stays a short overview: setup in `SETUP.md`, what is tested and how to read a report in `TESTING.md`. |
| `results/` | Local-only output of `k6 run --summary-export`. Git-ignored; run outputs are not part of the repo. |

## Data flow

```text
.env / shell env vars ──> config/environments.js ──> REST_BASE_URL, HTTPBIN_BASE_URL
                              (K6_ENV, REST_BASE_URL, HTTPBIN_BASE_URL)
config/scenarios.js ────> options (vus / duration / stages) + sleep seconds
config/thresholds.js ───> options.thresholds + CHECK_MAX_MS per check
test-data/*.json ───────> lib/common.js (payload template, expected values)
lib/common.js ──────────> scripts/*.js (getSinglePost, getUsers, newPostPayload, EXPECTED)
scripts/*.js ───────────> k6 run ──> terminal summary + results/*.json
```

1. `config/environments.js` resolves the base URLs: explicit env vars
   win, otherwise the table for `K6_ENV` (`dev` by default). Both
   environments currently point at the same public demo APIs, because
   this practice repo has no real production target.
2. `config/scenarios.js` supplies the load shape (`vus`/`duration` or
   `stages`) and the pause between iterations. `config/thresholds.js`
   supplies the SLA thresholds and the per-check time limit, which
   mirrors the p(95) threshold of the same scenario.
3. `lib/common.js` loads the payload template and expected values from
   `test-data/*.json` with k6's `open()` and exposes the shared request
   helpers. It imports the base URLs from `config/`, so it holds no
   URLs of its own.
4. Each script in `scripts/` spreads its scenario into `options`,
   attaches its thresholds, then runs its requests and `check()` calls
   against the imported values. A script never contains a literal URL,
   VU count, duration, threshold, sleep or expected value.

## How config, test-data and scripts connect

- A script needs a base URL: it imports `REST_BASE_URL` /
  `HTTPBIN_BASE_URL` from `lib/common.js`, which re-exports them from
  `config/environments.js`.
- A script needs its load shape: `...SCENARIOS.load` (or `stress` /
  `spike` / `soak`) from `config/scenarios.js`, plus
  `thresholds: THRESHOLDS.load` from `config/thresholds.js`.
- A script needs a time limit inside a `check()`: `CHECK_MAX_MS.<scenario>`
  from `config/thresholds.js`.
- A script needs a request body: `newPostPayload(userId)` from
  `lib/common.js`, which builds it from `test-data/new-post.json`.
- A script needs an expected value: `EXPECTED.postsCount` /
  `EXPECTED.singlePostId` from `lib/common.js`, which loads
  `test-data/expected.json`.

## How to add a new test

1. If it needs a new load shape, add it to `SCENARIOS` and
   `SLEEP_SECONDS` in `config/scenarios.js`; if it needs new limits,
   add them to `THRESHOLDS` and `CHECK_MAX_MS` in
   `config/thresholds.js`. Do not put numbers in the script.
2. If it needs a new payload or expected value, add a JSON file under
   `test-data/` (and a loader in `lib/common.js` if more than one
   script will use it).
3. If a request pattern is shared with another script, put the helper
   in `lib/common.js`; otherwise keep it in the new script.
4. Create `scripts/<name>-test.js`: import from `../config/` and
   `../lib/common.js`, set `options` from the config entries, write the
   `export default function ()` with `check()` calls that use
   `CHECK_MAX_MS` and `EXPECTED`, never literals.
5. Add the run command to `README.md` and a row to the table in
   `docs/TESTING.md`.
6. Smoke-test it before a full run:
   `k6 run --vus 2 --duration 10s scripts/<name>-test.js`.
