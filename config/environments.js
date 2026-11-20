// Environments: base URLs for the public demo APIs used by every test.
//
// Only this file holds base URLs. No script or helper may hard-code one.
// Override without editing code (env vars win over the table below):
//   K6_ENV=prod k6 run scripts/load-test.js
//   REST_BASE_URL=https://example.com HTTPBIN_BASE_URL=https://example.com k6 run scripts/load-test.js
//
// `dev` and `prod` point at the same targets on purpose: this is a
// practice repo with no real production system. The targets are public
// demo APIs only, never a work or client system. If a real target is
// ever added, put its URL here, not in a script.
export const ENVIRONMENTS = {
  dev: {
    restBaseUrl: 'https://jsonplaceholder.typicode.com',
    httpbinBaseUrl: 'https://httpbin.org',
  },
  prod: {
    restBaseUrl: 'https://jsonplaceholder.typicode.com',
    httpbinBaseUrl: 'https://httpbin.org',
  },
};

export const ENV_NAME = __ENV.K6_ENV || 'dev';
const selected = ENVIRONMENTS[ENV_NAME] || ENVIRONMENTS.dev;

export const REST_BASE_URL = __ENV.REST_BASE_URL || selected.restBaseUrl;
export const HTTPBIN_BASE_URL = __ENV.HTTPBIN_BASE_URL || selected.httpbinBaseUrl;
