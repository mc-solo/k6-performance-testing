// k6 spike test against public demo APIs.
// A sudden jump from a few users to many, held briefly, then back down.
// This checks how the API handles a burst, for example a sudden rush
// of traffic, rather than a slow build-up.
// Stages and thresholds live in config/, not here: see
// config/scenarios.js and config/thresholds.js.
// Run: k6 run scripts/spike-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { HTTPBIN_BASE_URL, getSinglePost, getUsers } from '../lib/common.js';
import { THRESHOLDS, CHECK_MAX_MS } from '../config/thresholds.js';
import { SCENARIOS, SLEEP_SECONDS } from '../config/scenarios.js';

export const options = {
  ...SCENARIOS.spike,
  thresholds: THRESHOLDS.spike,
};

export default function () {
  getSinglePost();
  getUsers();

  // /delay/1 waits 1 second on the server before answering, so it is
  // a useful check that slow responses during a spike still complete.
  const delayed = http.get(`${HTTPBIN_BASE_URL}/delay/1`);
  check(delayed, {
    'GET httpbin /delay/1 is 200': (r) => r.status === 200,
    'GET httpbin /delay/1 under limit': (r) => r.timings.duration < CHECK_MAX_MS.spike,
  });

  const ok = http.get(`${HTTPBIN_BASE_URL}/status/200`);
  check(ok, {
    'GET httpbin /status/200 is 200': (r) => r.status === 200,
  });

  sleep(SLEEP_SECONDS.spike);
}
