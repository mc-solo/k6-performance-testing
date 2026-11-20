// Shared helpers for the k6 scripts in scripts/.
// Imported by load-test.js, stress-test.js, spike-test.js and soak-test.js.
// Only k6 modules are used here, so no npm install is needed.
//
// This file holds no hard-coded URLs, payloads or expected values:
// base URLs come from ../config/environments.js and the request payload
// and expected values come from ../test-data/*.json (loaded with k6's
// open(), which resolves relative to this file's folder and to the
// scripts/ folder alike, since both sit one level below the repo root).
import http from 'k6/http';
import { check } from 'k6';
import { REST_BASE_URL, HTTPBIN_BASE_URL } from '../config/environments.js';

export { REST_BASE_URL, HTTPBIN_BASE_URL };

export const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

// A small, realistic POST body for /posts, from test-data/new-post.json.
// JSONPlaceholder does not persist it, it just echoes it back with a
// fake id, which is fine for a load test: we are measuring the request,
// not creating data.
const NEW_POST_TEMPLATE = JSON.parse(open('../test-data/new-post.json'));

export function newPostPayload(userId = NEW_POST_TEMPLATE.userId) {
  return JSON.stringify({ ...NEW_POST_TEMPLATE, userId });
}

// Expected values the checks assert against, from test-data/expected.json.
export const EXPECTED = JSON.parse(open('../test-data/expected.json'));

// GET /posts/1 plus a body sanity check, used by more than one script.
export function getSinglePost() {
  const res = http.get(`${REST_BASE_URL}/posts/1`);
  check(res, {
    'GET /posts/1 is 200': (r) => r.status === 200,
    'GET /posts/1 has expected id': (r) => r.json('id') === EXPECTED.singlePostId,
  });
  return res;
}

// GET /users plus a body sanity check.
export function getUsers() {
  const res = http.get(`${REST_BASE_URL}/users`);
  check(res, {
    'GET /users is 200': (r) => r.status === 200,
    'GET /users returns a list': (r) => Array.isArray(r.json()) && r.json().length > 0,
  });
  return res;
}
