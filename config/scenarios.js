// Load shapes: VUs, durations and ramp stages per scenario.
//
// Only this file holds VU counts, durations and stages. Scripts build
// their `options` from here, so tuning a scenario means editing this
// file, not the test logic. Keep the load light on purpose: the targets
// are shared public demo APIs, not a load target owned by this project.
export const SCENARIOS = {
  load: {
    vus: 10,
    duration: '1m',
  },
  stress: {
    stages: [
      { duration: '20s', target: 10 }, // warm up
      { duration: '30s', target: 25 }, // normal load
      { duration: '30s', target: 50 }, // stress
      { duration: '20s', target: 100 }, // peak stress, watch p95 and error rate here
      { duration: '20s', target: 0 }, // ramp down
    ],
  },
  spike: {
    stages: [
      { duration: '10s', target: 5 }, // baseline
      { duration: '10s', target: 50 }, // spike up, fast
      { duration: '30s', target: 50 }, // hold the spike
      { duration: '10s', target: 5 }, // spike down, fast
      { duration: '20s', target: 5 }, // recovery, watch p95 come back down
    ],
  },
  soak: {
    vus: 10,
    duration: '5m',
  },
};

// Full soak duration for a real run. The script runs shortened (5m)
// so it is practical locally; see docs/TESTING.md. Kept out of
// SCENARIOS so it never leaks into k6 `options` as an unknown key.
export const SOAK_FULL_DURATION = '1h';

// Pause (seconds) between iterations, per scenario. The soak pause is
// longer so 10 VUs make a steady low request rate instead of hammering
// the demo APIs for 5 minutes.
export const SLEEP_SECONDS = {
  load: 1,
  stress: 1,
  spike: 1,
  soak: 2,
};
