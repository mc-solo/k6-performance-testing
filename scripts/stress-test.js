// k6 stress test against public demo APIs.
// Ramps up in stages to find where response time and errors start to grow.
// Stages and thresholds live in config/, not here: see
// config/scenarios.js and config/thresholds.js.
// Kept light on purpose: these are shared public demo APIs, not a load
// target owned by this project. Do not push the VU counts much higher
// against jsonplaceholder or httpbin.
// Run: k6 run scripts/stress-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { REST_BASE_URL, HTTPBIN_BASE_URL, JSON_HEADERS, newPostPayload, getSinglePost } from '../lib/common.js';
import { THRESHOLDS, CHECK_MAX_MS } from '../config/thresholds.js';
import { SCENARIOS, SLEEP_SECONDS } from '../config/scenarios.js';

export const options = {
  ...SCENARIOS.stress,
  thresholds: THRESHOLDS.stress,
};

export default function () {
  getSinglePost();

  const posts = http.get(`${REST_BASE_URL}/posts`);
  check(posts, {
    'GET /posts is 200': (r) => r.status === 200,
    'GET /posts under limit': (r) => r.timings.duration < CHECK_MAX_MS.stress,
  });

  const created = http.post(`${REST_BASE_URL}/posts`, newPostPayload(1), JSON_HEADERS);
  check(created, {
    'POST /posts is 201': (r) => r.status === 201,
  });

  // httpbin status endpoint, a cheap way to confirm the second host
  // is still answering while the main target is under stress.
  const ok = http.get(`${HTTPBIN_BASE_URL}/status/200`);
  check(ok, {
    'GET httpbin /status/200 is 200': (r) => r.status === 200,
  });

  sleep(SLEEP_SECONDS.stress);
}
