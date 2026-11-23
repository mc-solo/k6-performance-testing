// k6 breakpoint test against public demo APIs.
// Ramps VUs up in steps (5 -> 200) to find the point where the API
// starts failing or slows past the threshold, then ramps back down.
// The step where errors or p95 jump is the breaking point: that is
// the finding, not a broken script.
// Stages and thresholds live in config/, not here: see
// config/scenarios.js and config/thresholds.js. Probe values live in
// test-data/breakpoint.json.
// Kept to 200 VUs max on purpose: these are shared public demo APIs,
// not a load target owned by this project.
// Run: k6 run scripts/breakpoint-test.js
// Or: ./scripts/run-breakpoint.sh  (saves summary + HTML report)
// Short smoke run: k6 run --vus 2 --duration 10s scripts/breakpoint-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { REST_BASE_URL, HTTPBIN_BASE_URL, newPostPayload, getSinglePost } from '../lib/common.js';
import { THRESHOLDS, CHECK_MAX_MS } from '../config/thresholds.js';
import { SCENARIOS, SLEEP_SECONDS } from '../config/scenarios.js';

const BREAKPOINT_DATA = JSON.parse(open('../test-data/breakpoint.json'));

export const options = {
  ...SCENARIOS.breakpoint,
  thresholds: THRESHOLDS.breakpoint,
};

export default function () {
  getSinglePost();

  const posts = http.get(`${REST_BASE_URL}/posts`);
  check(posts, {
    'GET /posts is 200': (r) => r.status === 200,
    'GET /posts under limit': (r) => r.timings.duration < CHECK_MAX_MS.breakpoint,
    'GET /posts returns a list': (r) => {
      const body = r.json();
      return Array.isArray(body) && body.length >= BREAKPOINT_DATA.minPostsInList;
    },
  });

  const created = http.post(`${REST_BASE_URL}/posts`, newPostPayload(1), { headers: { 'Content-Type': 'application/json' } });
  check(created, {
    'POST /posts is 201': (r) => r.status === 201,
  });

  // httpbin status endpoint, a cheap way to confirm the second host
  // is still answering while the main target is under load.
  const ok = http.get(`${HTTPBIN_BASE_URL}/status/200`);
  check(ok, {
    'GET httpbin /status/200 is 200': (r) => r.status === 200,
  });

  sleep(SLEEP_SECONDS.breakpoint);
}
