// k6 soak test against public demo APIs.
// Steady, low load for a longer time, to catch slow problems such as
// memory leaks or degrading response times that only show up over time.
//
// NOTE: this run is shortened to 5 minutes so it is practical to run
// locally. A full soak test is normally 1 hour or more at the same
// steady load. To run a real soak, change the duration in
// config/scenarios.js to SOAK_FULL_DURATION ('1h') and run it when the
// target can be left alone, for example overnight.
// VUs, duration and thresholds live in config/, not here.
// Run: k6 run scripts/soak-test.js
// Short smoke run: k6 run --vus 2 --duration 10s scripts/soak-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { REST_BASE_URL, HTTPBIN_BASE_URL, getSinglePost, getUsers } from '../lib/common.js';
import { THRESHOLDS, CHECK_MAX_MS } from '../config/thresholds.js';
import { SCENARIOS, SLEEP_SECONDS } from '../config/scenarios.js';

export const options = {
  ...SCENARIOS.soak,
  thresholds: THRESHOLDS.soak,
};

export default function () {
  getSinglePost();
  getUsers();

  const posts = http.get(`${REST_BASE_URL}/posts`);
  check(posts, {
    'GET /posts is 200': (r) => r.status === 200,
    'GET /posts under limit': (r) => r.timings.duration < CHECK_MAX_MS.soak,
  });

  const ok = http.get(`${HTTPBIN_BASE_URL}/status/200`);
  check(ok, {
    'GET httpbin /status/200 is 200': (r) => r.status === 200,
  });

  // A longer pause than the other scripts, so 10 VUs make a steady
  // low request rate instead of hammering the demo APIs for 5 minutes.
  sleep(SLEEP_SECONDS.soak);
}
