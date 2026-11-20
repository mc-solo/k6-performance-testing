# Setup

## What you need

- k6 only. No `npm install`, no dependencies: k6 runs the `.js` files
  directly. See [ARCHITECTURE.md](../ARCHITECTURE.md) for the layout.

## Install k6

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

## Environment variables

No setup beyond k6 is required. The defaults in
`config/environments.js` already point at the public demo APIs
(`https://jsonplaceholder.typicode.com` and `https://httpbin.org`).

k6 does **not** read `.env` files. Copy `.env.example` to `.env` for
reference if you like, then export the values in your shell or pass
them inline:

```bash
# Pick the environment table from config/environments.js (dev or prod).
K6_ENV=prod k6 run scripts/load-test.js

# Point the scripts at a different base URL without editing any file.
REST_BASE_URL=https://jsonplaceholder.typicode.com HTTPBIN_BASE_URL=https://httpbin.org k6 run scripts/load-test.js
```

| Variable | Default | What it does |
| --- | --- | --- |
| `K6_ENV` | `dev` | Which table in `config/environments.js` supplies the base URLs. |
| `REST_BASE_URL` | `https://jsonplaceholder.typicode.com` | Base URL of the main API under test. Overrides `K6_ENV`. |
| `HTTPBIN_BASE_URL` | `https://httpbin.org` | Base URL of the second demo host. Overrides `K6_ENV`. |

There are no secrets in this repo: the targets are public demo APIs,
so no API keys or credentials exist to configure. Never add one here;
if a target ever needs auth, add it as an env var and keep it out of
git (`.env` is git-ignored).

## Run each script

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

Save a summary to a file (`results/` is git-ignored, outputs stay local):

```bash
k6 run --summary-export results/load-summary.json scripts/load-test.js
```

## Changing the load

Do not edit the scripts. Tune in `config/` instead:

- VUs, durations, ramp stages: `config/scenarios.js`
- Thresholds: `config/thresholds.js`
- Base URLs: `config/environments.js` (or the env vars above)
- Request payloads and expected values: `test-data/*.json`
