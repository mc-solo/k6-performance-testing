// Shared helpers for the k6 scripts in this repo.
// Imported by load-test.js, stress-test.js, spike-test.js and soak-test.js.
// Only k6 modules are used here, so no npm install is needed.
import http from 'k6/http';
import { check } from 'k6';

// Public demo APIs only. No work or client system is tested here.
export const JSONPLACEHOLDER = __ENV.REST_BASE_URL || 'https://jsonplaceholder.typicode.com';
export const HTTPBIN = __ENV.HTTPBIN_BASE_URL || 'https://httpbin.org';

export const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

// A small, realistic POST body for /posts. JSONPlaceholder does not
// persist it, it just echoes it back with a fake id, which is fine
// for a load test: we are measuring the request, not creating data.
export function newPostPayload(userId = 1) {
  return JSON.stringify({
    title: 'k6 performance test post',
    body: 'Created by a k6 load test against a public demo API.',
    userId,
  });
}

// GET /posts/1 plus a body sanity check, used by more than one script.
export function getSinglePost() {
  const res = http.get(`${JSONPLACEHOLDER}/posts/1`);
  check(res, {
    'GET /posts/1 is 200': (r) => r.status === 200,
    'GET /posts/1 has id 1': (r) => r.json('id') === 1,
  });
  return res;
}

// GET /users plus a body sanity check.
export function getUsers() {
  const res = http.get(`${JSONPLACEHOLDER}/users`);
  check(res, {
    'GET /users is 200': (r) => r.status === 200,
    'GET /users returns a list': (r) => Array.isArray(r.json()) && r.json().length > 0,
  });
  return res;
}
