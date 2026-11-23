// Thresholds (SLAs) checked by each scenario, in one place.
//
// These are targets to check against, not results: no script in this
// repo has been run yet (see README.md). The stress and spike limits
// are looser because response times are expected to grow under heavy
// load; the point of those tests is to see where that happens.
export const THRESHOLDS = {
  load: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
  stress: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.10'],
    checks: ['rate>0.90'],
  },
  spike: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.10'],
    checks: ['rate>0.90'],
  },
  soak: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
  // Breakpoint limits are the loosest: the test is *meant* to push
  // past them. When a threshold fails, note the VU level at the time;
  // that is the finding, not a broken script.
  breakpoint: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.15'],
    checks: ['rate>0.85'],
  },
};

// Per-check response-time limits (ms) used inside check() calls.
// Each one mirrors the p(95) threshold of the same scenario, so a
// single slow request is flagged the same way the threshold flags
// the run as a whole. Scripts must use these, not literal numbers.
export const CHECK_MAX_MS = {
  load: 800,
  stress: 1500,
  spike: 2000,
  soak: 800,
  breakpoint: 3000,
};
