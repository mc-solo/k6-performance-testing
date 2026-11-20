// k6 load test against public demo APIs.
// Steady, expected load. VUs, duration and thresholds live in config/,
// not here: see config/scenarios.js and config/thresholds.js.
// Run: k6 run scripts/load-test.js
// Short smoke run: k6 run --vus 2 --duration 10s scripts/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { REST_BASE_URL, HTTPBIN_BASE_URL, JSON_HEADERS, newPostPayload, getSinglePost, getUsers, EXPECTED } from '../lib/common.js';
import { THRESHOLDS, CHECK_MAX_MS } from '../config/thresholds.js';
import { SCENARIOS, SLEEP_SECONDS } from '../config/scenarios.js';

export const options = {
  ...SCENARIOS.load,
  thresholds: THRESHOLDS.load,
};

export default function () {
  // List all posts.
  const posts = http.get(`${REST_BASE_URL}/posts`);
  check(posts, {
    'GET /posts is 200': (r) => r.status === 200,
    'GET /posts returns expected count': (r) => r.json().length === EXPECTED.postsCount,
    'GET /posts under limit': (r) => r.timings.duration < CHECK_MAX_MS.load,
  });

  // Single post and users, via the shared helpers.
  getSinglePost();
  getUsers();

  // Create a post (JSONPlaceholder echoes it back, it is not persisted).
  const created = http.post(`${REST_BASE_URL}/posts`, newPostPayload(1), JSON_HEADERS);
  check(created, {
    'POST /posts is 201': (r) => r.status === 201,
    'POST /posts returns an id': (r) => r.json('id') !== undefined,
  });

  // A second, independent target, to check a different host in the same run.
  const echo = http.get(`${HTTPBIN_BASE_URL}/get`);
  check(echo, {
    'GET httpbin /get is 200': (r) => r.status === 200,
  });

  sleep(SLEEP_SECONDS.load);
}
