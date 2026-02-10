// src/utils/warmup.js

import config from "../config";

let didWarmup = false;

/**
 * Wake up backend (Render cold start)
 * Runs only once per browser session
 */
export function warmupBackend() {
  if (didWarmup) return;
  didWarmup = true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  fetch(`${config.apiBaseUrl}/api/health`, {
    method: "GET",
    cache: "no-store",
    signal: controller.signal,
  })
    .catch(() => {
      // שקט – זה רק warmup
    })
    .finally(() => {
      clearTimeout(timeout);
    });
}
